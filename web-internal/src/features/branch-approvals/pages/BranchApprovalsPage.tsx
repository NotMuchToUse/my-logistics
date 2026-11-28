import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { useBranchScopeStore } from "@/core/stores/useBranchScopeStore";
import {
  APPROVAL_STATUS_META,
  APPROVAL_TYPE_LABELS,
  FALLBACK_APPROVAL_BRANCHES,
} from "../constants/branch-approvals.constants";
import { getBranchApprovals } from "../api/branch-approvals.api";
import { CreateApprovalDialog } from "../components/CreateApprovalDialog";
import { ReviewApprovalDialog } from "../components/ReviewApprovalDialog";
import type {
  ApprovalBranchOption,
  ApprovalRequestStatus,
  ApprovalRequestType,
  BranchApproval,
  BranchApprovalFilters,
} from "../types/branch-approvals.types";
import { APPROVAL_REQUEST_TYPES } from "../types/branch-approvals.types";

const INITIAL_FILTERS: BranchApprovalFilters = {
  search: "",
  status: "all",
  request_type: "all",
};

export function BranchApprovalsPage() {
  const roles = useAuthStore((state) => state.roles); 
  const reviewerName = useAuthStore(
    (state) => state.user?.full_name ?? "Quản lý chi nhánh",
  );
  const scopes = useBranchScopeStore((state) => state.scopes);
  const activeBranchId = useBranchScopeStore((state) => state.activeBranchId);
  const canCreate = roles.includes("coordinator");
  const canReview = roles.includes("branch_manager");
  const canInspectAll = roles.includes("system_admin");
  const canAccess = canCreate || canReview || canInspectAll;
  const [approvals, setApprovals] = useState<BranchApproval[]>([]);
  const [filters, setFilters] =
    useState<BranchApprovalFilters>(INITIAL_FILTERS);
  const [loading, setLoading] = useState(canAccess);
  const [loadError, setLoadError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [reviewing, setReviewing] = useState<BranchApproval | null>(null);
  const loadSequence = useRef(0);

  const branches = useMemo<ApprovalBranchOption[]>(() => {
    const options = new Map<number, ApprovalBranchOption>();
    for (const scope of scopes) {
      if (scope.branch_id === null) continue;
      const fallback = FALLBACK_APPROVAL_BRANCHES.find(
        (branch) => branch.id === scope.branch_id,
      );
      options.set(scope.branch_id, {
        id: scope.branch_id,
        code: scope.branch_code ?? fallback?.code ?? `CN-${scope.branch_id}`,
        name:
          scope.branch_name ??
          fallback?.name ??
          `Chi nhánh #${scope.branch_id}`,
      });
    }

    if (options.size === 0 && activeBranchId !== null) {
      const fallback = FALLBACK_APPROVAL_BRANCHES.find(
        (branch) => branch.id === activeBranchId,
      );
      options.set(activeBranchId, {
        id: activeBranchId,
        code: fallback?.code ?? `CN-${activeBranchId}`,
        name: fallback?.name ?? `Chi nhánh #${activeBranchId}`,
      });
    }
    return [...options.values()];
  }, [activeBranchId, scopes]);

  const loadApprovals = useCallback(async () => {
    const sequence = ++loadSequence.current;
    try {
      const result = await getBranchApprovals(filters);
      if (sequence === loadSequence.current) setApprovals(result);
    } catch (error) {
      if (sequence !== loadSequence.current) return;
      const message = getErrorMessage(error);
      setLoadError(message);
      toast.error(message);
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (canAccess) void loadApprovals();
  }, [canAccess, loadApprovals]);

  if (!canAccess) {
    return (
      <section className="space-y-3 py-10 text-center">
        <h1 className="text-xl font-semibold">Phê duyệt chi nhánh</h1>
        <p role="status" className="text-sm text-muted-foreground">
          Chức năng dành cho Điều phối viên và Quản lý chi nhánh.
        </p>
      </section>
    );
  }

  function updateFilter<Key extends keyof BranchApprovalFilters>(
    key: Key,
    value: BranchApprovalFilters[Key],
  ) {
    if (filters[key] === value) return;
    setLoadError("");
    setLoading(true);
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function handleCreated(created: BranchApproval) {
    setApprovals((current) => [created, ...current]);
    setLoadError("");
    setFilters({ search: "", status: "pending", request_type: "all" });
  }

  function handleReviewed(updated: BranchApproval) {
    setApprovals((current) => {
      const next = current.map((request) =>
        request.public_id === updated.public_id ? updated : request,
      );
      return filters.status !== "all" && updated.status !== filters.status
        ? next.filter((request) => request.public_id !== updated.public_id)
        : next;
    });
    setReviewing(null);
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Phê duyệt chi nhánh
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Theo dõi và xử lý yêu cầu liên quan đến vận đơn trong phạm vi chi nhánh.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setLoadError("");
              setLoading(true);
              void loadApprovals();
            }}
            disabled={loading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Làm mới
          </Button>
          {canCreate && (
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Gửi yêu cầu
            </Button>
          )}
        </div>
      </header>

      <div className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-[minmax(15rem,1fr)_12rem_16rem]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Tìm mã vận đơn hoặc nội dung yêu cầu"
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
            placeholder="Tìm mã vận đơn, chi nhánh, lý do..."
            className="pl-9"
          />
        </div>
        <Select
          value={filters.status}
          onValueChange={(value) =>
            updateFilter("status", value as ApprovalRequestStatus | "all")
          }
        >
          <SelectTrigger aria-label="Lọc theo trạng thái">
            <SelectValue placeholder="Tất cả trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            {(["pending", "approved", "rejected"] as const).map((status) => (
              <SelectItem key={status} value={status}>
                {APPROVAL_STATUS_META[status].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.request_type}
          onValueChange={(value) =>
            updateFilter(
              "request_type",
              value as ApprovalRequestType | "all",
            )
          }
        >
          <SelectTrigger aria-label="Lọc theo loại yêu cầu">
            <SelectValue placeholder="Tất cả loại yêu cầu" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả loại yêu cầu</SelectItem>
            {APPROVAL_REQUEST_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {APPROVAL_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-medium">Yêu cầu phê duyệt</h2>
          <span className="text-sm text-muted-foreground">
            {approvals.length} yêu cầu
          </span>
        </div>
        {loadError && (
          <div role="alert" className="border-b bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {loadError}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Vận đơn</th>
                <th scope="col" className="px-4 py-3 font-medium">Loại yêu cầu</th>
                <th scope="col" className="px-4 py-3 font-medium">Chi nhánh</th>
                <th scope="col" className="px-4 py-3 font-medium">Người gửi</th>
                <th scope="col" className="px-4 py-3 font-medium">Ngày gửi</th>
                <th scope="col" className="px-4 py-3 font-medium">Trạng thái</th>
                <th scope="col" className="px-4 py-3 font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {approvals.map((approval) => (
                <tr key={approval.public_id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium">{approval.tracking_number}</p>
                    <p className="mt-1 max-w-xs truncate text-xs text-muted-foreground">
                      {approval.reason}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {APPROVAL_TYPE_LABELS[approval.request_type]}
                  </td>
                  <td className="px-4 py-3">
                    <p>{approval.branch_name ?? `Chi nhánh #${approval.branch_id}`}</p>
                    <p className="text-xs text-muted-foreground">
                      {approval.branch_code ?? `CN-${approval.branch_id}`}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {approval.requested_by_name ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {formatDate(approval.requested_at)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={APPROVAL_STATUS_META[approval.status].className}
                    >
                      {APPROVAL_STATUS_META[approval.status].label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {canReview && approval.status === "pending" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setReviewing(approval)}
                      >
                        Xét duyệt
                      </Button>
                    ) : approval.review_note ? (
                      <span
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                        title={approval.review_note}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Có ghi chú
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && approvals.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    Không tìm thấy yêu cầu phù hợp.
                  </td>
                </tr>
              )}
              {loading && approvals.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    Đang tải danh sách...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {canCreate && (
        <CreateApprovalDialog
          key={
            createOpen
              ? `create-open-${activeBranchId ?? "none"}`
              : "create-closed"
          }
          open={createOpen}
          onOpenChange={setCreateOpen}
          branches={branches}
          defaultBranchId={activeBranchId}
          onCreated={handleCreated}
        />
      )}
      {canReview && (
        <ReviewApprovalDialog
          key={
            reviewing
              ? `review-${reviewing.public_id}`
              : "review-closed"
          }
          approval={reviewing}
          onOpenChange={(open) => {
            if (!open) setReviewing(null);
          }}
          reviewerName={reviewerName}
          onReviewed={handleReviewed}
        />
      )}
    </section>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "error" in error &&
    typeof error.error === "object" &&
    error.error !== null &&
    "message" in error.error &&
    typeof error.error.message === "string"
  ) {
    return error.error.message;
  }
  return error instanceof Error
    ? error.message
    : "Không thể tải danh sách yêu cầu.";
}
