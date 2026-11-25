import { test } from "node:test";
import assert from "node:assert/strict";
import {
  OpsConfigApiBlockedError,
  requireOpsConfigMock,
} from "../api/ops-config-api-mode.ts";

test("real API mode fails closed instead of silently switching to mock", () => {
  assert.throws(
    () => requireOpsConfigMock(false),
    (error) => {
      assert.ok(error instanceof OpsConfigApiBlockedError);
      assert.equal(error.code, "API_CONTRACT_BLOCKED");
      assert.match(error.message, /Backend chưa xác nhận/);
      return true;
    },
  );
  assert.doesNotThrow(() => requireOpsConfigMock(true));
});
