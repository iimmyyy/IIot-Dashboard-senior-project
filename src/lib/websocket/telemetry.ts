import { telemetrySchema, type Connection, type Telemetry } from "@/types";
export const reconnectDelay = (attempt: number) =>
  Math.min(1000 * 2 ** Math.min(attempt, 5), 30000);
export function isNewerTelemetry(
  current: Telemetry | null | undefined,
  next: Telemetry,
) {
  return !current || Date.parse(next.timestamp) > Date.parse(current.timestamp);
}
export function connectTelemetry(
  url: string,
  onFrame: (frame: Telemetry) => void,
  onState: (state: Connection) => void,
  onInvalid: () => void,
) {
  let socket: WebSocket | undefined;
  let timer: ReturnType<typeof setTimeout>;
  let watchdog: ReturnType<typeof setTimeout>;
  let disposed = false;
  let attempt = 0;
  function open() {
    if (disposed) return;
    onState(attempt ? "reconnecting" : "connecting");
    try {
      socket = new WebSocket(url);
    } catch {
      retry();
      return;
    }
    const armWatchdog = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => socket?.close(), 90000);
    };
    socket.onopen = () => {
      attempt = 0;
      onState("connected");
      armWatchdog();
    };
    socket.onmessage = (event) => {
      try {
        const data: unknown = JSON.parse(event.data);
        if (
          data &&
          typeof data === "object" &&
          "type" in data &&
          data.type === "heartbeat"
        ) {
          armWatchdog();
          return;
        }
        const result = telemetrySchema.safeParse(data);
        if (
          result.success &&
          Date.parse(result.data.timestamp) <= Date.now() + 30000
        ) {
          armWatchdog();
          onFrame(result.data);
        } else onInvalid();
      } catch {
        onInvalid();
      }
    };
    socket.onerror = () => socket?.close();
    socket.onclose = () => {
      clearTimeout(watchdog);
      retry();
    };
  }
  function retry() {
    if (disposed) return;
    onState("reconnecting");
    timer = setTimeout(open, reconnectDelay(attempt++));
  }
  open();
  return () => {
    disposed = true;
    clearTimeout(timer);
    clearTimeout(watchdog);
    if (socket) {
      socket.onclose = null;
      socket.close();
    }
  };
}
