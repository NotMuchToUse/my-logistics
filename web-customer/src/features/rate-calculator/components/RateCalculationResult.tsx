import { AlertCircle, LoaderCircle, Weight } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
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
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatVndCurrency, formatWeight } from "@/core/utils/formatters";
import type { useRateCalculator } from "../hooks/useRateCalculator";
import type { RateCalculationResult as RateCalculationData } from "../types/rate-calculator.types";

interface RateCalculationResultProps {
  calculator: ReturnType<typeof useRateCalculator>;
}

function WeightMetric({
  label,
  value,
  isAvailable,
}: {
  label: string;
  value: string;
  isAvailable: boolean;
}) {
  return (
    <div className="space-y-2 rounded-md border p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className={`tabular-nums font-semibold ${
          isAvailable ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function FeeItems({
  title,
  items,
}: {
  title: string;
  items: Array<{ id: number; name: string }>;
}) {
  return (
    <section className="space-y-2">
      <h4 className="text-sm font-medium">{title}</h4>
      {items.length > 0 ? (
        <ul className="space-y-1 text-sm text-muted-foreground">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-2">
              <span
                className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground"
                aria-hidden="true"
              />
              <span>{item.name}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Chưa có danh sách chi tiết trong kết quả mẫu.
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        Chưa có dữ liệu phí chi tiết từng mục.
      </p>
    </section>
  );
}

function SampleMetadata({
  data,
  responseMessage,
  serviceName,
  timestamp,
}: {
  data: RateCalculationData;
  responseMessage: string;
  serviceName: string;
  timestamp: string;
}) {
  const metadata = [
    { label: "Thông điệp response mẫu", value: responseMessage },
    { label: "Dịch vụ vận chuyển", value: serviceName },
    { label: "Mã bưu cục gửi", value: String(data.origin_branch_id) },
    { label: "Mã bưu cục nhận", value: String(data.destination_branch_id) },
    { label: "Mã dịch vụ", value: String(data.service_type_id) },
    { label: "Mã nhóm hàng", value: String(data.cargo_category_id) },
    {
      label: "Giá trị khai báo trong mẫu",
      value: formatVndCurrency(data.declared_value),
    },
    {
      label: "Tiền thu hộ (COD) trong mẫu",
      value: formatVndCurrency(data.cod_amount),
    },
    { label: "Thời điểm của dữ liệu mẫu", value: timestamp },
  ];

  return (
    <details className="rounded-md border px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        Thông tin tham khảo khác trong response mẫu
      </summary>
      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        {metadata.map((item) => (
          <div key={item.label} className="space-y-1">
            <dt className="text-muted-foreground">{item.label}</dt>
            <dd className="font-medium tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

function SuccessResult({
  calculator,
  data,
  responseMessage,
  timestamp,
}: {
  calculator: ReturnType<typeof useRateCalculator>;
  data: RateCalculationData;
  responseMessage: string;
  timestamp: string;
}) {
  const service = calculator.serviceTypes.find(
    (item) => item.id === data.service_type_id,
  );
  const serviceName = service
    ? `${service.name} (ID ${data.service_type_id})`
    : `Mã dịch vụ ${data.service_type_id}`;

  return (
    <div className="space-y-6">
      <div
        className="rounded-md border border-primary/20 bg-primary/5 p-4 text-sm text-foreground"
        role="note"
      >
        Kết quả minh họa từ dữ liệu mẫu, chưa phải báo giá thực tế và không được
        tính dựa trên thông số bạn đã nhập.
        <p className="mt-2 text-muted-foreground">
          Nguồn dữ liệu:{" "}
          <code className="rounded bg-background px-1.5 py-0.5 font-mono text-xs">
            {calculator.result?.source}
          </code>
        </p>
      </div>

      <section className="space-y-3">
        <h3 className="flex items-center gap-2 font-semibold">
          <Weight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Thông tin trọng lượng
        </h3>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <WeightMetric
            label="Trọng lượng thực tế"
            value="Chưa có dữ liệu"
            isAvailable={false}
          />
          <WeightMetric
            label="Trọng lượng quy đổi"
            value="Chưa có dữ liệu"
            isAvailable={false}
          />
          <WeightMetric
            label="Trọng lượng tính cước"
            value={formatWeight(data.chargeable_weight_gram)}
            isAvailable
          />
        </dl>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">Chi tiết cước phí</h3>
        <Table className="min-w-[28rem]">
          <TableCaption>
            Các tổng tiền được hiển thị nguyên theo dữ liệu mẫu.
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Khoản phí</TableHead>
              <TableHead className="whitespace-nowrap text-right">
                Số tiền
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Cước vận chuyển chính</TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">
                {formatVndCurrency(data.base_freight_amount)}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Tổng phụ phí</TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">
                {formatVndCurrency(data.surcharge_amount)}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>
                Tổng phí dịch vụ giá trị gia tăng
              </TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">
                {formatVndCurrency(data.vas_amount)}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Thuế VAT</TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">
                {formatVndCurrency(data.vat_amount)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FeeItems title="Danh sách phụ phí" items={data.surcharges} />
          <FeeItems
            title="Danh sách dịch vụ giá trị gia tăng"
            items={data.value_added_services}
          />
        </div>
      </section>

      <section
        className="rounded-lg bg-primary p-5 text-primary-foreground sm:p-6"
        aria-label="Tổng cước vận chuyển"
      >
        <p className="text-sm font-medium text-primary-foreground/80">
          Tổng cước vận chuyển
        </p>
        <p className="mt-1 text-2xl font-bold tabular-nums sm:text-3xl">
          {formatVndCurrency(data.total_freight_amount)}
        </p>
      </section>

      <SampleMetadata
        data={data}
        responseMessage={responseMessage}
        serviceName={serviceName}
        timestamp={timestamp}
      />
    </div>
  );
}

export function RateCalculationResult({
  calculator,
}: RateCalculationResultProps) {
  const result = calculator.result;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-xl sm:text-2xl">
          Chi tiết cước phí vận chuyển
        </CardTitle>
        <CardDescription>
          Kết quả và các khoản phí được trả về từ dữ liệu tính cước.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {calculator.isCalculating ? (
          <div
            className="flex min-h-48 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground"
            role="status"
          >
            <LoaderCircle
              className="h-6 w-6 animate-spin"
              aria-hidden="true"
            />
            Đang xử lý tính cước...
          </div>
        ) : calculator.error ? (
          <EmptyState
            title="Chưa thể hiển thị kết quả"
            description="Thông báo lỗi chi tiết đã được hiển thị ở phần biểu mẫu."
            icon={AlertCircle}
          />
        ) : result ? (
          <SuccessResult
            calculator={calculator}
            data={result.response.data}
            responseMessage={result.response.message}
            timestamp={result.response.meta.timestamp}
          />
        ) : (
          <EmptyState
            title="Chưa có kết quả tính cước"
            description="Nhập thông tin kiện hàng và chọn Tính cước vận chuyển để xem kết quả minh họa"
            icon={Weight}
          />
        )}
      </CardContent>
    </Card>
  );
}
