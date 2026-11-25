import { formatDateTime } from "../../../core/utils/formatters.ts";
import {
  SHIPMENT_STATUS_BADGE_CLASSES,
  SHIPMENT_STATUS_LABELS,
  SHIPMENT_STATUSES,
} from "../constants/shipment-list.constants.ts";
import type { ShipmentStatus } from "@/types/api.types";

const VND_FORMATTER = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export interface ShipmentStatusPresentation {
  status: ShipmentStatus | null;
  label: string;
  className: string;
}

export function formatShipmentAmount(value: unknown): string {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && !/^\d+(?:\.\d{1,2})?$/.test(value))
  ) {
    return "—";
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    try {
      return VND_FORMATTER.format(BigInt(value));
    } catch {
      return "—";
    }
  }

  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0
    ? VND_FORMATTER.format(amount)
    : "—";
}

export function formatShipmentCreatedAt(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") return "—";

  try {
    return formatDateTime(value).replace(" +07:00", "");
  } catch {
    return "—";
  }
}

export function getShipmentStatusPresentation(
  status: unknown,
): ShipmentStatusPresentation {
  const knownStatus =
    typeof status === "string"
      ? SHIPMENT_STATUSES.find((candidate) => candidate === status) ?? null
      : null;

  if (!knownStatus) {
    return {
      status: null,
      label: "Không xác định",
      className: "border-slate-200 bg-slate-100 text-slate-700",
    };
  }

  return {
    status: knownStatus,
    label: SHIPMENT_STATUS_LABELS[knownStatus],
    className: SHIPMENT_STATUS_BADGE_CLASSES[knownStatus],
  };
}

export function getShipmentErrorMessage(
  error: unknown,
  fallback = "Đã xảy ra lỗi khi xử lý vận đơn.",
): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error !== "object" || error === null || !("error" in error)) {
    return fallback;
  }

  const apiError = error.error;
  return typeof apiError === "object" &&
    apiError !== null &&
    "message" in apiError &&
    typeof apiError.message === "string"
    ? apiError.message
    : fallback;
}
