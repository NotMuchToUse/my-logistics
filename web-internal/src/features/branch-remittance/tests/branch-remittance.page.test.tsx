import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { DynamicSidebar } from "@/layouts/components/DynamicSidebar";
import { BranchRemittancePage } from "../pages/BranchRemittancePage";
import { canReadBranchRemittance } from "../hooks/useBranchRemittance";
import { resetRemittanceMockForTests, injectRemittanceMockFailureForTests, markCollectionRemittedForTests } from "../api/branch-remittance.api";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { useBranchScopeStore } from "@/core/stores/useBranchScopeStore";
import * as remittanceApi from "../api/branch-remittance.api";
import type { RemittanceMockState } from "../types/branch-remittance.types";

const branchScope = {
  scope_type: "post_office" as const,
  branch_id: 4,
  warehouse_id: null,
  is_primary: true,
  branch_name: "Bưu cục Sơn Trà",
};
const hqScope = {
  scope_type: "hq_all" as const,
  branch_id: null,
  warehouse_id: null,
  is_primary: true,
  branch_name: "Toàn hệ thống",
};

beforeEach(() => {
  resetRemittanceMockForTests();
  useAuthStore.setState({
    user: { public_id: "01JDC9X8K2M4N6P8Q0R2S4T6V8", must_change_password: 0 },
    token: "mock-only-test-token",
    roles: ["branch_accountant"],
    permissions: ["finance.read", "finance.remit"],
    isAuthenticated: true,
  });
  useBranchScopeStore.setState({ scopes: [branchScope], activeScope: branchScope, activeBranchId: 4, activeWarehouseId: null });
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:branch-remittance-test") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  class TestImage {
    naturalWidth = 640;
    naturalHeight = 480;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_value: string) { queueMicrotask(() => this.onload?.()); }
  }
  vi.stubGlobal("Image", TestImage);
});

afterEach(() => {
  cleanup();
  resetRemittanceMockForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete (URL as Partial<typeof URL>).createObjectURL;
  delete (URL as Partial<typeof URL>).revokeObjectURL;
});

async function prepareForm(user: ReturnType<typeof userEvent.setup>, collectionCodes: string[]) {
  await screen.findByText("CC-DNG-20261127-001");
  for (const code of collectionCodes) {
    await user.click(screen.getByRole("checkbox", { name: `Chọn ${code}` }));
  }
  await user.type(screen.getByLabelText("Tên ngân hàng"), "Ngân hàng Mock");
  await user.type(screen.getByLabelText("Số tài khoản thụ hưởng"), "001234500");
  await user.type(screen.getByLabelText("Mã giao dịch ngân hàng"), "REF-2026-001");
  const file = new File([new Uint8Array([137, 80, 78, 71])], "receipt.png", { type: "image/png" });
  await user.upload(screen.getByLabelText("Chọn ảnh biên lai"), file);
  await screen.findByLabelText("Ảnh sẵn sàng");
}

