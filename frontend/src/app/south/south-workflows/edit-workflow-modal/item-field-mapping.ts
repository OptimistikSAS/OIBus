import { OIBusRecord } from '@oibus/shared/common/content.model';
import { OIBusAttribute, OIBusAttributeType, OIBusEnablingCondition, OIBusObjectAttribute } from '@oibus/shared/connector/form.model';
import { SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';

/* The fields of a south item a mapping of the workflow wizard can target, read from the manifest of the connector */

// 'group-select' is not part of the manifest's own attribute-type vocabulary - it tags the
// historian groupId field, whose options come from this south connector's item groups rather
// than a static list.
type MappableFieldType = OIBusAttributeType | 'group-select';

/** One manifest enabling condition, resolved to full item-root-relative paths (the manifest's own
 *  referralPathFromRoot/targetPathFromRoot are only relative to the object that declares them - see
 *  buildItemMappableFields). A field is shown only once every rule covering it (its own, plus any
 *  inherited from an enclosing object) evaluates true against the referral field's current mapped value. */
interface FieldEnablingRule {
  referralPath: string;
  values: OIBusEnablingCondition['values'];
  operator?: OIBusEnablingCondition['operator'];
}

/** One field a mapping can target - a path into the item command shape, its translated label, and enough type
 *  information to render a type-appropriate constant input (checkbox, select, ...) instead of a bare text box. */
export interface MappableField {
  path: string;
  translationKey: string;
  attributeType: MappableFieldType;
  /** Only for 'string-select' - the manifest's own selectableValues. */
  selectableValues?: Array<string>;
  /** Every enabling condition gating this field's visibility (own + inherited from an ancestor object) -
   *  all must pass for the field to be shown at all. Empty for fields outside the manifest tree. */
  enablingRules?: Array<FieldEnablingRule>;
  /** Translation keys of every object this field is nested under, beyond the top-level `settings` wrapper
   *  every settings.* field already implies (e.g. ['...ha-mode.title'] for settings.haMode.aggregate) -
   *  shown as breadcrumb context so a deeply-nested field isn't just a bare, ambiguous leaf name. */
  ancestorLabelKeys?: Array<string>;
  /** True for a manifest attribute carrying a REQUIRED validator (e.g. name, scanMode) - the same source
   *  of truth EditSouthItemModalComponent's own form validators read from. Checked at save time so a
   *  workflow can't be saved half-mapped in a way item creation would only reject later, at run time. */
  mandatory?: boolean;
  /** The manifest's own defaultValue for this attribute, when it has a usable one (e.g. `enabled`'s is
   *  `true`) - such a field is left off isMandatoryFieldMissing()'s check even when mandatory, since an
   *  unmapped item command falls back to it (matching EditSouthItemModalComponent's own pre-filled
   *  control). Undefined for attribute types with no such concept (name's is `null`, scan-mode has none
   *  at all) - those stay genuinely required to be explicit. */
  hasUsableDefault?: boolean;
  /** Historian fields whose relevance depends on whether the item is (going to be) mapped into a group,
   *  mirroring the real item edit form's own group-dependent fields - `true` shows the field only when
   *  'groupId' is mapped to something, `false` only when it isn't. Not expressible as an enablingRule
   *  (those match against a known, finite set of values; "groupId is mapped to *something*" can't, since
   *  the set of valid group ids is dynamic). Unset for every field outside this historian group. */
  visibleWhenGrouped?: boolean;
}

/** Sentinel select-option value meaning "map this to a {{field}} expression instead of a fixed value". */
export const VARIABLE_SENTINEL = '__variable__';

/**
 * The fields of the Name & schedule section of the item mapping when the items are added once, in the order of the item
 * modal (see `itemMappingSections`): the others are the settings of the connector.
 */
export const SCHEDULE_ITEM_PATH_ORDER = [
  'name',
  'enabled',
  'groupId',
  'scanModeId',
  'syncWithGroup',
  'maxReadInterval',
  'readDelay',
  'recoveryStrategy',
  'startTimeOffset',
  'endTimeOffset'
];

/**
 * The item fields that have to be mapped, whatever the manifest says: an item is enabled or not on purpose - an unmapped
 * field would leave it to what the item had (a synchronisation) or to the backend (an item added), which is not a choice.
 */
export const ALWAYS_MANDATORY_ITEM_PATHS = new Set(['enabled']);

/** The history settings an item starts with in the item modal - the ones a new item mapping starts with too (see `prepare`). */
export const HISTORY_ITEM_DEFAULTS: Record<string, string> = {
  maxReadInterval: '3600',
  readDelay: '200',
  recoveryStrategy: 'oldest',
  startTimeOffset: '0',
  endTimeOffset: '0'
};

/** The item fields that give an item its schedule: an item of a history query has none, it is read over its time range. */
export const SCHEDULE_ITEM_PATHS = new Set([
  'scanModeId',
  'groupId',
  'syncWithGroup',
  'maxReadInterval',
  'readDelay',
  'startTimeOffset',
  'endTimeOffset',
  'recoveryStrategy'
]);

/** `{{field}}` expressions of a mapping template. */
const TEMPLATE_PLACEHOLDER = /\{\{\s*([^}\s]+)\s*\}\}/g;

