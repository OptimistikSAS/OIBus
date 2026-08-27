import { Knex } from 'knex';

/**
 * `south_item_cache.value`/`tracked_instant` already served two pre-existing, unrelated purposes
 * before this migration: the windowed-history-query cursor (`trackedInstant`, advanced by
 * `queryIntervals()`/`saveTrackedValue()` in south-connector.ts) and the one-shot "last value" shown
 * by the UI for direct-query connectors (`directQueryHandler()`'s legacy write). The caching-strategy
 * feature (entity-migrations v3.11.0) reused those same two columns for a third purpose — the item's
 * own last *cached* value/instant used by the `onChange`/`threshold` comparison — via
 * `saveItemsLastValues()`/`getItemsLastValues()`. Because all three writers target the exact same
 * row and columns, whichever ran last in a query cycle silently clobbered what the others had just
 * written moments earlier, corrupting both the caching-strategy comparison baseline and the
 * windowing cursor. This migration gives the caching-strategy feature its own dedicated columns so
 * it no longer collides with the pre-existing mechanisms.
 */
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('south_item_cache'))) return;

  await knex.schema.alterTable('south_item_cache', table => {
    table.text('cached_value').nullable();
    table.text('cached_instant').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('south_item_cache'))) return;

  await knex.raw('ALTER TABLE "south_item_cache" DROP COLUMN cached_value');
  await knex.raw('ALTER TABLE "south_item_cache" DROP COLUMN cached_instant');
}
