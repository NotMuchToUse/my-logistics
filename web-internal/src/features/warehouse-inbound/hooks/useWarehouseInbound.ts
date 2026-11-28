import { useCallback, useEffect, useReducer, useRef } from "react";
import { USE_MOCK } from "@/core/api/axiosClient";
import { lookupDemoBarcode } from "../api/warehouse-inbound.api.ts";
import { WAREHOUSE_INBOUND_OPTIONS } from "../constants/warehouse-inbound.constants.ts";
import { warehouseInboundScanSchema } from "../schemas/warehouse-inbound.schema.ts";
import type {
  DemoScanItem,
  DemoScanResult,
  DemoScanSound,
  WarehouseInboundType,
} from "../types/warehouse-inbound.types.ts";
import {
  createBarcodeFeedback,
  type BarcodeFeedbackResult,
} from "../utils/barcode-feedback.ts";

interface InboundState {
  inboundType: WarehouseInboundType;
  barcode: string;
  items: DemoScanItem[];
  lastResult: DemoScanResult | null;
  lastMessage: string | null;
  totalScans: number;
  addedCount: number;
  warningCount: number;
  pendingCount: number;
  soundEnabled: boolean;
  audioFeedback: BarcodeFeedbackResult | null;
}

type Action =
  | { type: "set_barcode"; barcode: string }
  | { type: "set_inbound_type"; inboundType: WarehouseInboundType }
  | { type: "submit" }
  | { type: "complete"; result: DemoScanResult; message: string }
  | { type: "failure"; message: string }
  | { type: "remove"; barcode: string }
  | { type: "reset" }
  | { type: "set_sound"; enabled: boolean }
  | { type: "audio_feedback"; result: BarcodeFeedbackResult };

const initialState: InboundState = {
  inboundType: "new_pickup",
  barcode: "",
  items: [],
  lastResult: null,
  lastMessage: null,
  totalScans: 0,
  addedCount: 0,
  warningCount: 0,
  pendingCount: 0,
  soundEnabled: true,
  audioFeedback: null,
};

function reducer(state: InboundState, action: Action): InboundState {
  switch (action.type) {
    case "set_barcode":
      return { ...state, barcode: action.barcode };
    case "set_inbound_type":
      return { ...state, inboundType: action.inboundType };
    case "submit":
      return {
        ...state,
        barcode: "",
        totalScans: state.totalScans + 1,
        pendingCount: state.pendingCount + 1,
      };
    case "complete":
      return {
        ...state,
        items: action.result.type === "added"
          ? [action.result.item, ...state.items]
          : state.items,
        lastResult: action.result,
        lastMessage: action.message,
        addedCount: state.addedCount + (action.result.type === "added" ? 1 : 0),
        warningCount: state.warningCount + (action.result.type === "added" ? 0 : 1),
        pendingCount: state.pendingCount - 1,
      };
    case "failure":
      return {
        ...state,
        lastResult: null,
        lastMessage: action.message,
        warningCount: state.warningCount + 1,
        pendingCount: state.pendingCount - 1,
      };
    case "remove":
      return { ...state, items: state.items.filter((item) => item.barcode !== action.barcode) };
    case "reset":
      return {
        ...initialState,
        inboundType: state.inboundType,
        soundEnabled: state.soundEnabled,
      };
    case "set_sound":
      return { ...state, soundEnabled: action.enabled, audioFeedback: null };
    case "audio_feedback":
      return { ...state, audioFeedback: action.result };
  }
}