// maxReadInterval/readDelay/the offsets/recoveryStrategy only apply to an item that owns its own
// schedule/history settings - once synced with a group, those come from the group instead, so mapping
// them here would be pointless. An item can be *in* a group without being *synced* to it, though (its
// own settings still apply then) - so this hinges on syncWithGroup itself, not merely on groupId being
// mapped, and is expressed as a regular enablingRule since 'true'/'false' is a fixed, known value set.
const HIDDEN_WHILE_SYNCED_WITH_GROUP: FieldEnablingRule = { referralPath: 'syncWithGroup', values: ['true'], operator: 'NOT_EQUAL' };

// None of these vary meaningfully per discovered record - each is a fixed setting of the item's own
// schedule, or a plain on/off toggle - so, like the schedule/group fields, they're constant-only.
export const CONSTANT_ONLY_ITEM_PATHS = new Set([
  'maxReadInterval',
  'readDelay',
  'startTimeOffset',
  'endTimeOffset',
  'recoveryStrategy',
  'syncWithGroup'
]);

// Item fields that exist on every south item but aren't part of the manifest's item attribute tree
// (the real item edit form adds them by hand too, gated on the same manifest.modes.history flag).
const HISTORIAN_ITEM_FIELDS: Array<MappableField> = [
  { path: 'groupId', translationKey: 'south.items.group', attributeType: 'group-select' },
  // syncWithGroup is only meaningful once there's a group to sync with at all.
  { path: 'syncWithGroup', translationKey: 'south.items.sync-with-group', attributeType: 'boolean', visibleWhenGrouped: true },
  {
    path: 'maxReadInterval',
    translationKey: 'south.items.max-read-interval',
    attributeType: 'number',
    enablingRules: [HIDDEN_WHILE_SYNCED_WITH_GROUP]
  },
  {
    path: 'readDelay',
    translationKey: 'south.items.read-delay',
    attributeType: 'number',
    enablingRules: [HIDDEN_WHILE_SYNCED_WITH_GROUP]
  },
  {
    path: 'startTimeOffset',
    translationKey: 'south.items.start-time-offset',
    attributeType: 'number',
    enablingRules: [HIDDEN_WHILE_SYNCED_WITH_GROUP]
  },
  {
    path: 'endTimeOffset',
    translationKey: 'south.items.end-time-offset',
    attributeType: 'number',
    enablingRules: [HIDDEN_WHILE_SYNCED_WITH_GROUP]
  },
  {
    path: 'recoveryStrategy',
    translationKey: 'south.items.recovery-strategy',
    attributeType: 'string-select',
    selectableValues: ['oldest', 'newest'],
    enablingRules: [HIDDEN_WHILE_SYNCED_WITH_GROUP]
  }
];

/** Whether one enabling rule passes against the referral field's current mapped value. */
export function evaluatesTrue(rule: FieldEnablingRule, values: Record<string, string>): boolean {
  const referralValue = values[rule.referralPath] ?? '';
  // Resolved per record at run time: the rule may pass for some of them
  if (referralValue.includes('{{')) {
    return true;
  }
  const matchesAnyValue = rule.values.some(value => String(value) === referralValue);
  if (rule.operator === 'CONTAINS') {
    return rule.values.some(value => referralValue.includes(String(value)));
  }
  if (rule.operator === 'NOT_EQUAL') {
    return !matchesAnyValue;
  }
  return matchesAnyValue;
}

/** Builds a MappableField from a manifest attribute, capturing its type (and selectableValues, for 'string-select')
 *  so the mapping UI can render a type-appropriate constant input instead of a bare text box. */
