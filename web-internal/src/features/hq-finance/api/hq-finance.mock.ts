import type {
  CustomerInvoice,
  CustomerInvoiceInput,
  Remittance,
  RemittanceVerificationInput,
} from "../types/hq-finance.types";

const remittances: Remittance[] = [
  {
    public_id: "REM-2026-00128",
    branch_id: 3,
    branch_code: "BC-HC1",
    branch_name: "Bưu cục Hải Châu 1 - Đà Nẵng",
    amount: 12500000,
    submitted_at: new Date(Date.now() - 45 * 60_000).toISOString(),
    submitted_by_name: "Nguyễn Văn An",
    receipt_image_url:
      "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1200",
    status: "submitted",
  },
  {
    public_id: "REM-2026-00127",
    branch_id: 4,
    branch_code: "BC-ST1",
    branch_name: "Bưu cục Sơn Trà - Đà Nẵng",
    amount: 8700000,
    submitted_at: new Date(Date.now() - 3 * 60 * 60_000).toISOString(),
    submitted_by_name: "Trần Thị Bình",
    receipt_image_url: null,
    status: "verified",
    journal_ref: "JV-2026-00642",
    note: "Đã đối chiếu sao kê ngân hàng.",
  },
];

const customerInvoices: CustomerInvoice[] = [
  {
    public_id: "INV-2026-00031",
    customer_id: "CUS-0018",
    customer_name: "Công ty TNHH Thương mại An Phát",
    billing_period: "2026-10",
    ngtts_freight_amount: 42850000,
    cod_collected_amount: 12000000,
    compensation_offset_amount: 1500000,
    settlement_balance: 29350000,
    status: "open",
    created_at: new Date(Date.now() - 24 * 60 * 60_000).toISOString(),
  },
  {
    public_id: "INV-2026-00030",
    customer_id: "CUS-0007",
    customer_name: "Cửa hàng Gia dụng Minh Châu",
    billing_period: "2026-10",
    ngtts_freight_amount: 18900000,
    cod_collected_amount: 4800000,
    compensation_offset_amount: 0,
    settlement_balance: 14100000,
    status: "settled",
    created_at: new Date(Date.now() - 48 * 60 * 60_000).toISOString(),
    settled_at: new Date(Date.now() - 12 * 60 * 60_000).toISOString(),
  },
];

let invoiceSequence = 32;

function notFound(message: string): never {
  throw new Error(message);
}

export const hqFinanceMock = {
  listRemittances(): Remittance[] {
    return remittances.map((row) => ({ ...row }));
  },

  verifyRemittance(
    publicId: string,
    input: RemittanceVerificationInput,
  ): Remittance {
    const row = remittances.find((item) => item.public_id === publicId);
    if (!row) return notFound("Không tìm thấy phiếu nộp tiền.");
    if (row.status !== "submitted") {
      return notFound("Phiếu nộp tiền này đã được xử lý.");
    }
    Object.assign(row, input);
    return { ...row };
  },

  listCustomerInvoices(): CustomerInvoice[] {
    return customerInvoices.map((row) => ({ ...row }));
  },

  createCustomerInvoice(input: CustomerInvoiceInput): CustomerInvoice {
    const created: CustomerInvoice = {
      ...input,
      public_id: `INV-DEV-${String(invoiceSequence++).padStart(5, "0")}`,
      status: "open",
      created_at: new Date().toISOString(),
    };
    customerInvoices.unshift(created);
    return { ...created };
  },

  deleteCustomerInvoice(publicId: string): void {
    const index = customerInvoices.findIndex(
      (row) => row.public_id === publicId,
    );
    if (index < 0) return notFound("Không tìm thấy đối soát công nợ.");
    if (customerInvoices[index]?.status === "settled") {
      return notFound("Không thể xóa đối soát đã tất toán.");
    }
    customerInvoices.splice(index, 1);
  },

  settleCustomerInvoice(publicId: string): CustomerInvoice {
    const row = customerInvoices.find((item) => item.public_id === publicId);
    if (!row) return notFound("Không tìm thấy đối soát công nợ.");
    if (row.status === "settled") {
      return notFound("Đối soát này đã được tất toán.");
    }
    row.status = "settled";
    row.settled_at = new Date().toISOString();
    return { ...row };
  },
};
