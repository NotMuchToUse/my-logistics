import { describe, expect, it, vi } from "vitest";

vi.mock("@/core/api/axiosClient", () => ({ USE_MOCK: false }));

import { listEligibleCollections, RemittanceBlockedError, submitRemittanceMock, uploadReceiptMock } from "../api/branch-remittance.api";

describe("branch remittance API mode", () => {
  it("fails closed for list, upload, and submit without falling back to Mock", async () => {
    const attempt = {
      idempotency_key: "00000000-0000-4000-8000-000000000001",
      branch_id: 4,
      collection_ids: ["01JDC9X8K2M4N6P8Q0R2S4T601"],
      values: { bank_name: "Bank", bank_account_no: "00123", bank_reference_no: "REF-1" },
      receipt: { receipt_image_url: "mock://receipts/receipt.png", file_name: "receipt.png", size: 120 },
    };

    await expect(listEligibleCollections({ branch_id: null, include_all_branches: true })).rejects.toBeInstanceOf(RemittanceBlockedError);
    await expect(uploadReceiptMock(new File(["data"], "receipt.png", { type: "image/png" }))).rejects.toBeInstanceOf(RemittanceBlockedError);
    await expect(submitRemittanceMock(attempt)).rejects.toBeInstanceOf(RemittanceBlockedError);
  });
});
