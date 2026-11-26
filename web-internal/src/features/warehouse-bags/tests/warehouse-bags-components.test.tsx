import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { BagClosingTab } from "../components/BagClosingTab";
import { BagOpeningTab } from "../components/BagOpeningTab";
import { BagSummary } from "../components/BagSummary";
import { useWarehouseBags } from "../hooks/useWarehouseBags";
import { createWarehouseBagsService } from "../api/warehouse-bags.api";
import { useBranchScopeStore } from "@/core/stores/useBranchScopeStore";
import fixture from "../../../mocks/warehouse-bags.mock.json";
import type { BagStatus } from "../warehouse-bags.types";
import { BAG_STATUS_LABELS } from "../warehouse-bags.constants";

const mockApi = () => createWarehouseBagsService({ useMock: true });
function Harness({ api, tab = "closing" }: { api: ReturnType<typeof mockApi>; tab?: "closing" | "opening" }) {
  const model = useWarehouseBags(api);
  return tab === "closing" ? <BagClosingTab model={model} /> : <BagOpeningTab model={model} />;
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); useBranchScopeStore.getState().clearScopes(); });
async function mount(tab: "closing" | "opening" = "closing", api = mockApi()) {
  render(<Harness api={api} tab={tab} />);
  await screen.findByRole("note");
  return api;
}
it("form Seal/kho đích: bắt buộc, tối đa 40, giữ số 0 đầu", async () => {
  await mount();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Kiểm tra thông tin" }));
  expect(await screen.findByText("Vui lòng nhập số Seal.")).toBeTruthy();
  expect(screen.getByText("Vui lòng chọn kho đích.")).toBeTruthy();
  const seal = screen.getByLabelText("Số niêm phong (Seal)");
  fireEvent.change(seal, { target: { value: "a".repeat(41) } });
  await user.click(screen.getByRole("button", { name: "Kiểm tra thông tin" }));
  expect(await screen.findByText("Số Seal không được vượt quá 40 ký tự.")).toBeTruthy();
  fireEvent.change(seal, { target: { value: "000-Seal/01" } });
  await user.click(screen.getByRole("combobox", { name: "Kho đích (dữ liệu mẫu)" }));
  await user.click(screen.getByRole("option", { name: "Kho mẫu B" }));
  await user.click(screen.getByRole("button", { name: "Kiểm tra thông tin" }));
  expect((seal as HTMLInputElement).value).toBe("000-Seal/01");
  expect(screen.queryByText("Vui lòng chọn kho đích.")).toBeNull();
});
it("Enter tra cứu vận đơn, focus và form còn nguyên, không thêm đơn/niêm phong", async () => {
  const api = await mount();
  const before = await api.readFixtureDataset();
  const user = userEvent.setup();
  fireEvent.change(screen.getByLabelText("Số niêm phong (Seal)"), { target: { value: "00001" } });
  const input = screen.getByLabelText("Mã vận đơn");
  await user.type(input, "UI-VS-0001{Enter}");
  await screen.findByText(/Đã tìm thấy vận đơn/);
  expect(document.activeElement).toBe(input);
  expect((input as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("Số niêm phong (Seal)") as HTMLInputElement).value).toBe("00001");
  expect((screen.getByRole("button", { name: "Niêm phong túi" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByText(/Đã thêm vận đơn vào túi/)).toBeNull();
  expect(screen.queryByText(/0 kg/)).toBeNull();
  await user.type(input, "MISSING{Enter}");
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByText(/Đã tìm thấy vận đơn/)).toBeNull();
  expect(await api.readFixtureDataset()).toEqual(before);
});
it("Mở túi: mã túi/Seal, bảng thành viên, lỗi mới bỏ dữ liệu cũ", async () => {
  await mount("opening");
  const user = userEvent.setup();
  const input = screen.getByLabelText("Mã túi hoặc Seal");
  await user.type(input, "UI-BAG-001{Enter}");
  await screen.findByText("UI-VS-0001");
  expect(screen.getByText("000-SEAL/1")).toBeTruthy();
  expect(screen.getByText("2026-11-26 08:00:00")).toBeTruthy();
  expect((screen.getByRole("button", { name: "Xác nhận mở túi" }) as HTMLButtonElement).disabled).toBe(true);
  await user.click(screen.getByRole("combobox", { name: "Tra cứu theo" }));
  await user.click(screen.getByRole("option", { name: "Số Seal" }));
  await user.type(input, "000-SEAL/2{Enter}");
  await screen.findByText("UI-VS-0002");
  await user.clear(input);
  await user.type(input, "MISSING{Enter}");
  await screen.findByRole("alert");
  expect(screen.queryByText("UI-VS-0002")).toBeNull();
  expect(screen.queryByText("000-SEAL/2")).toBeNull();
});
it("summary hiển thị đủ 5 nhãn trạng thái và không tạo trọng lượng", () => {
  for (const row of fixture.success_response.data.manifest_bags) {
    const view = render(<BagSummary bag={{ ...row, status: row.status as BagStatus }} />);
    expect(screen.getByText(BAG_STATUS_LABELS[row.status as BagStatus])).toBeTruthy();
    expect(screen.getByText("Tổng trọng lượng").nextElementSibling?.textContent).toBe("Chưa có dữ liệu");
    view.unmount();
  }
});
it("loading xóa túi trước, bảng trống cho túi cancelled", async () => {
  const api = mockApi();
  const found = await api.findBag({ lookupBy: "bag_code", value: "UI-BAG-005" });
  let resolve!: (value: typeof found) => void;
  vi.spyOn(api, "findBag").mockReturnValueOnce(new Promise((yes) => { resolve = yes; }));
  await mount("opening", api);
  fireEvent.change(screen.getByLabelText("Mã túi hoặc Seal"), { target: { value: "UI-BAG-005" } });
  fireEvent.click(screen.getByRole("button", { name: "Tra cứu túi" }));
  expect(screen.getByRole("status", { name: "Đang tra cứu" })).toBeTruthy();
  await act(async () => resolve(found));
  expect(await screen.findByText("Đã hủy")).toBeTruthy();
  expect(screen.getByText("Chưa có vận đơn thuộc túi để hiển thị.")).toBeTruthy();
});
it("empty và real BLOCKED không fallback; mutation luôn disabled", async () => {
  const view = render(<Harness api={createWarehouseBagsService({ useMock: true, scenario: "empty" })} />);
  expect(await screen.findByText("Danh sách túi mẫu đang rỗng.")).toBeTruthy();
  view.unmount();
  const api = createWarehouseBagsService({ useMock: false });
  render(<Harness api={api} tab="opening" />);
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByRole("note")).toBeNull();
  expect(screen.queryByText("UI-VS-0001")).toBeNull();
  expect((screen.getByRole("button", { name: "Tra cứu túi" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Xác nhận mở túi" }) as HTMLButtonElement).disabled).toBe(true);
});
it("đổi context xóa form/kết quả đang hiển thị", async () => {
  await mount();
  fireEvent.change(screen.getByLabelText("Số niêm phong (Seal)"), { target: { value: "0001" } });
  fireEvent.change(screen.getByLabelText("Mã vận đơn"), { target: { value: "UI-VS-0001" } });
  fireEvent.click(screen.getByRole("button", { name: "Tra cứu vận đơn" }));
  await screen.findByText(/Đã tìm thấy vận đơn/);
  act(() => useBranchScopeStore.setState({ activeBranchId: 8, activeWarehouseId: null }));
  await waitFor(() => expect((screen.getByLabelText("Số niêm phong (Seal)") as HTMLInputElement).value).toBe(""));
  expect(screen.queryByText(/Đã tìm thấy vận đơn/)).toBeNull();
  expect(screen.getByText(/Kho làm việc: Chưa xác định/)).toBeTruthy();
});
