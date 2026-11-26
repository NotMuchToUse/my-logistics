import { AlertCircle, FlaskConical, PackageSearch } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { useWarehouseBags } from "../hooks/useWarehouseBags";

export type WarehouseBagsModel = ReturnType<typeof useWarehouseBags> | ReturnType<typeof import("../hooks/useWarehouseBags").useWarehouseBagsDemo>;
export function BagReadFeedback({ state }: { state: Pick<WarehouseBagsModel["bag"], "status" | "error"> }) {
  if (state.status === "loading") return <div role="status" aria-label="Đang tra cứu" className="space-y-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-12 w-full" /><span className="sr-only">Đang tra cứu</span></div>;
  if (state.error) return <div role="alert" className="flex gap-2 rounded-md border border-destructive/30 p-3 text-sm"><AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" /><p>{state.status === "blocked" ? "Chưa thể kết nối API thật. " : ""}{state.error.message}</p></div>;
  if (state.status === "empty" || state.status === "idle") return <p className="flex items-center gap-2 text-sm text-muted-foreground"><PackageSearch className="h-4 w-4" aria-hidden="true" />{state.status === "empty" ? "Danh sách túi mẫu đang rỗng." : "Nhập mã để tra cứu dữ liệu."}</p>;
  return null;
}
export function BagContextNotice({ model }: { model: WarehouseBagsModel }) {
  return <div className="space-y-3 text-sm">
    <p>Chi nhánh hiện tại: {model.context.branchId ?? "Chưa chọn"} · Kho làm việc: {model.context.warehouseId ?? "Chưa xác định"}</p>
    {model.dataset.data && <p role="note" className="flex gap-2 rounded-md border bg-muted/50 p-3"><FlaskConical className="h-4 w-4 shrink-0" aria-hidden="true" />{"resetDemo" in model ? "CHẾ ĐỘ DEMO — Dữ liệu và thao tác giả lập, không ảnh hưởng hệ thống thật." : "Dữ liệu Mock để xem thử, chưa xác nhận quyền hoặc phạm vi kho vận hành."}</p>}
    <BagReadFeedback state={model.dataset} />
    <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" disabled={model.dataset.status === "loading"} onClick={() => void model.refetch()}>Tải lại dữ liệu đọc</Button>{"resetDemo" in model && <Button type="button" variant="outline" size="sm" onClick={model.resetDemo}>Đặt lại dữ liệu Demo</Button>}</div>
  </div>;
}
