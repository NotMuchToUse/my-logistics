import { Link } from "react-router-dom";
import { LoaderCircle, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/EmptyState";
import { PICKUP_MODES } from "../constants/pickup.constants";
import { IS_PICKUP_DEMO } from "../api/pickup.api";
import { usePickupCreate } from "../hooks/usePickupCreate";
import { DropoffMap } from "../components/DropoffMap";
import { useCustomerAuthStore } from "@/core/stores/useCustomerAuthStore";

export function PickupCreatePage() {
  const owner = useCustomerAuthStore((state) => state.customer?.public_id);
  return <PickupCreateForm key={owner ?? "anonymous"} />;
}

function PickupCreateForm() {
  const pickup = usePickupCreate();
  const { form, options, loading, loadError, receipt, sending, pendingRetry } = pickup;
  const values = form.watch();
  const { errors } = form.formState;
  const locked = sending || pendingRetry;
  const selectedAddress = options.addresses.find((address) => String(address.id) === values.addressId);
  const selectedBranch = options.branches.find((branch) => branch.public_id === values.branchPublicId);
  const fieldError = (message?: string) => message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null;

  return (
    <section className="min-w-0 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Tạo yêu cầu gửi hàng</h1>
        <p className="text-sm text-muted-foreground sm:text-base">Chọn cách gửi và cung cấp số kiện, trọng lượng dự kiến.</p>
      </header>
      {IS_PICKUP_DEMO && <p role="status" className="rounded-md border bg-amber-50 p-4 text-sm text-amber-800">Chế độ dùng thử — địa chỉ, bưu cục và kết quả tạo yêu cầu là dữ liệu mẫu. Không có tài xế được điều phối.</p>}
      {loading ? <div role="status" aria-label="Đang tải địa chỉ và bưu cục" className="space-y-4">
        {[1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-md bg-muted" />)}
      </div> : loadError ? <Card><CardContent className="space-y-4 pt-6">
        <p role="alert" className="text-sm text-destructive">{loadError}</p>
        <Button type="button" variant="outline" onClick={pickup.reload}>Thử tải lại</Button>
      </CardContent></Card> : receipt ? <Card><CardHeader><CardTitle>Đã tạo yêu cầu dùng thử</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p role="status">Mã yêu cầu: <span className="font-mono text-sm font-medium">{receipt.request_code}</span></p>
          <p className="text-sm">{receipt.estimated_parcel_count} kiện · {receipt.estimated_weight_gram.toLocaleString("vi-VN")} gram · Chờ xử lý</p>
          <p className="text-sm text-muted-foreground">Yêu cầu mẫu chỉ tồn tại trong phiên dùng thử hiện tại, chưa xuất hiện trong lịch sử vận đơn thật.</p>
          <Button type="button" onClick={pickup.startNew}>Tạo yêu cầu khác</Button>
        </CardContent>
      </Card> : <form onSubmit={form.handleSubmit(pickup.submit)} noValidate className="space-y-6">
        <fieldset disabled={locked} className="space-y-3">
          <legend className="mb-3 font-semibold">Hình thức gửi hàng</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {PICKUP_MODES.map((mode) => <label key={mode.value} className={`flex cursor-pointer items-start gap-3 rounded-md border p-4 ${values.handoverMode === mode.value ? "border-primary bg-muted/40" : ""}`}>
              <input type="radio" value={mode.value} className="mt-1 h-4 w-4 accent-current" {...form.register("handoverMode")} />
              <span><span className="block font-medium">{mode.label}</span><span className="text-sm text-muted-foreground">{mode.description}</span></span>
            </label>)}
          </div>
        </fieldset>
        <Card><CardHeader><CardTitle>{values.handoverMode === "driver_pickup" ? "Địa chỉ lấy hàng" : "Bưu cục nhận hàng"}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {values.handoverMode === "driver_pickup" ? <>
              {options.addresses.length === 0 ? <EmptyState title="Chưa có địa chỉ gửi hàng" description="Thêm địa chỉ gửi trong sổ địa chỉ trước khi yêu cầu tài xế đến lấy." action={<Button asChild variant="outline"><Link to="/customer/address-book">Mở sổ địa chỉ</Link></Button>} /> : <>
                <Label htmlFor="pickup-address">Chọn địa chỉ đã lưu</Label>
                <select id="pickup-address" disabled={locked} aria-invalid={!!errors.addressId} className="h-11 w-full rounded-md border bg-background px-3 text-base sm:text-sm" {...form.register("addressId")}>
                  <option value="">Chọn địa chỉ</option>
                  {options.addresses.map((address) => <option key={address.id} value={address.id}>{address.label} — {address.address_detail}</option>)}
                </select>
                {selectedAddress && <div className="rounded-md bg-muted/40 p-4 text-sm"><p className="font-medium">{selectedAddress.contact_name} · {selectedAddress.phone_masked}</p><p className="mt-1">{selectedAddress.address_detail}</p></div>}
              </>}
              {fieldError(errors.addressId?.message)}
            </> : <>
              {options.branches.length === 0 ? <EmptyState title="Chưa có bưu cục nhận hàng" description="Vui lòng thử lại sau hoặc chọn tài xế đến lấy hàng." /> : <>
                <DropoffMap branches={options.branches} selected={values.branchPublicId} disabled={locked} onSelect={(id) => form.setValue("branchPublicId", id, { shouldValidate: true, shouldDirty: true })} />
                <Label htmlFor="pickup-branch">Chọn bưu cục</Label>
                <select id="pickup-branch" disabled={locked} aria-invalid={!!errors.branchPublicId} className="h-11 w-full rounded-md border bg-background px-3 text-base sm:text-sm" {...form.register("branchPublicId")}>
                  <option value="">Chọn bưu cục</option>
                  {options.branches.map((branch) => <option key={branch.public_id} value={branch.public_id}>{branch.name}</option>)}
                </select>
                {selectedBranch && <div className="rounded-md bg-muted/40 p-4 text-sm"><p className="font-medium">{selectedBranch.name}</p><p>{selectedBranch.address_detail}</p><p className="mt-1 text-muted-foreground">Giờ mở cửa: {selectedBranch.operating_hours}</p></div>}
              </>}
              {fieldError(errors.branchPublicId?.message)}
            </>}
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle>Thông tin kiện hàng</CardTitle></CardHeader><CardContent>
          <fieldset disabled={locked} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="parcel-count">Số kiện dự kiến</Label><Input id="parcel-count" type="number" inputMode="numeric" min="1" step="1" aria-invalid={!!errors.parcelCount} {...form.register("parcelCount", { valueAsNumber: true })} />{fieldError(errors.parcelCount?.message)}</div>
            <div className="space-y-2"><Label htmlFor="weight-gram">Tổng trọng lượng dự kiến (gram)</Label><Input id="weight-gram" type="number" inputMode="numeric" min="1" step="1" aria-invalid={!!errors.weightGram} {...form.register("weightGram", { valueAsNumber: true })} />{fieldError(errors.weightGram?.message)}<p className="text-sm text-muted-foreground">1 kg = 1.000 gram</p></div>
          </fieldset>
        </CardContent></Card>
        {fieldError(errors.root?.server?.message)}
        {pendingRetry && <p role="status" className="text-sm">Chưa xác nhận được kết quả. Thử lại sẽ giữ nguyên thông tin và mã thao tác để tránh tạo trùng.</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="submit" className="w-full sm:w-auto" disabled={sending || (values.handoverMode === "driver_pickup" ? options.addresses.length === 0 : options.branches.length === 0)}>
            {sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}
            {sending ? "Đang gửi yêu cầu…" : pendingRetry ? "Thử gửi lại" : "Tạo yêu cầu gửi hàng"}
          </Button>
        </div>
      </form>}
    </section>
  );
}
