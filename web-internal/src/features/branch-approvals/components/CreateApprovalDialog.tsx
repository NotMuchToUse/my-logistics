import { useState } from "react";
import { Loader2, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createBranchApproval } from "../api/branch-approvals.api";
import { APPROVAL_TYPE_LABELS } from "../constants/branch-approvals.constants";
import { createApprovalSchema } from "../schemas/branch-approvals.schema";
import type {
  ApprovalBranchOption,
  ApprovalRequestType,
  BranchApproval,
} from "../types/branch-approvals.types";
import { APPROVAL_REQUEST_TYPES } from "../types/branch-approvals.types";

interface CreateApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: ApprovalBranchOption[];
  defaultBranchId: number | null;
  onCreated: (approval: BranchApproval) => void;
}

export function CreateApprovalDialog({
  open,
  onOpenChange,
  branches,
  defaultBranchId,
  onCreated,
}: CreateApprovalDialogProps) {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [requestType, setRequestType] =
    useState<ApprovalRequestType>("cancel_delivered");
  const [branchId, setBranchId] = useState(() =>
    String(
      branches.some((branch) => branch.id === defaultBranchId)
        ? defaultBranchId
        : (branches[0]?.id ?? ""),
    ),
  );
  const [reason, setReason] = useState("");
  const [evidenceUrls, setEvidenceUrls] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = createApprovalSchema.safeParse({
      tracking_number: trackingNumber,
      request_type: requestType,
      branch_id: Number(branchId),
      reason,
      evidence_urls: evidenceUrls,
    });

    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        nextErrors[key] ??= issue.message;
      }
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const created = await createBranchApproval(parsed.data);
      toast.success("Đã gửi yêu cầu phê duyệt.");
      onCreated(created);
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể gửi yêu cầu phê duyệt."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-primary" />
            Gửi yêu cầu phê duyệt
          </DialogTitle>
          <DialogDescription>
            Nhập thông tin vận đơn và đính kèm URL chứng từ nếu có.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="approval-tracking-number">Mã vận đơn *</Label>
              <Input
                id="approval-tracking-number"
                value={trackingNumber}
                onChange={(event) => setTrackingNumber(event.target.value)}
                placeholder="VD: VS26112300200"
                autoComplete="off"
              />
              {errors.tracking_number && (
                <p className="text-xs text-destructive">{errors.tracking_number}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Loại yêu cầu *</Label>
              <Select
                value={requestType}
                onValueChange={(value) =>
                  setRequestType(value as ApprovalRequestType)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APPROVAL_REQUEST_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {APPROVAL_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Chi nhánh *</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn chi nhánh" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={String(branch.id)}>
                    {branch.code} - {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.branch_id && (
              <p className="text-xs text-destructive">{errors.branch_id}</p>
            )}
            {branches.length === 0 && (
              <p role="alert" className="text-xs text-destructive">
                Tài khoản chưa được cấp phạm vi chi nhánh.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="approval-reason">Lý do *</Label>
            <textarea
              id="approval-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              maxLength={1000}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Nêu rõ tình huống và lý do đề nghị..."
            />
            {errors.reason && (
              <p className="text-xs text-destructive">{errors.reason}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="approval-evidence-urls">URL chứng từ</Label>
            <textarea
              id="approval-evidence-urls"
              value={evidenceUrls}
              onChange={(event) => setEvidenceUrls(event.target.value)}
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder={"https://example.com/evidence-1.jpg\nhttps://example.com/evidence-2.jpg"}
            />
            <p className="text-xs text-muted-foreground">
              Mỗi URL trên một dòng, tối đa 10 URL (chỉ chấp nhận HTTP/HTTPS).
            </p>
            {errors.evidence_urls && (
              <p className="text-xs text-destructive">{errors.evidence_urls}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={submitting || branches.length === 0}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Gửi yêu cầu
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
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
  return error instanceof Error ? error.message : fallback;
}
