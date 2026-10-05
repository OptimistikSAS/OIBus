import Module from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

/**
 * @yao-pkg/pkg does not support package.json subpath imports (`"imports": { "#foo": ... }`): Node's native resolver reads
 * package.json files outside the patched fs, so it cannot see them inside the /snapshot virtual filesystem.
 * This hook resolves `#` specifiers (used for example by chalk >= 5) from the nearest package.json when running in a pkg
 * binary. The targets must also be bundled through the `pkg.scripts` field of package.json.
 */
type ImportTarget = string | null | { [condition: string]: ImportTarget } | Array<ImportTarget>;

const CONDITIONS = ['node', 'require', 'default'];

const pickTarget = (target: ImportTarget): string | null => {
  if (target === null || typeof target === 'string') return target;
  if (Array.isArray(target)) {
    for (const item of target) {
      const resolved = pickTarget(item);
      if (resolved) return resolved;
    }
    return null;
  }
  for (const [condition, value] of Object.entries(target)) {
    if (CONDITIONS.includes(condition)) {
      const resolved = pickTarget(value);
      if (resolved) return resolved;
    }
  }
  return null;
};

const findPackageImports = (fromDir: string): { dir: string; imports: Record<string, ImportTarget> } | null => {
  let dir = fromDir;
  while (true) {
    const packageJsonPath = path.join(dir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const { imports } = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      return imports ? { dir, imports } : null;
    }
    const parentDir = path.dirname(dir);
    if (parentDir === dir) return null;
    dir = parentDir;
  }
};

const resolveSubpathImport = (request: string, parentFilename: string): string | null => {
  const packageImports = findPackageImports(path.dirname(parentFilename));
  if (!packageImports) return null;
  const { dir, imports } = packageImports;
  if (request in imports) {
    const target = pickTarget(imports[request]);
    return target ? path.join(dir, target) : null;
  }
  for (const [key, value] of Object.entries(imports)) {
    const [prefix, suffix] = key.split('*');
    if (suffix !== undefined && request.startsWith(prefix) && request.endsWith(suffix)) {
      const target = pickTarget(value);
      return target ? path.join(dir, target.replace('*', request.slice(prefix.length, request.length - suffix.length))) : null;
    }
  }
  return null;
};

if ('pkg' in process) {
  const moduleInternals = Module as unknown as {
    _resolveFilename: (request: string, parent: { filename?: string } | undefined, ...args: Array<unknown>) => string;
  };
  const originalResolveFilename = moduleInternals._resolveFilename;
  moduleInternals._resolveFilename = function (request, parent, ...args) {
    if (request.startsWith('#') && parent?.filename) {
      const resolved = resolveSubpathImport(request, parent.filename);
      if (resolved) return originalResolveFilename.call(this, resolved, parent, ...args);
    }
    return originalResolveFilename.call(this, request, parent, ...args);
  };
}
