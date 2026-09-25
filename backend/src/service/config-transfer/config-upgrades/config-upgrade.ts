/**
 * Plain JSON object: an upgrade step reads and writes the configuration of an older export, whose
 * shape the current DTO types no longer describe.
 */
export type JsonObject = Record<string, unknown>;

/**
 * One step of the config upgrade chain: rewrites a whole exported configuration (`ConfigExportDTO['config']`)
 * from the shape of the OIBus version before `version` to the shape of `version`, the same way an
 * entity migration rewrites the database. Steps live in `config-upgrades/<major.minor>/v<version>.ts`
 * and are registered in `CONFIG_UPGRADES`.
 *
 * Every entity migration that changes configuration data (a settings shape, a column the DTOs carry,
 * a new entity) needs a step at the same version doing the equivalent to the DTOs; when it rewrites a
 * settings blob, the migration and the step should call the same pure function. The differential test
 * (`config-upgrades.differential.spec.ts`) fails when a migration has no equivalent step.
 */
export interface ConfigUpgrade {
  /**
   * The exact OIBus version, pre-release tag included, that introduced the change (e.g.
   * '3.11.0-beta-3' if it landed in that beta, not '3.11.0').
   */
  version: string;
  /** Shown to the user in the import result. */
  description: string;
  apply: (config: JsonObject) => JsonObject;
}

const asObjects = (value: unknown): Array<JsonObject> => (Array.isArray(value) ? (value as Array<JsonObject>) : []);

/** Calls `fn` on every south connector entry of `type` (or of any type when `type` is null). */
export function forEachSouth(config: JsonObject, type: string | null, fn: (south: JsonObject) => void): void {
  for (const south of asObjects(config.southConnectors)) {
    if (type === null || south.type === type) fn(south);
  }
}

/** Calls `fn` on every item of every south connector entry of `type` (or of any type when `type` is null). */
export function forEachSouthItem(config: JsonObject, type: string | null, fn: (item: JsonObject, south: JsonObject) => void): void {
  forEachSouth(config, type, south => {
    for (const item of asObjects((south.settings as JsonObject | undefined)?.items)) fn(item, south);
  });
}

/** Calls `fn` on every north connector entry of `type` (or of any type when `type` is null). */
export function forEachNorth(config: JsonObject, type: string | null, fn: (north: JsonObject) => void): void {
  for (const north of asObjects(config.northConnectors)) {
    if (type === null || north.type === type) fn(north);
  }
}

/**
 * Calls `fn` on the settings of every history query entry whose south type is `southType` (or of any
 * south type when null).
 */
export function forEachHistoryQuery(config: JsonObject, southType: string | null, fn: (settings: JsonObject) => void): void {
  for (const historyQuery of asObjects(config.historyQueries)) {
    const settings = historyQuery.settings as JsonObject | undefined;
    if (settings && (southType === null || settings.southType === southType)) fn(settings);
  }
}

/** Calls `fn` on every item of every history query entry whose south type is `southType` (or of any south type when null). */
export function forEachHistoryQueryItem(
  config: JsonObject,
  southType: string | null,
  fn: (item: JsonObject, settings: JsonObject) => void
): void {
  forEachHistoryQuery(config, southType, settings => {
    for (const item of asObjects(settings.items)) fn(item, settings);
  });
}
