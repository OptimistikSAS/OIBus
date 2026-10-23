import { SourceOriginSouthDTO, TransformerDTO, TransformerDTOWithOptions } from '@oibus/shared/api/transformer.model';
import { InputType } from '@oibus/shared/connector/transformer-manifest.model';

import { isTransformerApplicable } from '../../shared/utils/utils';

/** The level of the transformer an item is routed to: its own, its group's or its south's */
export type RoutingLevel = 'item' | 'group' | 'south';

export interface ItemRouting {
  transformer: TransformerDTOWithOptions;
  level: RoutingLevel;
}

/** Whether the data of a south reaches the North: through a transformer for all its items, for some of them, or none */
export type SouthCoverage = 'all' | 'some' | 'none';

type SouthTransformer = TransformerDTOWithOptions & { source: SourceOriginSouthDTO };

const southTransformers = (transformers: Array<TransformerDTOWithOptions>, southId: string): Array<SouthTransformer> =>
  transformers.filter(
    (transformer): transformer is SouthTransformer => transformer.source.type === 'south' && transformer.source.south.id === southId
  );

const isSouthLevel = (transformer: SouthTransformer) => !transformer.source.group && transformer.source.items.length === 0;

const excludes = (transformer: SouthTransformer, itemId: string) =>
  (transformer.source.excludedItems ?? []).some(excludedItem => excludedItem.id === itemId);

/**
 * The transformer the North routes an item to, as the backend does: the first one listing the item, then the first one of
 * its group, then the first one of its south, the transformers leaving the item out being skipped. `null` when the data of
 * the item is dropped.
 */
export function resolveItemRouting(
  transformers: Array<TransformerDTOWithOptions>,
  southId: string,
  item: { id: string; groupId: string | null }
): ItemRouting | null {
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

/** The standard transformers sending the data of each type as it is */
const PASSTHROUGHS: Record<InputType, string> = {
  any: 'file',
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
  if (dataType === 'any' && passthrough) return passthrough;
  const specific = applicable.filter(transformer => transformer.outputType !== 'any');
  if (specific.length === 1) return specific[0];
  return passthrough ?? null;
}
