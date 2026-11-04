/**
 * `@oibus/oledb` is a Windows-only optional dependency (`"os": ["win32"]`): npm skips it on Linux/macOS, so it is never
 * imported statically — these types mirror the part of its API used by the OLEDB south connector, and the module itself
 * is required lazily, only when a connection is opened.
 */
export interface OleDbConnectionInfo {
  provider: string;
  dataSource: string;
  database: string;
  serverVersion: string;
}

export type OleDbColumnType = 'string' | 'number' | 'boolean' | 'datetime' | 'datetimeoffset' | 'binary' | 'other';

export interface OleDbColumn {
  name: string;
  type: OleDbColumnType;
  dataTypeName: string;
}

export type OleDbValue = string | number | boolean | null;

export interface OleDbQueryResult {
  columns: Array<OleDbColumn>;
  records: Array<Record<string, OleDbValue>>;
}

export interface OleDbConnection {
  readonly info: OleDbConnectionInfo;
  query(sql: string, options?: { timeout?: number }): Promise<OleDbQueryResult>;
  disconnect(): Promise<void>;
}

export interface IOleDb {
  OleDbConnection: {
    connect(connectionString: string, options?: { connectionTimeout?: number }): Promise<OleDbConnection>;
  };
}

let oledb: IOleDb | null = null;

// eslint-disable-next-line @typescript-eslint/no-require-imports
export function importOleDb(load: () => unknown = () => require('@oibus/oledb')): IOleDb | null {
  try {
    return (load() as IOleDb | null) ?? null;
  } catch {
    return null;
  }
}

export function loadOleDb(load?: () => unknown): IOleDb | null {
  if (oledb) {
    return oledb;
  }

  oledb = importOleDb(load);
  return oledb;
}
