import { Knex } from 'knex';
import CreateTableBuilder = Knex.CreateTableBuilder;

const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const SOUTH_ITEMS_TABLE = 'south_items';
const ENGINES_TABLE = 'engines';
const OIANALYTICS_MESSAGE_TABLE = 'oianalytics_messages';

export const SOUTH_MODBUS_ITEM_SETTINGS_DATA_DATA_TYPES = [
  'Bit',
  'UInt16',
  'Int16',
  'UInt32',
  'Int32',
  'BigUInt64',
  'BigInt64',
  'Float',
  'Double'
] as const;
export type SouthModbusItemSettingsDataDataType = (typeof SOUTH_MODBUS_ITEM_SETTINGS_DATA_DATA_TYPES)[number];

interface OldSouthModbusItemSettings {
  address: string;
  modbusType: 'coil' | 'discreteInput' | 'inputRegister' | 'holdingRegister';
  dataType: SouthModbusItemSettingsDataDataType;
  multiplierCoefficient: number;
  bitIndex: number;
}

interface NewSouthModbusItemSettings {
  address: string;
  modbusType: 'coil' | 'discreteInput' | 'inputRegister' | 'holdingRegister';
  data: {
    dataType: SouthModbusItemSettingsDataDataType;
    multiplierCoefficient: number;
    bitIndex: number;
  };
}

function createDefaultEntityFields(table: CreateTableBuilder): void {
  table.uuid('id').primary();
  table.timestamps(false, true);
}

async function updateModbusItems(knex: Knex) {
  const modbusItems: Array<{ id: string; settings: string }> = await knex(SOUTH_ITEMS_TABLE)
    .join(SOUTH_CONNECTORS_TABLE, `${SOUTH_CONNECTORS_TABLE}.id`, '=', `${SOUTH_ITEMS_TABLE}.connector_id`)
    .select(`${SOUTH_ITEMS_TABLE}.id as id`, `${SOUTH_ITEMS_TABLE}.settings as settings`)
    .where(`${SOUTH_CONNECTORS_TABLE}.type`, 'modbus');

  const settingsUpdates = modbusItems.map(item => {
    const oldSettings: OldSouthModbusItemSettings = JSON.parse(item.settings);
    const newSettings: NewSouthModbusItemSettings = {
      address: oldSettings.address,
      modbusType: oldSettings.modbusType,
      data: {
        dataType: oldSettings.dataType,
        multiplierCoefficient: oldSettings.multiplierCoefficient,
        bitIndex: oldSettings.bitIndex
      }
    };
    return { id: item.id, settings: JSON.stringify(newSettings) };
  });
  await bulkUpdateSettings(knex, SOUTH_ITEMS_TABLE, settingsUpdates);
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

export async function up(knex: Knex): Promise<void> {
  await createOIAMessageTable(knex);
  await addVersionInEngineSettings(knex);
  await updateModbusItems(knex);
}

async function createOIAMessageTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(OIANALYTICS_MESSAGE_TABLE, table => {
    createDefaultEntityFields(table);
    table.string('type').notNullable();
    table.json('content').notNullable();
    table.datetime('completed_date');
    table.string('error');
    table.string('status').notNullable().defaultTo('PENDING');
  });
}

async function addVersionInEngineSettings(knex: Knex) {
  await knex.schema.raw(`ALTER TABLE ${ENGINES_TABLE} ADD oibus_version NOT NULL DEFAULT "3.8.0"`);
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
