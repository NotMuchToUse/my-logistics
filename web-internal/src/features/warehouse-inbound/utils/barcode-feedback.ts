import type { DemoScanSound } from "../types/warehouse-inbound.types.ts";

export type BarcodeFeedbackResult =
  | { status: "ready" | "played" | "disabled" | "unsupported" | "blocked" | "disposed" }
  | { status: "error"; error: unknown };

export function createBarcodeFeedback() {
  let enabled = true;
  let disposed = false;
  let context: AudioContext | null = null;
  const activeNodes = new Set<{ oscillator: OscillatorNode; gain: GainNode }>();

  function setEnabled(value: boolean): void {
    enabled = value;
  }

  function cleanupNodes(
    oscillator: OscillatorNode | undefined,
    gain: GainNode | undefined,
    stop: boolean,
  ): unknown[] {
    const errors: unknown[] = [];
    if (oscillator) {
      oscillator.onended = null;
      if (stop) {
        try {
          oscillator.stop();
        } catch (error) {
          errors.push(error);
        }
      }
      try {
        oscillator.disconnect();
      } catch (error) {
        errors.push(error);
      }
    }
    if (gain) {
      try {
        gain.disconnect();
      } catch (error) {
        errors.push(error);
      }
    }
    return errors;
  }

  async function prepare(): Promise<BarcodeFeedbackResult> {
    if (disposed) return { status: "disposed" };
    if (!enabled) return { status: "disabled" };
    if (typeof window === "undefined" || typeof window.AudioContext !== "function") {
      return { status: "unsupported" };
    }

    try {
      context ??= new window.AudioContext();
      const current = context;
      if (current.state === "suspended") await current.resume();
      if (disposed || context !== current) return { status: "disposed" };
      if (!enabled) return { status: "disabled" };
      return { status: current.state === "running" ? "ready" : "blocked" };
    } catch (error) {
      if (error instanceof Error && error.name === "NotAllowedError") {
        return { status: "blocked" };
      }
      return { status: "error", error };
    }
  }

  async function play(sound: DemoScanSound): Promise<BarcodeFeedbackResult> {
    const result = await prepare();
    if (result.status !== "ready") return result;
    const current = context;
    if (!current || disposed) return { status: "disposed" };
    if (!enabled) return { status: "disabled" };

    let oscillator: OscillatorNode | undefined;
    let gain: GainNode | undefined;
    let nodes: { oscillator: OscillatorNode; gain: GainNode } | undefined;
    let started = false;
    try {
      oscillator = current.createOscillator();
      gain = current.createGain();
      nodes = { oscillator, gain };
      const active = nodes;
      const start = current.currentTime;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(sound === "success" ? 880 : 440, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.04, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
      oscillator.connect(gain);
      gain.connect(current.destination);
      oscillator.onended = () => {
        activeNodes.delete(active);
        const errors = cleanupNodes(active.oscillator, active.gain, false);
        if (errors.length) console.warn("Không thể dọn dẹp âm thanh demo.", errors);
      };
      activeNodes.add(nodes);
      oscillator.start(start);
      started = true;
      oscillator.stop(start + 0.12);
      return { status: "played" };
    } catch (error) {
      if (nodes) activeNodes.delete(nodes);
      const errors = cleanupNodes(oscillator, gain, started);
      return {
        status: "error",
        error: errors.length ? new AggregateError([error, ...errors]) : error,
      };
    }
  }

  async function dispose(): Promise<BarcodeFeedbackResult> {
    if (disposed) return { status: "disposed" };
    disposed = true;
    const current = context;
    context = null;
    const errors: unknown[] = [];

    for (const { oscillator, gain } of activeNodes) {
      errors.push(...cleanupNodes(oscillator, gain, true));
    }
    activeNodes.clear();

    try {
      if (current && current.state !== "closed") await current.close();
    } catch (error) {
      errors.push(error);
    }
    if (errors.length) return { status: "error", error: new AggregateError(errors) };
    return { status: "disposed" };
  }

  return { setEnabled, prepare, play, dispose };
}
