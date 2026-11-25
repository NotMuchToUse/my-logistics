import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  createOpsConfigMockService,
  parseOpsConfigMockSeed,
} from "../api/ops-config.mock.ts";

const fixture = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../../mocks/ops-config.mock.json", import.meta.url)),
    "utf8",
  ),
);
const seed = parseOpsConfigMockSeed(fixture.data);

export function createOpsConfigHarness() {
  const lookups = {
    service_types: [
      { id: 1, code: "EXPRESS", name: "Chuyển phát nhanh", is_active: 1 },
      { id: 2, code: "STANDARD", name: "Chuyển phát tiêu chuẩn", is_active: 1 },
    ],
    branches: [
      { id: 1, code: "BR-01", name: "Chi nhánh mẫu 1", is_active: 1 },
      { id: 2, code: "BR-02", name: "Chi nhánh mẫu 2", is_active: 1 },
      { id: 3, code: "BR-03", name: "Chi nhánh mẫu 3", is_active: 1 },
      { id: 5, code: "BR-05", name: "Chi nhánh mẫu 5", is_active: 1 },
    ],
    warehouses: [
      {
        id: 1,
        branch_id: 2,
        code: "WH-01",
        name: "Kho mẫu 1",
        is_active: 1,
      },
      {
        id: 2,
        branch_id: 3,
        code: "WH-02",
        name: "Kho mẫu 2",
        is_active: 1,
      },
      {
        id: 3,
        branch_id: 5,
        code: "WH-03",
        name: "Kho mẫu 3",
        is_active: 1,
      },
    ],
    partners: [],
    drivers: seed.drivers.map((driver) => ({ ...driver })),
  };
  let service;
  service = createOpsConfigMockService(seed, async () => ({
    ...lookups,
    partners: service.getPartnerLookups(),
  }));
  return { fixture, seed, lookups, service };
}
