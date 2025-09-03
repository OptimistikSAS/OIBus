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
  const oldSouth: Array<{
    id: string;
    type: string;
  }> = await knex(SOUTH_CONNECTORS_TABLE).select('id', 'type').where('type', 'mssql');

  for (const connector of oldSouth) {
    const items: Array<{
      id: string;
      settings: string;
    }> = await knex(SOUTH_ITEMS_TABLE).select('id', 'settings').where('connector_id', connector.id);
    for (const item of items) {
      const oldItemSettings = JSON.parse(item.settings);
      const newDateTimeFields = oldItemSettings.dateTimeFields.map((dateTimeField: { type: OldDateTimeType }) => ({
        ...dateTimeField,
        type: convertToNewType(dateTimeField.type)
      }));
      const newItemSettings = {
        ...oldItemSettings,
        dateTimeFields: newDateTimeFields
      };
      await knex(SOUTH_ITEMS_TABLE)
        .update({ settings: JSON.stringify(newItemSettings) })
        .where('id', item.id);
    }
  }
}

async function updateHistorySQLItemSettings(knex: Knex) {
  const oldHistory: Array<{
    id: string;
    south_type: string;
  }> = await knex(HISTORY_QUERIES_TABLE).select('id', 'south_type').where('south_type', 'mssql');

  for (const history of oldHistory) {
    const items: Array<{
      id: string;
      settings: string;
    }> = await knex(HISTORY_ITEMS_TABLE).select('id', 'settings').where('history_id', history.id);
    for (const item of items) {
      const oldItemSettings = JSON.parse(item.settings);
      const newDateTimeFields = oldItemSettings.dateTimeFields.map((dateTimeField: { type: OldDateTimeType }) => ({
        ...dateTimeField,
        type: convertToNewType(dateTimeField.type)
      }));
      const newItemSettings = {
        ...oldItemSettings,
        dateTimeFields: newDateTimeFields
      };
      await knex(HISTORY_ITEMS_TABLE)
        .update({ settings: JSON.stringify(newItemSettings) })
        .where('id', item.id);
    }
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
