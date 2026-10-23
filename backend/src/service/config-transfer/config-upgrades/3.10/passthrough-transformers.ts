/**
 * 3.10.0 removes the 'iso' (cache as is) and 'ignore' (drop) standard transformers: a North now drops the data no
 * transformer is configured for. Shared by the entity migration (`migration/entity-migrations/3/3.10/v3.10.0_5.ts`) and
 * the config upgrade of the same version, which reproduce the previous routing:
 *  - a North cached as is the data without transformer when it accepted its content type, and the data configured with
 *    'iso' (the JSON payloads of the MQTT souths and of the OIBus API being cached as files). Such data now goes through
 *    the passthrough of its content type: 'file' for files and payloads, 'record-list-to-json' for records,
 *    'setpoint-to-json' for setpoints;
 *  - the items configured with 'ignore' are left out of the transformer they would otherwise fall back to, which is
 *    narrowed to the list of the other items.
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
  /** The links narrowed to a list of items (no longer scoped to their group or to the whole south) */
  narrowed: Map<string, Array<string>>;
  /** The passthrough link to add: at the south level when `itemIds` is empty */
  added: { itemIds: Array<string> } | undefined;
}

const NEW_LINK_ID = '\0new';

const isSouthLevel = (link: RoutingLink) => !link.groupItemIds && link.itemIds.length === 0;

/** The link an item is routed to by the North: items level, then group level, then south level, the first one winning */
function resolve(links: Array<RoutingLink>, itemId: string): string | undefined {
  return (
    links.find(link => link.itemIds.includes(itemId))?.id ??
    links.find(link => link.groupItemIds?.includes(itemId))?.id ??
    links.find(isSouthLevel)?.id
  );
}

/**
 * Plans the changes to the links of a south keeping each of its items routed as before, once 'iso' and 'ignore' are
 * removed and the data without transformer is dropped. `passthroughByDefault` and `passthroughThroughIso` tell whether
 * the North received the data as is without transformer, and through 'iso'.
 *
 * Without transformer, the data now goes through a new passthrough link at the south level, so that the items added
 * later are still sent. An item configured with 'ignore' (or with 'iso' when the North dropped its data) falls back to
 * the link of its group or of its south: that link is narrowed to the list of the items it still routes.
 */
export function planRouting(
  links: Array<RoutingLink>,
  itemIds: Array<string>,
  passthroughByDefault: boolean,
  passthroughThroughIso: boolean
): RoutingPlan {
  const kind = (link: RoutingLink) =>
    link.functionName === ISO_FUNCTION_NAME || link.functionName === IGNORE_FUNCTION_NAME ? link.functionName : 'other';

  // The link each item must be routed to, undefined when its data must be dropped
  const expected = new Map<string, string | undefined>();
  for (const itemId of itemIds) {
    const resolvedId = resolve(links, itemId);
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

  let planned: Array<RoutingLink> = links.filter(
    link => kind(link) === 'other' || (kind(link) === ISO_FUNCTION_NAME && passthroughThroughIso)
  );
  if (passthroughByDefault && !links.some(isSouthLevel)) {
    planned.push({ id: NEW_LINK_ID, functionName: undefined, itemIds: [] });
  }

  // Narrow the links now catching items which must be dropped. Each narrowing only moves its link to the items level for
  // the items it already routed, so a few passes are enough
  const narrowed = new Map<string, Array<string>>();
  for (let pass = 0; pass <= links.length; pass++) {
    const wronglyRouting = new Set<string>();
    for (const itemId of itemIds) {
      const resolvedId = resolve(planned, itemId);
      if (resolvedId !== undefined && resolvedId !== expected.get(itemId)) {
        wronglyRouting.add(resolvedId);
      }
    }
    if (wronglyRouting.size === 0) break;
    planned = planned.map(link => {
      if (!wronglyRouting.has(link.id)) return link;
      const routedItemIds = itemIds.filter(itemId => expected.get(itemId) === link.id);
      narrowed.set(link.id, routedItemIds);
      return { ...link, itemIds: routedItemIds, groupItemIds: undefined };
    });
    planned = planned.filter(link => link.itemIds.length > 0 || !narrowed.has(link.id));
  }

  const plannedIds = new Set(planned.map(link => link.id));
  const newLink = planned.find(link => link.id === NEW_LINK_ID);
  narrowed.delete(NEW_LINK_ID);
  for (const id of narrowed.keys()) {
    if (!plannedIds.has(id)) narrowed.delete(id);
  }
  return {
    removed: links.filter(link => !plannedIds.has(link.id)).map(link => link.id),
    toPassthrough: links.filter(link => kind(link) === ISO_FUNCTION_NAME && plannedIds.has(link.id)).map(link => link.id),
    narrowed,
    added: newLink ? { itemIds: newLink.itemIds } : undefined
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
