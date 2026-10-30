import assert from 'node:assert/strict';
import { isBuiltin } from 'node:module';
import path from 'node:path';
import { setImmediate } from 'node:timers';
import { type Mock, mock } from 'node:test';

import type { OIBusNorthType } from '../../../shared/model/connector/north-manifest.model';
import type { NorthSettings } from '../../../shared/model/connector/north-settings.model';
import type { OIBusSouthType } from '../../../shared/model/connector/south-manifest.model';
import type { SouthItemSettings, SouthSettings } from '../../../shared/model/connector/south-settings.model';

import type { NorthConnectorEntity } from '../../model/north-connector.model';
import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type { BaseFolders } from '../../model/types';
import type AuditService from '../../service/audit.service';
import type { CustomExpressRequest } from '../../web-server/express';
import testData from './test-data';

// Light helpers only: this module is imported by most specs, so it must not pull knex, better-sqlite3,
// the migrations or any service at runtime (`import type` only). Database helpers live in database-utils.ts.

export const flushPromises = () => new Promise(setImmediate);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: Array<any>) => any;

/**
 * A mocked `T`: every method is a `node:test` mock (`.mock.calls`, `.mock.mockImplementation()`, …) and
 * the object stays assignable to `T` itself — private members included — so it can be passed straight
 * to a constructor expecting the real class.
 */
export type Mocked<T> = T & { [K in keyof T]: T[K] extends AnyFunction ? Mock<T[K]> : T[K] };

/** Default implementations and property values of a mock. Functions are wrapped in `mock.fn()`. */
export type MockOverrides<T> = { [K in keyof T]?: T[K] extends AnyFunction ? (...args: Parameters<T[K]>) => unknown : T[K] };

// Kept undefined: `then` would make the mock look like a promise to `await`, the others are probed by
// node's inspector, assert and JSON serialisation.
const UNMOCKED_PROPERTIES = new Set<PropertyKey>(['then', 'toJSON', 'constructor', 'asymmetricMatch', 'nodeType']);

/**
 * Creates a mock of `T` (a class or an interface: only its type is used, nothing is loaded at runtime).
 * Any method accessed is lazily created as a `mock.fn()` returning `undefined`. `overrides` gives the
 * methods that need a default behaviour and the plain properties (`logger`, settings…):
 *
 *   const southService = createMock<SouthService>({ findById: () => testData.south.list[0] });
 *   southService.create.mock.mockImplementation(async () => created);
 *   assert.strictEqual(southService.delete.mock.callCount(), 1);
 *
 * Create mocks in `beforeEach` instead of resetting them: a fresh mock per test needs no cleanup.
 */
export function createMock<T extends object>(overrides: MockOverrides<T> = {}): Mocked<T> {
  const target: Record<PropertyKey, unknown> = {};
  for (const [key, value] of Object.entries(overrides)) {
    target[key] = typeof value === 'function' && !('mock' in value) ? mock.fn(value as AnyFunction) : value;
  }
  return new Proxy(target, {
    get(object, property) {
      if (property in object) return object[property];
      if (typeof property === 'symbol' || UNMOCKED_PROPERTIES.has(property)) return undefined;
      return (object[property] = mock.fn());
    }
  }) as Mocked<T>;
}

export function createMockServices(overrides: Partial<CustomExpressRequest['services']> = {}): CustomExpressRequest['services'] {
  return {
    auditService: createMock(),
    certificateService: createMock(),
    configImportService: createMock(),
    configTransferService: createMock(),
    configurationWorkflowRunService: createMock(),
    configurationWorkflowService: createMock(),
    historyQueryService: createMock(),
    ipFilterService: createMock(),
    logService: createMock(),
    northService: createMock(),
    oIAnalyticsCommandService: createMock(),
    oIAnalyticsRegistrationService: createMock(),
    oIBusService: createMock(),
    scanModeService: createMock(),
    southService: createMock(),
    transformerService: createMock(),
    userService: createMock(),
    ...overrides
  };
}

/** A fresh AuditService mock, for repositories that require one but whose audit trail is not under test. */
export function createAuditServiceMock(): Mocked<AuditService> {
  return createMock<AuditService>();
}

/**
 * Makes 'tsoa' load only @tsoa/runtime, the part of tsoa the web server and the controllers use (decorators,
 * Controller, ValidateError): the full package also loads the tsoa CLI and the TypeScript compiler with it (~300 ms).
 * It also fixes tsx resolving 'tsoa' to tsoa.json (the TSOA config file) rather than the tsoa npm package, which
 * happens when tsconfig baseUrl:"./" makes bare imports match local JSON files before node_modules.
 * Call this in the before() hook of any spec loading a controller, before loading it.
 */
export function fixTsoaModuleResolution(req: NodeJS.Require): void {
  mockModule(req, 'tsoa', req('@tsoa/runtime'));
}

