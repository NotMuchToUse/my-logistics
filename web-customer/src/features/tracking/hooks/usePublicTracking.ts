import { useState } from "react";
import { fetchPublicTrackingApi } from "@/features/tracking/api/tracking.api";
import type { TrackingSearchResult } from "@/features/tracking/types/tracking.types";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

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

  return "Không thể tra cứu vận đơn. Vui lòng thử lại.";
}

export function usePublicTracking() {
  const [results, setResults] = useState<TrackingSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  async function searchTracking(codes: string[]): Promise<void> {
    setIsLoading(true);

    try {
      const uniqueCodes = [...new Set(codes.map((code) => code.toUpperCase()))];
      const trackingResults = await Promise.all(
        uniqueCodes.map(async (tracking_code) => {
          try {
            const shipment = await fetchPublicTrackingApi(tracking_code);
            return { tracking_code, shipment };
          } catch (error: unknown) {
            return { tracking_code, error: getErrorMessage(error) };
          }
        }),
      );

      setResults(trackingResults);
    } finally {
      setIsLoading(false);
    }
  }

  return { results, isLoading, searchTracking };
}
