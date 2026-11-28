import fixture from "../../../mocks/warehouse-bags.mock.json" with { type: "json" };
import type { BagFixtureRow } from "../api/warehouse-bags.api";
import type { BagLookupFormValues } from "../warehouse-bags.types";

const clone = <T,>(value: T): T => structuredClone(value);

export function isWarehouseBagsDemoEnabled(input: {
  isDevelopment: boolean;
  useMock: boolean;
  demoFlag: string | undefined;
  isAuthenticated: boolean;
  hasToken: boolean;
}) {
  return input.isDevelopment && input.useMock && input.demoFlag === "true" && input.isAuthenticated && input.hasToken;
}

export function createWarehouseBagsDemoService() {
  const original = clone(fixture.success_response.data);
  const sampleWeight = () => 850;

  function createSession() {
    const bags = clone(original.manifest_bags).map((row) => ({ ...row, status: row.status as BagFixtureRow["status"] }));
    const shipments = clone(original.shipments);
    const items = clone(original.manifest_bag_items);
    let next = 1;
    const envelope = <T,>(data: T, message: string) => ({ success: true as const, message: `DEMO ONLY — ${message}`, data: clone(data), meta: clone(fixture.success_response.meta) });
    const detail = (bag: typeof bags[number]) => {
      const members = items.filter((item) => item.bag_id === bag.id);
      const ids = new Set(members.map((item) => item.shipment_id));
      return { bag: clone(bag), manifest_bag_items: clone(members), shipments: clone(shipments.filter((row) => ids.has(row.id))) };
    };
    return {
      async readFixtureDataset() { return envelope({ ...clone(original), manifest_bags: clone(bags), shipments: clone(shipments), manifest_bag_items: clone(items) }, "dữ liệu fixture"); },
      async listBags() { return { ...envelope(bags, "danh sách túi"), meta: { ...clone(fixture.pagination_response.meta), pagination: { page: 1, per_page: 20, total: bags.length, total_pages: Math.ceil(bags.length / 20) } } }; },
      async findBag(input: BagLookupFormValues) { const row = bags.find((item) => item[input.lookupBy] === input.value); if (!row) throw clone(fixture.bag_not_found_response); return envelope(detail(row), "tra cứu túi"); },
      async findShipment(code: string) { const row = shipments.find((item) => item.tracking_code === code); if (!row) throw clone(fixture.shipment_not_found_response); return envelope(row, "tra cứu vận đơn"); },
      async readErrorFixture(name: keyof typeof fixture) { return clone(fixture[name]); },
      async addShipment(seal: string, destinationId: string, code: string) {
        let bag = bags.find((row) => row.seal_number === seal);
        if (bag && bag.status !== "open") throw clone(fixture.invalid_form_response);
        const shipment = shipments.find((row) => row.tracking_code === code);
        if (!shipment) throw clone(fixture.shipment_not_found_response);
        if (bag && items.some((item) => item.bag_id === bag!.id && item.shipment_id === shipment.id)) throw clone(fixture.duplicate_tracking_response);
        if (!bag) {
          const id = 700 + next++;
          bag = { id, public_id: `01KAV${String(id).padStart(20, "0")}`, bag_code: `DEMO-BAG-${String(next).padStart(3, "0")}`, seal_number: seal, origin_warehouse_id: 101, destination_warehouse_id: Number(destinationId), status: "open", shipment_count: 0, version: 1 };
          bags.unshift(bag);
        }
        items.push({ id: 900 + next++, bag_id: bag.id, shipment_id: shipment.id, scanned_in_by: 901, scanned_in_at: "2026-11-26 09:00:00", unpacked_by: null, unpacked_at: null });
        bag.shipment_count = items.filter((item) => item.bag_id === bag!.id).length;
        return envelope(detail(bag), "đã thêm vận đơn giả lập");
      },
      async removeShipment(seal: string, code: string) {
        const bag = bags.find((row) => row.seal_number === seal && row.status === "open");
        if (!bag) return null;
        const index = items.findIndex((item) => item.bag_id === bag.id && shipments.find((row) => row.id === item.shipment_id)?.tracking_code === code);
        if (index < 0) return null;
        items.splice(index, 1); bag.shipment_count = items.filter((item) => item.bag_id === bag.id).length;
        return envelope(detail(bag), "đã gỡ vận đơn giả lập");
      },
      async sealBag(seal: string) { const bag = bags.find((row) => row.seal_number === seal && row.status === "open" && row.shipment_count > 0); if (!bag) return null; bag.status = "sealed"; return envelope(detail(bag), "đã niêm phong túi giả lập"); },
      async openBag(publicId: string) { const bag = bags.find((row) => row.public_id === publicId && ["sealed", "in_transit"].includes(row.status)); if (!bag) return null; bag.status = "opened"; return envelope(detail(bag), "đã mở túi giả lập"); },
      getCurrentShipments(seal: string) { const bag = bags.find((row) => row.seal_number === seal && row.status === "open"); return bag ? detail(bag).shipments : []; },
      getDemoWeight(publicId: string) { const bag = bags.find((row) => row.public_id === publicId); return bag ? sampleWeight() * bag.shipment_count : null; },
      getDemoWeightBySeal(seal: string) { const bag = bags.find((row) => row.seal_number === seal); return bag ? sampleWeight() * bag.shipment_count : null; },
      reset() { bags.splice(0, bags.length, ...clone(original.manifest_bags).map((row) => ({ ...row, status: row.status as BagFixtureRow["status"] }))); items.splice(0, items.length, ...clone(original.manifest_bag_items)); shipments.splice(0, shipments.length, ...clone(original.shipments)); next = 1; },
    };
  }
  return { createSession };
}
export type WarehouseBagsDemoService = ReturnType<typeof createWarehouseBagsDemoService>;
