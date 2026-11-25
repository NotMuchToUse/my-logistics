import { test } from "node:test";
import assert from "node:assert/strict";
import { canManageOpsConfig } from "../utils/ops-config-access.ts";

test("only system_admin with the confirmed permission and HQ scope can manage", () => {
  assert.equal(
    canManageOpsConfig(["system_admin"], true, "hq_all"),
    true,
  );
  assert.equal(
    canManageOpsConfig(["system_admin"], false, "hq_all"),
    false,
  );
  assert.equal(
    canManageOpsConfig(["system_admin"], true, "branch"),
    false,
  );
  assert.equal(
    canManageOpsConfig(["system_dev"], true, "hq_all"),
    false,
  );
  assert.equal(
    canManageOpsConfig(["receptionist"], true, "hq_all"),
    false,
  );
});
