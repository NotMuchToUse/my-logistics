import { zodResolver } from "@hookform/resolvers/zod";
import { Search } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  branchFilterSchema,
  type BranchFilterFormValues,
} from "@/features/branch-locator/schemas/branch-locator.schema";
import type {
  BranchDistrict,
  BranchProvince,
} from "@/features/branch-locator/types/branch-locator.types";

interface BranchFilterFormProps {
  provinces: BranchProvince[];
  districts: BranchDistrict[];
  isLoading: boolean;
  onSearch: (values: BranchFilterFormValues) => Promise<void>;
}

export function BranchFilterForm({
  provinces,
  districts,
  isLoading,
  onSearch,
}: BranchFilterFormProps) {
  const form = useForm<BranchFilterFormValues>({
    resolver: zodResolver(branchFilterSchema),
    defaultValues: {
      keyword: "",
      province_id: "",
      district_id: "",
      accepts_counter_dropoff: false,
    },
  });

  const provinceId = form.watch("province_id");
  const filteredDistricts = provinceId
    ? districts.filter(
        (district) => district.province_id === Number(provinceId),
      )
    : districts;

  useEffect(() => {
    const districtId = form.getValues("district_id");
    if (
      districtId &&
      !filteredDistricts.some(
        (district) => String(district.id) === districtId,
      )
    ) {
      form.setValue("district_id", "");
    }
  }, [filteredDistricts, form]);

  return (
    <form
      className="grid gap-3 md:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_minmax(220px,1.4fr)_auto]"
      onSubmit={form.handleSubmit(onSearch)}
      noValidate
    >
      <div className="space-y-1">
        <label className="text-sm font-medium">Tỉnh/thành</label>
        <Select
          value={provinceId}
          onValueChange={(value) =>
            form.setValue("province_id", value === "all" ? "" : value)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Tất cả tỉnh/thành" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả tỉnh/thành</SelectItem>
            {provinces.map((province) => (
              <SelectItem key={province.id} value={String(province.id)}>
                {province.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Quận/huyện</label>
        <Select
          value={form.watch("district_id")}
          onValueChange={(value) =>
            form.setValue("district_id", value === "all" ? "" : value)
          }
          disabled={!provinceId && provinces.length > 0}
        >
          <SelectTrigger>
            <SelectValue placeholder="Tất cả quận/huyện" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả quận/huyện</SelectItem>
            {filteredDistricts.map((district) => (
              <SelectItem key={district.id} value={String(district.id)}>
                {district.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="branch-keyword">
          Từ khóa
        </label>
        <Input
          id="branch-keyword"
          placeholder="Tên, mã bưu cục hoặc địa chỉ"
          aria-invalid={Boolean(form.formState.errors.keyword)}
          {...form.register("keyword")}
        />
        {form.formState.errors.keyword && (
          <p className="text-sm text-destructive">
            {form.formState.errors.keyword.message}
          </p>
        )}
      </div>

      <div className="flex items-end">
        <Button type="submit" disabled={isLoading} className="w-full md:w-auto">
          <Search className="h-4 w-4" aria-hidden="true" />
          {isLoading ? "Đang tìm..." : "Tìm bưu cục"}
        </Button>
      </div>

      <label className="flex items-center gap-2 text-sm md:col-span-4">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-input"
          {...form.register("accepts_counter_dropoff")}
        />
        Chỉ hiển thị bưu cục nhận gửi tại quầy
      </label>
    </form>
  );
}