function toMappableField(
  attribute: OIBusAttribute,
  path: string,
  enablingRules: Array<FieldEnablingRule>,
  ancestorLabelKeys: Array<string>
): MappableField {
  const field: MappableField = {
    path,
    translationKey: attribute.translationKey,
    attributeType: attribute.type,
    enablingRules,
    ancestorLabelKeys,
    mandatory: attribute.validators?.some(validator => validator.type === 'REQUIRED') ?? false,
    // Only a subset of attribute shapes even carry a defaultValue property, and it's nullable on most
    // of those (meaning "no real default", still genuinely required) - 'boolean' is the one type whose
    // defaultValue is never null.
    hasUsableDefault: 'defaultValue' in attribute && attribute.defaultValue !== null
  };
  if (attribute.type === 'string-select') {
    field.selectableValues = attribute.selectableValues;
  }
  return field;
}

// `scanMode` is the one manifest key renamed on its way into a mappable path (to `scanModeId`, what the
// workflow command actually uses) - applied wherever it appears, including as a referral/target of some
// enabling condition, so path resolution stays consistent with the field's own listed path.
function resolveChildPath(pathPrefix: string, key: string): string {
  const resolvedKey = key === 'scanMode' ? 'scanModeId' : key;
  return pathPrefix ? `${pathPrefix}.${resolvedKey}` : resolvedKey;
}

/**
 * Recursively walks one object attribute's children (the item root, `settings`, or any object nested
 * further under it), resolving each `enablingConditions` entry declared on it - relative to its own
 * direct children per the manifest convention (see dynamic-form.builder.ts's addEnablingConditions) -
 * into full item-root-relative paths, and pushing one MappableField per non-object child. A child that
 * is itself an object is recursed into (never pushed as its own field - there's no single value to map
 * a whole nested group of settings to); its own children inherit every rule gating the parent, plus
 * whatever rule of its own further narrows them, and every ancestor's own label beyond the top-level
 * `settings` wrapper (skipped as a breadcrumb entry - every settings.* field already implies it).
 */
function walkItemAttributes(
  objectAttribute: OIBusObjectAttribute,
  pathPrefix: string,
  inheritedRules: Array<FieldEnablingRule>,
  ancestorLabelKeys: Array<string>,
  fields: Array<MappableField>
): void {
  const ownRuleByChildKey = new Map<string, FieldEnablingRule>();
  for (const condition of objectAttribute.enablingConditions) {
    const referralPath = resolveChildPath(pathPrefix, condition.referralPathFromRoot);
    ownRuleByChildKey.set(condition.targetPathFromRoot, { referralPath, values: condition.values, operator: condition.operator });
  }

  for (const attribute of objectAttribute.attributes) {
    const childPath = resolveChildPath(pathPrefix, attribute.key);
    const ownRule = ownRuleByChildKey.get(attribute.key);
    const rules = ownRule ? [...inheritedRules, ownRule] : inheritedRules;

    if (attribute.type === 'object') {
      const childAncestors = pathPrefix === '' ? ancestorLabelKeys : [...ancestorLabelKeys, attribute.translationKey];
      walkItemAttributes(attribute, childPath, rules, childAncestors, fields);
    } else {
      fields.push(toMappableField(attribute, childPath, rules, ancestorLabelKeys));
    }
  }
}

/**
 * Flattens a south connector's item manifest into a mappable-field list: every top-level item
 * attribute (name, enabled, ...), the connector-specific settings.* fields nested arbitrarily deep
 * under the manifest's own `settings` object attribute, `scanMode` renamed to the `scanModeId` path
 * the workflow command actually uses, plus the historian fields the real item form adds by hand
 * outside the manifest tree (gated on the same `manifest.modes.history` flag it uses). Each field
 * carries the manifest's own `enablingConditions`, resolved to full paths, so the UI can hide a field
 * until its condition is met.
 */
export function buildItemMappableFields(manifest: SouthConnectorManifest): Array<MappableField> {
  const fields: Array<MappableField> = [];
  walkItemAttributes(manifest.items.rootAttribute, '', [], [], fields);
  if (manifest.modes.history) {
    fields.push(...HISTORIAN_ITEM_FIELDS);
  }
  return fields;
}

/** A mapping template with its `{{field}}` expressions replaced by the record values - an example item name. */
export function resolveTemplate(template: string, record: OIBusRecord): string {
  return template.replace(TEMPLATE_PLACEHOLDER, (_match, field: string) => {
    const value = record[field];
    return value === null || value === undefined ? '' : String(value);
  });
}

/** Trims every value, keeping only non-empty entries - a blank expression means "not mapped". */
export function nonEmptyEntries(values: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    const trimmed = value?.trim();
    if (trimmed) {
      result[key] = trimmed;
    }
  }
  return result;
}
