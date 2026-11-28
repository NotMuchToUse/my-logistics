import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
vi.mock("@/core/api/axiosClient", () => ({ default: { get: vi.fn() }, USE_MOCK: true }));
import { WarehouseHistoryScreen } from "../pages/WarehouseHistoryPage";
import { createFixtures } from "../api/warehouse-history.mock";
import type { HistoryContext } from "../warehouse-history.model";
import { ManifestPreview } from "../components/ManifestPreview";
const c: HistoryContext = { authenticated: true, can_read: true, roles: ["branch_manager"], branch_id: 3, warehouse_id: null, demo_scope: true, unlock_capability: true };
afterEach(() => { cleanup(); });
function mount(id = "", context = c) {
  return render(<MemoryRouter initialEntries={[`/warehouse-history${id ? `/${id}` : ""}`]}><Routes><Route path="warehouse-history/:publicId?" element={<WarehouseHistoryScreen context={context} />} /></Routes></MemoryRouter>);
}
describe("KHA-42 UI Mock", () => {
  it("lists, filters, paginates and clears filters", async () => {
    mount();
    await screen.findByText("48 phiếu · Trang 1/3");
    fireEvent.click(screen.getByRole("button", { name: "Sau" }));
    await screen.findByText("48 phiếu · Trang 2/3");
    fireEvent.change(screen.getByLabelText("Mã phiếu"), { target: { value: "0048" } });
    await screen.findByText("1 phiếu · Trang 1/1");
    fireEvent.click(screen.getByRole("button", { name: "Xóa bộ lọc" }));
    await screen.findByText("48 phiếu · Trang 1/3");
    fireEvent.change(screen.getByLabelText("Loại phiếu"), { target: { value: "inbound" } });
    await screen.findByText("16 phiếu · Trang 1/1");
  });
  it("supports direct detail URL, validates form, blocks double submit and refetches", async () => {
    mount(createFixtures()[0].public_id);
    fireEvent.click(await screen.findByRole("button", { name: "Mở khóa phiếu" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận mở khóa" }));
    await screen.findByText("Vui lòng nhập lý do mở khóa.");
    fireEvent.change(screen.getByLabelText("Lý do mở khóa (tối đa 500 ký tự)"), { target: { value: "Điều chỉnh mẫu UI" } });
    const button = screen.getByRole("button", { name: "Xác nhận mở khóa" });
    fireEvent.click(button); fireEvent.click(button);
    await screen.findByText("Đã mở khóa");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "Mở khóa phiếu" })).toBeNull();
    await screen.findByText("Điều chỉnh mẫu UI");
  });
  it("denies unauthorized page and hides unlock for handed-over receipt", async () => {
    const view = mount("", { ...c, can_read: false });
    await screen.findByRole("alert"); expect(screen.queryByRole("table")).toBeNull();
    view.unmount(); mount(createFixtures()[3].public_id);
    await screen.findByText("Đã bàn giao"); expect(screen.queryByRole("button", { name: "Mở khóa phiếu" })).toBeNull();
  });
  it("print preview removes deleted rows and preview alone never prints", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    render(<ManifestPreview receipt={createFixtures()[0]} mock onClose={() => {}} />);
    expect(screen.queryByText("DEMO-REMOVED")).toBeNull();
    expect(print).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "In thử Mock" }));
    expect(print).toHaveBeenCalledTimes(1); print.mockRestore();
  });
  it("production preview cannot issue print commands", async () => {
    render(<ManifestPreview receipt={createFixtures()[1]} mock={false} onClose={() => {}} />);
    expect((screen.getByRole("button", { name: "In thử Mock" }) as HTMLButtonElement).disabled).toBe(true);
    await waitFor(() => expect(document.querySelector(".warehouse-history-print")).toBeNull());
    expect(document.querySelector("style[data-warehouse-print]")).toBeNull();
  });
  it("removes the feature A4 page override when preview closes so other print flows keep their settings", () => {
    const view = render(<ManifestPreview receipt={createFixtures()[1]} mock onClose={() => {}} />);
    expect(document.querySelector("style[data-warehouse-print]")?.textContent).toContain("@page");
    view.unmount();
    expect(document.querySelector("style[data-warehouse-print]")).toBeNull();
  });
});
