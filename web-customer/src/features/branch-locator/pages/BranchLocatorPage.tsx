import { MapPin } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BranchFilterForm } from "@/features/branch-locator/components/BranchFilterForm";
import { BranchList } from "@/features/branch-locator/components/BranchList";
import { BranchMapView } from "@/features/branch-locator/components/BranchMapView";
import { useBranchLocator } from "@/features/branch-locator/hooks/useBranchLocator";
import type { BranchFilterFormValues } from "@/features/branch-locator/schemas/branch-locator.schema";
import type { LogisticsBranch } from "@/features/branch-locator/types/branch-locator.types";

export function BranchLocatorPage() {
  const { directory, branches, isLoading, error, searchBranches } =
    useBranchLocator();
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);

  const resolvedSelectedBranchId =
    selectedBranchId !== null &&
    branches.some((branch) => branch.id === selectedBranchId)
      ? selectedBranchId
      : (branches[0]?.id ?? null);

  async function submitFilter(values: BranchFilterFormValues): Promise<void> {
    await searchBranches({
      province_id: values.province_id
        ? Number(values.province_id)
        : undefined,
      district_id: values.district_id
        ? Number(values.district_id)
        : undefined,
      keyword: values.keyword || undefined,
      accepts_counter_dropoff: values.accepts_counter_dropoff,
    });
  }

  function selectBranch(branch: LogisticsBranch): void {
    setSelectedBranchId(branch.id);
  }

  return (
    <section className="mx-auto w-full max-w-7xl space-y-5 py-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <MapPin className="h-6 w-6" aria-hidden="true" />
          <h1 className="text-2xl font-bold tracking-tight">Tìm bưu cục</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Tìm bưu cục Vietstar theo khu vực, dịch vụ và từ khóa.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <BranchFilterForm
            provinces={directory.provinces}
            districts={directory.districts}
            isLoading={isLoading}
            onSearch={submitFilter}
          />
        </CardContent>
      </Card>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {isLoading
                ? "Đang tải..."
                : `${branches.length} bưu cục phù hợp`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BranchList
              branches={branches}
              selectedBranchId={resolvedSelectedBranchId}
              onSelect={selectBranch}
            />
          </CardContent>
        </Card>

        <BranchMapView
          branches={branches}
          selectedBranchId={resolvedSelectedBranchId}
          onSelect={selectBranch}
        />
      </div>
    </section>
  );
}
