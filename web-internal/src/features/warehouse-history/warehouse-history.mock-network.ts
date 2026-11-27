import network from "@/mocks/networkOrg.mock.json";
// Reuse established Mock network relationships, never production lookup data.
export const HISTORY_BRANCHES = network.success_response.data.branches.filter((b) => b.is_active === 1);
export const HISTORY_WAREHOUSES = network.success_response.data.warehouses.filter((w) => w.is_active === 1 && HISTORY_BRANCHES.some((b) => b.id === w.branch_id));
