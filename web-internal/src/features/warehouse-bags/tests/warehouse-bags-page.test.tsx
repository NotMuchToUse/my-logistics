import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { WarehouseBagsPage, WarehouseBagsReadView } from "../pages/WarehouseBagsPage";
import { useWarehouseBags } from "../hooks/useWarehouseBags";
import { createWarehouseBagsService, warehouseBagsApi } from "../api/warehouse-bags.api";
import { useBranchScopeStore } from "@/core/stores/useBranchScopeStore";
import { useAuthStore } from "@/core/stores/useAuthStore";

const service = () => createWarehouseBagsService({ useMock: true });
function Preview({ api }: { api: ReturnType<typeof service> }) {
  const model = useWarehouseBags(api);
  return <WarehouseBagsReadView model={model} />;
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); useAuthStore.getState().logout(); });

it.each([{ permissions: [] }, { permissions: ["warehouse.manage_bags"] }, { permissions: ["*"] }])("Page production fail-closed, không suy quyền từ $permissions và không đọc dữ liệu", ({ permissions }) => {
  useAuthStore.setState({ isAuthenticated: true, permissions });
  const read = vi.spyOn(warehouseBagsApi, "readFixtureDataset");
  const list = vi.spyOn(warehouseBagsApi, "listBags");
  render(<WarehouseBagsPage />);
  expect(screen.getByRole("heading", { name: "Đóng túi & Mở túi hàng" })).toBeTruthy();
  expect(screen.getByRole("alert").textContent).toContain("Chưa xác nhận quyền truy cập trang");
  expect(screen.queryByRole("tab")).toBeNull();
  expect(read).not.toHaveBeenCalled();
  expect(list).not.toHaveBeenCalled();
});

it("view tích hợp dùng một hook, hai tab không đọc dư hoặc mutation", async () => {
  const api = service();
  const before = await api.readFixtureDataset();
  const read = vi.spyOn(api, "readFixtureDataset");
  const list = vi.spyOn(api, "listBags");
  render(<Preview api={api} />);
  const user = userEvent.setup();
  await screen.findByRole("note");
  await user.click(screen.getByRole("button", { name: "Kiểm tra thông tin" }));
  expect(await screen.findByText("Vui lòng nhập số Seal.")).toBeTruthy();
  await user.type(screen.getByLabelText("Số niêm phong (Seal)"), "000001");
  await user.type(screen.getByLabelText("Mã vận đơn"), "UI-VS-0001{Enter}");
  await screen.findByText(/Đã tìm thấy vận đơn/);
  expect((screen.getByRole("button", { name: "Niêm phong túi" }) as HTMLButtonElement).disabled).toBe(true);
  await user.click(screen.getByRole("tab", { name: "Mở túi hàng" }));
  await user.type(screen.getByLabelText("Mã túi hoặc Seal"), "UI-BAG-002{Enter}");
  expect(await screen.findByText("UI-VS-0002")).toBeTruthy();
  expect(screen.getByText("000-SEAL/2")).toBeTruthy();
  expect((screen.getByRole("button", { name: "Xác nhận mở túi" }) as HTMLButtonElement).disabled).toBe(true);
  await user.click(screen.getByRole("tab", { name: "Đóng túi hàng" }));
  expect((screen.getByLabelText("Số niêm phong (Seal)") as HTMLInputElement).value).toBe("000001");
  expect(read).toHaveBeenCalledTimes(1);
  expect(list).toHaveBeenCalledTimes(1);
  expect(await api.readFixtureDataset()).toEqual(before);
});

it("view bỏ túi cũ sau lỗi mới hoặc khi context đổi", async () => {
  render(<Preview api={service()} />);
  const user = userEvent.setup();
  await screen.findByRole("note");
  await user.click(screen.getByRole("tab", { name: "Mở túi hàng" }));
  const input = screen.getByLabelText("Mã túi hoặc Seal");
  await user.type(input, "UI-BAG-001{Enter}");
  await screen.findByText("UI-VS-0001");
  await user.clear(input);
  await user.type(input, "MISSING{Enter}");
  await screen.findByRole("alert");
  expect(screen.queryByText("UI-VS-0001")).toBeNull();
  await user.clear(input);
  await user.type(input, "UI-BAG-001{Enter}");
  await screen.findByText("UI-VS-0001");
  act(() => useBranchScopeStore.setState({ activeBranchId: 42, activeWarehouseId: null }));
  await waitFor(() => expect(screen.queryByText("UI-VS-0001")).toBeNull());
  expect((input as HTMLInputElement).value).toBe("");
  expect(screen.getByText(/Kho làm việc: Chưa xác định/)).toBeTruthy();
});

it("view real BLOCKED không fallback qua cả hai tab", async () => {
  render(<Preview api={createWarehouseBagsService({ useMock: false })} />);
  await screen.findByRole("alert");
  expect(screen.queryByRole("note")).toBeNull();
  expect((screen.getByRole("button", { name: "Tra cứu vận đơn" }) as HTMLButtonElement).disabled).toBe(true);
  const user = userEvent.setup();
  await user.click(screen.getByRole("tab", { name: "Mở túi hàng" }));
  expect((screen.getByRole("button", { name: "Tra cứu túi" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByText("UI-VS-0001")).toBeNull();
});
