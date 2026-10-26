import { Knex } from 'knex';

// The configuration changes are shared with the config upgrade of the same version (applied to imported configurations)
import { toFileDataType } from '../../../../service/config-transfer/config-upgrades/3.10/v3.10.0';

const TRANSFORMERS_TABLE = 'transformers';

/**
 * The `any` data type is renamed `file` (see `toFileDataType`): the input and output types of the standard and custom
 * transformers are updated. The files still waiting in the North caches are updated by the 3.10.0_1 data folder
 * migration.
 */
export async function up(knex: Knex): Promise<void> {
  for (const column of ['input_type', 'output_type']) {
    await knex(TRANSFORMERS_TABLE)
      .where(column, 'any')
      .update({ [column]: toFileDataType('any') });
  }
}

export async function down(): Promise<void> {
  return;
}