describe("branch remittance page Mock flow", () => {
  it("allows system_admin only in Mock mode and still requires an allowed branch scope", () => {
    const adminRoles = ["system_admin"] as const;
    const hasWildcard = (permission: string) => permission === "*" || permission === "finance.read";
    expect(canReadBranchRemittance(true, [...adminRoles], hasWildcard, true, true)).toBe(true);
    expect(canReadBranchRemittance(true, [...adminRoles], hasWildcard, false, true)).toBe(false);
    expect(canReadBranchRemittance(true, [...adminRoles], hasWildcard, true, false)).toBe(false);
  });

  it("lets Admin Mock on hq_all see all fixture units and blocks mixing their collections", async () => {
    useAuthStore.setState({ roles: ["system_admin"], permissions: ["*"] });
    useBranchScopeStore.setState({ scopes: [hqScope], activeScope: hqScope, activeBranchId: null, activeWarehouseId: null });
    render(<BranchRemittancePage />);
    expect(await screen.findByText("CC-DNG-20261127-001")).toBeTruthy();
    expect(await screen.findByText("CC-DNG-20261127-006")).toBeTruthy();
    expect(screen.getAllByText("Bưu cục Sơn Trà").length).toBeGreaterThan(1);
    expect(screen.getAllByText("Chi nhánh Đà Nẵng").length).toBeGreaterThan(1);
    const selectAll = screen.getByRole("checkbox", { name: "Chọn tất cả bảng kê đang hiển thị" }) as HTMLInputElement;
    expect(selectAll.disabled).toBe(true);

    await userEvent.setup().click(screen.getByRole("checkbox", { name: "Chọn CC-DNG-20261127-001" }));
    expect((screen.getByRole("checkbox", { name: "Chọn CC-DNG-20261127-006" }) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText(/Phiếu hiện tại chỉ gồm bảng kê của Bưu cục Sơn Trà/)).toBeTruthy();

    fireEvent.change(screen.getByRole("combobox", { name: "Lọc chi nhánh/bưu cục" }), { target: { value: "3" } });
    expect(await screen.findByText("CC-DNG-20261127-006")).toBeTruthy();
    expect(within(screen.getByRole("table")).queryByText("CC-DNG-20261127-001")).toBeNull();
    expect(screen.getByText("4.250.000 VND", { selector: "dd" })).toBeTruthy();
  });

  it("searches, selects and deselects only eligible rows within the chosen unit", async () => {
    useAuthStore.setState({ roles: ["system_admin"], permissions: ["*"] });
    useBranchScopeStore.setState({ scopes: [hqScope], activeScope: hqScope, activeBranchId: null, activeWarehouseId: null });
    const user = userEvent.setup();
    render(<BranchRemittancePage />);
    await screen.findByText("CC-DNG-20261127-001");
    fireEvent.change(screen.getByRole("combobox", { name: "Lọc chi nhánh/bưu cục" }), { target: { value: "4" } });
    const selectAll = screen.getByRole("checkbox", { name: "Chọn tất cả bảng kê đang hiển thị" });
    await user.click(selectAll);
    expect(screen.getByText("3", { selector: "dd" })).toBeTruthy();
    expect(screen.getByText("6.075.000,5 VND")).toBeTruthy();
    await user.click(selectAll);
    expect(screen.getByText("0", { selector: "dd" })).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "Tìm mã bảng kê" }), { target: { value: "20261127-002" } });
    expect(screen.getByText("CC-DNG-20261127-002")).toBeTruthy();
    expect(screen.queryByText("CC-DNG-20261127-001")).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "Tìm mã bảng kê" }), { target: { value: "missing" } });
    expect(screen.getByText("Không tìm thấy bảng kê phù hợp.")).toBeTruthy();
  });

  it("shows the Sidebar item to wildcard Admin and finance.read users, but not users without finance.read", () => {
    useAuthStore.setState({ roles: ["system_admin"], permissions: ["*"] });
    const { unmount } = render(<MemoryRouter><DynamicSidebar /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Nộp tiền về trung tâm" })).toBeTruthy();
    unmount();

    useAuthStore.setState({ roles: ["branch_accountant"], permissions: ["finance.read"] });
    const { unmount: unmountAccountant } = render(<MemoryRouter><DynamicSidebar /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Nộp tiền về trung tâm" })).toBeTruthy();
    unmountAccountant();

    useAuthStore.setState({ roles: ["receptionist"], permissions: ["compensation.read"] });
    render(<MemoryRouter><DynamicSidebar /></MemoryRouter>);
    expect(screen.queryByRole("link", { name: "Nộp tiền về trung tâm" })).toBeNull();
  });

  it("selects eligible collections, totals exact decimal value, confirms and renders submitted result", async () => {
    const user = userEvent.setup();
    render(<BranchRemittancePage />);
    await prepareForm(user, ["CC-DNG-20261127-001", "CC-DNG-20261127-002"]);
    expect(screen.queryByText("CC-DNG-20261127-004")).toBeNull();
    expect(screen.queryByText("CC-DNG-20261127-005")).toBeNull();
    expect(screen.queryByText("CC-DNG-20261127-006")).toBeNull();
    expect(screen.getByText("6.075.000,5 VND")).toBeTruthy();
    expect(screen.getByText("2", { selector: "dd" })).toBeTruthy();
    const send = screen.getByRole("button", { name: "Gửi duyệt" });
    await waitFor(() => expect((send as HTMLButtonElement).disabled).toBe(false));
    await user.click(send);
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Xác nhận gửi" }));
    expect(await screen.findByText(/Mock đã ghi nhận phiếu ở trạng thái chờ xác nhận/)).toBeTruthy();
    expect(await screen.findByText("RM-DNG-20261128-001")).toBeTruthy();
    expect(screen.queryByText("CC-DNG-20261127-001")).toBeNull();
  });

  it("keeps selected collections and transfer fields when confirmation is cancelled", async () => {
    const user = userEvent.setup();
    render(<BranchRemittancePage />);
    await prepareForm(user, ["CC-DNG-20261127-001"]);
    await user.click(screen.getByRole("button", { name: "Gửi duyệt" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Quay lại" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect((screen.getByLabelText("Tên ngân hàng") as HTMLInputElement).value).toBe("Ngân hàng Mock");
    expect(screen.getByText("4.250.000 VND", { selector: "dd" })).toBeTruthy();
    expect(screen.getByLabelText("Ảnh sẵn sàng")).toBeTruthy();
  });

  it("keeps the branch permission check active and does not show collections without finance.read", async () => {
    useAuthStore.setState({ permissions: ["finance.remit"] });
    render(<BranchRemittancePage />);
    expect((await screen.findByRole("alert")).textContent).toContain("chưa có quyền xem");
    expect(screen.queryByText("CC-DNG-20261127-001")).toBeNull();
  });

  it("does not infer submit permission from finance.read", async () => {
    useAuthStore.setState({ permissions: ["finance.read"] });
    render(<BranchRemittancePage />);
    expect(await screen.findByText("CC-DNG-20261127-001")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("finance.remit");
    expect((screen.getByRole("button", { name: "Gửi duyệt" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText("Chọn ảnh biên lai") as HTMLInputElement).disabled).toBe(true);
  });

  it("shows transfer validation errors and preserves a leading zero in account number", async () => {
    const user = userEvent.setup();
    render(<BranchRemittancePage />);
    await screen.findByText("CC-DNG-20261127-001");
    const send = screen.getByRole("button", { name: "Gửi duyệt" });
    expect((send as HTMLButtonElement).disabled).toBe(true);
    await user.type(screen.getByLabelText("Số tài khoản thụ hưởng"), "001234500");
    expect((screen.getByLabelText("Số tài khoản thụ hưởng") as HTMLInputElement).value).toBe("001234500");
    const checkbox = screen.getByRole("checkbox", { name: "Chọn CC-DNG-20261127-001" });
    await user.click(checkbox);
    expect(screen.getByText("4.250.000 VND", { selector: "dd" })).toBeTruthy();
    await user.click(checkbox);
    expect(screen.getByText("0", { selector: "dd" })).toBeTruthy();
    expect((send as HTMLButtonElement).disabled).toBe(true);
  });

  it("retries a temporary upload failure using the selected file", async () => {
    const user = userEvent.setup();
    injectRemittanceMockFailureForTests("upload_once");
    render(<BranchRemittancePage />);
    await screen.findByText("CC-DNG-20261127-001");
    const file = new File([new Uint8Array([137, 80, 78, 71])], "receipt.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("Chọn ảnh biên lai"), file);
    expect(await screen.findByText(/Mất kết nối mạng/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByLabelText("Ảnh sẵn sàng")).toBeTruthy();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it("previews a replacement receipt and revokes it when removed", async () => {
    const user = userEvent.setup();
    render(<BranchRemittancePage />);
    await screen.findByText("CC-DNG-20261127-001");
    const input = screen.getByLabelText("Chọn ảnh biên lai");
    await user.upload(input, new File([new Uint8Array([137, 80, 78, 71])], "first.png", { type: "image/png" }));
    await screen.findByText(/first.png/);
    await user.upload(input, new File([new Uint8Array([137, 80, 78, 71])], "replacement.webp", { type: "image/webp" }));
    expect(await screen.findByText(/replacement.webp/)).toBeTruthy();
    expect(screen.queryByText(/first.png/)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Gỡ ảnh" }));
    expect(screen.queryByAltText("Xem trước biên lai")).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it("prevents duplicate UI submits and safely retries a lost response with the same Mock transaction", async () => {
    const user = userEvent.setup();
    const submitSpy = vi.spyOn(remittanceApi, "submitRemittanceMock");
    injectRemittanceMockFailureForTests("response_after_commit_once");
    render(<BranchRemittancePage />);
    await prepareForm(user, ["CC-DNG-20261127-001"]);
    await user.click(screen.getByRole("button", { name: "Gửi duyệt" }));
    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Xác nhận gửi" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(await screen.findByText(/Mất kết nối mạng/)).toBeTruthy();
    expect(submitSpy).toHaveBeenCalledTimes(1);
    expect((screen.getByLabelText("Số tài khoản thụ hưởng") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("checkbox", { name: "Chọn CC-DNG-20261127-001" }) as HTMLInputElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Thử gửi lại" }));
    expect(await screen.findByText("RM-DNG-20261128-001")).toBeTruthy();
    expect(submitSpy).toHaveBeenCalledTimes(2);
    expect(submitSpy.mock.calls[0][0]).toEqual(submitSpy.mock.calls[1][0]);
    expect(screen.queryByText("CC-DNG-20261127-001")).toBeNull();
  });

  it("clears a stale selection and refreshes after a Mock conflict", async () => {
    const user = userEvent.setup();
    render(<BranchRemittancePage />);
    await prepareForm(user, ["CC-DNG-20261127-001"]);
    markCollectionRemittedForTests("01JDC9X8K2M4N6P8Q0R2S4T601");
    await user.click(screen.getByRole("button", { name: "Gửi duyệt" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Xác nhận gửi" }));
    expect(await screen.findByText(/Bảng kê vừa được sử dụng bởi giao dịch khác/)).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("CC-DNG-20261127-001")).toBeNull());
    expect(screen.getByText("0", { selector: "dd" })).toBeTruthy();
  });

  it("shows list-load errors and recovers from an explicit refresh", async () => {
    const originalList = remittanceApi.listEligibleCollections;
    const listSpy = vi.spyOn(remittanceApi, "listEligibleCollections")
      .mockRejectedValueOnce(new Error("Mock list unavailable"))
      .mockImplementation((scope) => originalList(scope));
    render(<BranchRemittancePage />);
    expect(await screen.findByText("Mock list unavailable")).toBeTruthy();
    await userEvent.setup().click(screen.getByRole("button", { name: "Tải lại danh sách" }));
    expect(await screen.findByText("CC-DNG-20261127-001")).toBeTruthy();
    expect(listSpy).toHaveBeenCalledTimes(2);
  });

  it("revokes the receipt preview URL when leaving the page", async () => {
    const user = userEvent.setup();
    const view = render(<BranchRemittancePage />);
    await screen.findByText("CC-DNG-20261127-001");
    await user.upload(screen.getByLabelText("Chọn ảnh biên lai"), new File([new Uint8Array([137, 80, 78, 71])], "receipt.png", { type: "image/png" }));
    await screen.findByLabelText("Ảnh sẵn sàng");
    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:branch-remittance-test");
  });

  it("does not upload an image whose decode finishes after the page unmounts", async () => {
    const user = userEvent.setup();
    const deferredDecoder: { finish: (() => void) | null } = { finish: null };
    class DeferredImage {
      naturalWidth = 640;
      naturalHeight = 480;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) { deferredDecoder.finish = () => this.onload?.(); }
    }
    vi.stubGlobal("Image", DeferredImage);
    const uploadSpy = vi.spyOn(remittanceApi, "uploadReceiptMock");
    const view = render(<BranchRemittancePage />);
    await screen.findByText("CC-DNG-20261127-001");
    await user.upload(screen.getByLabelText("Chọn ảnh biên lai"), new File([new Uint8Array([137, 80, 78, 71])], "receipt.png", { type: "image/png" }));
    await waitFor(() => expect(deferredDecoder.finish).toBeTruthy());
    view.unmount();
    deferredDecoder.finish?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(uploadSpy).not.toHaveBeenCalled();
  });

  it("drops the old selection when the active branch changes and only renders the new scope", async () => {
    const user = userEvent.setup();
    const otherScope = { ...branchScope, branch_id: 3, branch_name: "Chi nhánh Đà Nẵng", is_primary: false };
    useBranchScopeStore.setState({ scopes: [branchScope, otherScope] });
    render(<BranchRemittancePage />);
    await screen.findByText("CC-DNG-20261127-001");
    await user.click(screen.getByRole("checkbox", { name: "Chọn CC-DNG-20261127-001" }));
    useBranchScopeStore.getState().switchBranch(3);
    expect(await screen.findByText("CC-DNG-20261127-006")).toBeTruthy();
    expect(screen.queryByText("CC-DNG-20261127-001")).toBeNull();
    expect(screen.getByText("0", { selector: "dd" })).toBeTruthy();
  });

  it("ignores a stale branch list response that arrives after the active scope changed", async () => {
    const otherScope = { ...branchScope, branch_id: 3, branch_name: "Chi nhánh Đà Nẵng", is_primary: false };
    useBranchScopeStore.setState({ scopes: [branchScope, otherScope] });
    let resolveOld!: (state: RemittanceMockState) => void;
    let resolveNew!: (state: RemittanceMockState) => void;
    const oldResponse = new Promise<RemittanceMockState>((resolve) => { resolveOld = resolve; });
    const newResponse = new Promise<RemittanceMockState>((resolve) => { resolveNew = resolve; });
    const list = vi.spyOn(remittanceApi, "listEligibleCollections").mockImplementationOnce(() => oldResponse).mockImplementationOnce(() => newResponse);
    render(<BranchRemittancePage />);
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
    useBranchScopeStore.getState().switchBranch(3);
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    const data = {
      collections: [{ public_id: "01JDC9X8K2M4N6P8Q0R2S4T606", collection_code: "CC-DNG-20261127-006", branch_id: 3, shipment_count: 12, total_amount: "3100000.00", status: "locked" as const, locked_at: "2026-11-27T19:00:00+07:00", version: 1 }],
      remitted_collection_ids: [],
      selected_recipient_name: "Trung tâm Mock",
      branch_names: { "3": "Chi nhánh Đà Nẵng" },
    };
    resolveNew(data);
    expect(await screen.findByText("CC-DNG-20261127-006")).toBeTruthy();
    resolveOld({ ...data, collections: [{ ...data.collections[0], public_id: "01JDC9X8K2M4N6P8Q0R2S4T601", collection_code: "STALE-BRANCH-4", branch_id: 4 }] });
    await waitFor(() => expect(screen.queryByText("STALE-BRANCH-4")).toBeNull());
    expect(screen.getByText("CC-DNG-20261127-006")).toBeTruthy();
  });

  it("rejects a corrupted image before enabling submission", async () => {
    const user = userEvent.setup();
    class BrokenImage {
      naturalWidth = 0;
      naturalHeight = 0;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) { queueMicrotask(() => this.onerror?.()); }
    }
    vi.stubGlobal("Image", BrokenImage);
    render(<BranchRemittancePage />);
    await screen.findByText("CC-DNG-20261127-001");
    await user.click(screen.getByRole("checkbox", { name: "Chọn CC-DNG-20261127-001" }));
    const file = new File([new Uint8Array([137, 80, 78, 71])], "damaged.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("Chọn ảnh biên lai"), file);
    expect(await screen.findByText("Tệp đã chọn không phải ảnh hợp lệ hoặc ảnh bị hỏng.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Gửi duyệt" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
