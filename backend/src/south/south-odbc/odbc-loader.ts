export interface IOdbc {
  connect(args: { connectionString: string; connectionTimeout?: number }): Promise<{
    query(sql: string): Promise<Array<Record<string, string>>>;
    close(): Promise<void>;
  }>;
}

let odbc: IOdbc | null = null;

export function importOdbc(): IOdbc | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('odbc') as IOdbc | null) ?? null;
  } catch {
    return null;
  }
}

export function loadOdbc(): IOdbc | null {
  if (odbc) {
    return odbc;
  }

  odbc = importOdbc();
  return odbc;
}
