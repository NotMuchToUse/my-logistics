import axios from "axios";
import axiosClient, { USE_MOCK } from "@/core/api/axiosClient";
import type {
  ApiPaginationResponse,
  ApiSuccessResponse,
} from "@/types/api.types";
import { hqFinanceMock } from "./hq-finance.mock";
import type {
  CustomerInvoice,
  CustomerInvoiceInput,
  Remittance,
  RemittanceVerificationInput,
} from "../types/hq-finance.types";

async function runWithDevFallback<T>(
  label: string,
  mockRequest: () => T,
  apiRequest: () => Promise<T>,
): Promise<T> {
  if (USE_MOCK) return mockRequest();
  try {
    return await apiRequest();
  } catch (error) {
    if (import.meta.env.DEV && axios.isAxiosError(error) && !error.response) {
      console.warn(`API kế toán chưa kết nối; dùng dữ liệu mock cho ${label}.`, error);
      return mockRequest();
    }
    throw error;
  }
}

export function getRemittances(): Promise<Remittance[]> {
  return runWithDevFallback(
    "danh sách phiếu nộp tiền",
    () => hqFinanceMock.listRemittances(),
    async () => {
      const response = await axiosClient.get<ApiPaginationResponse<Remittance>>(
        "/api/v1/finance/remittances",
        { params: { page: 1, per_page: 100 } },
      );
      return response.data.data;
    },
  );
}

export function verifyRemittance(
  publicId: string,
  input: RemittanceVerificationInput,
): Promise<Remittance> {
  return runWithDevFallback(
    "xác nhận phiếu nộp tiền",
    () => hqFinanceMock.verifyRemittance(publicId, input),
    async () => {
      const response = await axiosClient.patch<ApiSuccessResponse<Remittance>>(
        `/api/v1/finance/remittances/${encodeURIComponent(publicId)}/verify`,
        input,
      );
      return response.data.data;
    },
  );
}

export function getCustomerInvoices(): Promise<CustomerInvoice[]> {
  return runWithDevFallback(
    "danh sách đối soát công nợ",
    () => hqFinanceMock.listCustomerInvoices(),
    async () => {
      const response = await axiosClient.get<
        ApiPaginationResponse<CustomerInvoice>
      >("/api/v1/finance/customer-invoices", {
        params: { page: 1, per_page: 100 },
      });
      return response.data.data;
    },
  );
}

export function createCustomerInvoice(
  input: CustomerInvoiceInput,
): Promise<CustomerInvoice> {
  return runWithDevFallback(
    "tạo đối soát công nợ",
    () => hqFinanceMock.createCustomerInvoice(input),
    async () => {
      const response = await axiosClient.post<ApiSuccessResponse<CustomerInvoice>>(
        "/api/v1/finance/customer-invoices",
        input,
      );
      return response.data.data;
    },
  );
}

export function deleteCustomerInvoice(publicId: string): Promise<void> {
  return runWithDevFallback(
    "xóa đối soát công nợ",
    () => hqFinanceMock.deleteCustomerInvoice(publicId),
    async () => {
      await axiosClient.delete<ApiSuccessResponse<null>>(
        `/api/v1/finance/customer-invoices/${encodeURIComponent(publicId)}`,
      );
    },
  );
}

export function settleCustomerInvoice(
  publicId: string,
): Promise<CustomerInvoice> {
  return runWithDevFallback(
    "tất toán công nợ khách hàng",
    () => hqFinanceMock.settleCustomerInvoice(publicId),
    async () => {
      const response = await axiosClient.patch<
        ApiSuccessResponse<CustomerInvoice>
      >(
        `/api/v1/finance/customer-invoices/${encodeURIComponent(publicId)}`,
        { status: "settled" },
      );
      return response.data.data;
    },
  );
}
