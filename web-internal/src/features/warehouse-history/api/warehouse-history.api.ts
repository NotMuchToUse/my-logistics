import { z } from "zod";
import axiosClient, { USE_MOCK } from "@/core/api/axiosClient";
import { createHistoryMock, HistoryError } from "./warehouse-history.mock";
import { hasHistoryScope, isHqHistory, historyFiltersSchema, publicIdSchema, type HistoryContext, type HistoryFilters, type Receipt, type ReceiptPage } from "../warehouse-history.model";

export const HISTORY_MOCK = USE_MOCK;
const mock = createHistoryMock();
const databaseInteger = z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]).pipe(z.number().int().nonnegative().safe());
const receiptSchema = z.object({
  public_id: publicIdSchema, receipt_code: z.string(), receipt_type: z.enum(["inbound", "outbound_linehaul", "outbound_delivery"]),
  status: z.enum(["draft", "confirmed", "unlocked", "handed_over", "cancelled"]), warehouse_id: databaseInteger.refine((value) => value > 0), warehouse_name: z.string().nullable(),
  total_shipments: databaseInteger, total_bags: databaseInteger, total_weight_gram: databaseInteger, version: databaseInteger.refine((value) => value > 0),
  created_at: z.string().nullable(), updated_at: z.string().nullable(), confirmed_at: z.string().nullable(), note: z.string().nullable(), confirmed_by_name: z.string().nullable().optional(), branch_name: z.string().nullable().optional(),
});
const paginationSchema = z.object({ page: z.number().int().positive(), per_page: z.number().int().positive().max(100), total: z.number().int().nonnegative(), total_pages: z.number().int().nonnegative() });
function authorize(c: HistoryContext) {
  if (!c.authenticated || !c.can_read || !hasHistoryScope(c) || (c.warehouse_id !== null && (!Number.isSafeInteger(c.warehouse_id) || c.warehouse_id <= 0))) throw new HistoryError("403_FORBIDDEN", "Cần đăng nhập, quyền warehouse.read và phạm vi chi nhánh hợp lệ.");
}
// Sources: Warehouse routes.php, validateReceiptListQuery, formatReceipt, listReceiptItems.
export async function listHistory(f: HistoryFilters, c: HistoryContext, signal?: AbortSignal): Promise<ReceiptPage> {
  authorize(c);
  const filters = historyFiltersSchema.safeParse(f);
  if (!filters.success) throw new HistoryError("422_VALIDATION_ERROR", filters.error.issues[0].message);
  f = filters.data;
  if (HISTORY_MOCK) return mock.list(f, c);
  if (isHqHistory(c)) throw new HistoryError("CONTRACT_BLOCKED", "Xem toàn hệ thống qua API đang chờ xác nhận ngoại lệ X-Branch-Id cho hq_all. Vui lòng chọn chi nhánh cụ thể.");
  if (f.branch_id) throw new HistoryError("CONTRACT_BLOCKED", "Bộ lọc chi nhánh chỉ hỗ trợ trong Mock.");
  if (f.receipt_type || f.from || f.to) throw new HistoryError("CONTRACT_BLOCKED", "Bộ lọc loại phiếu/ngày chưa được API hỗ trợ.");
  const { data } = await axiosClient.get("/api/v1/warehouse/receipts", { signal, params: { page: f.page, per_page: f.per_page, receipt_code: f.receipt_code || undefined, status: f.status || undefined, warehouse_id: c.warehouse_id ?? (f.warehouse_id ? Number(f.warehouse_id) : undefined) } });
  const parsed = z.object({ success: z.literal(true), data: z.array(receiptSchema), meta: z.object({ pagination: paginationSchema }) }).parse(data);
  if (c.warehouse_id !== null && parsed.data.some((r) => r.warehouse_id !== c.warehouse_id)) throw new HistoryError("403_BRANCH_SCOPE", "Danh sách chứa phiếu ngoài kho đang chọn.");
  return parsed;
}
export async function getReceipt(id: string, c: HistoryContext, signal?: AbortSignal): Promise<Receipt> {
  authorize(c);
  if (!publicIdSchema.safeParse(id).success) throw new HistoryError("400_BAD_REQUEST", "Định danh phiếu không hợp lệ.");
  if (HISTORY_MOCK) return mock.detail(id, c);
  if (isHqHistory(c)) throw new HistoryError("CONTRACT_BLOCKED", "Chi tiết toàn hệ thống qua API đang chờ xác nhận contract hq_all.");
  const { data } = await axiosClient.get(`/api/v1/warehouse/receipts/${id}`, { signal });
  const parsed = z.object({ success: z.literal(true), data: receiptSchema.extend({ items: z.array(z.object({ tracking_code: z.string(), scanned_at: z.string().nullable(), inbound_source_type: z.string().nullable(), is_wrong_route: z.union([z.number(), z.boolean()]) })) }) }).parse(data);
  if (parsed.data.public_id !== id) throw new HistoryError("INVALID_RESPONSE", "Máy chủ trả về phiếu khác với phiếu được yêu cầu.");
  if (c.warehouse_id !== null && parsed.data.warehouse_id !== c.warehouse_id) throw new HistoryError("403_BRANCH_SCOPE", "Phiếu không thuộc kho đang chọn.");
  return { ...parsed.data, items: parsed.data.items.map((item) => ({ ...item, removed_at: null })) };
}
export async function unlockReceipt(id: string, payload: unknown, c: HistoryContext) {
  authorize(c);
  if (!HISTORY_MOCK) throw new HistoryError("CONTRACT_BLOCKED", "Chưa có route/validator/quyền mở khóa và audit log được xác nhận.");
  return mock.unlock(id, payload, c);
}
export function historyErrorMessage(error: unknown): string {
  if (error instanceof HistoryError) return error.message;
  if (error && typeof error === "object" && "error" in error) {
    const parsed = z.object({ error: z.object({ message: z.string() }) }).safeParse(error);
    if (parsed.success) return parsed.data.error.message;
  }
  return "Không thể tải dữ liệu. Kiểm tra kết nối rồi tải lại; không tự gửi lại thao tác mở khóa.";
}
export function historyErrorDetails(error: unknown) {
  if (error instanceof HistoryError) return { code: error.code, details: undefined };
  const parsed = z.object({ error: z.object({ code: z.string(), details: z.record(z.string(), z.array(z.string())).optional() }) }).safeParse(error);
  return parsed.success ? parsed.data.error : { code: "UNKNOWN", details: undefined };
}
