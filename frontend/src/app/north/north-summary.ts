import { TranslateService } from '@ngx-translate/core';

import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import { TransformerDTO, TransformerDTOWithOptions } from '@oibus/shared/api/transformer.model';

import { FormUtils } from '../shared/form/form-utils';
import { SettingSummary } from '../shared/form/oibus-settings-summary/settings-summary';

/** The caching settings as edited in the north connector and history query forms */
export interface CachingFormValue {
  trigger: { scanMode: ScanModeDTO | null; numberOfElements: number; numberOfFiles: number };
  throttling: { runMinDelay: number; maxSize: number; maxNumberOfElements: number };
  error: { retryInterval: number; retryCount: number; retentionDuration: number };
  archive: { enabled: boolean; retentionDuration: number };
}

/**
 * Sums up the caching settings, one group per section of the form.
 * @param isInvalid whether the control at this path (from the caching group) has an error
 */
export function summarizeCaching(
  caching: CachingFormValue,
  translateService: TranslateService,
  isInvalid: (path: Array<string>) => boolean
): Array<SettingSummary> {
  const number = (raw: number | null | undefined, labelKey: string, path: [string, string], unitKey?: string): SettingSummary => ({
    kind: 'text',
    labelKey,
    text: raw === null || raw === undefined ? null : unitKey ? `${raw} ${translateService.instant(unitKey)}` : String(raw),
    invalid: isInvalid(path)
  });
  const { trigger, throttling, error, archive } = caching;
  return [
    {
      kind: 'group',
      labelKey: 'north.caching.trigger.title',
      settings: [
        {
          kind: 'text',
          labelKey: 'north.caching.trigger.schedule',
          text: trigger.scanMode?.name ?? null,
          invalid: isInvalid(['trigger', 'scanMode'])
        },
        number(trigger.numberOfElements, 'north.caching.trigger.number-of-elements', ['trigger', 'numberOfElements']),
        number(trigger.numberOfFiles, 'north.caching.trigger.number-of-files', ['trigger', 'numberOfFiles'])
      ]
    },
    {
      kind: 'group',
      labelKey: 'north.caching.throttling.title',
      settings: [
        number(throttling.runMinDelay, 'north.caching.throttling.run-min-delay', ['throttling', 'runMinDelay'], 'common.unit.ms'),
        number(throttling.maxNumberOfElements, 'north.caching.throttling.max-number-of-elements', ['throttling', 'maxNumberOfElements']),
        number(throttling.maxSize, 'north.caching.throttling.max-size', ['throttling', 'maxSize'], 'common.unit.MB')
      ]
    },
    {
      kind: 'group',
      labelKey: 'north.caching.error.title',
      settings: [
        number(error.retryInterval, 'north.caching.error.retry-interval', ['error', 'retryInterval'], 'common.unit.ms'),
        number(error.retryCount, 'north.caching.error.retry-count', ['error', 'retryCount']),
        number(error.retentionDuration, 'north.caching.error.retention-duration', ['error', 'retentionDuration'], 'common.unit.hr')
      ]
    },
    {
      kind: 'group',
      labelKey: 'north.caching.archive.title',
      settings: [
        { kind: 'boolean', labelKey: 'north.caching.archive.enabled', value: archive.enabled },
        number(archive.retentionDuration, 'north.caching.archive.retention-duration', ['archive', 'retentionDuration'], 'common.unit.hr')
      ]
    }
  ];
}

/** The name of a transformer, as shown in the transformer lists */
export function transformerName(transformer: TransformerDTO, translateService: TranslateService): string {
  return transformer.type === 'standard'
    ? translateService.instant('configuration.oibus.manifest.transformers.standard.' + transformer.functionName)
    : transformer.name;
}

/**
 * The options of a north transformer shown beside its name in the transformer lists: the ones its manifest displays in view
 * mode (e.g. the time precision of the OIAnalytics payloads), as "label: value"
 */
export function transformerOptionsSummary(transformer: TransformerDTOWithOptions, translateService: TranslateService): string {
  return FormUtils.buildColumn(transformer.transformer.manifest.attributes, [])
    .map(column => {
      const value = FormUtils.formatValue(transformer.options, column.path, column.type, column.translationKey, translateService, []);
      if (value === '' || value === null || value === undefined) return null;
      const label = translateService.instant(column.type === 'string-select' ? `${column.translationKey}.title` : column.translationKey);
      return `${label}: ${value}`;
    })
    .filter(option => option !== null)
    .join(', ');
}

/** Where the data of a north transformer comes from, as shown in the transformer lists */
export function formatTransformerSource(transformer: TransformerDTOWithOptions, translateService: TranslateService): string {
  if (transformer.source.type === 'south') {
    const southLabel = `${transformer.source.south!.name} (${translateService.instant('enums.oibus-south-type.' + transformer.source.south!.type)})`;
    const numberOfItems = transformer.source.items.length;
    const numberOfExcludedItems = transformer.source.excludedItems?.length ?? 0;
    const exceptItems = numberOfExcludedItems
      ? translateService.instant('configuration.oibus.manifest.transformers.except-items', { numberOfItems: numberOfExcludedItems })
      : '';

    if (transformer.source.group) {
      return `${southLabel} [${translateService.instant('configuration.oibus.manifest.transformers.group-selected', { groupName: transformer.source.group.name })}${exceptItems}]`;
    } else if (numberOfItems === 1) {
      return `${southLabel} [${transformer.source.items[0].name}]`;
    } else if (numberOfItems > 1) {
      return `${southLabel} [${translateService.instant('configuration.oibus.manifest.transformers.several-items-selected', { numberOfItems })}]`;
    } else {
      return `${southLabel} [${translateService.instant('configuration.oibus.manifest.transformers.all-items-selected')}${exceptItems}]`;
    }
  } else if (transformer.source.type === 'oibus-api') {
    return transformer.source.dataSourceId
      ? `${translateService.instant('configuration.oibus.manifest.transformers.oibus-api-selected', { dataSourceId: transformer.source.dataSourceId })} `
      : `${translateService.instant('configuration.oibus.manifest.transformers.oibus-api-all-selected')} `;
  } else {
    return `${translateService.instant('configuration.oibus.manifest.transformers.oianalytics-setpoint-selected')}`;
  }
}

/** What changed in a list (items, transformers) since it was saved */
export interface ListChanges {
  added: number;
  changed: number;
  removed: number;
}

/** Compares a list with the list as saved, matching the elements by id: an element without one is new */
export function compareLists<T extends { id?: string | null }>(list: Array<T>, saved: Array<T>): ListChanges {
  const savedById = new Map(saved.map(element => [element.id, JSON.stringify(element)]));
  const keptIds = new Set(list.filter(element => element.id && savedById.has(element.id)).map(element => element.id));
  return {
    added: list.filter(element => !element.id || !savedById.has(element.id)).length,
    changed: list.filter(element => element.id && savedById.has(element.id) && savedById.get(element.id) !== JSON.stringify(element))
      .length,
    removed: [...savedById.keys()].filter(id => !keptIds.has(id)).length
  };
}
