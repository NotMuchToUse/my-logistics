import { USE_MOCK } from "@/core/api/axiosClient";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { useBranchScopeStore } from "@/core/stores/useBranchScopeStore";
import fixture from "@/mocks/waybillPrint.mock.json";
import { readWaybillFixture } from "./waybillPrint.fixture";
import { createWaybillMock } from "./waybillPrint.mock";
import { createWaybillGateway } from "./waybillPrint.gateway";
import type { WaybillSession } from "../types/waybillPrint.types";

const data = readWaybillFixture(fixture);
const mock = createWaybillMock(data.model, data.ranges);
export const waybillPrintApi = createWaybillGateway(USE_MOCK, mock);
export const MOCK_SHIPMENT_PUBLIC_ID = data.model.publicId;

export function getWaybillSession(): WaybillSession {
  const auth = useAuthStore.getState();
  const scope = useBranchScopeStore.getState();
  return {
    key: JSON.stringify([auth.user?.public_id, auth.token, auth.roles, auth.permissions, scope.activeScope, scope.activeBranchId, scope.scopes]),
    branchId: scope.activeBranchId === null ? null : String(scope.activeBranchId),
    authenticated: auth.isAuthenticated && !!auth.token,
    roles: auth.roles,
    allowedBranchIds: scope.scopes.flatMap((item) => item.branch_id === null ? [] : [String(item.branch_id)]),
    branchOptions: scope.scopes.flatMap((item) => item.branch_id === null ? [] : [{
      id: String(item.branch_id),
      name: item.branch_name ?? `Chi nhánh ${item.branch_id}`,
    }]),
    allBranches: scope.scopes.some((item) => item.scope_type === "hq_all"),
  };
}

useAuthStore.subscribe((state, previous) => {
  if (state.token !== previous.token || state.user?.public_id !== previous.user?.public_id) mock.clear();
});
