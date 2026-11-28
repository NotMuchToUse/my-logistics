import { useEffect, useRef, useState } from "react";
import { USE_MOCK } from "@/core/api/axiosClient";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { useBranchScopeStore } from "@/core/stores/useBranchScopeStore";
import { createBranchCodCollectionDemoData } from "../mocks/branch-cod-collection.mock";
import type {
  DemoBranchScope,
  DemoCashCollection,
  DemoCollectionItem,
  DemoDebtShipment,
  DemoDriverDebt,
  DemoScanResult,
  DemoVnd,
} from "../types/branch-cod-collection.types";

type DemoActionResult =
  | { ok: true }
  | { ok: false; reason: "unavailable" | "invalid_state" | "invalid_data" };

interface Access {
  hasRead: boolean;
  hasCollect: boolean;
  scope: DemoBranchScope | null;
  key: string | null;
}

interface DemoSession {
  generation: number;
  key: string;
  scope: DemoBranchScope;
  debts: DemoDriverDebt[];
  selectedDriverId: string | null;
  scanned: DemoCollectionItem[];
  collections: DemoCashCollection[];
  currentCollectionId: string | null;
  lastScan: DemoScanResult | null;
}

function hasActiveCollection(session: DemoSession): boolean {
  return session.currentCollectionId !== null ||
    session.collections.some((entry) => entry.status === "draft");
}

function sameScope(left: DemoBranchScope, right: DemoBranchScope): boolean {
  return left.scope_type === right.scope_type &&
    left.branch_id === right.branch_id &&
    left.warehouse_id === right.warehouse_id;
}

function readAccess(): Access {
  const auth = useAuthStore.getState();
  const branches = useBranchScopeStore.getState();
  const hasRead = USE_MOCK && auth.isAuthenticated && !!auth.token &&
    !!auth.user && auth.hasPermission("finance.read");
  const hasCollect = hasRead && auth.hasPermission("finance.collect");
  const active = branches.activeScope;
  const validScope = active !== null &&
    (active.scope_type === "branch" || active.scope_type === "post_office") &&
    active.branch_id !== null && Number.isSafeInteger(active.branch_id) &&
    active.branch_id > 0 && active.warehouse_id === null &&
    branches.activeBranchId === active.branch_id &&
    branches.activeWarehouseId === active.warehouse_id &&
    branches.scopes.some((scope) => sameScope(scope, active));
  const scope: DemoBranchScope | null = validScope && active
    ? {
        scope_type: active.scope_type,
        branch_id: active.branch_id,
        warehouse_id: active.warehouse_id,
      }
    : null;

  return {
    hasRead,
    hasCollect,
    scope,
    key: hasRead && scope
      ? JSON.stringify([auth.user?.public_id, auth.token, hasCollect, scope])
      : null,
  };
}

function isDemoVnd(value: number): value is DemoVnd {
  return Number.isSafeInteger(value) && value >= 0;
}

function sumAmounts(items: readonly DemoDebtShipment[]): DemoVnd {
  let total = 0;
  for (const item of items) {
    if (!isDemoVnd(item.amountDue)) throw new Error("Số tiền demo không hợp lệ.");
    total += item.amountDue;
    if (!isDemoVnd(total)) throw new Error("Tổng tiền demo vượt phạm vi an toàn.");
  }
  if (!isDemoVnd(total)) throw new Error("Tổng tiền demo không hợp lệ.");
  return total;
}

function copyItem(item: DemoDebtShipment): DemoCollectionItem {
  return {
    ...item,
    codTransactions: item.codTransactions.map((transaction) => ({ ...transaction })),
  };
}

function holding(item: DemoDebtShipment): boolean {
  if (
    !isDemoVnd(item.codAmount) || !isDemoVnd(item.freightAmount) ||
    !isDemoVnd(item.amountDue) || item.codTransactions.length === 0
  ) throw new Error("Dữ liệu vận đơn demo không hợp lệ.");
  const status = item.codTransactions[0].status;
  if (
    (status !== "driver_holding" && status !== "collected_by_branch") ||
    item.codTransactions.some((transaction) => transaction.status !== status)
  ) throw new Error("Trạng thái giao dịch demo không nhất quán.");
  return status === "driver_holding";
}

