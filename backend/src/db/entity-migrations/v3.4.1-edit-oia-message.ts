import { Knex } from 'knex';
import { OIANALYTICS_MESSAGE_TABLE } from '../../repository/oianalytics-message.repository';
import { COMMANDS_TABLE } from '../../repository/oianalytics-command.repository';

export async function up(knex: Knex): Promise<void> {
  await updateOIAMessageTable(knex);
  await recreateCommandTable(knex);
}

async function updateOIAMessageTable(knex: Knex): Promise<void> {
  await knex.schema.raw(`delete
                         from ${OIANALYTICS_MESSAGE_TABLE}`);
  await knex.schema.alterTable(OIANALYTICS_MESSAGE_TABLE, table => {
    table.dropColumn('content');
  });
}

async function recreateCommandTable(knex: Knex): Promise<void> {
  await knex.schema.raw(
    `create table temporary_table
     (
       id               char(36) primary key,
       created_at       datetime default CURRENT_TIMESTAMP not null,
       updated_at       datetime default CURRENT_TIMESTAMP not null,
       type             text                               not null,
       status           text                               not null,
       ack              boolean  default '0'               not null,
       retrieved_date   varchar(255),
       completed_date   varchar(255),
       result           varchar(255),
       upgrade_version  varchar(255),
       upgrade_asset_id varchar(255),
       command_content  text
     );
    `
  );
  await knex.schema.raw(`INSERT INTO temporary_table
                         SELECT *
                         FROM ${COMMANDS_TABLE}`);
  await knex.schema.raw(`DROP TABLE ${COMMANDS_TABLE}`);
  await knex.schema.raw(`ALTER TABLE temporary_table
    RENAME TO ${COMMANDS_TABLE}`);
  await knex.schema.alterTable(COMMANDS_TABLE, table => {
    table.string('south_connector_id', 255);
    table.string('north_connector_id', 255);
    table.string('scan_mode_id', 255);
    table.string('target_version', 255);
  });
}

export async function down(_knex: Knex): Promise<void> {}
