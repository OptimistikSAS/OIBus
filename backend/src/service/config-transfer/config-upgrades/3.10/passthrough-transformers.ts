/**
 * 3.10.0 removes the 'iso' (cache as is) and 'ignore' (drop) standard transformers: a North now drops the data no
 * transformer is configured for. Shared by the entity migration (`migration/entity-migrations/3/3.10/v3.10.0_5.ts`) and
 * the config upgrade of the same version, which reproduce the previous routing:
 *  - a North cached as is the data without transformer when it accepted its content type, and the data configured with
 *    'iso' (the JSON payloads of the MQTT souths and of the OIBus API being cached as files). Such data now goes through
 *    the passthrough of its content type: 'file' for files and payloads, 'record-list-to-json' for records,
 *    'setpoint-to-json' for setpoints;
 *  - the items configured with 'ignore' are left out of the transformer they would otherwise fall back to (excluded
 *    from it, or, for history queries, which cannot exclude items, by narrowing it to the list of the other items).
 */

export const ISO_FUNCTION_NAME = 'iso';
export const IGNORE_FUNCTION_NAME = 'ignore';

export interface Passthrough {
  functionName: string;
  inputType: string;
  outputType: string;
}

export const FILE_PASSTHROUGH: Passthrough = { functionName: 'file', inputType: 'any', outputType: 'any' };
export const RECORD_LIST_PASSTHROUGH: Passthrough = { functionName: 'record-list-to-json', inputType: 'record-list', outputType: 'any' };
export const SETPOINT_PASSTHROUGH: Passthrough = { functionName: 'setpoint-to-json', inputType: 'setpoint', outputType: 'any' };

type ContentType = 'any' | 'any-content' | 'record-list' | 'setpoint';

const RECORD_LIST_SOUTH_TYPES = [
  'ads',
  'bacnet',
  'influxdb',
  'modbus',
  'mongodb',
  'mssql',
  'mysql',
  'odbc',
  'oledb',
  'opc',
  'opcua',
  'oracle',
  'osisoft-pi',
  'postgresql',
  's7',
  'sqlite'
];

/** The content types each North type accepts at 3.10.0 */
const NORTH_CONTENT_TYPES: Record<string, Array<string>> = {
  'aws-s3': ['any'],
  'azure-blob': ['any'],
  'azure-data-explorer': ['any'],
  console: ['any', 'record-list', 'setpoint'],
  'file-writer': ['any', 'record-list', 'setpoint'],
  modbus: ['modbus'],
  mqtt: ['mqtt'],
  oianalytics: ['any', 'oianalytics'],
  opcua: ['opcua'],
  rest: ['any'],
  sftp: ['any']
};

/** The type of the content a south of this type sends: records, JSON payloads (MQTT) or files */
export function southContentType(southType: string): ContentType {
  if (RECORD_LIST_SOUTH_TYPES.includes(southType)) return 'record-list';
  return southType === 'mqtt' ? 'any-content' : 'any';
}

/**
 * The passthrough reproducing how a North of this type received content of this type without transformer, or through
 * 'iso' when `throughIso`. Undefined when the North dropped it (or moved it to its error folder).
 */
export function passthroughFor(contentType: ContentType, northType: string, throughIso: boolean): Passthrough | undefined {
  const accepted = NORTH_CONTENT_TYPES[northType] ?? [];
  if (contentType === 'any-content') {
    // No North accepts JSON payloads as is: they were dropped without transformer, and cached as files through 'iso'
    return throughIso && accepted.includes('any') ? FILE_PASSTHROUGH : undefined;
  }
  if (!accepted.includes(contentType)) return undefined;
  switch (contentType) {
    case 'record-list':
      return RECORD_LIST_PASSTHROUGH;
    case 'setpoint':
      return SETPOINT_PASSTHROUGH;
    default:
      return FILE_PASSTHROUGH;
  }
}

/** A transformer link of a North (or history query) for the data of a south */
export interface RoutingLink {
  id: string;
  /** The function name of a standard transformer, undefined for a custom one */
  functionName: string | undefined;
  /** The items the link applies to (item level) */
  itemIds: Array<string>;
  /** The items of the group the link applies to (group level), undefined when it is not scoped to a group */
  groupItemIds?: Array<string>;
}

export interface RoutingPlan {
  /** The links to delete */
  removed: Array<string>;
  /** The 'iso' links now going through the passthrough, at the same scope */
  toPassthrough: Array<string>;
  /** The links now applying to a list of items: fewer of their items, or no longer their group or their whole south */
  narrowed: Map<string, Array<string>>;
  /** The items now left out of the links applying to a group or to the whole south */
  excluded: Map<string, Array<string>>;
  /** The passthrough link to add: at the south level when `itemIds` is empty, leaving `excludedItemIds` out */
  added: { itemIds: Array<string>; excludedItemIds: Array<string> } | undefined;
}

interface PlannedLink extends RoutingLink {
  excludedItemIds: Array<string>;
}

const NEW_LINK_ID = '\0new';

const isSouthLevel = (link: RoutingLink) => !link.groupItemIds && link.itemIds.length === 0;

/**
 * The link an item is routed to by the North: items level, then group level, then south level, the first one not leaving
 * the item out winning
 */
function resolve(links: Array<PlannedLink>, itemId: string): string | undefined {
  const keeps = (link: PlannedLink) => !link.excludedItemIds.includes(itemId);
  return (
    links.find(link => link.itemIds.includes(itemId))?.id ??
    links.find(link => link.groupItemIds?.includes(itemId) && keeps(link))?.id ??
    links.find(link => isSouthLevel(link) && keeps(link))?.id
  );
}

