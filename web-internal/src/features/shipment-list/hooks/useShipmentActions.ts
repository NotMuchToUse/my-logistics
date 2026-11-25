import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getScopeKey,
  useBranchScopeStore,
} from "@/core/stores/useBranchScopeStore";
import { useAuthStore } from "@/core/stores/useAuthStore";
import {
  SHIPMENT_LIST_PERMISSIONS,
} from "../constants/shipment-list.constants.ts";
import {
  shipmentCancelMutationSchema,
  shipmentPriorityMutationSchema,
  shipmentPublicIdSchema,
} from "../schemas/shipment-list.schema.ts";
import {
  cancelShipmentApi,
  updateShipmentPriorityApi,
} from "../api/shipment-list.api";
import type { ShipmentListItem } from "../types/shipment-list.types";
import {
  canCancelShipmentStatus,
  getShipmentApiErrorCode,
  hasShipmentPermission,
  isMutationOutcomeUncertain,
  shouldRefetchAfterMutationError,
} from "./shipment-list.hook-logic";

interface ShipmentActionTarget {
  public_id: string;
  version: number;
  status: ShipmentListItem["status"];
}

interface ShipmentActionError {
  publicId: string;
  error: unknown;
  outcomeUnknown: boolean;
  scopeKey: string;
}

function currentScopeKey(): string {
  const auth = useAuthStore.getState();
  const scope = useBranchScopeStore.getState().activeScope;
  return JSON.stringify([
    auth.isAuthenticated,
    auth.user?.public_id ?? null,
    auth.permissions,
    scope ? getScopeKey(scope) : "none",
  ]);
}

export function useShipmentActions(refetch: () => void) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userPublicId = useAuthStore((state) => state.user?.public_id ?? null);
  const permissions = useAuthStore((state) => state.permissions);
  const activeScope = useBranchScopeStore((state) => state.activeScope);
  const scopeKey = JSON.stringify([
    isAuthenticated,
    userPublicId,
    permissions,
    activeScope ? getScopeKey(activeScope) : "none",
  ]);
  const canUpdatePriority =
    isAuthenticated && hasShipmentPermission(permissions, "priority");
  const canCancel =
    isAuthenticated && hasShipmentPermission(permissions, "cancel");

  const [pendingKeys, setPendingKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [actionError, setActionError] =
    useState<ShipmentActionError | null>(null);
  const pendingLocks = useRef(new Set<string>());
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const runMutation = useCallback(
    async <T>(
      action: "priority" | "cancel",
      publicId: string,
      operation: () => Promise<T>,
    ): Promise<T> => {
      const permission = SHIPMENT_LIST_PERMISSIONS[action];
      const auth = useAuthStore.getState();
      if (!auth.isAuthenticated || !auth.hasPermission(permission)) {
        throw new Error(`Thiếu quyền ${permission} để thực hiện thao tác.`);
      }

      const operationScopeKey = currentScopeKey();
      const pendingKey = `${operationScopeKey}\u001f${publicId}`;
      if (pendingLocks.current.has(pendingKey)) {
        throw new Error("Thao tác vận đơn này đang được xử lý.");
      }

      pendingLocks.current.add(pendingKey);
      if (mounted.current) {
        setPendingKeys((current) => new Set(current).add(pendingKey));
        setActionError(null);
      }

      try {
        const result = await operation();
        if (mounted.current && currentScopeKey() === operationScopeKey) {
          refetch();
        }
        return result;
      } catch (error) {
        if (mounted.current && currentScopeKey() === operationScopeKey) {
          setActionError({
            publicId,
            error,
            outcomeUnknown: isMutationOutcomeUncertain(error),
            scopeKey: operationScopeKey,
          });
          if (shouldRefetchAfterMutationError(error)) {
            refetch();
          }
        }
        throw error;
      } finally {
        pendingLocks.current.delete(pendingKey);
        if (mounted.current) {
          setPendingKeys((current) => {
            const next = new Set(current);
            next.delete(pendingKey);
            return next;
          });
        }
      }
    },
    [refetch],
  );

  const updatePriority = useCallback(
    (
      shipment: ShipmentActionTarget,
      isPriority: boolean,
    ) => {
      const publicId = shipmentPublicIdSchema.parse(shipment.public_id);
      const payload = shipmentPriorityMutationSchema.parse({
        is_priority: isPriority,
        version: shipment.version,
      });

      return runMutation("priority", publicId, () =>
        updateShipmentPriorityApi(publicId, payload),
      );
    },
    [runMutation],
  );

  const cancel = useCallback(
    (shipment: ShipmentActionTarget, cancelReason?: string) => {
      const publicId = shipmentPublicIdSchema.parse(shipment.public_id);
      if (!canCancelShipmentStatus(shipment.status)) {
        throw new Error(
          "Chỉ có thể hủy vận đơn ở trạng thái draft hoặc pending_pickup.",
        );
      }
      const payload = shipmentCancelMutationSchema.parse({
        version: shipment.version,
        cancel_reason: cancelReason,
      });

      return runMutation("cancel", publicId, () =>
        cancelShipmentApi(publicId, payload),
      );
    },
    [runMutation],
  );

  const pendingPublicIds = useMemo(
    () =>
      new Set(
        [...pendingKeys]
          .filter((key) => key.startsWith(`${scopeKey}\u001f`))
          .map((key) => key.slice(scopeKey.length + 1)),
      ),
    [pendingKeys, scopeKey],
  );
  const visibleError =
    actionError?.scopeKey === scopeKey ? actionError : null;

  const clearError = useCallback((publicId?: string) => {
    setActionError((current) =>
      !publicId || current?.publicId === publicId ? null : current,
    );
  }, []);

  return {
    canUpdatePriority,
    canCancel,
    pendingPublicIds,
    isPending: (publicId: string) => pendingPublicIds.has(publicId),
    error: visibleError?.error ?? null,
    errorPublicId: visibleError?.publicId ?? null,
    mutationOutcomeUnknown: visibleError?.outcomeUnknown ?? false,
    errorCode: getShipmentApiErrorCode(visibleError?.error),
    updatePriority,
    cancel,
    clearError,
  };
}
