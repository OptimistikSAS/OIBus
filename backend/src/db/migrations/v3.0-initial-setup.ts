import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('todos', table => {
    table.uuid('id').primary();
    table.string('name').notNullable();
    table.string('assignee').notNullable();
    table.date('dueDate').notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('todos');
}
