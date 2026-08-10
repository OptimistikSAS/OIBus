import { Knex } from 'knex';

const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const SOUTH_ITEMS_TABLE = 'south_items';
const HISTORY_QUERIES_TABLE = 'history_queries';
const HISTORY_ITEMS_TABLE = 'history_items';

export const NEW_DATE_TIME_TYPES = [
  'iso-string',
  'unix-epoch',
  'unix-epoch-ms',
  'string',
  'date',
  'small-date-time',
  'date-time',
  'date-time-2',
  'date-time-offset',
  'timestamp',
  'timestamptz'
] as const;
export type NewDateTimeType = (typeof NEW_DATE_TIME_TYPES)[number];

export const OLD_DATE_TIME_TYPES = [
  'string',
  'Date',
  'DateTime',
  'DateTime2',
  'DateTimeOffset',
  'SmallDateTime',
  'iso-string',
  'unix-epoch',
  'unix-epoch-ms',
  'timestamp',
  'timestamptz'
] as const;
export type OldDateTimeType = (typeof OLD_DATE_TIME_TYPES)[number];

export async function up(knex: Knex): Promise<void> {
  await updateSouthSQLItemSettings(knex);
  await updateHistorySQLItemSettings(knex);
}

async function updateSouthSQLItemSettings(knex: Knex) {
  const items: Array<{ id: string; settings: string }> = await knex(SOUTH_ITEMS_TABLE)
    .join(SOUTH_CONNECTORS_TABLE, `${SOUTH_CONNECTORS_TABLE}.id`, '=', `${SOUTH_ITEMS_TABLE}.connector_id`)
    .select(`${SOUTH_ITEMS_TABLE}.id as id`, `${SOUTH_ITEMS_TABLE}.settings as settings`)
    .where(`${SOUTH_CONNECTORS_TABLE}.type`, 'mssql');

  const settingsUpdates = items.map(item => {
    const oldItemSettings = JSON.parse(item.settings);
    const newDateTimeFields = oldItemSettings.dateTimeFields.map((dateTimeField: { type: OldDateTimeType }) => ({
      ...dateTimeField,
      type: convertToNewType(dateTimeField.type)
    }));
    const newItemSettings = {
      ...oldItemSettings,
      dateTimeFields: newDateTimeFields
    };
    return { id: item.id, settings: JSON.stringify(newItemSettings) };
  });
  await bulkUpdateSettings(knex, SOUTH_ITEMS_TABLE, settingsUpdates);
}

async function updateHistorySQLItemSettings(knex: Knex) {
  const items: Array<{ id: string; settings: string }> = await knex(HISTORY_ITEMS_TABLE)
    .join(HISTORY_QUERIES_TABLE, `${HISTORY_QUERIES_TABLE}.id`, '=', `${HISTORY_ITEMS_TABLE}.history_id`)
    .select(`${HISTORY_ITEMS_TABLE}.id as id`, `${HISTORY_ITEMS_TABLE}.settings as settings`)
    .where(`${HISTORY_QUERIES_TABLE}.south_type`, 'mssql');

  const settingsUpdates = items.map(item => {
    const oldItemSettings = JSON.parse(item.settings);
    const newDateTimeFields = oldItemSettings.dateTimeFields.map((dateTimeField: { type: OldDateTimeType }) => ({
      ...dateTimeField,
      type: convertToNewType(dateTimeField.type)
    }));
    const newItemSettings = {
      ...oldItemSettings,
      dateTimeFields: newDateTimeFields
    };
    return { id: item.id, settings: JSON.stringify(newItemSettings) };
  });
  await bulkUpdateSettings(knex, HISTORY_ITEMS_TABLE, settingsUpdates);
}

/** Splits `array` into consecutive chunks of at most `size` elements, preserving order. */
function chunk<T>(array: Array<T>, size: number): Array<Array<T>> {
  const result: Array<Array<T>> = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

/**
 * Writes each `{ id, settings }` pair to `table`'s `settings` column via chunked
 * `UPDATE ... SET settings = CASE id WHEN ? THEN ? ... END WHERE id IN (...)` statements instead of
 * one UPDATE per row, cutting N sequential UPDATE statements down to N/100 while producing the exact
 * same per-row values.
 */
async function bulkUpdateSettings(knex: Knex, table: string, updates: Array<{ id: string; settings: string }>): Promise<void> {
  for (const batch of chunk(updates, 100)) {
    const caseSql = batch.map(() => 'when ? then ?').join(' ');
    const caseBindings = batch.flatMap(u => [u.id, u.settings]);
    await knex(table)
      .whereIn(
        'id',
        batch.map(u => u.id)
      )
      .update({ settings: knex.raw(`case id ${caseSql} end`, caseBindings) });
  }
}

function convertToNewType(type: OldDateTimeType): NewDateTimeType {
  switch (type) {
    case 'Date':
      return 'date';
    case 'DateTime':
      return 'date-time';
    case 'DateTime2':
      return 'date-time-2';
    case 'DateTimeOffset':
      return 'date-time-offset';
    case 'SmallDateTime':
      return 'small-date-time';
    default:
      return type;
  }
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
