import type { PickupRequestStatus } from "@/types/api.types";
import { SLA_WARNING_MINUTES } from "../constants/pickup-dispatch.constants";
import type { SlaUrgency } from "../types/pickup-dispatch.types";

export interface SlaEvaluation {
  urgency: SlaUrgency;
  label: string;
  minutesDiff: number | null;
}

const TERMINAL_STATUSES: readonly PickupRequestStatus[] = [
  "picked_up",
  "cancelled",
];

export function parseVietnamDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
    ? value
    : `${value.replace(" ", "T")}+07:00`;
  const parsed = new Date(normalized);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDurationMinutes(absMinutes: number): string {
  if (absMinutes < 60) {
    return `${absMinutes} phút`;
  }
  const hours = Math.floor(absMinutes / 60);
  const mins = absMinutes % 60;
  return mins > 0 ? `${hours}g ${mins}p` : `${hours} giờ`;
}

export function evaluateSlaStatus(
  slaDeadlineAt: string | null | undefined,
  status: PickupRequestStatus,
  now: Date = new Date(),
): SlaEvaluation {
  if (TERMINAL_STATUSES.includes(status)) {
    return {
      urgency: "completed",
      label: status === "picked_up" ? "Hoàn tất lấy hàng" : "Đã hủy",
      minutesDiff: null,
    };
  }

  const deadline = parseVietnamDate(slaDeadlineAt);
  if (!deadline) {
    return {
      urgency: "normal",
      label: "Chưa thiết lập SLA",
      minutesDiff: null,
    };
  }

  const diffMinutes = Math.round((deadline.getTime() - now.getTime()) / 60_000);

  if (diffMinutes < 0) {
    return {
      urgency: "overdue",
      label: `Quá hạn SLA ${formatDurationMinutes(Math.abs(diffMinutes))}`,
      minutesDiff: diffMinutes,
    };
  }

  if (diffMinutes <= SLA_WARNING_MINUTES) {
    return {
      urgency: "warning",
      label:
        diffMinutes === 0
          ? "Đến hạn SLA ngay bây giờ"
          : `Sắp trễ SLA (còn ${diffMinutes} phút)`,
      minutesDiff: diffMinutes,
    };
  }

  return {
    urgency: "normal",
    label: `Còn ${formatDurationMinutes(diffMinutes)}`,
    minutesDiff: diffMinutes,
  };
}