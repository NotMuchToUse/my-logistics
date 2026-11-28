import type {
  DemoCodTransactionStatus,
  DemoDebtShipment,
  DemoDriverDebt,
  DemoVnd,
} from "../types/branch-cod-collection.types";

// Dữ liệu và quy tắc dưới đây chỉ phục vụ UI demo, không phải nghiệp vụ Backend.
function demoVnd(value: number): DemoVnd {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError("Số tiền demo phải là số nguyên VND không âm và an toàn.");
  }
  return value as DemoVnd;
}

function shipment(
  shipmentId: string,
  barcode: string,
  transactionIds: readonly string[],
  codAmount: number,
  freightAmount: number,
  amountDue: number,
  status: DemoCodTransactionStatus = "driver_holding",
): DemoDebtShipment {
  return {
    shipmentId,
    barcode,
    codTransactions: transactionIds.map((id) => ({ id, status })),
    codAmount: demoVnd(codAmount),
    freightAmount: demoVnd(freightAmount),
    amountDue: demoVnd(amountDue),
  };
}

function totalHolding(shipments: readonly DemoDebtShipment[]): DemoVnd {
  const seen = new Set<string>();
  let total = demoVnd(0);
  for (const item of shipments) {
    if (seen.has(item.shipmentId)) {
      throw new Error(`Vận đơn demo trùng ID: ${item.shipmentId}`);
    }
    seen.add(item.shipmentId);
    if (item.codTransactions.length === 0) {
      throw new Error(`Vận đơn demo thiếu giao dịch: ${item.shipmentId}`);
    }
    const statuses = new Set(item.codTransactions.map((transaction) => transaction.status));
    if (statuses.size !== 1) {
      throw new Error(`Vận đơn demo có trạng thái giao dịch không đồng nhất: ${item.shipmentId}`);
    }
    if (item.codTransactions[0].status === "driver_holding") {
      total = demoVnd(total + item.amountDue);
    }
  }
  return total;
}

// Mỗi lần gọi tạo bản sao độc lập; dữ liệu chưa được lọc theo quyền hoặc scope phiên.
export function createBranchCodCollectionDemoData(): DemoDriverDebt[] {
  const branchScope = { scope_type: "branch", branch_id: 3, warehouse_id: null } as const;
  const postOfficeScope = { scope_type: "post_office", branch_id: 4, warehouse_id: null } as const;

  const drivers: Omit<DemoDriverDebt, "totalDebt">[] = [
    {
      driver: { id: "DEMO-DRIVER-A", name: "Tài xế Demo A", branchId: 3 },
      scope: branchScope,
      shipments: [
        shipment("DEMO-SHIPMENT-01", "DEMO-COD-0001", ["DEMO-TXN-01"], 100000, 0, 100000),
        shipment("DEMO-SHIPMENT-02", "DEMO-COD-0002", ["DEMO-TXN-02"], 0, 20000, 20000),
        shipment("DEMO-SHIPMENT-03", "DEMO-COD-0003", ["DEMO-TXN-03A", "DEMO-TXN-03B"], 125000, 15000, 130000),
        shipment("DEMO-SHIPMENT-04", "DEMO-COD-0004", ["DEMO-TXN-04"], 80000, 0, 80000, "collected_by_branch"),
        shipment("DEMO-SHIPMENT-05", "DEMO-COD-0005", ["DEMO-TXN-05"], 45000, 0, 45000),
      ],
    },
    {
      driver: { id: "DEMO-DRIVER-B", name: "Tài xế Demo B", branchId: 3 },
      scope: { ...branchScope },
      shipments: [
        shipment("DEMO-SHIPMENT-06", "DEMO-COD-0006", ["DEMO-TXN-06"], 60000, 0, 60000),
        shipment("DEMO-SHIPMENT-07", "DEMO-COD-0007", ["DEMO-TXN-07"], 0, 18000, 18000),
        shipment("DEMO-SHIPMENT-08", "DEMO-COD-0008", ["DEMO-TXN-08"], 75000, 0, 75000),
        shipment("DEMO-SHIPMENT-09", "DEMO-COD-0009", ["DEMO-TXN-09"], 30000, 0, 30000),
      ],
    },
    {
      driver: { id: "DEMO-DRIVER-C", name: "Tài xế Demo C", branchId: 4 },
      scope: postOfficeScope,
      shipments: [
        shipment("DEMO-SHIPMENT-10", "DEMO-COD-0010", ["DEMO-TXN-10"], 90000, 0, 90000),
        shipment("DEMO-SHIPMENT-11", "DEMO-COD-0011", ["DEMO-TXN-11"], 0, 25000, 25000),
        shipment("DEMO-SHIPMENT-12", "DEMO-COD-0012", ["DEMO-TXN-12"], 55000, 0, 55000),
      ],
    },
    {
      driver: { id: "DEMO-DRIVER-D", name: "Tài xế Demo D", branchId: 4 },
      scope: { ...postOfficeScope },
      shipments: [],
    },
  ];

  return drivers.map((driver) => ({
    ...driver,
    totalDebt: totalHolding(driver.shipments),
  }));
}
