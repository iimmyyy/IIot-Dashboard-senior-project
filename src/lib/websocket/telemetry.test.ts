import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  connectTelemetry,
  isNewerTelemetry,
  reconnectDelay,
} from "./telemetry";
import { demoFrame } from "@/lib/mock/data";

class FakeSocket {
  static instances: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  constructor() {
    FakeSocket.instances.push(this);
  }
  close() {
    this.onclose?.();
  }
}
beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeSocket);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("real-time telemetry safeguards", () => {
  it("ignores older and duplicate measurements", () => {
    const frame = demoFrame(Date.now());
    expect(isNewerTelemetry(frame, frame)).toBe(false);
    expect(isNewerTelemetry(frame, demoFrame(Date.now() - 1000))).toBe(false);
    expect(isNewerTelemetry(frame, demoFrame(Date.now() + 1000))).toBe(true);
  });
  it("caps reconnection delay", () => {
    expect([0, 1, 2, 8].map(reconnectDelay)).toEqual([1000, 2000, 4000, 30000]);
  });
  it("reconnects after disconnect and cancels retries on cleanup", () => {
    const state = vi.fn();
    const dispose = connectTelemetry("ws://test", vi.fn(), state, vi.fn());
    FakeSocket.instances[0].onopen?.();
    expect(state).toHaveBeenLastCalledWith("connected");
    FakeSocket.instances[0].close();
    expect(state).toHaveBeenLastCalledWith("reconnecting");
    vi.advanceTimersByTime(1000);
    expect(FakeSocket.instances.length).toBe(2);
    dispose();
    vi.advanceTimersByTime(60000);
    expect(FakeSocket.instances.length).toBe(2);
  });
  it("rejects invalid and future frames", () => {
    const invalid = vi.fn();
    const frame = vi.fn();
    const dispose = connectTelemetry("ws://test", frame, vi.fn(), invalid);
    const socket = FakeSocket.instances[0];
    socket.onmessage?.({ data: '{"bad":true}' });
    socket.onmessage?.({ data: "not json" });
    socket.onmessage?.({ data: JSON.stringify(demoFrame(Date.now() + 60000)) });
    expect(invalid).toHaveBeenCalledTimes(3);
    expect(frame).not.toHaveBeenCalled();
    dispose();
  });
  it("accepts valid telemetry and heartbeat messages", () => {
    const receive = vi.fn();
    const invalid = vi.fn();
    const dispose = connectTelemetry("ws://test", receive, vi.fn(), invalid);
    FakeSocket.instances[0].onopen?.();
    FakeSocket.instances[0].onmessage?.({
      data: JSON.stringify(demoFrame(Date.now())),
    });
    FakeSocket.instances[0].onmessage?.({ data: '{"type":"heartbeat"}' });
    expect(receive).toHaveBeenCalledTimes(1);
    expect(invalid).not.toHaveBeenCalled();
    dispose();
  });
  it("reconnects when an open stream stops responding", () => {
    const dispose = connectTelemetry("ws://test", vi.fn(), vi.fn(), vi.fn());
    FakeSocket.instances[0].onopen?.();
    vi.advanceTimersByTime(91000);
    expect(FakeSocket.instances.length).toBe(2);
    dispose();
  });
});
