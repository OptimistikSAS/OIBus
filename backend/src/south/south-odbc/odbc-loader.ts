export interface IOdbc {
  // Define the methods and properties you need from the odbc module
  connect(args: { connectionString: string; connectionTimeout?: number }): Promise<{
    query(sql: string): Promise<Array<Record<string, string>>>;
    close(): Promise<void>;
  }>;

  // Add other methods as needed
}

let odbc: IOdbc | null = null;

// Exported only so we can mock it in tests
export async function importOdbc(): Promise<IOdbc | null> {
  try {
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
