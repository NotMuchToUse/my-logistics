import { RateCalculationResult } from "../components/RateCalculationResult";
import { RateCalculatorForm } from "../components/RateCalculatorForm";
import { useRateCalculator } from "../hooks/useRateCalculator";

export function RateCalculatorPage() {
  const calculator = useRateCalculator();

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Ước tính cước phí vận chuyển
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Nhập thông tin địa chỉ, trọng lượng, kích thước và dịch vụ vận chuyển
          để xem chi tiết cước phí.
        </p>
      </header>

      <div className="grid min-w-0 grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="min-w-0" aria-label="Thông tin tính cước">
          <RateCalculatorForm calculator={calculator} />
        </section>
        <section className="min-w-0" aria-label="Kết quả tính cước">
          <RateCalculationResult calculator={calculator} />
        </section>
      </div>
    </section>
  );
}
