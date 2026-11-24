import { WaybillError, type createWaybillMock } from "./waybillPrint.mock.ts";
import type { PrintCommand, TrackingRangeInput, WaybillSession } from "../types/waybillPrint.types";

export function createWaybillGateway(mockMode: boolean, mock: ReturnType<typeof createWaybillMock>) {
  function verifiedMode() {
    if (!mockMode) throw new WaybillError("CONTRACT_BLOCKED", "Chức năng chưa sẵn sàng: hợp đồng API và quyền truy cập chưa được xác nhận.");
  }
  return {
    async shipment(session: WaybillSession, id: string) { verifiedMode(); return mock.shipment(session, id); },
    async log(session: WaybillSession, command: PrintCommand, key: string) { verifiedMode(); return mock.log(session, command, key); },
    async ranges(session: WaybillSession) { verifiedMode(); return mock.list(session); },
    async save(session: WaybillSession, input: TrackingRangeInput, id: string | null, key: string) { verifiedMode(); return mock.save(session, input, id, key); },
    async deactivate(session: WaybillSession, id: string, key: string) { verifiedMode(); return mock.deactivate(session, id, key); },
  };
}
