import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const page = readFileSync(
  fileURLToPath(new URL("../pages/OpsConfigPage.tsx", import.meta.url)),
  "utf8",
);
const api = readFileSync(
  fileURLToPath(new URL("../api/ops-config.api.ts", import.meta.url)),
  "utf8",
);
const access = readFileSync(
  fileURLToPath(new URL("../utils/ops-config-access.ts", import.meta.url)),
  "utf8",
);

test("page declares exactly three main tabs and checks role, permission and HQ scope", () => {
  assert.match(page, /OPS_CONFIG_TABS/);
  assert.match(page, /canManageOpsConfig/);
  assert.match(page, /hasPermission\("system\.manage_settings"\)/);
  assert.match(page, /activeScope\?\.scope_type \?\? null/);
  assert.match(access, /scopeType === "hq_all"/);
  assert.doesNotMatch(page, /system_dev/);
  assert.match(page, /value="partners-vehicles"/);
});

test("API adapter prevents real calls and mock fallback while contract is blocked", () => {
  assert.match(api, /requireOpsConfigMock\(USE_MOCK\)/);
  assert.match(api, /getOpsConfigLookups/);
  assert.doesNotMatch(api, /axiosClient\.(get|post|put|patch|delete)/);
});
