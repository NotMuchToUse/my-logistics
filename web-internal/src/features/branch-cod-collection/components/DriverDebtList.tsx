import { useId, useState } from "react";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatVndCurrency } from "@/core/utils/formatters";
import type { DemoDriverDebt } from "../types/branch-cod-collection.types";

export interface DriverDebtListProps {
  driverDebts: readonly DemoDriverDebt[];
  currentDebt: DemoDriverDebt | null;
  isMockMode: boolean;
  hasRead: boolean;
  isScopeValid: boolean;
  error: string | null;
  selectionBlockedReason: "scanned" | "draft" | null;
  onSelectDriver: (driverId: string) => void;
}

export function DriverDebtList({
  driverDebts,
  currentDebt,
  isMockMode,
  hasRead,
  isScopeValid,
  error,
  selectionBlockedReason,
  onSelectDriver,
}: DriverDebtListProps) {
  const [search, setSearch] = useState("");
  const searchId = useId();
  const blockedId = useId();
  const query = search.trim().toLocaleLowerCase("vi-VN");
  const filteredDebts = driverDebts.filter(({ driver }) =>
    driver.name.toLocaleLowerCase("vi-VN").includes(query) ||
    driver.id.toLocaleLowerCase("vi-VN").includes(query),
  );
  const blockedMessage = selectionBlockedReason === "scanned"
    ? "Hãy xử lý hoặc xóa danh sách đang quét trước khi đổi tài xế."
    : selectionBlockedReason === "draft"
      ? "Hãy khóa hoặc hủy bảng kê nháp demo trước khi đổi tài xế."
      : null;

  return (
    <Card className="min-w-0 space-y-4 p-4 sm:p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Công nợ tài xế</h2>
        <p className="text-sm text-muted-foreground">
          Theo dõi tiền COD và cước đang giữ của tài xế trong phạm vi được chọn.
        </p>
        <p className="text-sm font-medium">
          Dữ liệu demo — không ghi nhận thu tiền thực tế.
        </p>
      </div>

      {!isMockMode ? (
        <p role="status" className="text-sm text-muted-foreground">
          Công nợ demo chỉ khả dụng trong chế độ Mock.
        </p>
      ) : !hasRead ? (
        <p role="status" className="text-sm text-muted-foreground">
          Bạn không có quyền xem công nợ tài xế.
        </p>
      ) : !isScopeValid ? (
        <p role="status" className="text-sm text-muted-foreground">
          Phạm vi chưa hợp lệ. Vui lòng chọn chi nhánh hoặc bưu cục được cấp.
        </p>
      ) : (
        <>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

          <div className="space-y-2">
            <Label htmlFor={searchId}>Tìm tài xế theo tên hoặc mã</Label>
            <Input
              id={searchId}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nhập tên hoặc mã tài xế"
            />
          </div>

          {blockedMessage && (
            <p id={blockedId} role="status" className="text-sm text-muted-foreground">
              {blockedMessage}
            </p>
          )}

          {driverDebts.length === 0 ? (
            !error && (
              <EmptyState
                icon={Users}
                title="Không có tài xế trong phạm vi"
                description="Chưa có dữ liệu tài xế demo trong phạm vi đang chọn."
              />
            )
          ) : filteredDebts.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Không tìm thấy tài xế"
              description="Thử tìm theo tên hoặc mã tài xế khác."
            />
          ) : (
            <ul aria-label="Danh sách công nợ tài xế demo" className="space-y-2">
              {filteredDebts.map((debt) => {
                const selected = currentDebt?.driver.id === debt.driver.id;
                return (
                  <li
                    key={debt.driver.id}
                    className="min-w-0 rounded-md border p-3"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <p className="break-words font-medium">{debt.driver.name}</p>
                        <p className="break-all font-mono text-xs font-medium sm:text-sm">
                          {debt.driver.id}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {debt.shipments.length} vận đơn đang giữ tiền
                        </p>
                      </div>
                      <div className="flex min-w-0 flex-col items-stretch gap-2 sm:items-end">
                        <p className="text-right text-sm tabular-nums">
                          <span className="text-muted-foreground">Công nợ: </span>
                          <span className="font-semibold">{formatVndCurrency(debt.totalDebt)}</span>
                        </p>
                        <Button
                          type="button"
                          variant={selected ? "secondary" : "outline"}
                          size="sm"
                          aria-label={`${selected ? "Đang chọn" : "Chọn"} tài xế ${debt.driver.name}, mã ${debt.driver.id}`}
                          aria-pressed={selected}
                          aria-describedby={!selected && blockedMessage ? blockedId : undefined}
                          disabled={!selected && blockedMessage !== null}
                          onClick={() => onSelectDriver(debt.driver.id)}
                        >
                          {selected ? "Đang chọn" : "Chọn tài xế"}
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="min-w-0 space-y-2 rounded-md border p-4">
            <h3 className="font-semibold">Tổng quan tài xế đang chọn</h3>
            {currentDebt ? (
              <>
                <p className="break-words text-sm font-medium">{currentDebt.driver.name}</p>
                <p className="break-all font-mono text-xs font-medium sm:text-sm">
                  {currentDebt.driver.id}
                </p>
                <p className="text-sm text-muted-foreground">
                  {currentDebt.shipments.length === 0
                    ? "Không có vận đơn đang giữ tiền."
                    : `${currentDebt.shipments.length} vận đơn đang giữ tiền.`}
                </p>
                <p className="text-right text-sm tabular-nums">
                  Tổng công nợ: <span className="font-semibold">{formatVndCurrency(currentDebt.totalDebt)}</span>
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Chưa chọn tài xế.</p>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