export function useWarehouseInbound() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const lifecycle = useRef({ active: false, generation: 0 });
  const inboundTypeRef = useRef<WarehouseInboundType>("new_pickup");
  const barcodeRef = useRef("");
  const itemsRef = useRef<DemoScanItem[]>([]);
  const pendingRef = useRef(0);
  const soundEnabledRef = useRef(true);
  const feedbackRef = useRef<ReturnType<typeof createBarcodeFeedback> | null>(null);
  const audioSequenceRef = useRef(0);
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    const lifetime = lifecycle.current;
    lifetime.active = true;
    const feedback = createBarcodeFeedback();
    feedback.setEnabled(soundEnabledRef.current);
    feedbackRef.current = feedback;

    return () => {
      lifetime.active = false;
      lifetime.generation += 1;
      audioSequenceRef.current += 1;
      feedbackRef.current = null;
      void feedback.dispose().then((result) => {
        if (result.status === "error") console.error("Không thể giải phóng âm thanh demo.", result.error);
      }).catch((error: unknown) => {
        console.error("Không thể giải phóng âm thanh demo.", error);
      });
    };
  }, []);

  const reportAudio = useCallback((operation: Promise<BarcodeFeedbackResult>) => {
    const generation = lifecycle.current.generation;
    const sequence = ++audioSequenceRef.current;
    void operation.then((result) => {
      if (lifecycle.current.active && lifecycle.current.generation === generation && audioSequenceRef.current === sequence) {
        dispatch({ type: "audio_feedback", result });
      }
    }).catch((error: unknown) => {
      if (lifecycle.current.active && lifecycle.current.generation === generation && audioSequenceRef.current === sequence) {
        dispatch({ type: "audio_feedback", result: { status: "error", error } });
      }
    });
  }, []);

  const setBarcode = useCallback((barcode: string) => {
    barcodeRef.current = barcode;
    dispatch({ type: "set_barcode", barcode });
  }, []);

  const setInboundType = useCallback((inboundType: WarehouseInboundType): boolean => {
    if (
      pendingRef.current > 0 ||
      itemsRef.current.length > 0 ||
      !WAREHOUSE_INBOUND_OPTIONS.some((option) => option.value === inboundType)
    ) {
      return false;
    }
    inboundTypeRef.current = inboundType;
    dispatch({ type: "set_inbound_type", inboundType });
    return true;
  }, []);

  const setSoundEnabled = useCallback((enabled: boolean) => {
    soundEnabledRef.current = enabled;
    audioSequenceRef.current += 1;
    const feedback = feedbackRef.current;
    feedback?.setEnabled(enabled);
    dispatch({ type: "set_sound", enabled });
    if (enabled && feedback) reportAudio(feedback.prepare());
  }, [reportAudio]);

  const scanBarcode = useCallback((barcode = barcodeRef.current): Promise<DemoScanResult | null> => {
    const generation = lifecycle.current.generation;
    if (!lifecycle.current.active) return Promise.resolve(null);

    const feedback = feedbackRef.current;
    if (feedback && soundEnabledRef.current) reportAudio(feedback.prepare());

    const input = { barcode, inboundType: inboundTypeRef.current };
    barcodeRef.current = "";
    pendingRef.current += 1;
    dispatch({ type: "submit" });

    const isCurrent = () => lifecycle.current.active && lifecycle.current.generation === generation;
    const processScan = async (): Promise<DemoScanResult | null> => {
      if (!isCurrent()) return null;
      try {
        const parsed = warehouseInboundScanSchema.safeParse(input);
        const lookup = await lookupDemoBarcode(parsed.success ? parsed.data : input);
        if (!isCurrent()) return null;

        let result: DemoScanResult;
        let message: string;
        if (lookup.type !== "found") {
          result = { type: lookup.type };
          message = lookup.message;
        } else if (itemsRef.current.some((item) => item.barcode === lookup.item.barcode)) {
          result = { type: "duplicate" };
          message = "Mã barcode đã có trong danh sách quét demo.";
        } else {
          const item: DemoScanItem = {
            ...lookup.item,
            inboundType: lookup.inboundType,
            scannedAt: new Date().toISOString(),
          };
          itemsRef.current = [item, ...itemsRef.current];
          result = { type: "added", item };
          message = "Đã thêm mã vào danh sách demo, chưa nhập kho thực tế.";
        }

        pendingRef.current -= 1;
        dispatch({ type: "complete", result, message });
        const sound: DemoScanSound = result.type === "added" ? "success" : "error";
        if (feedbackRef.current && soundEnabledRef.current) reportAudio(feedbackRef.current.play(sound));
        return result;
      } catch (error) {
        if (!isCurrent()) return null;
        console.error("Không thể tra cứu barcode demo.", error);
        pendingRef.current -= 1;
        dispatch({ type: "failure", message: "Không thể tra cứu dữ liệu demo. Vui lòng thử lại." });
        if (feedbackRef.current && soundEnabledRef.current) reportAudio(feedbackRef.current.play("error"));
        return null;
      }
    };

    const result = queueRef.current.then(processScan);
    queueRef.current = result.then(() => undefined, (error: unknown) => {
      console.error("Không thể xử lý hàng đợi quét demo.", error);
    });
    return result;
  }, [reportAudio]);

  const removeBarcode = useCallback((barcode: string) => {
    itemsRef.current = itemsRef.current.filter((item) => item.barcode !== barcode);
    dispatch({ type: "remove", barcode });
  }, []);

  const resetSession = useCallback(() => {
    lifecycle.current.generation += 1;
    audioSequenceRef.current += 1;
    barcodeRef.current = "";
    itemsRef.current = [];
    pendingRef.current = 0;
    queueRef.current = Promise.resolve();
    dispatch({ type: "reset" });
  }, []);

  return {
    ...state,
    isMockMode: USE_MOCK,
    isProcessing: state.pendingCount > 0,
    isInboundTypeLocked: state.pendingCount > 0 || state.items.length > 0,
    currentCount: state.items.length,
    setBarcode,
    setInboundType,
    setSoundEnabled,
    scanBarcode,
    removeBarcode,
    resetSession,
  };
}
