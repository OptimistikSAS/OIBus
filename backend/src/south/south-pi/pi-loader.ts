/**
 * `@oibus/pi` is a Windows-only optional dependency (`"os": ["win32"]`): npm skips it on Linux/macOS, so it is never
 * imported statically — these types mirror the part of its API used by the PI south connector, and the module itself is
 * required lazily, only when a connection is opened.
 */
export interface PiServerInfo {
  name: string;
  version: string;
  uniqueId: string;
}

export type PiValue = string | number | boolean | null;

export interface PiRecordedValue {
  timestamp: string;
  value: PiValue;
  good: boolean;
}

export interface PiPointValues {
  point: string;
  values: Array<PiRecordedValue>;
}

export interface PiReadResult {
  points: Array<PiPointValues & { name: string; filter?: string }>;
  notFound: Array<string>;
  pointsErrors: Array<{ names: Array<string>; filter?: string; error: string }>;
  queries: Array<{ query: string; filter?: string; points: Array<PiPointValues>; error?: string }>;
}

export interface PiConnection {
  readonly info: PiServerInfo;
  recordedValues(
    startTime: string,
    endTime: string,
    request: { points?: Array<{ name: string; filter?: string }>; queries?: Array<{ query: string; filter?: string }> },
    options?: { pageSize?: number; timeout?: number }
  ): Promise<PiReadResult>;
  disconnect(): Promise<void>;
}

export interface IPi {
  PiConnection: {
    connect(options?: { serverName?: string; connectionTimeout?: number }): Promise<PiConnection>;
  };
}

let pi: IPi | null = null;

// eslint-disable-next-line @typescript-eslint/no-require-imports
export function importPi(load: () => unknown = () => require('@oibus/pi')): IPi | null {
  try {
    return (load() as IPi | null) ?? null;
  } catch {
    return null;
  }
}

export function loadPi(load?: () => unknown): IPi | null {
  if (pi) {
    return pi;
  }

  pi = importPi(load);
  return pi;
}
