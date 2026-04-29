export interface IOdbc {
  connect(args: { connectionString: string; connectionTimeout?: number }): Promise<{
    query(sql: string): Promise<Array<Record<string, string>>>;
    close(): Promise<void>;
  }>;
}

import odbcModule from 'odbc';

let odbc: IOdbc | null = null;

export async function importOdbc(): Promise<IOdbc | null> {
  return (odbcModule as IOdbc | null) ?? null;
}

export async function loadOdbc(): Promise<IOdbc | null> {
  if (odbc) {
    return odbc;
  }

  odbc = await importOdbc();
  return odbc;
}
