/**
 * `@oibus/opc-classic` is a Windows-only optional dependency (`"os": ["win32"]`): npm skips it on Linux/macOS, so it is
 * never imported statically — these types mirror the part of its API used by the OPC south connector, and the module
 * itself is required lazily, only when a connection is opened.
 */
export type OpcMode = 'da' | 'hda';

export interface OpcServerInfo {
  vendorInfo: string;
  productVersion: string;
  serverState: string;
}

export interface OpcRawValue {
  nodeId: string;
  timestamp: string;
  value: string;
  quality: string;
}

export interface OpcHdaReadOptions {
  aggregate?: string;
  resampling?: string;
  maxReadValues?: number;
  intervalReadDelay?: number;
}

export interface OpcConnection {
  readonly serverInfo: OpcServerInfo;
  read(startTime: string, endTime: string, nodeIds: Array<string>, options?: OpcHdaReadOptions): Promise<Array<OpcRawValue>>;
  disconnect(): Promise<void>;
}

export interface IOpcClassic {
  OpcConnection: {
    connect(host: string, serverName: string, mode: OpcMode): Promise<OpcConnection>;
  };
}

let opcClassic: IOpcClassic | null = null;

// eslint-disable-next-line @typescript-eslint/no-require-imports
export function importOpcClassic(load: () => unknown = () => require('@oibus/opc-classic')): IOpcClassic | null {
  try {
    return (load() as IOpcClassic | null) ?? null;
  } catch {
    return null;
  }
}

export function loadOpcClassic(load?: () => unknown): IOpcClassic | null {
  if (opcClassic) {
    return opcClassic;
  }

  opcClassic = importOpcClassic(load);
  return opcClassic;
}
