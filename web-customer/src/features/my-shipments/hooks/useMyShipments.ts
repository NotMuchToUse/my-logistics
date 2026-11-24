import { useCallback, useEffect, useState } from "react";
import {
  cancelPickupRequestApi,
  fetchCustomerShipmentsApi,
} from "@/features/my-shipments/api/my-shipments.api";
import type {
  CustomerShipmentsData,
  PickupRequestRecord,
} from "@/features/my-shipments/types/my-shipments.types";

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
    : "Không thể tải dữ liệu vận đơn. Vui lòng thử lại.";
}

export function useMyShipments() {
  const [data, setData] = useState<CustomerShipmentsData>({
    shipments: [],
    pickupRequests: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [cancellingPublicId, setCancellingPublicId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(() => fetchCustomerShipmentsApi(), []);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setData(await loadData());
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }, [loadData]);

  useEffect(() => {
    let active = true;

    fetchCustomerShipmentsApi()
      .then((response) => {
        if (active) {
          setData(response);
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(getErrorMessage(requestError));
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const cancelPickupRequest = useCallback(
    async (request: PickupRequestRecord, reason: string) => {
      setCancellingPublicId(request.public_id);
      setError(null);

      try {
        const cancelledRequest = await cancelPickupRequestApi(
          request.public_id,
          reason,
        );
        setData((current) => ({
          ...current,
          pickupRequests: current.pickupRequests.map((item) =>
            item.public_id === cancelledRequest.public_id
              ? cancelledRequest
              : item,
          ),
          shipments: current.shipments.map((shipment) =>
            shipment.tracking_code === cancelledRequest.tracking_code &&
            shipment.status === "pending_pickup"
              ? {
                  ...shipment,
                  status: "cancelled",
                  shipment_status_history: [
                    ...shipment.shipment_status_history,
                    {
                      from_status: "pending_pickup",
                      to_status: "cancelled",
                      description: "Yêu cầu lấy hàng đã được khách hàng hủy.",
                      is_public_visible: 1,
                      occurred_at: new Date()
                        .toISOString()
                        .replace("T", " ")
                        .slice(0, 19),
                    },
                  ],
                }
              : shipment,
          ),
        }));
        return true;
      } catch (requestError: unknown) {
        setError(getErrorMessage(requestError));
        return false;
      } finally {
        setCancellingPublicId(null);
      }
    },
    [],
  );

  return {
    ...data,
    isLoading,
    cancellingPublicId,
    error,
    reload,
    cancelPickupRequest,
    clearError: () => setError(null),
  };
}
