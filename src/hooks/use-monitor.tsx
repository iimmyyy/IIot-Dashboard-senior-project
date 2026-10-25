"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api, mode } from "@/lib/api/client";
import { connectTelemetry, isNewerTelemetry } from "@/lib/websocket/telemetry";
import { type Connection, type Scenario, type Telemetry } from "@/types";
import {
  STALE_MS,
  zoneCondition,
  zoneValue,
} from "@/features/telemetry/calculations";

function useMonitorState() {
  const client = useQueryClient();
  const [scenario, setScenario] = useState<Scenario>("normal");
  const [now, setNow] = useState<number | null>(null);
  const [connection, setConnection] = useState<Connection>(
    mode === "demo" ? "connected" : "connecting",
  );
  const [invalidFrames, setInvalidFrames] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 10000);
    return () => clearInterval(timer);
  }, []);
  const experiments = useQuery({
    queryKey: ["experiments"],
    queryFn: api.experiments,
    refetchInterval: 60000,
  });
  const latest = useQuery({
    queryKey: ["latest", scenario],
    queryFn: async () => {
      const next = await api.latest(scenario);
      const current = client.getQueryData<Telemetry | null>([
        "latest",
        scenario,
      ]);
      if (next && Date.parse(next.timestamp) > Date.now() + 30000)
        throw new Error(
          "A measurement has an incorrect timestamp. Ask the system administrator to check the sensor clock.",
        );
      return next && !isNewerTelemetry(current, next) ? current! : next;
    },
    refetchInterval: 15000,
  });
  const alerts = useQuery({
    queryKey: ["alerts"],
    queryFn: api.alerts,
    refetchInterval: 30000,
  });
  const system = useQuery({
    queryKey: ["system"],
    queryFn: api.status,
    refetchInterval: 30000,
  });
  useEffect(() => {
    if (mode === "demo") return;
    const url = process.env.NEXT_PUBLIC_WS_URL;
    if (!url) return;
    return connectTelemetry(
      url,
      (frame) => {
        client.setQueryData<Telemetry | null>(
          ["latest", "normal"],
          (current) => (isNewerTelemetry(current, frame) ? frame : current),
        );
      },
      setConnection,
      () => setInvalidFrames((n) => n + 1),
    );
  }, [client]);
  const currentExperiment = experiments.data?.find(
    (e) => e.status === "running",
  );
  const frame =
    latest.data && latest.data.experiment_id === currentExperiment?.id
      ? latest.data
      : undefined;
  const effectiveConnection =
    mode === "demo"
      ? scenario === "disconnected"
        ? "disconnected"
        : "connected"
      : !process.env.NEXT_PUBLIC_WS_URL
        ? "disconnected"
        : connection;
  const stale =
    !!frame && now !== null && now - Date.parse(frame.timestamp) > STALE_MS;
  const missing =
    !!frame &&
    (["top", "middle", "bottom"] as const).some(
      (position) => zoneValue(frame, position, now ?? 0) === null,
    );
  const status =
    latest.isError ||
    system.isError ||
    system.data?.api_connected === false ||
    effectiveConnection === "disconnected"
      ? "Connection Interrupted"
      : effectiveConnection === "reconnecting"
        ? "Reconnecting"
        : effectiveConnection === "connecting"
          ? "Connecting"
          : stale
            ? "Sensor Data Outdated"
            : frame &&
                frame.readings.some(
                  (reading) =>
                    zoneCondition(frame, reading.position, now ?? 0) ===
                    "error",
                )
              ? "Sensor Error"
              : missing
                ? "Sensor Attention Required"
                : !frame
                  ? "Waiting for Sensor Data"
                  : "Monitoring Active";
  return {
    scenario,
    setScenario,
    now,
    connection: effectiveConnection,
    invalidFrames,
    experiments,
    latest,
    frame,
    alerts,
    system,
    currentExperiment,
    stale,
    missing,
    status,
    refresh: () => {
      void client.invalidateQueries();
    },
    mode,
  };
}
type Monitor = ReturnType<typeof useMonitorState>;
const MonitorContext = createContext<Monitor | null>(null);
function MonitorProvider({ children }: { children: ReactNode }) {
  const value = useMonitorState();
  return (
    <MonitorContext.Provider value={value}>{children}</MonitorContext.Provider>
  );
}
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, staleTime: 10000, refetchOnWindowFocus: true },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <MonitorProvider>{children}</MonitorProvider>
    </QueryClientProvider>
  );
}
export function useMonitor() {
  const value = useContext(MonitorContext);
  if (!value) throw new Error("Monitor provider is required");
  return value;
}
export function useHistory(id: string | undefined, start: number, end: number) {
  return useQuery({
    queryKey: ["history", id, start, end],
    queryFn: () => api.history(id!, start, end),
    enabled:
      !!id && Number.isFinite(start) && Number.isFinite(end) && start < end,
    refetchInterval: 30000,
  });
}
