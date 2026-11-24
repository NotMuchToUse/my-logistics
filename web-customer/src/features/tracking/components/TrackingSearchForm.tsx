import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Search, Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MOCK_TRACKING_CODE } from "@/features/tracking/constants/tracking.constants";
import {
  trackingSearchSchema,
  type TrackingSearchFormValues,
} from "@/features/tracking/schemas/tracking.schema";

interface TrackingSearchFormProps {
  isLoading: boolean;
  onSearch: (codes: string[]) => Promise<void>;
}

export function TrackingSearchForm({
  isLoading,
  onSearch,
}: TrackingSearchFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<TrackingSearchFormValues>({
    resolver: zodResolver(trackingSearchSchema),
    defaultValues: { tracking_codes: "" },
  });

  function submitSearch(values: TrackingSearchFormValues) {
    return onSearch(
      values.tracking_codes
        .split(",")
        .map((code) => code.trim().toUpperCase()),
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={handleSubmit(submitSearch)}
      noValidate
    >
      <label className="text-sm font-medium" htmlFor="tracking-codes">
        Mã vận đơn
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="tracking-codes"
          placeholder="Ví dụ: VS26112300004, VS26112300006"
          aria-invalid={Boolean(errors.tracking_codes)}
          aria-describedby={
            errors.tracking_codes ? "tracking-codes-error" : undefined
          }
          {...register("tracking_codes")}
        />
        <Button type="submit" className="shrink-0" disabled={isLoading}>
          <Search className="h-4 w-4" aria-hidden="true" />
          {isLoading ? "Đang tra cứu..." : "Tra cứu"}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      {errors.tracking_codes && (
        <p id="tracking-codes-error" className="text-sm text-destructive">
          {errors.tracking_codes.message}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>Thử nhanh:</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setValue("tracking_codes", MOCK_TRACKING_CODE, {
              shouldValidate: true,
              shouldDirty: true,
            })
          }
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {MOCK_TRACKING_CODE}
        </Button>
        <span>Ngăn cách nhiều mã bằng dấu phẩy.</span>
      </div>
    </form>
  );
}
