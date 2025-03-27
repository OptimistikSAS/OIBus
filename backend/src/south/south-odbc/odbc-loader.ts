let odbc: typeof import('odbc') | null = null;

// Exported only so we can mock it in tests
export async function importOdbc() {
  return await import('odbc');
}

export async function loadOdbc(): Promise<typeof import('odbc') | null> {
  try {
    const mod = await importOdbc(); // use this instead of direct import
    odbc = mod.default;
    return odbc;
  } catch {
    return null;
  }
}
