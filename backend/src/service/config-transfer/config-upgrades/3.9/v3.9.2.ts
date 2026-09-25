import { ConfigUpgrade, forEachHistoryQueryItem, forEachSouthItem, JsonObject } from '../config-upgrade';

/**
 * Older versions initialized OPC UA items' `settings.timestampOrigin` to an empty string instead of
 * omitting it. The field is a strict 'oibus' | 'point' | 'server' enum, so the stray empty value is
 * removed. Shared with the entity migration doing the same to existing installs
 * (`migration/entity-migrations/3/3.9/v3.9.2.ts`).
 */
export function removeEmptyTimestampOrigin(settings: JsonObject): JsonObject {
  if (settings.timestampOrigin !== '') return settings;
  const { timestampOrigin: _timestampOrigin, ...rest } = settings;
  return rest;
}

export const upgrade: ConfigUpgrade = {
  version: '3.9.2',
  description: 'Remove the empty timestamp origin of OPC UA items',
  apply: config => {
    const upgradeItem = (item: JsonObject): void => {
      item.settings = removeEmptyTimestampOrigin(item.settings as JsonObject);
    };
    forEachSouthItem(config, 'opcua', upgradeItem);
    forEachHistoryQueryItem(config, 'opcua', upgradeItem);
    return config;
  }
};