/**
 * Injects exports into the require cache for a module.
 * The real module is NOT loaded: mocking a connector SDK (mssql, node-opcua, @azure/…) must not
 * pay its import cost, which used to dominate the duration of most specs.
 * Use before reloadModule() to set up mocks for dependencies of the module under test.
 *
 * IMPORTANT: tsx compiles `import { fn } from './mod'` as namespace access (`import_mod.fn()`),
 * so the SUT holds a reference to the exports OBJECT, not individual bindings.
 * This means replacing the cache entry works only when the SUT is loaded AFTER this call.
 * To update mocks between tests, mutate the object returned by this function in-place
 * rather than calling mockModule() again.
 *
 * Node built-ins (`fs`, `node:net`…) cannot be mocked this way: `require` never reads them from the
 * require cache, so the mock would silently do nothing. Use `mock.method(fs, 'readFile', …)` instead.
 */
export function mockModule(req: NodeJS.Require, modulePath: string, exports: unknown): Record<string, unknown> {
  if (isBuiltin(modulePath)) {
    throw new Error(`mockModule() cannot mock the Node built-in "${modulePath}": use mock.method() on it instead`);
  }
  let resolved: string;
  try {
    resolved = req.resolve(modulePath);
  } catch {
    // Module is not resolvable (e.g. optional native addon not installed in this environment).
    // Skip cache injection — when the SUT calls require(modulePath) it will also fail to
    // resolve and run its own error-handling path (e.g. return null).
    return exports as Record<string, unknown>;
  }
  if (req.cache[resolved]) {
    req.cache[resolved]!.exports = exports;
  } else {
    (req.cache as Record<string, unknown>)[resolved] = { id: resolved, filename: resolved, loaded: true, exports, children: [], paths: [] };
  }
  return exports as Record<string, unknown>;
}

/**
 * Deletes a module from the require cache and reloads it.
 * Call after all mockModule() calls to load the SUT with mocked dependencies applied.
 */
export function reloadModule<T>(req: NodeJS.Require, modulePath: string): T {
  const resolved = req.resolve(modulePath);
  delete req.cache[resolved];
  return req(modulePath) as T;
}

/**
 * Creates a FIFO sequential mock implementation for node:test.
 * node:test's mockImplementationOnce overwrites prior "once" impls, so this helper
 * provides Jest-compatible sequential behaviour with multiple staged return values.
 */
export function seq<T>(...impls: Array<() => T>): () => T {
  let i = 0;
  return () => (i < impls.length ? impls[i++]() : (undefined as unknown as T));
}

/**
 * Asserts that `actual` contains all properties from `expected` (partial match).
 * Equivalent to Jest's expect(actual).toEqual(expect.objectContaining(expected)).
 */
export function assertContains(actual: unknown, expected: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(expected)) {
    assert.deepStrictEqual((actual as Record<string, unknown>)[key], value, `Property '${key}' mismatch`);
  }
}

export function stripAuditFields<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map(stripAuditFields) as T;
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (['createdBy', 'updatedBy', 'createdAt', 'updatedAt'].includes(key)) continue;
      result[key] = stripAuditFields(value);
    }
    return result as T;
  }
  return obj;
}

export const mockBaseFolders = (id: string): BaseFolders => ({
  archive: path.resolve('archive', id),
  cache: path.resolve('cache', id),
  error: path.resolve('error', id)
});
export const buildNorthEntity = <T extends NorthSettings>(type: OIBusNorthType, settings: T): NorthConnectorEntity<T> => ({
  id: 'northId',
  createdBy: 'system',
  updatedBy: 'system',
  createdAt: testData.constants.dates.DATE_1,
  updatedAt: testData.constants.dates.DATE_2,
  name: 'myNorth',
  description: 'desc',
  type: type,
  enabled: true,
  settings,
  caching: {
    trigger: {
      scanMode: testData.scanMode.list[0],
      numberOfElements: 250,
      numberOfFiles: 1
    },
    throttling: {
      runMinDelay: 200,
      maxSize: 30,
      maxNumberOfElements: 10_000
    },
    error: {
      retryInterval: 1_000,
      retryCount: 3,
      retentionDuration: 24
    },
    archive: {
      enabled: false,
      retentionDuration: 72
    }
  },
  transformers: []
});

export const buildSouthEntity = <T extends SouthSettings, I extends SouthItemSettings>(
  type: OIBusSouthType,
  settings: T,
  itemSettings: Array<I>
): SouthConnectorEntity<T, I> => {
  const index = 0;
  const items: Array<SouthConnectorItemEntity<I>> = [];
  for (const element of itemSettings) {
    items.push({
      id: `id${index}`,
      createdBy: 'system',
      updatedBy: 'system',
      createdAt: testData.constants.dates.DATE_1,
      updatedAt: testData.constants.dates.DATE_2,
      name: `item${index}`,
      description: null,
      enabled: true,
      settings: element,
      scanMode: testData.scanMode.list[0],
      group: null,
      syncWithGroup: false,
      maxReadInterval: 3600,
      readDelay: 200,
      startTimeOffset: 0,
      endTimeOffset: null,
      recoveryStrategy: null,
      emptyIntervalStrategy: null,
      cachingStrategy: null,
      thresholdType: null,
      threshold: null,
      rangeLow: null,
      rangeHigh: null,
      maxCachingInterval: null
    });
  }
  return {
    id: 'southId',
    createdBy: 'system',
    updatedBy: 'system',
    createdAt: testData.constants.dates.DATE_1,
    updatedAt: testData.constants.dates.DATE_2,
    name: 'mySouth',
    description: 'desc',
    type,
    enabled: true,
    settings,
    items,
    groups: []
  };
};
