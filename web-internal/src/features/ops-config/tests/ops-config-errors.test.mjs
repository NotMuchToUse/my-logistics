import { test } from "node:test";
import assert from "node:assert/strict";
import { applyOpsConfigFieldErrors } from "../utils/ops-config-errors.ts";

test("API validation details are mapped only to registered form fields", () => {
  const fieldErrors = {};
  const form = {
    getValues: () => ({ code: "", name: "" }),
    setError: (field, error) => {
      fieldErrors[field] = error;
    },
  };
  const error = {
    response: {
      error: {
        code: "422_VALIDATION_ERROR",
        message: "Dữ liệu cấu hình không hợp lệ.",
        details: {
          code: ["Mã đối tác đã tồn tại."],
          unknown_field: ["Không được ánh xạ."],
        },
      },
    },
  };

  assert.equal(
    applyOpsConfigFieldErrors(form, error),
    "Dữ liệu cấu hình không hợp lệ.",
  );
  assert.deepEqual(fieldErrors, {
    code: {
      type: "server",
      message: "Mã đối tác đã tồn tại.",
    },
  });
});