function validateDebts(debts: readonly DemoDriverDebt[], scope: DemoBranchScope): DemoDriverDebt[] {
  const driverIds = new Set<string>();
  const shipmentIds = new Set<string>();
  const barcodes = new Set<string>();
  const transactionIds = new Set<string>();
  return debts.map((debt) => {
    if (
      !debt.driver.id || driverIds.has(debt.driver.id) ||
      !sameScope(debt.scope, scope) || debt.driver.branchId !== scope.branch_id
    ) throw new Error("Tài xế hoặc phạm vi demo không hợp lệ.");
    driverIds.add(debt.driver.id);
    const active: DemoDebtShipment[] = [];
    for (const item of debt.shipments) {
      if (!item.shipmentId || !item.barcode || shipmentIds.has(item.shipmentId) || barcodes.has(item.barcode)) {
        throw new Error("Vận đơn hoặc barcode demo không hợp lệ.");
      }
      shipmentIds.add(item.shipmentId);
      barcodes.add(item.barcode);
      for (const transaction of item.codTransactions) {
        if (!transaction.id || transactionIds.has(transaction.id)) {
          throw new Error("Giao dịch demo không hợp lệ.");
        }
        transactionIds.add(transaction.id);
      }
      if (holding(item)) active.push(item);
    }
    return { ...debt, totalDebt: sumAmounts(active) };
  });
}

function sameItem(left: DemoCollectionItem, right: DemoDebtShipment): boolean {
  return left.shipmentId === right.shipmentId && left.barcode === right.barcode &&
    left.codAmount === right.codAmount && left.freightAmount === right.freightAmount &&
    left.amountDue === right.amountDue &&
    left.codTransactions.length === right.codTransactions.length &&
    left.codTransactions.every((transaction, index) =>
      transaction.id === right.codTransactions[index].id &&
      transaction.status === right.codTransactions[index].status);
}

function validateItems(session: DemoSession, driverId: string, items: readonly DemoCollectionItem[]): DemoVnd {
  const debt = session.debts.find((entry) => entry.driver.id === driverId);
  if (!debt || items.length === 0) throw new Error("Danh sách demo không hợp lệ.");
  const shipmentIds = new Set<string>();
  const transactionIds = new Set<string>();
  for (const item of items) {
    if (shipmentIds.has(item.shipmentId)) throw new Error("Vận đơn demo bị trùng.");
    shipmentIds.add(item.shipmentId);
    const source = debt.shipments.find((entry) => entry.shipmentId === item.shipmentId);
    if (!source || !holding(source) || !holding(item) || !sameItem(item, source)) {
      throw new Error("Vận đơn demo không còn đủ điều kiện.");
    }
    for (const transaction of item.codTransactions) {
      if (transactionIds.has(transaction.id)) throw new Error("Giao dịch demo bị trùng.");
      transactionIds.add(transaction.id);
    }
  }
  return sumAmounts(items);
}

