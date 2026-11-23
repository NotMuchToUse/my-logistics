import {
  Activity,
  Banknote,
  Boxes,
  Building2,
  ClipboardList,
  FileBarChart,
  FileCheck2,
  FileClock,
  FileInput,
  FileOutput,
  FileText,
  Gauge,
  MapPinned,
  Package,
  PackageCheck,
  PackagePlus,
  PackageSearch,
  Printer,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Truck,
  UserCog,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { USE_MOCK } from "@/core/api/axiosClient";
import { useAuthStore } from "@/core/stores/useAuthStore";

interface MenuItem {
  to: string;
  label: string;
  icon: LucideIcon;
  permissionCode: string | null;
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

// Permission codes are omitted until the API contract defines the per-feature mapping.
const menuGroups: MenuGroup[] = [
  {
    title: "Mạng lưới & người dùng",
    items: [
      {
        to: "/network-org",
        label: "Mạng lưới chi nhánh",
        icon: Building2,
        permissionCode: null,
      },
      {
        to: "/user-management",
        label: "Người dùng & phân quyền",
        icon: Users,
        permissionCode: null,
      },
    ],
  },
  {
    title: "Danh mục & cấu hình",
    items: [
      {
        to: "/pricing-catalog",
        label: "Danh mục & bảng giá",
        icon: Banknote,
        permissionCode: null,
      },
      {
        to: "/ops-config",
        label: "Cấu hình vận hành",
        icon: Settings,
        permissionCode: null,
      },
    ],
  },
  {
    title: "Điều phối lấy hàng",
    items: [
      {
        to: "/pickup-dispatch",
        label: "Điều phối lấy hàng",
        icon: Truck,
        permissionCode: null,
      },
    ],
  },
  {
    title: "Vận đơn",
    items: [
      {
        to: "/shipment-create",
        label: "Tạo vận đơn",
        icon: PackagePlus,
        permissionCode: null,
      },
      {
        to: "/shipment-list",
        label: "Danh sách vận đơn",
        icon: PackageSearch,
        permissionCode: null,
      },
      {
        to: "/shipment-detail",
        label: "Chi tiết vận đơn",
        icon: PackageCheck,
        permissionCode: null,
      },
      {
        to: "/shipment-bulk-import",
        label: "Nhập vận đơn hàng loạt",
        icon: FileInput,
        permissionCode: null,
      },
      {
        to: "/shipment-exceptions",
        label: "Đơn chờ xử lý",
        icon: ShieldAlert,
        permissionCode: null,
      },
      {
        to: "/shipment-incidents",
        label: "Sự cố vận đơn",
        icon: Activity,
        permissionCode: null,
      },
      {
        to: "/branch-approvals",
        label: "Phê duyệt chi nhánh",
        icon: ShieldCheck,
        permissionCode: null,
      },
      {
        to: "/waybill-print",
        label: "Phiếu gửi & in ấn",
        icon: Printer,
        permissionCode: null,
      },
    ],
  },
  {
    title: "Kho vận",
    items: [
      {
        to: "/warehouse-inbound",
        label: "Nhập kho",
        icon: FileInput,
        permissionCode: null,
      },
      {
        to: "/warehouse-bags",
        label: "Túi hàng & niêm phong",
        icon: Boxes,
        permissionCode: null,
      },
      {
        to: "/warehouse-outbound-linehaul",
        label: "Xuất kho trung chuyển",
        icon: FileOutput,
        permissionCode: null,
      },
      {
        to: "/warehouse-outbound-delivery",
        label: "Xuất kho giao hàng",
        icon: Package,
        permissionCode: null,
      },
      {
        to: "/warehouse-history",
        label: "Lịch sử kho",
        icon: FileClock,
        permissionCode: null,
      },
      {
        to: "/warehouse-audit",
        label: "Kiểm kê kho",
        icon: ClipboardList,
        permissionCode: null,
      },
    ],
  },
  {
    title: "Tài chính",
    items: [
      {
        to: "/branch-cod-collection",
        label: "Thu COD tại bưu cục",
        icon: Banknote,
        permissionCode: null,
      },
      {
        to: "/branch-remittance",
        label: "Nộp tiền về trung tâm",
        icon: FileCheck2,
        permissionCode: null,
      },
      {
        to: "/hq-finance",
        label: "Tài chính trung tâm",
        icon: Gauge,
        permissionCode: null,
      },
      {
        to: "/compensations",
        label: "Hồ sơ đền bù",
        icon: FileText,
        permissionCode: null,
      },
    ],
  },
  {
    title: "Báo cáo & hệ thống",
    items: [
      {
        to: "/auth",
        label: "Tài khoản & xác thực",
        icon: UserCog,
        permissionCode: null,
      },
      {
        to: "/driver-gps-monitor",
        label: "Giám sát GPS tài xế",
        icon: MapPinned,
        permissionCode: null,
      },
      {
        to: "/reports-analytics",
        label: "Báo cáo & phân tích",
        icon: FileBarChart,
        permissionCode: null,
      },
      {
        to: "/system-logs-settings",
        label: "Nhật ký & cài đặt",
        icon: Workflow,
        permissionCode: null,
      },
    ],
  },
];

export interface DynamicSidebarProps {
  onNavigate?: () => void;
}

export function DynamicSidebar({ onNavigate }: DynamicSidebarProps) {
  const hasPermission = useAuthStore((state) => state.hasPermission);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex h-16 shrink-0 items-center border-b px-5">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <PackageCheck className="h-5 w-5" aria-hidden="true" />
          <span>Vietstar Logistics</span>
        </div>
      </div>
      <nav
        aria-label="Phân hệ vận hành"
        className="space-y-5 px-3 py-5"
      >
        {menuGroups.map((group) => {
          const visibleItems = group.items.filter(
            (item) =>
              USE_MOCK ||
              (item.permissionCode !== null &&
                hasPermission(item.permissionCode)),
          );

          if (visibleItems.length === 0) {
            return null;
          }

          return (
            <section key={group.title} className="space-y-1">
              <h2 className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.title}
              </h2>
              {visibleItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-secondary text-secondary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{label}</span>
                </NavLink>
              ))}
            </section>
          );
        })}
      </nav>
    </div>
  );
}
