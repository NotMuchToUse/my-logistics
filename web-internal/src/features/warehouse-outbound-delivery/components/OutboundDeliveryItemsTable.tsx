import { History, PackageX, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OUTBOUND_SHIPMENT_STATUS_META } from "../constants/warehouse-outbound-delivery.constants";
import type {
  OutboundDeliveryReceiptItem,
  OutboundDeliveryReceiptStatus,
} from "../types/warehouse-outbound-delivery.types";

interface OutboundDeliveryItemsTableProps {
  receiptStatus: OutboundDeliveryReceiptStatus | null;
  activeItems: OutboundDeliveryReceiptItem[];
  removedItems: OutboundDeliveryReceiptItem[];
  totalWeightGram: number;
  totalCodAmount: number;
  onRequestRemoveItem: (item: OutboundDeliveryReceiptItem) => void;
}

function formatWeight(weightGram: number): string {
  return `${(weightGram / 1000).toLocaleString("vi-VN", {
    maximumFractionDigits: 2,
  })} kg`;
}

function formatCurrency(amount: number): string {
  return `${amount.toLocaleString("vi-VN")} đ`;
}

export function OutboundDeliveryItemsTable({
  receiptStatus,
  activeItems,
  removedItems,
  totalWeightGram,
  totalCodAmount,
  onRequestRemoveItem,
}: OutboundDeliveryItemsTableProps) {
  const canRemove = receiptStatus === "draft";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">
                Danh sách vận đơn giao hàng ({activeItems.length} đơn)
              </CardTitle>
              <CardDescription>
                Kiểm tra kỹ thông tin người nhận và tiền thu hộ COD. Khi phiếu đang ở trạng thái nháp, có thể gỡ đơn quét nhầm kèm lý do.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-4 rounded-md border bg-muted/30 px-3.5 py-2 text-sm">
              <div>
                <span className="text-muted-foreground">Tổng khối lượng: </span>
                <strong className="font-semibold">{formatWeight(totalWeightGram)}</strong>
              </div>
              <div className="h-4 w-px bg-border" aria-hidden="true" />
              <div>
                <span className="text-muted-foreground">Tổng thu hộ COD: </span>
                <strong className="font-semibold text-primary">
                  {formatCurrency(totalCodAmount)}
                </strong>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {activeItems.length === 0 ? (
            <EmptyState
              title="Chưa có vận đơn nào trong phiếu xuất giao"
              description="Quét barcode vận đơn ở khung phía trên để đưa đơn hàng vào danh sách giao của tài xế."
              icon={PackageX}
            />
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">STT</TableHead>
                    <TableHead>Mã vận đơn</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Người nhận & Địa chỉ giao</TableHead>
                    <TableHead className="text-right">Kiện / KL</TableHead>
                    <TableHead className="text-right">Tiền COD</TableHead>
                    <TableHead>Thời gian quét</TableHead>
                    <TableHead className="w-28 text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeItems.map((item, index) => {
                    const statusMeta =
                      OUTBOUND_SHIPMENT_STATUS_META[item.shipment_status];

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="text-center text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell className="font-mono font-semibold">
                          {item.tracking_code}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={statusMeta?.className ?? ""}
                          >
                            {statusMeta?.label ?? item.shipment_status}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <p className="font-medium text-foreground">
                            {item.recipient_name} · {item.recipient_phone_masked}
                          </p>
                          <p className="truncate text-xs text-muted-foreground" title={item.recipient_address}>
                            {item.recipient_address}
                          </p>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {item.parcel_count} kiện · {formatWeight(item.chargeable_weight_gram)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.cod_amount)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <div>{item.scanned_at}</div>
                          <div>Bởi: {item.scanned_by_name}</div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={!canRemove}
                            onClick={() => onRequestRemoveItem(item)}
                          >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                            Gỡ đơn
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {removedItems.length > 0 && (
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <History className="h-4 w-4" aria-hidden="true" />
              Lịch sử vận đơn đã gỡ khỏi phiếu nháp ({removedItems.length} đơn)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã vận đơn</TableHead>
                    <TableHead>Người nhận</TableHead>
                    <TableHead>Lý do gỡ đơn (remove_reason)</TableHead>
                    <TableHead>Người gỡ & Thời điểm</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {removedItems.map((item) => (
                    <TableRow key={item.id} className="bg-muted/20 text-muted-foreground">
                      <TableCell className="font-mono line-through">
                        {item.tracking_code}
                      </TableCell>
                      <TableCell>{item.recipient_name}</TableCell>
                      <TableCell className="font-medium text-foreground">
                        {item.remove_reason ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.removed_by_name ?? "Nhân viên kho"} · {item.removed_at ?? ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
