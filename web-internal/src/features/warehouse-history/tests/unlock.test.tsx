import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ unlock: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: mock.success, error: mock.error } }));
vi.mock("../api/warehouse-history.api", async (original) => ({ ...await original<typeof import("../api/warehouse-history.api")>(), unlockReceipt: mock.unlock }));
import { UnlockReceiptDialog } from "../components/UnlockReceiptDialog";
import { createFixtures } from "../api/warehouse-history.mock";
import type { HistoryContext } from "../warehouse-history.model";
const c: HistoryContext = { authenticated: true, can_read: true, roles: ["branch_manager"], branch_id: 3, warehouse_id: null, demo_scope: true, unlock_capability: true };
beforeEach(() => { vi.resetAllMocks(); });
afterEach(() => { cleanup(); });
function mount() {
  const onClose = vi.fn(); const onRefresh = vi.fn(); const receipt = createFixtures()[0];
  const view = render(<UnlockReceiptDialog receipt={receipt} context={c} onClose={onClose} onRefresh={onRefresh} />);
  fireEvent.change(screen.getByLabelText("Lý do mở khóa (tối đa 500 ký tự)"), { target: { value: "  Điều chỉnh hợp lệ  " } });
  return { ...view, onClose, onRefresh, receipt };
}
it("retains reason and maps 422 field errors without refreshing away the modal", async () => {
  mock.unlock.mockRejectedValue({ error: { code: "422_VALIDATION_ERROR", message: "Sai dữ liệu", details: { unlock_reason: ["Lý do bị từ chối"] } } });
  const view = mount(); fireEvent.click(screen.getByRole("button", { name: "Xác nhận mở khóa" }));
  await screen.findByText("Lý do bị từ chối");
  expect(view.onRefresh).not.toHaveBeenCalled(); expect(view.onClose).not.toHaveBeenCalled();
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toContain("Điều chỉnh hợp lệ");
});
it("closes with a visible warning and refreshes on conflict, without retrying", async () => {
  mock.unlock.mockRejectedValue({ error: { code: "409_VERSION_CONFLICT", message: "Dữ liệu vừa thay đổi" } });
  const view = mount(); fireEvent.click(screen.getByRole("button", { name: "Xác nhận mở khóa" }));
  await waitFor(() => expect(view.onRefresh).toHaveBeenCalledOnce());
  expect(mock.error).toHaveBeenCalledWith("Dữ liệu vừa thay đổi"); expect(view.onClose).toHaveBeenCalledOnce(); expect(mock.unlock).toHaveBeenCalledOnce();
});
it.each(["Timeout", "Network Error"])("blocks blind resubmit after %s and requires reload", async (message) => {
  mock.unlock.mockRejectedValue(new Error(message)); const view = mount();
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận mở khóa" }));
  await screen.findByRole("button", { name: "Tải lại phiếu" });
  const button = screen.getByRole("button", { name: "Xác nhận mở khóa" }) as HTMLButtonElement;
  expect(button.disabled).toBe(true); fireEvent.click(button); expect(mock.unlock).toHaveBeenCalledOnce();
  expect(mock.success).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole("button", { name: "Tải lại phiếu" }));
  expect(view.onRefresh).toHaveBeenCalledOnce();
});
it("guards two submit events while pending and sends trimmed reason/current version", async () => {
  let resolve: (value: ReturnType<typeof createFixtures>[number]) => void = () => {};
  mock.unlock.mockReturnValue(new Promise((done) => { resolve = done; })); const view = mount();
  const form = screen.getByRole("textbox").closest("form")!;
  fireEvent.submit(form); fireEvent.submit(form);
  await waitFor(() => expect(mock.unlock).toHaveBeenCalledOnce());
  expect(mock.unlock.mock.calls[0][1]).toEqual({ unlock_reason: "Điều chỉnh hợp lệ", version: 3 });
  await act(async () => { resolve({ ...view.receipt, status: "unlocked", version: 4 }); });
  expect(mock.success).toHaveBeenCalledOnce(); expect(view.onRefresh).toHaveBeenCalledOnce();
});
it("ignores late completion after unmount", async () => {
  let resolve: (value: ReturnType<typeof createFixtures>[number]) => void = () => {};
  mock.unlock.mockReturnValue(new Promise((done) => { resolve = done; })); const view = mount();
  fireEvent.submit(screen.getByRole("textbox").closest("form")!);
  await waitFor(() => expect(mock.unlock).toHaveBeenCalledOnce()); view.unmount();
  await act(async () => { resolve({ ...view.receipt, status: "unlocked", version: 4 }); });
  expect(view.onRefresh).not.toHaveBeenCalled(); expect(mock.success).not.toHaveBeenCalled();
});
it("never reports success for an invalid mutation response", async () => {
  mock.unlock.mockResolvedValue(createFixtures()[0]); mount();
  fireEvent.submit(screen.getByRole("textbox").closest("form")!);
  await screen.findByRole("button", { name: "Tải lại phiếu" }); expect(mock.success).not.toHaveBeenCalled();
});
