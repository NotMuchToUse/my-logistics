import { useEffect, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FIELD_CLASS, INCIDENT_TYPES, SEVERITIES, STATUSES, SEVERITY_LABELS, STATUS_LABELS, TYPE_LABELS } from '../constants/shipmentIncidents.constants.ts';
import { createEvidenceRegistry } from '../utils/evidence.ts';
import { useShipmentIncidents } from '../hooks/useShipmentIncidents';
import type { IncidentService, IncidentSession } from '../types/shipmentIncidents.types.ts';
import { CreateIncidentDialog } from './CreateIncidentDialog';
import { IncidentDetailDialog } from './IncidentDetailDialog';
import { IncidentSeverityBadge, IncidentStatusBadge } from './IncidentPresentation';
import { displayDate } from '../utils/displayDate';

// Exported for an isolated test harness; production capabilities come from the page adapter.
export function IncidentWorkspace({ service, session }: { service: IncidentService; session: IncidentSession }) {
  const list = useShipmentIncidents(service, session);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [registry] = useState(createEvidenceRegistry);
  useEffect(() => () => registry.dispose(), [registry]);
  const saved = () => { toast.success('Đã cập nhật hồ sơ mô phỏng.'); list.refetch(); };
  return <section className="min-w-0 space-y-6"><header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Báo cáo & Xử lý sự cố vận đơn</h1><p className="text-sm text-muted-foreground">Theo dõi hồ sơ và chứng từ trong phạm vi được cấp.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={list.refetch} disabled={list.loading}><RefreshCw className="mr-2 h-4 w-4" />Làm mới</Button><Button disabled={!session.capabilities.create || list.loading || !!list.error} onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" />Tạo báo cáo sự cố</Button></div></header>
    <p className="rounded-md border bg-muted p-3 text-sm">Chế độ Mock — dữ liệu và ảnh chỉ tồn tại trong phiên. Quyền tạo, gán và chuyển đề xuất thật đang chờ xác nhận.</p>
    <div className="grid grid-cols-1 gap-3 rounded-md border p-4 sm:grid-cols-2 lg:grid-cols-3"><div><label htmlFor="incident-search">Tìm mã sự cố / vận đơn</label><Input id="incident-search" value={list.search} onChange={e => list.setSearch(e.target.value)} className="text-base sm:text-sm" placeholder="Nhập mã cần tìm" /></div>
      <div><label htmlFor="type-filter">Loại sự cố</label><select id="type-filter" className={FIELD_CLASS} value={list.filters.incident_type} onChange={e => list.filter('incident_type', e.target.value as typeof list.filters.incident_type)}><option value="">Tất cả loại</option>{INCIDENT_TYPES.map(v => <option key={v} value={v}>{TYPE_LABELS[v]}</option>)}</select></div>
      <div><label htmlFor="severity-filter">Mức độ</label><select id="severity-filter" className={FIELD_CLASS} value={list.filters.severity} onChange={e => list.filter('severity', e.target.value as typeof list.filters.severity)}><option value="">Tất cả mức độ</option>{SEVERITIES.map(v => <option key={v} value={v}>{SEVERITY_LABELS[v]}</option>)}</select></div>
      <div><label htmlFor="status-filter">Trạng thái</label><select id="status-filter" className={FIELD_CLASS} value={list.filters.status} onChange={e => list.filter('status', e.target.value as typeof list.filters.status)}><option value="">Tất cả trạng thái</option>{STATUSES.map(v => <option key={v} value={v}>{STATUS_LABELS[v]}</option>)}</select></div>
      <div><label htmlFor="staff-filter">Người chịu trách nhiệm</label><select id="staff-filter" className={FIELD_CLASS} value={list.filters.responsible_user_id} onChange={e => list.filter('responsible_user_id', e.target.value)}><option value="">Tất cả nhân viên</option>{list.options.staff.map(s => <option key={s.id} value={s.id}>{s.employee_code} — {s.full_name}</option>)}</select></div><Button variant="outline" className="self-end" onClick={list.reset}>Xóa bộ lọc</Button>
    </div>
    {list.loading ? <Skeleton className="h-72 w-full" aria-label="Đang tải danh sách" /> : list.error ? <div role="alert" className="space-y-3 rounded border p-4"><p>{list.error.message}</p><Button variant="outline" onClick={list.refetch}>Thử lại</Button></div> : !list.rows.length ? <EmptyState title="Không có hồ sơ sự cố" description="Thử thay đổi hoặc xóa bộ lọc." action={<Button variant="outline" onClick={list.reset}>Xóa bộ lọc</Button>} /> : <div className="w-full overflow-x-auto rounded-md border"><Table><TableHeader><TableRow>{['Mã sự cố / Vận đơn', 'Loại sự cố', 'Mức độ', 'Trạng thái', 'Ảnh', 'Người chịu trách nhiệm', 'Thời gian báo cáo', 'Thao tác'].map(label => <TableHead key={label} className="whitespace-nowrap">{label}</TableHead>)}</TableRow></TableHeader><TableBody>{list.rows.map(row => <TableRow key={row.public_id}><TableCell className="whitespace-nowrap font-mono text-xs font-medium sm:text-sm">{row.incident_code}<div className="text-muted-foreground">{list.options.shipments.find(s => s.id === row.shipment_id)?.tracking_code ?? 'Chưa có thông tin'}</div></TableCell><TableCell>{TYPE_LABELS[row.incident_type]}</TableCell><TableCell><IncidentSeverityBadge value={row.severity} /></TableCell><TableCell><IncidentStatusBadge value={row.status} /></TableCell><TableCell>{row.evidence_urls?.length ?? 0}</TableCell><TableCell>{row.responsible_user_id ? list.options.staff.find(s => s.id === row.responsible_user_id)?.full_name ?? 'Chưa có thông tin' : 'Chưa xác định'}</TableCell><TableCell className="whitespace-nowrap">{displayDate(row.created_at)}</TableCell><TableCell><Button variant="outline" size="sm" onClick={() => setSelected(row.public_id)} aria-label={`Xem ${row.incident_code}`}>Xem chi tiết</Button></TableCell></TableRow>)}</TableBody></Table></div>}
    <nav aria-label="Phân trang sự cố" className="flex flex-col items-center justify-between gap-3 sm:flex-row"><p className="text-sm">{list.pagination.total} hồ sơ · Trang {list.pagination.page}/{Math.max(1, list.pagination.total_pages)}</p><div className="flex gap-2"><Button variant="outline" disabled={list.loading || !!list.error || list.filters.page <= 1} onClick={() => list.page(list.filters.page - 1)}>Trước</Button><Button variant="outline" disabled={list.loading || !!list.error || list.filters.page >= list.pagination.total_pages} onClick={() => list.page(list.filters.page + 1)}>Sau</Button></div></nav>
    {creating && <CreateIncidentDialog service={service} session={session} options={list.options} registry={registry} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); list.reset(); saved(); }} />}
    {selected && <IncidentDetailDialog id={selected} service={service} session={session} options={list.options} registry={registry} onClose={() => setSelected(null)} onSaved={() => toast.success('Đã cập nhật hồ sơ mô phỏng.')} onRefresh={list.refetch} />}
  </section>;
}
