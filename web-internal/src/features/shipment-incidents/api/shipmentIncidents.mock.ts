import { z } from 'zod';
import { assignmentSchema, createIncidentSchema, filtersSchema, incidentSchema, publicIdSchema } from '../schemas/shipmentIncidents.schema.ts';
import { IncidentError } from '../utils/incidentErrors.ts';
import type { Incident, IncidentLookups, IncidentSession, IncidentService } from '../types/shipmentIncidents.types.ts';

export function assertAccess(session: IncidentSession, capability: keyof IncidentSession['capabilities']) {
  if (!session.authenticated) throw new IncidentError('401_UNAUTHORIZED', 'Vui lòng đăng nhập.');
  if (!session.capabilities.read || !session.capabilities[capability]) throw new IncidentError('403_FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.');
  if (!session.branchId || !['branch', 'post_office'].includes(session.scopeType) || !session.allowedBranchIds.includes(session.branchId)) throw new IncidentError('403_BRANCH_SCOPE', 'Chọn chi nhánh/bưu cục được cấp. Phạm vi vùng, toàn quốc và kho chờ xác nhận quan hệ dữ liệu.');
}
function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const details: Record<string, string[]> = {};
  for (const issue of result.error.issues) (details[String(issue.path[0] ?? 'root')] ??= []).push(issue.message);
  throw new IncidentError('422_VALIDATION_ERROR', 'Kiểm tra dữ liệu nhập.', details);
}
export function createIncidentMock(seed: Incident[], lookups: IncidentLookups): IncidentService {
  const rows = z.array(incidentSchema).parse(structuredClone(seed));
  const replay = new Map<string, { hash: string; result: Incident }>();
  let nextId = 1000;
  const success = <T>(data: T) => ({ success: true as const, message: 'Thao tác mô phỏng thành công', data: structuredClone(data), meta: { timestamp: new Date().toISOString() } });
  function scopedRow(session: IncidentSession, id: string) {
    assertAccess(session, 'read');
    parseInput(publicIdSchema, id);
    const row = rows.find(item => item.public_id === id && item.branch_id === session.branchId);
    if (!row) throw new IncidentError('404_NOT_FOUND', 'Không tìm thấy hồ sơ trong phạm vi hiện tại.');
    return row;
  }
  function mutate(session: IncidentSession, action: 'create' | 'assign' | 'handoff', id: string, input: unknown, key: string, execute: () => Incident) {
    assertAccess(session, action);
    if (!z.uuid({ version: 'v4' }).safeParse(key).success) throw new IncidentError('400_BAD_REQUEST', 'Khóa gửi không hợp lệ.');
    const cacheKey = `${session.key}:${key}`;
    const hash = JSON.stringify([action, id, input]);
    const cached = replay.get(cacheKey);
    if (cached) {
      if (cached.hash !== hash) throw new IncidentError('409_IDEMPOTENCY_DUPLICATE', 'Không dùng cùng khóa cho dữ liệu khác.');
      return success(cached.result);
    }
    const row = execute();
    replay.set(cacheKey, { hash, result: structuredClone(row) });
    return success(row);
  }
  function editable(session: IncidentSession, id: string, version: number) {
    const row = scopedRow(session, id);
    if (row.version !== version) throw new IncidentError('409_VERSION_CONFLICT', 'Dữ liệu vừa được người khác cập nhật. Tải lại hồ sơ trước khi lưu.');
    if (!['open', 'investigating'].includes(row.status)) throw new IncidentError('422_VALIDATION_ERROR', 'Hồ sơ này chỉ được xem.');
    return row;
  }
  return {
    async list(session, input) {
      assertAccess(session, 'read');
      const filters = parseInput(filtersSchema, input);
      const search = filters.search.trim().toLocaleLowerCase('vi');
      const filtered = rows.filter(row => row.branch_id === session.branchId &&
        (!filters.incident_type || row.incident_type === filters.incident_type) && (!filters.severity || row.severity === filters.severity) &&
        (!filters.status || row.status === filters.status) && (!filters.responsible_user_id || row.responsible_user_id === filters.responsible_user_id) &&
        (!search || row.incident_code.toLowerCase().includes(search) || lookups.shipments.some(s => s.branch_id === session.branchId && s.id === row.shipment_id && s.tracking_code.toLowerCase().includes(search))));
      return { ...success(filtered.slice((filters.page - 1) * filters.per_page, filters.page * filters.per_page)), meta: { timestamp: new Date().toISOString(), pagination: { page: filters.page, per_page: filters.per_page, total: filtered.length, total_pages: Math.ceil(filtered.length / filters.per_page) } } };
    },
    async detail(session, id) { return success(scopedRow(session, id)); },
    async options(session) {
      assertAccess(session, 'read');
      return success({ branches: lookups.branches.filter(b => b.id === session.branchId), shipments: lookups.shipments.filter(s => s.branch_id === session.branchId), staff: lookups.staff.filter(s => s.branch_id === session.branchId && s.eligible && s.user_type === 'staff') });
    },
    async create(session, input, key) {
      return mutate(session, 'create', '', input, key, () => {
        const data = parseInput(createIncidentSchema, input);
        if (!lookups.shipments.some(s => s.id === data.shipment_id && s.branch_id === session.branchId)) throw new IncidentError('422_VALIDATION_ERROR', 'Vận đơn ngoài phạm vi.', { shipment_id: ['Chọn vận đơn hợp lệ trong phạm vi.'] });
        if (!session.actorId) throw new IncidentError('403_FORBIDDEN', 'Chưa xác nhận người báo cáo.');
        const id = String(nextId++);
        const now = new Date().toISOString();
        const row = incidentSchema.parse({ ...data, id, public_id: `01KAX00000000000000000${id.padStart(4, '0')}`, incident_code: `INC-MOCK-${id}`, branch_id: session.branchId, reported_by: session.actorId, responsible_user_id: null, assigned_handler_id: null, status: 'open', resolution_note: null, resolved_at: null, version: 1, created_at: now, updated_at: now });
        rows.unshift(row); return row;
      });
    },
    async assign(session, id, input, key) {
      return mutate(session, 'assign', id, input, key, () => {
        const data = parseInput(assignmentSchema, input);
        const row = editable(session, id, data.version);
        if (data.responsible_user_id && !lookups.staff.some(s => s.id === data.responsible_user_id && s.branch_id === session.branchId && s.eligible && s.user_type === 'staff')) throw new IncidentError('422_VALIDATION_ERROR', 'Nhân viên không hợp lệ.', { responsible_user_id: ['Chọn nhân viên hợp lệ trong phạm vi.'] });
        Object.assign(row, { responsible_user_id: data.responsible_user_id, resolution_note: data.resolution_note || null, status: 'investigating', version: row.version + 1, updated_at: new Date().toISOString() });
        return row;
      });
    },
    async handoff(session, id, version, key) {
      return mutate(session, 'handoff', id, { version }, key, () => {
        parseInput(z.number().int().positive(), version);
        const row = editable(session, id, version);
        Object.assign(row, { status: 'compensation_requested', version: row.version + 1, updated_at: new Date().toISOString() });
        return row;
      });
    },
  };
}
