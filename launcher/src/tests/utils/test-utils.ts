/**
 * Because tsx compiles ES module `import` statements as namespace access, module-level mocks
 * must be installed before the module under test is loaded — use mockModule() then reloadModule().
 */
export function mockModule(req: NodeJS.Require, modulePath: string, exports: unknown): Record<string, unknown> {
  try {
    req(modulePath);
  } catch {
    // ensure the module has a cache entry before we replace its exports
  }
  const resolved = req.resolve(modulePath);
  if (req.cache[resolved]) {
    req.cache[resolved]!.exports = exports;
  } else {
    (req.cache as Record<string, unknown>)[resolved] = { id: resolved, filename: resolved, loaded: true, exports, children: [], paths: [] };
  }
  return exports as Record<string, unknown>;
}

/**
 * Deletes a module from the require cache and reloads it.
 */
export function reloadModule<T>(req: NodeJS.Require, modulePath: string): T {
  const resolved = req.resolve(modulePath);
  delete req.cache[resolved];
  return req(modulePath) as T;
}
