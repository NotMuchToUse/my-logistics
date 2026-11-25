import { PackageSearch } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { TrackingSearchForm } from "@/features/tracking/components/TrackingSearchForm";
import { ShipmentSummaryCard } from "@/features/tracking/components/ShipmentSummaryCard";
import { ShipmentTimeline } from "@/features/tracking/components/ShipmentTimeline";
import { usePublicTracking } from "@/features/tracking/hooks/usePublicTracking";

export function TrackingPage() {
  const { results, isLoading, searchTracking } = usePublicTracking();

  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 py-8 sm:py-12">
      <header className="space-y-3 text-center">
        <PackageSearch
          className="mx-auto h-10 w-10 text-primary"
          aria-hidden="true"
        />
        <h1 className="text-3xl font-bold tracking-tight">Tra cứu vận đơn</h1>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          Nhập một hoặc nhiều mã vận đơn để xem trạng thái và hành trình giao
          hàng.
        </p>
      </header>

      <Card>
        <CardContent className="pt-6">
          <TrackingSearchForm
            isLoading={isLoading}
            onSearch={searchTracking}
          />
        </CardContent>
      </Card>

      {results.length > 0 && (
        <section className="space-y-6" aria-label="Kết quả tra cứu">
          {results.map((result) =>
            result.shipment ? (
              <article key={result.tracking_code} className="space-y-4">
                <ShipmentSummaryCard shipment={result.shipment} />
                <ShipmentTimeline shipment={result.shipment} />
              </article>
            ) : (
              <Card key={result.tracking_code}>
                <CardContent className="pt-6">
                  <p className="font-medium">{result.tracking_code}</p>
                  <p className="mt-1 text-sm text-destructive">
                    {result.error}
                  </p>
                </CardContent>
              </Card>
            ),
          )}
        </section>
      )}
    </main>
  );
}
