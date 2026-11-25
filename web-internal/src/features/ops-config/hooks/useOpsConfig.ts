import { useCallback, useEffect, useState } from "react";
import {
  getOpsConfigLookups,
  opsConfigApi,
} from "../api/ops-config.api";
import type { OpsConfigLookups } from "../types/ops-config.types";
import { useOpsConfigResource } from "./useOpsConfigResource";
import type {
  BranchRoutingRulePayload,
  SlaDeadlinePayload,
  ThirdPartyPartnerPayload,
  VehiclePayload,
} from "../types/ops-config.types";

const EMPTY_LOOKUPS: OpsConfigLookups = {
  service_types: [],
  branches: [],
  warehouses: [],
  partners: [],
  drivers: [],
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Không thể tải dữ liệu tham chiếu cấu hình.";
}

export function useOpsConfig(enabled: boolean) {
  const [lookups, setLookups] = useState(EMPTY_LOOKUPS);
  const [lookupLoading, setLookupLoading] = useState(enabled);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const reloadLookups = useCallback(async () => {
    if (!enabled) return;
    setLookupLoading(true);
    setLookupError(null);
    try {
      setLookups(await getOpsConfigLookups());
    } catch (error) {
      setLookupError(getErrorMessage(error));
    } finally {
      setLookupLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setLookups(EMPTY_LOOKUPS);
      setLookupLoading(false);
      setLookupError(null);
      return;
    }
    void reloadLookups();
  }, [enabled, reloadLookups]);

  const slaDeadlines = useOpsConfigResource<
    Awaited<ReturnType<typeof opsConfigApi.slaDeadlines.list>>["data"][number],
    SlaDeadlinePayload
  >(
    {
      list: opsConfigApi.slaDeadlines.list,
      create: opsConfigApi.slaDeadlines.create,
      update: opsConfigApi.slaDeadlines.update,
    },
    enabled,
  );

  const routingRules = useOpsConfigResource<
    Awaited<ReturnType<typeof opsConfigApi.routingRules.list>>["data"][number],
    BranchRoutingRulePayload
  >(
    {
      list: opsConfigApi.routingRules.list,
      create: opsConfigApi.routingRules.create,
      update: opsConfigApi.routingRules.update,
    },
    enabled,
  );

  const partners = useOpsConfigResource<
    Awaited<ReturnType<typeof opsConfigApi.partners.list>>["data"][number],
    ThirdPartyPartnerPayload
  >(
    {
      list: opsConfigApi.partners.list,
      create: opsConfigApi.partners.create,
      update: opsConfigApi.partners.update,
      onMutation: reloadLookups,
    },
    enabled,
  );

  const vehicles = useOpsConfigResource<
    Awaited<ReturnType<typeof opsConfigApi.vehicles.list>>["data"][number],
    VehiclePayload
  >(
    {
      list: opsConfigApi.vehicles.list,
      create: opsConfigApi.vehicles.create,
      update: opsConfigApi.vehicles.update,
    },
    enabled,
  );

  return {
    lookups,
    lookupLoading,
    lookupError,
    reloadLookups,
    slaDeadlines,
    routingRules,
    partners,
    vehicles,
  };
}