// Chỉ quản lý trạng thái demo trong vòng đời của hook, không thực hiện thu tiền.
export function useBranchCodCollection() {
  useAuthStore();
  useBranchScopeStore();
  const [snapshot, setSnapshot] = useState<DemoSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<DemoSession | null>(null);
  const generationRef = useRef(0);
  const collectionIdRef = useRef(0);

  useEffect(() => {
    let active = true;
    let contextInvalidated = false;
    const initialAuth = useAuthStore.getState();
    const principal = JSON.stringify([initialAuth.user?.public_id, initialAuth.token]);
    const grantedScopes = useBranchScopeStore.getState().scopes;
    const synchronize = () => {
      const auth = useAuthStore.getState();
      if (
        contextInvalidated ||
        principal !== JSON.stringify([auth.user?.public_id, auth.token]) ||
        grantedScopes !== useBranchScopeStore.getState().scopes
      ) {
        contextInvalidated = true;
        generationRef.current += 1;
        sessionRef.current = null;
        setSnapshot(null);
        setError("Phiên hoặc phạm vi được cấp đã thay đổi; vui lòng mở lại trang demo.");
        return;
      }
      const access = readAccess();
      if (sessionRef.current && sessionRef.current.key === access.key) return;
      generationRef.current += 1;
      sessionRef.current = null;
      setSnapshot(null);
      setError(null);
      const scope = access.scope;
      if (!access.key || !scope) return;
      try {
        const debts = validateDebts(
          createBranchCodCollectionDemoData().filter((debt) => sameScope(debt.scope, scope)),
          scope,
        );
        const session: DemoSession = {
          generation: generationRef.current,
          key: access.key,
          scope,
          debts,
          selectedDriverId: null,
          scanned: [],
          collections: [],
          currentCollectionId: null,
          lastScan: null,
        };
        if (active) {
          sessionRef.current = session;
          setSnapshot(session);
        }
      } catch (cause) {
        console.error("Không thể khởi tạo dữ liệu thu COD demo.", cause);
        if (active) setError("Dữ liệu demo không hợp lệ; thao tác đã bị chặn.");
      }
    };
    const unsubscribeAuth = useAuthStore.subscribe(synchronize);
    const unsubscribeScope = useBranchScopeStore.subscribe(synchronize);
    synchronize();
    return () => {
      active = false;
      generationRef.current += 1;
      sessionRef.current = null;
      unsubscribeAuth();
      unsubscribeScope();
    };
  }, []);

  const access = readAccess();
  const visible = snapshot && access.key === snapshot.key ? snapshot : null;
  const generation = visible?.generation;

  function current(needsCollect: boolean): DemoSession | null {
    const live = sessionRef.current;
    const currentAccess = readAccess();
    if (
      !live || generation === undefined || live.generation !== generation ||
      live.key !== currentAccess.key || !currentAccess.hasRead ||
      (needsCollect && !currentAccess.hasCollect)
    ) return null;
    return live;
  }

  function publish(session: DemoSession): void {
    sessionRef.current = session;
    setError(null);
    setSnapshot(session);
  }

  function failData(cause: unknown): DemoActionResult {
    console.error("Thao tác thu COD demo bị chặn.", cause);
    setError("Dữ liệu demo không nhất quán; thao tác đã bị chặn.");
    return { ok: false, reason: "invalid_data" };
  }

  function selectDriver(driverId: string): DemoActionResult {
    const session = current(false);
    if (!session) return { ok: false, reason: "unavailable" };
    if (!session.debts.some((entry) => entry.driver.id === driverId)) {
      return { ok: false, reason: "invalid_state" };
    }
    if (driverId !== session.selectedDriverId &&
      (session.scanned.length > 0 || session.collections.some((entry) => entry.status === "draft"))) {
      return { ok: false, reason: "invalid_state" };
    }
    publish({ ...session, selectedDriverId: driverId, lastScan: null });
    return { ok: true };
  }

  function scanBarcode(input: string): DemoScanResult | null {
    const session = current(true);
    if (!session) return null;
    if (hasActiveCollection(session)) {
      const result: DemoScanResult = { type: "collection_not_draft" };
      publish({ ...session, lastScan: result });
      return result;
    }
    let result: DemoScanResult;
    const barcode = input.trim();
    const debt = session.debts.find((entry) => entry.driver.id === session.selectedDriverId);
    if (!barcode) result = { type: "invalid" };
    else if (!debt) {
      publish({ ...session, lastScan: null });
      setError("Vui lòng chọn tài xế demo trước khi quét.");
      return null;
    } else {
      const item = debt.shipments.find((entry) => entry.barcode === barcode);
      const otherDriver = session.debts.some((entry) =>
        entry.driver.id !== debt.driver.id && entry.shipments.some((shipment) => shipment.barcode === barcode));
      try {
        if (!item) result = otherDriver ? { type: "wrong_driver" } : { type: "not_found" };
        else if (!holding(item)) result = { type: "not_driver_holding" };
        else if (session.scanned.some((entry) => entry.shipmentId === item.shipmentId)) result = { type: "duplicate" };
        else if (session.collections.some((entry) =>
          entry.status !== "cancelled" && entry.items.some((line) => line.shipmentId === item.shipmentId))) {
          result = { type: "already_in_collection" };
        } else {
          const copy = copyItem(item);
          validateItems(session, debt.driver.id, [...session.scanned, copy]);
          result = { type: "added", item: copyItem(copy) };
          publish({ ...session, scanned: [...session.scanned, copy], lastScan: result });
          return structuredClone(result);
        }
      } catch (cause) {
        failData(cause);
        return null;
      }
    }
    publish({ ...session, lastScan: result });
    return result;
  }

  function removeScanned(shipmentId: string): DemoActionResult {
    const session = current(true);
    if (!session) return { ok: false, reason: "unavailable" };
    if (hasActiveCollection(session) ||
      !session.scanned.some((entry) => entry.shipmentId === shipmentId)) {
      return { ok: false, reason: "invalid_state" };
    }
    publish({ ...session, scanned: session.scanned.filter((entry) => entry.shipmentId !== shipmentId), lastScan: null });
    return { ok: true };
  }

  function clearScanned(): DemoActionResult {
    const session = current(true);
    if (!session) return { ok: false, reason: "unavailable" };
    if (hasActiveCollection(session)) {
      return { ok: false, reason: "invalid_state" };
    }
    publish({ ...session, scanned: [], lastScan: null });
    return { ok: true };
  }

  function createCollection(): DemoActionResult {
    const session = current(true);
    if (!session) return { ok: false, reason: "unavailable" };
    const debt = session.debts.find((entry) => entry.driver.id === session.selectedDriverId);
    if (!debt || session.scanned.length === 0 ||
      hasActiveCollection(session)) {
      return { ok: false, reason: "invalid_state" };
    }
    try {
      const totalAmount = validateItems(session, debt.driver.id, session.scanned);
      if (session.scanned.some((item) => session.collections.some((entry) =>
        entry.status !== "cancelled" && entry.items.some((line) => line.shipmentId === item.shipmentId)))) {
        return { ok: false, reason: "invalid_state" };
      }
      const id = `DEMO-COLLECTION-${++collectionIdRef.current}`;
      const collection: DemoCashCollection = {
        id,
        driverId: debt.driver.id,
        branchId: debt.driver.branchId,
        scope: { ...session.scope },
        items: session.scanned.map(copyItem),
        totalAmount,
        status: "draft",
      };
      publish({
        ...session,
        scanned: [],
        collections: [...session.collections, collection],
        currentCollectionId: id,
        lastScan: null,
      });
      return { ok: true };
    } catch (cause) {
      return failData(cause);
    }
  }

  function changeCollection(id: string, target: "locked" | "cancelled"): DemoActionResult {
    const session = current(true);
    if (!session) return { ok: false, reason: "unavailable" };
    const collection = session.collections.find((entry) => entry.id === id);
    if (!collection || collection.status !== "draft" ||
      !sameScope(collection.scope, session.scope) || collection.branchId !== session.scope.branch_id) {
      return { ok: false, reason: "invalid_state" };
    }
    try {
      const total = validateItems(session, collection.driverId, collection.items);
      if (total !== collection.totalAmount) throw new Error("Tổng bảng kê demo không nhất quán.");
      const debts = target === "locked"
        ? validateDebts(session.debts.map((debt) => {
            if (debt.driver.id !== collection.driverId) return debt;
            const ids = new Set(collection.items.map((item) => item.shipmentId));
            return {
              ...debt,
              shipments: debt.shipments.map((item) => ids.has(item.shipmentId)
                ? {
                    ...item,
                    codTransactions: item.codTransactions.map((transaction) => ({
                      ...transaction,
                      status: "collected_by_branch" as const,
                    })),
                  }
                : item),
            };
          }), session.scope)
        : session.debts;
      publish({
        ...session,
        debts,
        collections: session.collections.map((entry) =>
          entry.id === id ? { ...entry, status: target } : entry),
      });
      return { ok: true };
    } catch (cause) {
      return failData(cause);
    }
  }

  function startNewCollection(): DemoActionResult {
    const session = current(true);
    if (!session) return { ok: false, reason: "unavailable" };
    if (session.collections.some((entry) => entry.status === "draft") || session.scanned.length > 0) {
      return { ok: false, reason: "invalid_state" };
    }
    publish({ ...session, currentCollectionId: null, lastScan: null });
    return { ok: true };
  }

  const selectedDebt = visible?.debts.find((entry) => entry.driver.id === visible.selectedDriverId);
  const currentCollection = visible?.collections.find((entry) => entry.id === visible.currentCollectionId) ?? null;
  const collectionActive = visible ? hasActiveCollection(visible) : false;
  const safeDebts = visible?.debts.map((debt) => ({
    ...debt,
    shipments: debt.shipments.filter((item) => item.codTransactions.every((transaction) =>
      transaction.status === "driver_holding")),
  })) ?? [];

  return {
    isMockMode: USE_MOCK,
    hasRead: access.hasRead,
    hasCollect: access.hasCollect,
    scope: access.scope ? { ...access.scope } : null,
    isScopeValid: access.scope !== null,
    isProcessing: false,
    error,
    drivers: structuredClone(safeDebts.map((debt) => debt.driver)),
    driverDebts: structuredClone(safeDebts),
    selectedDriver: selectedDebt ? structuredClone(selectedDebt.driver) : null,
    currentDebt: selectedDebt
      ? structuredClone(safeDebts.find((debt) => debt.driver.id === selectedDebt.driver.id) ?? null)
      : null,
    scanned: structuredClone(visible?.scanned ?? []),
    scannedTotal: visible ? sumAmounts(visible.scanned) : null,
    currentCollection: structuredClone(currentCollection),
    history: structuredClone(visible?.collections ?? []),
    lastScan: structuredClone(visible?.lastScan ?? null),
    canCreate: !!visible && access.hasCollect && !!selectedDebt && visible.scanned.length > 0 && !collectionActive,
    canLock: !!currentCollection && access.hasCollect && currentCollection.status === "draft",
    canCancel: !!currentCollection && access.hasCollect && currentCollection.status === "draft",
    selectDriver,
    scanBarcode,
    removeScanned,
    clearScanned,
    createCollection,
    lockCollection: (id: string) => changeCollection(id, "locked"),
    cancelCollection: (id: string) => changeCollection(id, "cancelled"),
    startNewCollection,
  };
}