/**
 * Plans the changes to the links of a south keeping each of its items routed as before, once 'iso' and 'ignore' are
 * removed and the data without transformer is dropped. `passthroughByDefault` and `passthroughThroughIso` tell whether
 * the North received the data as is without transformer, and through 'iso'.
 *
 * Without transformer, the data now goes through a new passthrough link at the south level, so that the items added
 * later are still sent. An item configured with 'ignore' (or with 'iso' when the North dropped its data) falls back to
 * the link of its group or of its south: with `allowExclusions`, the item is left out of that link, which keeps applying
 * to the items added later; otherwise (history queries), the link is narrowed to the list of the items it still routes.
 * A link listing the item itself no longer lists it.
 */
export function planRouting(
  links: Array<RoutingLink>,
  itemIds: Array<string>,
  passthroughByDefault: boolean,
  passthroughThroughIso: boolean,
  allowExclusions: boolean
): RoutingPlan {
  const kind = (link: RoutingLink) =>
    link.functionName === ISO_FUNCTION_NAME || link.functionName === IGNORE_FUNCTION_NAME ? link.functionName : 'other';
  const withoutExclusion = (link: RoutingLink): PlannedLink => ({ ...link, excludedItemIds: [] });

  // The link each item must be routed to, undefined when its data must be dropped
  const expected = new Map<string, string | undefined>();
  for (const itemId of itemIds) {
    const resolvedId = resolve(links.map(withoutExclusion), itemId);
    const resolved = links.find(link => link.id === resolvedId);
    if (!resolved) {
      expected.set(itemId, passthroughByDefault ? NEW_LINK_ID : undefined);
    } else if (kind(resolved) === IGNORE_FUNCTION_NAME) {
      expected.set(itemId, undefined);
    } else if (kind(resolved) === ISO_FUNCTION_NAME) {
      expected.set(itemId, passthroughThroughIso ? resolved.id : undefined);
    } else {
      expected.set(itemId, resolved.id);
    }
  }

  let planned: Array<PlannedLink> = links
    .filter(link => kind(link) === 'other' || (kind(link) === ISO_FUNCTION_NAME && passthroughThroughIso))
    .map(withoutExclusion);
  if (passthroughByDefault && !links.some(isSouthLevel)) {
    planned.push({ id: NEW_LINK_ID, functionName: undefined, itemIds: [], excludedItemIds: [] });
  }

  // Fix the links now catching items which must be dropped. Each fix moves the item to a link of lower priority, so a few
  // passes are enough
  const narrowed = new Set<string>();
  for (let pass = 0; pass <= links.length + 1; pass++) {
    const wrongRoutes = itemIds
      .map(itemId => ({ itemId, linkId: resolve(planned, itemId) }))
      .filter(({ itemId, linkId }) => linkId !== undefined && linkId !== expected.get(itemId));
    if (wrongRoutes.length === 0) break;
    planned = planned.map(link => {
      const wrongItemIds = wrongRoutes.filter(route => route.linkId === link.id).map(route => route.itemId);
      if (wrongItemIds.length === 0) return link;
      if (link.itemIds.length > 0) {
        narrowed.add(link.id);
        return { ...link, itemIds: link.itemIds.filter(itemId => !wrongItemIds.includes(itemId)) };
      }
      if (allowExclusions) {
        return { ...link, excludedItemIds: [...link.excludedItemIds, ...wrongItemIds] };
      }
      narrowed.add(link.id);
      return { ...link, itemIds: itemIds.filter(itemId => expected.get(itemId) === link.id), groupItemIds: undefined };
    });
    // A link narrowed to no item would apply to the whole south
    planned = planned.filter(link => link.itemIds.length > 0 || !narrowed.has(link.id));
  }

  const plannedIds = new Set(planned.map(link => link.id));
  const newLink = planned.find(link => link.id === NEW_LINK_ID);
  const existingLinks = planned.filter(link => link.id !== NEW_LINK_ID);
  return {
    removed: links.filter(link => !plannedIds.has(link.id)).map(link => link.id),
    toPassthrough: links.filter(link => kind(link) === ISO_FUNCTION_NAME && plannedIds.has(link.id)).map(link => link.id),
    narrowed: new Map(existingLinks.filter(link => narrowed.has(link.id)).map(link => [link.id, link.itemIds])),
    excluded: new Map(existingLinks.filter(link => link.excludedItemIds.length > 0).map(link => [link.id, link.excludedItemIds])),
    added: newLink ? { itemIds: newLink.itemIds, excludedItemIds: newLink.excludedItemIds } : undefined
  };
}

/**
 * Plans the changes to the links of a source routed as a whole: the setpoints of OIAnalytics, or one data source of the
 * OIBus API. The first link wins: 'ignore' drops the data, 'iso' sends it as is when the North accepts it. Returns the
 * links to delete, the 'iso' link now going through the passthrough, and whether the data has no link left while the
 * North received it without transformer.
 */
export function planSourceRouting(
  links: Array<{ id: string; functionName: string | undefined }>,
  passthroughThroughIso: boolean
): { removed: Array<string>; toPassthrough: string | undefined; ignored: boolean } {
  const [first, ...others] = links;
  if (!first) return { removed: [], toPassthrough: undefined, ignored: false };
  if (first.functionName === IGNORE_FUNCTION_NAME || (first.functionName === ISO_FUNCTION_NAME && !passthroughThroughIso)) {
    // Every link is removed: the ones after the first were never used, and must not start being used
    return { removed: links.map(link => link.id), toPassthrough: undefined, ignored: true };
  }
  return {
    removed: others
      .filter(link => link.functionName === ISO_FUNCTION_NAME || link.functionName === IGNORE_FUNCTION_NAME)
      .map(link => link.id),
    toPassthrough: first.functionName === ISO_FUNCTION_NAME ? first.id : undefined,
    ignored: false
  };
}
