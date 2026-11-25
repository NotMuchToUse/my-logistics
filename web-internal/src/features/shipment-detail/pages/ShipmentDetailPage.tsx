import { useEffect, useState, type FormEvent } from "react";
import {
  LoaderCircle,
  PackageCheck,
  Printer,
  Search,
  UserRound,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { getShipmentDetail } from "../api/shipment-detail.api";
import type {
  ShipmentChargeSnapshot,
  ShipmentDetail,
  ShipmentHistoryVisibility,
  ShipmentParty,
  ShipmentStatusHistory,
} from "../types/shipment-detail.types";

type HistoryFilter = "all" | ShipmentHistoryVisibility;

const STATUS_LABELS: Record<string, string> = {
  draft: "Nháp",
  pending_pickup: "Chờ lấy hàng",
  picked_up: "Đã lấy hàng",
  in_warehouse: "Tại kho",
  bagged: "Đã đóng bao",
  in_transit: "Đang vận chuyển",
  out_for_delivery: "Đang giao hàng",
  delivered: "Đã giao hàng",
  delivery_failed: "Giao không thành công",
  pending_return: "Chờ hoàn",
  returning: "Đang hoàn",
  returned: "Đã hoàn",
  incident: "Có sự cố",
  cancelled: "Đã hủy",
};

function formatMoney(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) {
    return "—";
  }
  return `${new Intl.NumberFormat("vi-VN").format(amount)} đ`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function formatWeight(
  kilograms: number | null | undefined,
  grams: number | null | undefined,
): string {
  const value =
    kilograms !== null && kilograms !== undefined
      ? kilograms
      : grams !== null && grams !== undefined
        ? grams / 1000
        : null;
  return value === null
    ? "—"
    : `${new Intl.NumberFormat("vi-VN", {
        maximumFractionDigits: 2,
      }).format(value)} kg`;
}

function partyName(party: ShipmentParty): string {
  return party.full_name ?? party.name ?? "Chưa có thông tin";
}

function partyAddress(party: ShipmentParty): string {
  return [
    party.address_line ?? party.address,
    party.ward_name,
    party.district_name,
    party.province_name,
  ]
    .filter((part): part is string => Boolean(part))
    .join(", ") || "—";
}

function statusLabel(status: string): string {
  return (
    STATUS_LABELS[status] ??
    status.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase())
  );
}

function historyVisibility(
  item: ShipmentStatusHistory,
): ShipmentHistoryVisibility {
  return item.visibility ?? item.scope ?? (item.is_public ? "public" : "internal");
}

function chargeName(charge: ShipmentChargeSnapshot): string {
  return charge.name ?? charge.vas_name ?? charge.surcharge_name ?? charge.code ?? "Khoản phí";
}

function chargeAmount(charge: ShipmentChargeSnapshot): number | null {
  if (charge.amount !== null && charge.amount !== undefined) {
    return charge.amount;
  }
  if (
    charge.unit_price !== null &&
    charge.unit_price !== undefined &&
    charge.quantity !== null &&
    charge.quantity !== undefined
  ) {
    return charge.unit_price * charge.quantity;
  }
  return null;
}

function readErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "error" in error) {
    const apiError = error.error;
    if (
      typeof apiError === "object" &&
      apiError !== null &&
      "message" in apiError &&
      typeof apiError.message === "string"
    ) {
      return apiError.message;
    }
  }
  return error instanceof Error
    ? error.message
    : "Không thể tải thông tin vận đơn. Vui lòng thử lại.";
}

function PartyCard({
  title,
  party,
}: {
  title: string;
  party: ShipmentParty | null | undefined;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <UserRound className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <p className="font-medium">{party ? partyName(party) : "—"}</p>
        <p className="text-muted-foreground">
          {party?.phone_masked ?? party?.phone ?? "—"}
        </p>
        <p className="text-muted-foreground">{party ? partyAddress(party) : "—"}</p>
      </CardContent>
    </Card>
  );
}

