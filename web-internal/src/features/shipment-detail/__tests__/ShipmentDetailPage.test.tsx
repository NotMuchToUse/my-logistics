import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { getShipmentDetail } from "../api/shipment-detail.api";
import { ShipmentDetailPage } from "../pages/ShipmentDetailPage";
import { shipmentFixture } from "./shipment-detail.fixture";

vi.mock("../api/shipment-detail.api", () => ({
  getShipmentDetail: vi.fn(),
}));

const mockGetShipmentDetail = vi.mocked(getShipmentDetail);

function renderShipmentDetail(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          element={<ShipmentDetailPage />}
          path="/shipment-detail/:publicId?"
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ShipmentDetailPage", () => {
  beforeEach(() => {
    mockGetShipmentDetail.mockResolvedValue(shipmentFixture);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("loads the route shipment and shows parties, parcel weights, and snapshot fees", async () => {
    renderShipmentDetail("/shipment-detail/SHIP-TEST-001");

    expect(await screen.findByText("SHIP-TEST-001")).toBeTruthy();
    expect(mockGetShipmentDetail).toHaveBeenCalledWith("SHIP-TEST-001");
    expect(screen.getByText("Nguyễn Văn Gửi")).toBeTruthy();
    expect(screen.getByText("Trần Thị Nhận")).toBeTruthy();
    expect(screen.getByText("30 × 20 × 10 cm")).toBeTruthy();
    expect(screen.getAllByText("1,5 kg")).toHaveLength(2);
    expect(screen.getByText("1,2 kg")).toBeTruthy();
    expect(screen.getByText("45.000 đ")).toBeTruthy();
    expect(screen.getByText("Bảo hiểm")).toBeTruthy();
    expect(screen.getByText("Phụ phí vùng xa")).toBeTruthy();
    expect(screen.getByText("250.000 đ")).toBeTruthy();
    expect(screen.getByText("5.000 đ")).toBeTruthy();
  });

  it("filters public and internal events in the shipment timeline", async () => {
    const user = userEvent.setup();
    renderShipmentDetail("/shipment-detail/SHIP-TEST-001");

    await screen.findByText("SHIP-TEST-001");
    await user.click(screen.getByRole("tab", { name: "Hành trình" }));
    expect(screen.getByText("Mốc công khai")).toBeTruthy();
    expect(screen.getByText("Mốc nội bộ")).toBeTruthy();

    await user.click(screen.getByRole("combobox", { name: "Lọc mốc trạng thái" }));
    await user.click(screen.getByRole("option", { name: "Công khai" }));
    expect(screen.getByText("Mốc công khai")).toBeTruthy();
    expect(screen.queryByText("Mốc nội bộ")).toBeNull();

    await user.click(screen.getByRole("combobox", { name: "Lọc mốc trạng thái" }));
    await user.click(screen.getByRole("option", { name: "Nội bộ" }));
    expect(screen.getByText("Mốc nội bộ")).toBeTruthy();
    expect(screen.queryByText("Mốc công khai")).toBeNull();
  });

  it("shows print history and supports lookup from the quick-search field", async () => {
    const user = userEvent.setup();
    renderShipmentDetail("/shipment-detail");

    await user.type(screen.getByRole("textbox", { name: "Mã vận đơn" }), "SHIP-QUICK-02");
    await user.click(screen.getByRole("button", { name: "Tra cứu" }));
    expect(await screen.findByText("SHIP-TEST-001")).toBeTruthy();
    expect(mockGetShipmentDetail).toHaveBeenCalledWith("SHIP-QUICK-02");

    await user.click(screen.getByRole("tab", { name: "Lịch sử in" }));
    expect(screen.getByText("Phiếu gửi")).toBeTruthy();
    expect(screen.getByText("Nhân viên quầy")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("shows the API error when a shipment cannot be loaded", async () => {
    mockGetShipmentDetail.mockRejectedValue({
      error: { message: "Không tìm thấy vận đơn." },
    });
    renderShipmentDetail("/shipment-detail/NOT-FOUND");

    expect(await screen.findByText("Không tìm thấy vận đơn.")).toBeTruthy();
    expect(mockGetShipmentDetail).toHaveBeenCalledWith("NOT-FOUND");
  });
});
