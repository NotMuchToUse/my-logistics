import { useCallback, useEffect, useRef, useState } from "react";
import { waybillPrintApi } from "../api/waybillPrint.api";
import { WaybillError } from "../api/waybillPrint.mock";
import { openPrintFrame } from "../utils/printFrame";
import { selectPrintParcels } from "../utils/printSelection";
import { createPendingOperation } from "../utils/pendingOperation";
import type {
  PrintCommand,
  PrintDocumentType,
  PrintReceipt,
  WaybillPrintModel,
  WaybillSession,
} from "../types/waybillPrint.types";

type PrintState = "idle" | "loading" | "recording" | "opening" | "done" | "error";

export function useWaybillPrint(session: WaybillSession) {
  const modelRef = useRef<WaybillPrintModel | null>(null);
  const loadSequence = useRef(0);
  const printController = useRef<AbortController | null>(null);
  const pendingCommand = useRef<PrintCommand | null>(null);
  const printLock = useRef(false);
  const [model, setModel] = useState<WaybillPrintModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<PrintState>("idle");
  const [receipt, setReceipt] = useState<PrintReceipt | null>(null);
  const [error, setError] = useState<WaybillError | Error | null>(null);
  const [canRetryPrint, setCanRetryPrint] = useState(false);

  const [logOperation] = useState(() => createPendingOperation<PrintCommand, PrintReceipt>(
    (command, key) => waybillPrintApi.log(session, command, key),
    () => session.key,
  ));

  useEffect(() => () => {
    loadSequence.current += 1;
    printController.current?.abort();
    logOperation.invalidate();
  }, [logOperation]);

  const loadShipment = useCallback(async (publicId: string): Promise<WaybillPrintModel | null> => {
    if (printLock.current || logOperation.pending) {
      setError(new WaybillError("OPERATION_PENDING", "Hãy hoàn tất hoặc thử lại lượt in hiện tại trước khi đổi vận đơn."));
      return null;
    }
    const id = publicId.trim();
    const request = ++loadSequence.current;
    const requestSession = session;
    modelRef.current = null;
    setModel(null);
    setReceipt(null);
    setError(null);
    setLoading(true);
    setState("loading");
    try {
      const result = await waybillPrintApi.shipment(requestSession, id);
      if (request !== loadSequence.current || requestSession.key !== session.key) return null;
      modelRef.current = result;
      setModel(result);
      setState("idle");
      return result;
    } catch (caught: unknown) {
      if (request !== loadSequence.current || requestSession.key !== session.key) return null;
      const failure = caught instanceof Error ? caught : new Error("Không tải được dữ liệu vận đơn.");
      setError(failure);
      setState("error");
      return null;
    } finally {
      if (request === loadSequence.current) setLoading(false);
    }
  }, [logOperation, session, setError, setLoading, setModel, setReceipt, setState]);

  const performPrint = useCallback(async (
    source: HTMLElement | null,
    command: PrintCommand,
    retry = false,
  ) => {
    if (printLock.current) {
      const failure = new WaybillError("OPERATION_BUSY", "Thao tác in đang được xử lý.");
      setError(failure);
      return false;
    }
    if (logOperation.pending && !retry) {
      setError(new WaybillError("OUTCOME_UNKNOWN", "Kết quả lượt in trước chưa rõ. Hãy thử lại đúng lượt đó."));
      setCanRetryPrint(pendingCommand.current !== null);
      setState("error");
      return false;
    }
    const currentModel = modelRef.current;
    if (!currentModel || !source) {
      const failure = new WaybillError("PRINT_DATA_NOT_READY", "Dữ liệu xem trước chưa sẵn sàng.");
      setError(failure);
      return false;
    }
    const actualCommand = retry ? pendingCommand.current : command;
    if (!actualCommand) {
      const failure = new WaybillError("NO_PENDING_OPERATION", "Không có lượt in cần thử lại.");
      setError(failure);
      return false;
    }
    printLock.current = true;
    const operationSessionKey = session.key;
    setError(null);
    setState("recording");
    const controller = new AbortController();
    printController.current?.abort();
    printController.current = controller;
    try {
      selectPrintParcels(currentModel, actualCommand);
      if (!retry) {
        pendingCommand.current = actualCommand;
        setCanRetryPrint(true);
      }
      const recorded = await logOperation.run(actualCommand, retry);
      pendingCommand.current = null;
      setCanRetryPrint(false);
      setReceipt(recorded);
      if (session.key !== operationSessionKey || modelRef.current?.publicId !== actualCommand.shipmentPublicId) {
        throw new WaybillError("CONTEXT_CHANGED", "Phiên, chi nhánh hoặc vận đơn đã thay đổi.");
      }
      setState("opening");
      await openPrintFrame(source, actualCommand.documentType, controller.signal);
      setState("done");
      return true;
    } catch (caught: unknown) {
      const failure = caught instanceof Error ? caught : new Error("Không thể thực hiện lượt in.");
      setError(failure);
      setState("error");
      if (!logOperation.pending) pendingCommand.current = null;
      setCanRetryPrint(logOperation.pending && pendingCommand.current !== null);
      return false;
    } finally {
      if (printController.current === controller) printController.current = null;
      printLock.current = false;
    }
  }, [logOperation, session, setCanRetryPrint, setError, setReceipt, setState]);

  const print = useCallback(async (
    source: HTMLElement | null,
    documentType: PrintDocumentType,
    parcelBarcodes: string[],
  ) => {
    const currentModel = modelRef.current;
    if (!currentModel) {
      setError(new WaybillError("PRINT_DATA_NOT_READY", "Chưa tải vận đơn."));
      return false;
    }
    const command: PrintCommand = {
      shipmentPublicId: currentModel.publicId,
      documentType,
      parcelBarcodes: documentType === "barcode_sticker" ? [...parcelBarcodes] : [],
    };
    return performPrint(source, command);
  }, [performPrint, setError]);

  const retryPrint = useCallback(async (source: HTMLElement | null) => {
    const command = pendingCommand.current;
    if (!command) {
      setError(new WaybillError("NO_PENDING_OPERATION", "Không có lượt in cần thử lại."));
      return false;
    }
    return performPrint(source, command, true);
  }, [performPrint, setError]);

  return {
    model,
    loading,
    state,
    receipt,
    error,
    retryAvailable: canRetryPrint,
    loadShipment,
    print,
    retryPrint,
  };
}
