import { SourceOriginSouthDTO, TransformerDTO, TransformerDTOWithOptions, TransformerSourceDTO } from '@oibus/shared/api/transformer.model';
import { InputType } from '@oibus/shared/connector/transformer-manifest.model';

import { isTransformerApplicable } from '../../shared/utils/utils';

/** The level of the transformer an item is routed to: its own, its group's or its south's */
export type RoutingLevel = 'item' | 'group' | 'south';

/** What routing needs of a transformer: where its data comes from (a transformer being configured has no options yet) */
export interface RoutedTransformer {
  id: string;
  source: TransformerSourceDTO;
}

export interface ItemRouting<T extends RoutedTransformer = TransformerDTOWithOptions> {
  transformer: T;
  level: RoutingLevel;
}

/** Whether the data of a south reaches the North: through a transformer for all its items, for some of them, or none */
export type SouthCoverage = 'all' | 'some' | 'none';

export type SouthTransformer<T extends RoutedTransformer = TransformerDTOWithOptions> = T & { source: SourceOriginSouthDTO };

export const southTransformers = <T extends RoutedTransformer>(transformers: Array<T>, southId: string): Array<SouthTransformer<T>> =>
  transformers.filter(
    (transformer): transformer is SouthTransformer<T> => transformer.source.type === 'south' && transformer.source.south.id === southId
  );

export const isSouthLevel = (transformer: SouthTransformer<RoutedTransformer>) =>
  !transformer.source.group && transformer.source.items.length === 0;

const excludes = (transformer: SouthTransformer<RoutedTransformer>, itemId: string) =>
  (transformer.source.excludedItems ?? []).some(excludedItem => excludedItem.id === itemId);

/**
 * The transformer the North routes an item to, as the backend does: the first one listing the item, then the first one of
 * its group, then the first one of its south, the transformers leaving the item out being skipped. `null` when the data of
 * the item is dropped.
 */
export function resolveItemRouting<T extends RoutedTransformer>(
  transformers: Array<T>,
  southId: string,
  item: { id: string; groupId: string | null }
): ItemRouting<T> | null {
  const candidates = southTransformers(transformers, southId);
  const byItem = candidates.find(transformer => transformer.source.items.some(element => element.id === item.id));
  if (byItem) return { transformer: byItem, level: 'item' };
  const byGroup = item.groupId
    ? candidates.find(transformer => transformer.source.group?.id === item.groupId && !excludes(transformer, item.id))
    : undefined;
  if (byGroup) return { transformer: byGroup, level: 'group' };
  const bySouth = candidates.find(transformer => isSouthLevel(transformer) && !excludes(transformer, item.id));
  return bySouth ? { transformer: bySouth, level: 'south' } : null;
}

/**
 * Whether the data of a south reaches the North. A transformer applying to all its items covers every item, but the ones
 * it deliberately leaves out; otherwise, only the items listed by a transformer, or in the group of one, are sent.
 */
export function southCoverage(transformers: Array<TransformerDTOWithOptions>, southId: string): SouthCoverage {
  const candidates = southTransformers(transformers, southId);
  if (candidates.length === 0) return 'none';
  return candidates.some(isSouthLevel) ? 'all' : 'some';
}

/** The transformers applying to all the items of a south, in list order (the first one not leaving an item out applies) */
export function southLevelTransformers(transformers: Array<TransformerDTOWithOptions>, southId: string): Array<SouthTransformer> {
  return southTransformers(transformers, southId).filter(isSouthLevel);
}

/** The transformers applying to all the items of a group, in list order */
export function groupLevelTransformers(
  transformers: Array<TransformerDTOWithOptions>,
  southId: string,
  groupId: string
): Array<SouthTransformer> {
  return southTransformers(transformers, southId).filter(transformer => transformer.source.group?.id === groupId);
}

/** The transformers listing some items of a south */
export function itemLevelTransformers(transformers: Array<TransformerDTOWithOptions>, southId: string): Array<SouthTransformer> {
  return southTransformers(transformers, southId).filter(transformer => transformer.source.items.length > 0);
}

/**
 * The transformers the North never uses: another transformer of the same scope (the whole south, the same group, or the
 * same items) comes first in the list and applies to everything they would apply to.
 */
export function unusedTransformerIds(transformers: Array<TransformerDTOWithOptions>): Set<string> {
  const unused = new Set<string>();
  transformers.forEach((transformer, index) => {
    const before = transformers.slice(0, index);
    const source = transformer.source;
    if (source.type === 'south') {
      const earlier = southTransformers(before, source.south.id);
      const coversAll = (candidate: SouthTransformer) => (candidate.source.excludedItems ?? []).length === 0;
      if (source.items.length > 0) {
        const listedBefore = new Set(earlier.flatMap(candidate => candidate.source.items.map(item => item.id)));
        if (source.items.every(item => listedBefore.has(item.id))) unused.add(transformer.id);
      } else if (source.group) {
        if (earlier.some(candidate => candidate.source.group?.id === source.group!.id && coversAll(candidate))) unused.add(transformer.id);
      } else if (earlier.some(candidate => isSouthLevel(candidate) && coversAll(candidate))) {
        unused.add(transformer.id);
      }
    } else if (source.type === 'oibus-api') {
      if (before.some(candidate => candidate.source.type === 'oibus-api' && candidate.source.dataSourceId === source.dataSourceId)) {
        unused.add(transformer.id);
      }
    } else if (before.some(candidate => candidate.source.type === 'oianalytics-setpoint')) {
      unused.add(transformer.id);
    }
  });
  return unused;
}

/** The standard transformers sending the data of each type as it is */
const PASSTHROUGHS: Record<InputType, string> = {
  file: 'file',
  'record-list': 'record-list-to-json',
  setpoint: 'setpoint-to-json'
};

/**
 * The transformer to propose for the data of a source sent to a North accepting `northTypes`: files are sent as they are
 * when the North accepts files, otherwise the only standard transformer producing the North's own format (e.g. OIAnalytics
 * values, MQTT payloads), otherwise the passthrough of the data type. `null` when there is no obvious choice.
 */
export function findDefaultTransformer(
  transformers: Array<TransformerDTO>,
  dataType: InputType | null,
  northTypes: Array<string>
): TransformerDTO | null {
  if (!dataType) return null;
  const applicable = transformers.filter(
    transformer => transformer.type === 'standard' && isTransformerApplicable(transformer, dataType, northTypes)
  );
  const passthrough = applicable.find(
    transformer => transformer.type === 'standard' && transformer.functionName === PASSTHROUGHS[dataType]
  );
  if (dataType === 'file' && passthrough) return passthrough;
  const specific = applicable.filter(transformer => transformer.outputType !== 'file');
  if (specific.length === 1) return specific[0];
  return passthrough ?? null;
}
