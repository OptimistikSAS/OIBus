import { Knex } from 'knex';
import { OIANALYTICS_MESSAGE_TABLE } from '../../repository/oianalytics-message.repository';
import { ENGINES_TABLE } from '../../repository/engine.repository';
import { version } from '../../../package.json';
import { OIANALYTICS_MESSAGE_STATUS } from '../../../../shared/model/oianalytics-message.model';
import CreateTableBuilder = Knex.CreateTableBuilder;
import { SOUTH_CONNECTORS_TABLE } from '../../repository/south-connector.repository';
import { SOUTH_ITEMS_TABLE } from '../../repository/south-item.repository';

export const SOUTH_MODBUS_ITEM_SETTINGS_MODBUS_TYPES = ['coil', 'discreteInput', 'inputRegister', 'holdingRegister'] as const;
export type SouthModbusItemSettingsModbusType = (typeof SOUTH_MODBUS_ITEM_SETTINGS_MODBUS_TYPES)[number];

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
  modbusType: SouthModbusItemSettingsModbusType;
  dataType: SouthModbusItemSettingsDataDataType;
  multiplierCoefficient: number;
  bitIndex: number;
}

interface NewSouthModbusItemSettings {
  address: string;
  modbusType: SouthModbusItemSettingsModbusType;
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
  const modbusConnectors: Array<{ id: string }> = await knex(SOUTH_CONNECTORS_TABLE).select('id').where('type', 'modbus');

  for (const { id } of modbusConnectors) {
    const modbusConnectorItems: Array<{ id: string; settings: string }> = await knex(SOUTH_ITEMS_TABLE)
      .select('id', 'settings')
      .where('connector_id', id);

    for (const item of modbusConnectorItems) {
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
      await knex(SOUTH_ITEMS_TABLE)
        .update({ settings: JSON.stringify(newSettings) })
        .where('id', item.id);
    }
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
    table.enum('status', OIANALYTICS_MESSAGE_STATUS).notNullable().defaultTo('PENDING');
  });
}

async function addVersionInEngineSettings(knex: Knex) {
  await knex.schema.raw(`ALTER TABLE ${ENGINES_TABLE} ADD oibus_version NOT NULL DEFAULT "${version}"`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable(OIANALYTICS_MESSAGE_TABLE);
}