function ShipmentDetailContent({ publicId }: { publicId: string | undefined }) {
  const navigate = useNavigate();
  const [lookupValue, setLookupValue] = useState(publicId ?? "");
  const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(Boolean(publicId));
  const [errorMessage, setErrorMessage] = useState("");
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");

  useEffect(() => {
    if (!publicId) {
      return;
    }

    let active = true;
    void getShipmentDetail(publicId)
      .then((result) => {
        if (active) {
          setShipment(result);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setErrorMessage(readErrorMessage(error));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [publicId]);

  function handleLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = lookupValue.trim();
    if (value) {
      navigate(`/shipment-detail/${encodeURIComponent(value)}`);
    }
  }

  const history =
    shipment?.shipment_status_history ?? shipment?.status_history ?? [];
  const filteredHistory =
    historyFilter === "all"
      ? history
      : history.filter((item) => historyVisibility(item) === historyFilter);
  const parcels = shipment?.shipment_parcels ?? [];
  const vas = shipment?.shipment_vas ?? [];
  const surcharges = shipment?.shipment_surcharges ?? [];
  const mainShippingFee =
    shipment?.base_shipping_fee ?? shipment?.freight_fee ?? shipment?.shipping_fee;

  return (
    <main className="space-y-6">
      <header className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Chi tiết vận đơn</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tra cứu thông tin, phí snapshot và toàn bộ hành trình vận chuyển.
          </p>
        </div>
        <form
          className="flex w-full max-w-2xl gap-2"
          onSubmit={handleLookup}
          role="search"
        >
          <Input
            aria-label="Mã vận đơn"
            autoComplete="off"
            onChange={(event) => setLookupValue(event.target.value)}
            placeholder="Nhập mã vận đơn (public_id)"
            value={lookupValue}
          />
          <Button disabled={!lookupValue.trim() || loading} type="submit">
            {loading ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Tra cứu
          </Button>
        </form>
      </header>

      {loading && (
        <Card>
          <CardContent className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Đang tải chi tiết vận đơn…
          </CardContent>
        </Card>
      )}

      {errorMessage && (
        <Card>
          <CardContent className="py-5 text-sm text-destructive">
            {errorMessage}
          </CardContent>
        </Card>
      )}

      {!loading && !errorMessage && !shipment && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <PackageCheck className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Nhập mã vận đơn để xem chi tiết</p>
            <p className="text-sm text-muted-foreground">
              Bạn có thể mở trực tiếp trang này với mã vận đơn trong đường dẫn.
            </p>
          </CardContent>
        </Card>
      )}

      {shipment && (
        <div className="space-y-6">
          <Card>
            <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Mã vận đơn</p>
                <p className="break-all text-lg font-semibold">{shipment.public_id}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {shipment.status && (
                  <Badge variant="secondary">{statusLabel(shipment.status)}</Badge>
                )}
                {shipment.service_name && (
                  <span className="text-sm text-muted-foreground">
                    {shipment.service_name}
                  </span>
                )}
                <span className="text-sm text-muted-foreground">
                  Tạo lúc {formatDate(shipment.created_at)}
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <PartyCard title="Người gửi" party={shipment.sender} />
            <PartyCard title="Người nhận" party={shipment.receiver} />
          </div>

          <Tabs className="space-y-4" defaultValue="overview">
            <TabsList className="h-auto flex-wrap justify-start">
              <TabsTrigger value="overview">Chi tiết & phí</TabsTrigger>
              <TabsTrigger value="timeline">Hành trình</TabsTrigger>
              <TabsTrigger value="prints">Lịch sử in</TabsTrigger>
            </TabsList>

            <TabsContent className="space-y-6" value="overview">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Chi tiết kiện hàng</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kiện hàng</TableHead>
                        <TableHead>Kích thước (D × R × C)</TableHead>
                        <TableHead>TL thực</TableHead>
                        <TableHead>TL quy đổi</TableHead>
                        <TableHead>TL tính cước</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parcels.length ? (
                        parcels.map((parcel, index) => (
                          <TableRow key={parcel.id}>
                            <TableCell>
                              <p className="font-medium">
                                {parcel.parcel_code ?? `Kiện ${index + 1}`}
                              </p>
                              {parcel.description && (
                                <p className="text-xs text-muted-foreground">
                                  {parcel.description}
                                </p>
                              )}
                            </TableCell>
                            <TableCell>
                              {[
                                parcel.length_cm,
                                parcel.width_cm,
                                parcel.height_cm,
                              ].every((value) => value !== null && value !== undefined)
                                ? `${parcel.length_cm} × ${parcel.width_cm} × ${parcel.height_cm} cm`
                                : "—"}
                            </TableCell>
                            <TableCell>
                              {formatWeight(parcel.actual_weight_kg, parcel.actual_weight_g)}
                            </TableCell>
                            <TableCell>
                              {formatWeight(
                                parcel.volumetric_weight_kg,
                                parcel.volumetric_weight_g,
                              )}
                            </TableCell>
                            <TableCell>
                              {formatWeight(
                                parcel.chargeable_weight_kg,
                                parcel.chargeable_weight_g,
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            className="py-8 text-center text-muted-foreground"
                            colSpan={5}
                          >
                            Không có thông tin kiện hàng.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Bóc tách phí snapshot</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Khoản phí</TableHead>
                        <TableHead className="text-right">Thành tiền</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>Cước chính</TableCell>
                        <TableCell className="text-right">
                          {formatMoney(mainShippingFee)}
                        </TableCell>
                      </TableRow>
                      {vas.map((charge) => (
                        <TableRow key={`vas-${charge.id}`}>
                          <TableCell>{chargeName(charge)}</TableCell>
                          <TableCell className="text-right">
                            {formatMoney(chargeAmount(charge))}
                          </TableCell>
                        </TableRow>
                      ))}
                      {surcharges.map((charge) => (
                        <TableRow key={`surcharge-${charge.id}`}>
                          <TableCell>{chargeName(charge)}</TableCell>
                          <TableCell className="text-right">
                            {formatMoney(chargeAmount(charge))}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell>COD thu hộ</TableCell>
                        <TableCell className="text-right">
                          {formatMoney(shipment.cod_amount)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Phí COD</TableCell>
                        <TableCell className="text-right">
                          {formatMoney(shipment.cod_fee)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="timeline">
              <Card>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-lg">Lịch sử trạng thái</CardTitle>
                  <Select
                    onValueChange={(value) => setHistoryFilter(value as HistoryFilter)}
                    value={historyFilter}
                  >
                    <SelectTrigger aria-label="Lọc mốc trạng thái" className="w-full sm:w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả mốc</SelectItem>
                      <SelectItem value="public">Công khai</SelectItem>
                      <SelectItem value="internal">Nội bộ</SelectItem>
                    </SelectContent>
                  </Select>
                </CardHeader>
                <CardContent>
                  {filteredHistory.length ? (
                    <ol className="space-y-0">
                      {filteredHistory.map((item, index) => {
                        const visibility = historyVisibility(item);
                        return (
                          <li
                            className="relative flex gap-4 pb-6 last:pb-0"
                            key={item.id}
                          >
                            {index < filteredHistory.length - 1 && (
                              <span
                                aria-hidden="true"
                                className="absolute left-[7px] top-4 h-full w-px bg-border"
                              />
                            )}
                            <span
                              aria-hidden="true"
                              className="relative mt-1.5 h-4 w-4 shrink-0 rounded-full border-4 border-primary bg-background"
                            />
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium">{statusLabel(item.status)}</p>
                                <Badge variant="outline">
                                  {visibility === "public" ? "Công khai" : "Nội bộ"}
                                </Badge>
                              </div>
                              {(item.description ?? item.note) && (
                                <p className="text-sm text-muted-foreground">
                                  {item.description ?? item.note}
                                </p>
                              )}
                              {item.location_name && (
                                <p className="text-xs text-muted-foreground">
                                  {item.location_name}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                {formatDate(item.occurred_at ?? item.created_at)}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  ) : (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Không có mốc trạng thái phù hợp.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="prints">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Printer className="h-5 w-5" />
                    Lịch sử in
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Chứng từ</TableHead>
                        <TableHead>Người in</TableHead>
                        <TableHead>Số bản</TableHead>
                        <TableHead>Thời gian</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shipment.print_logs?.length ? (
                        shipment.print_logs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell>
                              {log.print_type ?? log.document_type ?? "—"}
                            </TableCell>
                            <TableCell>
                              {log.printed_by_name ?? log.employee_name ?? "—"}
                            </TableCell>
                            <TableCell>{log.copies ?? "—"}</TableCell>
                            <TableCell>
                              {formatDate(log.printed_at ?? log.created_at)}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            className="py-8 text-center text-muted-foreground"
                            colSpan={4}
                          >
                            Chưa có lịch sử in.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </main>
  );
}

export function ShipmentDetailPage() {
  const { publicId } = useParams<{ publicId: string }>();
  return (
    <ShipmentDetailContent key={publicId ?? "empty"} publicId={publicId} />
  );
}
