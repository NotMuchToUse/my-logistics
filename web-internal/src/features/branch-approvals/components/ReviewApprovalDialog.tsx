import { useState } from "react";
import { Check, ExternalLink, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { reviewBranchApproval } from "../api/branch-approvals.api";
import { APPROVAL_TYPE_LABELS } from "../constants/branch-approvals.constants";
import { reviewApprovalSchema } from "../schemas/branch-approvals.schema";
import type {
  ApprovalRequestStatus,
  BranchApproval,
} from "../types/branch-approvals.types";

interface ReviewApprovalDialogProps {
  approval: BranchApproval | null;
  onOpenChange: (open: boolean) => void;
  reviewerName: string;
  onReviewed: (approval: BranchApproval) => void;
}

export function ReviewApprovalDialog({
  approval,
  onOpenChange,
  reviewerName,
  onReviewed,
}: ReviewApprovalDialogProps) {
  const [reviewNote, setReviewNote] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleReview(
    status: Extract<ApprovalRequestStatus, "approved" | "rejected">,
  ) {
    if (!approval) return;
    const parsed = reviewApprovalSchema.safeParse({ review_note: reviewNote });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Vui lòng nhập ghi chú.");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      const updated = await reviewBranchApproval(
        approval,
        { status, review_note: parsed.data.review_note, version: approval.version },
        reviewerName,
      );
      toast.success(
        status === "approved"
          ? "Đã phê duyệt yêu cầu."
          : "Đã từ chối yêu cầu.",
      );
      onReviewed(updated);
      onOpenChange(false);
    } catch (reviewError) {
      toast.error(getErrorMessage(reviewError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={approval !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {approval && (
          <>
            <DialogHeader>
              <DialogTitle>Xét duyệt yêu cầu</DialogTitle>
              <DialogDescription>
                Vận đơn {approval.tracking_number} ·{" "}
                {APPROVAL_TYPE_LABELS[approval.request_type]}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{approval.branch_code ?? `CN-${approval.branch_id}`}</Badge>
                <span className="text-sm text-muted-foreground">
                  {approval.branch_name ?? `Chi nhánh #${approval.branch_id}`}
                </span>
              </div>
              <div className="rounded-md bg-muted/50 p-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Lý do đề nghị
                </p>
                <p className="whitespace-pre-wrap text-sm">{approval.reason}</p>
              </div>

              <section className="space-y-2" aria-label="Chứng từ đính kèm">
                <h3 className="text-sm font-medium">
                  Chứng từ đính kèm ({approval.evidence_urls.length})
                </h3>
                {approval.evidence_urls.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {approval.evidence_urls.map((url, index) => {
                      const safeUrl = getSafeHttpUrl(url);
                      return (
                        <div
                          key={`${url}-${index}`}
                          className="overflow-hidden rounded-md border"
                        >
                          {safeUrl ? (
                            <>
                              <a
                                href={safeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block"
                                aria-label={`Mở chứng từ ${index + 1} ở tab mới`}
                              >
                                <img
                                  src={safeUrl}
                                  alt={`Chứng từ ${index + 1}`}
                                  loading="lazy"
                                  className="h-28 w-full bg-muted object-cover"
                                />
                              </a>
                              <a
                                href={safeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 truncate px-2 py-2 text-xs text-primary hover:underline"
                              >
                                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                                Mở chứng từ {index + 1}
                              </a>
                            </>
                          ) : (
                            <p className="p-3 text-xs text-destructive">
                              URL chứng từ không hợp lệ.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Không có chứng từ đính kèm.
                  </p>
                )}
              </section>

              <div className="space-y-1.5">
                <Label htmlFor="approval-review-note">
                  Ghi chú xét duyệt *
                </Label>
                <textarea
                  id="approval-review-note"
                  value={reviewNote}
                  onChange={(event) => setReviewNote(event.target.value)}
                  rows={3}
                  maxLength={1000}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Ghi rõ căn cứ phê duyệt hoặc từ chối..."
                />
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Đóng
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => void handleReview("rejected")}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <X className="mr-2 h-4 w-4" />
                )}
                Từ chối
              </Button>
              <Button
                type="button"
                onClick={() => void handleReview("approved")}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Phê duyệt
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function getSafeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
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
    : "Không thể xét duyệt yêu cầu.";
}
