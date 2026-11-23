import { Printer } from "lucide-react";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export function WaybillPrintPage() {
  return (
    <PagePlaceholder
      title="Phiếu gửi & in ấn"
      description="Khung trang xem và in chứng từ vận chuyển."
      icon={Printer}
    />
  );
}
