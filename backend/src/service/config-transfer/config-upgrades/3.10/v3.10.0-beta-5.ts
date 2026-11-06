import { ConfigUpgrade, forEachHistoryQuery, forEachNorth, JsonObject } from '../config-upgrade';

/**
 * The error and archive folders get their own maximum size, starting with the cache one: before, the cache maximum
 * size limited the three folders together. Shared with the entity migration doing the same to existing installs
 * (`migration/entity-migrations/3/3.10/v3.10.0_1.ts`).
 */
export function addFolderMaxSizes(caching: JsonObject): void {
  const maxSize = (caching.throttling as JsonObject).maxSize;
  (caching.error as JsonObject).maxSize = maxSize;
  (caching.archive as JsonObject).maxSize = maxSize;
}

export const upgrade: ConfigUpgrade = {
  version: '3.10.0-beta-5',
  description: 'Give the error and archive folders of the North connectors and history queries their own maximum size',
  apply: config => {
    forEachNorth(config, null, north => addFolderMaxSizes((north.settings as JsonObject).caching as JsonObject));
    forEachHistoryQuery(config, null, settings => addFolderMaxSizes(settings.caching as JsonObject));
    return config;
  }
};
