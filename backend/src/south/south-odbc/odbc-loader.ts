export interface IOdbc {
  connect(args: { connectionString: string; connectionTimeout?: number }): Promise<{
    query(sql: string): Promise<Array<Record<string, string>>>;
    close(): Promise<void>;
  }>;
}

let odbc: IOdbc | null = null;

export async function importOdbc(): Promise<IOdbc | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const mod = await import('odbc');
    return mod.default as IOdbc;
  } catch (error) {
    console.error('Failed to load odbc module:', error);
    return null;
  }
}

export async function loadOdbc(): Promise<IOdbc | null> {
  if (odbc) {
    return odbc;
  }

  odbc = await importOdbc();
  return odbc;
}
