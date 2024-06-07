import { Knex } from 'knex';
import { OIANALYTICS_MESSAGE_TABLE } from '../../repository/oianalytics-message.repository';
import { ENGINES_TABLE } from '../../repository/engine.repository';
import { version } from '../../../package.json';
import CreateTableBuilder = Knex.CreateTableBuilder;
import { OIANALYTICS_MESSAGE_STATUS } from '../../../../shared/model/oianalytics-message.model';

function createDefaultEntityFields(table: CreateTableBuilder): void {
  table.uuid('id').primary();
  table.timestamps(false, true);
}

export async function up(knex: Knex): Promise<void> {
  await createOIAMessageTable(knex);
  await addVersionInEngineSettings(knex);
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
