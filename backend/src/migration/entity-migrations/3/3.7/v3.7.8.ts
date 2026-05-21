import { Knex } from 'knex';

const ENGINES_TABLE = 'engines';
const USERS_TABLE = 'users';
const IP_FILTERS_TABLE = 'ip_filters';
const CERTIFICATES_TABLE = 'certificates';
const REGISTRATIONS_TABLE = 'registrations';
const COMMANDS_TABLE = 'commands';
const OIANALYTICS_MESSAGE_TABLE = 'oianalytics_messages';
const TRANSFORMERS_TABLE = 'transformers';
const SCAN_MODES_TABLE = 'scan_modes';
const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const SOUTH_ITEMS_TABLE = 'south_items';
const NORTH_CONNECTORS_TABLE = 'north_connectors';
const HISTORY_QUERIES_TABLE = 'history_queries';
const HISTORY_ITEMS_TABLE = 'history_items';
const SUBSCRIPTION_TABLE = 'subscription';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async trx => {
    await trx.raw('PRAGMA foreign_keys = OFF;');

    // Step 1: Convert existing timestamps in all tables
    await convertTimestampsToISO(trx, ENGINES_TABLE);
    await convertTimestampsToISO(trx, USERS_TABLE);
    await convertTimestampsToISO(trx, IP_FILTERS_TABLE);
    await convertTimestampsToISO(trx, CERTIFICATES_TABLE);
    await convertTimestampsToISO(trx, REGISTRATIONS_TABLE);
    await convertTimestampsToISO(trx, COMMANDS_TABLE);
    await convertTimestampsToISO(trx, OIANALYTICS_MESSAGE_TABLE);
    await convertTimestampsToISO(trx, TRANSFORMERS_TABLE);
    await convertTimestampsToISO(trx, NORTH_CONNECTORS_TABLE);
    await convertTimestampsToISO(trx, SOUTH_CONNECTORS_TABLE);
    await convertTimestampsToISO(trx, SOUTH_ITEMS_TABLE);
    await convertTimestampsToISO(trx, HISTORY_QUERIES_TABLE);
    await convertTimestampsToISO(trx, HISTORY_ITEMS_TABLE);
    await convertTimestampsToISO(trx, SUBSCRIPTION_TABLE);

    // Step 2: Save junction table data before we start dropping tables (preserve order with rowid)
    const northTransformers = await trx('north_transformers').select('*').orderBy('rowid');
    const historyTransformers = await trx('history_query_transformers').select('*').orderBy('rowid');
    const southItems = await trx(SOUTH_ITEMS_TABLE).select('*').orderBy('rowid');
    const subscriptions = await trx(SUBSCRIPTION_TABLE).select('*').orderBy('rowid');
    const historyItems = await trx(HISTORY_ITEMS_TABLE).select('*').orderBy('rowid');

    // Step 3: Drop all junction/dependent tables
    await trx.schema.raw(`DROP TABLE IF EXISTS north_transformers;`);
    await trx.schema.raw(`DROP TABLE IF EXISTS history_query_transformers;`);
    await trx.schema.raw(`DROP TABLE IF EXISTS ${SUBSCRIPTION_TABLE};`);
    await trx.schema.raw(`DROP TABLE IF EXISTS ${SOUTH_ITEMS_TABLE};`);
    await trx.schema.raw(`DROP TABLE IF EXISTS ${HISTORY_ITEMS_TABLE};`);

    // Step 4: Recreate standalone tables
    await recreateEnginesTable(trx);
    await recreateUsersTable(trx);
    await recreateIpFiltersTable(trx);
    await recreateCertificatesTable(trx);
    await recreateRegistrationsTable(trx);
    await recreateCommandsTable(trx);
    await recreateOIAnalyticsMessagesTable(trx);

    // Step 5: Recreate parent tables
    await recreateTransformersTable(trx);
    await recreateSouthConnectorsTable(trx);
    await recreateNorthConnectorsTable(trx);
    await recreateHistoryQueriesTable(trx);

    // Step 6: Recreate junction/dependent tables and restore data
    await recreateJunctionTables(trx, northTransformers, historyTransformers, southItems, subscriptions, historyItems);

    await trx.raw('PRAGMA foreign_keys = ON;');
    await trx.commit();
  });
  await updateRegistrationSettings(knex);
}

async function convertTimestampsToISO(trx: Knex.Transaction, tableName: string): Promise<void> {
  await trx.raw(`UPDATE ${tableName} SET
    created_at = strftime('%Y-%m-%dT%H:%M:%fZ', created_at),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', updated_at);`);
}

async function recreateEnginesTable(trx: Knex.Transaction): Promise<void> {
  const tempTable = `${ENGINES_TABLE}_dg_tmp`;

  await trx.schema.raw(`CREATE TABLE ${tempTable} (
    id char(36) PRIMARY KEY,
    created_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    updated_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    name varchar(255) NOT NULL DEFAULT 'OIBus' UNIQUE,
    port integer NOT NULL DEFAULT 2223,
    log_console_level varchar(255) NOT NULL DEFAULT 'silent',
    log_file_level varchar(255) NOT NULL DEFAULT 'silent',
    log_file_max_file_size integer NOT NULL DEFAULT 50,
    log_file_number_of_files integer NOT NULL DEFAULT 5,
    log_database_level varchar(255) NOT NULL DEFAULT 'silent',
    log_database_max_number_of_logs integer NOT NULL DEFAULT 100000,
    log_loki_level varchar(255) NOT NULL DEFAULT 'silent',
    log_loki_interval integer NOT NULL DEFAULT 60,
    log_loki_address varchar(255),
    log_loki_username varchar(255),
    log_loki_password varchar(255),
    log_oia_level varchar(255) NOT NULL DEFAULT 'silent',
    log_oia_interval integer NOT NULL DEFAULT 10,
    proxy_enabled boolean DEFAULT 0,
    proxy_port integer DEFAULT 9000,
    oibus_version varchar(255) NOT NULL,
    oibus_launcher_version varchar(255)
  );`);

  await trx.schema.raw(`INSERT INTO ${tempTable} (id, created_at, updated_at, name, port, log_console_level, log_file_level,
    log_file_max_file_size, log_file_number_of_files, log_database_level, log_database_max_number_of_logs,
    log_loki_level, log_loki_interval, log_loki_address, log_loki_username, log_loki_password, log_oia_level,
    log_oia_interval, proxy_enabled, proxy_port, oibus_version, oibus_launcher_version)
    SELECT id, created_at, updated_at, name, port, log_console_level, log_file_level,
    log_file_max_file_size, log_file_number_of_files, log_database_level, log_database_max_number_of_logs,
    log_loki_level, log_loki_interval, log_loki_address, log_loki_username, log_loki_password, log_oia_level,
    log_oia_interval, proxy_enabled, proxy_port, oibus_version, oibus_launcher_version FROM ${ENGINES_TABLE};`);
  await trx.schema.raw(`DROP TABLE ${ENGINES_TABLE};`);
  await trx.schema.raw(`ALTER TABLE ${tempTable} RENAME TO ${ENGINES_TABLE};`);
  await trx.schema.raw(`CREATE UNIQUE INDEX ${ENGINES_TABLE}_name_unique ON ${ENGINES_TABLE} (name);`);
}

async function recreateUsersTable(trx: Knex.Transaction): Promise<void> {
  const tempTable = `${USERS_TABLE}_dg_tmp`;

  await trx.schema.raw(`CREATE TABLE ${tempTable} (
    id char(36) PRIMARY KEY,
    created_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    updated_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    login varchar(255) NOT NULL UNIQUE,
    password varchar(255) NOT NULL,
    first_name varchar(255),
    last_name varchar(255),
    email varchar(255),
    language varchar(255),
    timezone varchar(255)
  );`);

  await trx.schema
    .raw(`INSERT INTO ${tempTable} (id, created_at, updated_at, login, password, first_name, last_name, email, language, timezone)
    SELECT id, created_at, updated_at, login, password, first_name, last_name, email, language, timezone FROM ${USERS_TABLE};`);
  await trx.schema.raw(`DROP TABLE ${USERS_TABLE};`);
  await trx.schema.raw(`ALTER TABLE ${tempTable} RENAME TO ${USERS_TABLE};`);
  await trx.schema.raw(`CREATE UNIQUE INDEX ${USERS_TABLE}_login_unique ON ${USERS_TABLE} (login);`);
}

async function recreateIpFiltersTable(trx: Knex.Transaction): Promise<void> {
  const tempTable = `${IP_FILTERS_TABLE}_dg_tmp`;

  await trx.schema.raw(`CREATE TABLE ${tempTable} (
    id char(36) PRIMARY KEY,
    created_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    updated_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    address varchar(255) NOT NULL UNIQUE,
    description varchar(255)
  );`);

  await trx.schema.raw(`INSERT INTO ${tempTable} (id, created_at, updated_at, address, description)
    SELECT id, created_at, updated_at, address, description FROM ${IP_FILTERS_TABLE};`);
  await trx.schema.raw(`DROP TABLE ${IP_FILTERS_TABLE};`);
  await trx.schema.raw(`ALTER TABLE ${tempTable} RENAME TO ${IP_FILTERS_TABLE};`);
  await trx.schema.raw(`CREATE UNIQUE INDEX ${IP_FILTERS_TABLE}_address_unique ON ${IP_FILTERS_TABLE} (address);`);
}

async function recreateCertificatesTable(trx: Knex.Transaction): Promise<void> {
  const tempTable = `${CERTIFICATES_TABLE}_dg_tmp`;

  await trx.schema.raw(`CREATE TABLE ${tempTable} (
    id char(36) PRIMARY KEY,
    created_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    updated_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    name varchar(255) NOT NULL,
    description varchar(255),
    public_key varchar NOT NULL,
    private_key varchar NOT NULL,
    expiry varchar,
    certificate varchar NOT NULL
  );`);

  await trx.schema
    .raw(`INSERT INTO ${tempTable} (id, created_at, updated_at, name, description, public_key, private_key, expiry, certificate)
    SELECT id, created_at, updated_at, name, description, public_key, private_key, expiry, certificate FROM ${CERTIFICATES_TABLE};`);
  await trx.schema.raw(`DROP TABLE ${CERTIFICATES_TABLE};`);
  await trx.schema.raw(`ALTER TABLE ${tempTable} RENAME TO ${CERTIFICATES_TABLE};`);
}

async function recreateRegistrationsTable(trx: Knex.Transaction): Promise<void> {
  const tempTable = `${REGISTRATIONS_TABLE}_dg_tmp`;

  await trx.schema.raw(`CREATE TABLE ${tempTable} (
    id char(36) PRIMARY KEY,
    created_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    updated_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    host varchar(255) NOT NULL UNIQUE,
    use_proxy boolean DEFAULT 0,
    proxy_url varchar(255),
    proxy_username varchar(255),
    proxy_password varchar(255),
    accept_unauthorized boolean DEFAULT 0,
    activation_code varchar(255) UNIQUE,
    check_url varchar(255) UNIQUE,
    activation_date varchar(255),
    activation_expiration_date varchar(255),
    token varchar(255),
    status varchar(255) NOT NULL DEFAULT 'NOT_REGISTERED',
    command_setpoint boolean,
    public_key varchar(255),
    private_key varchar(255),
    command_retry_interval integer,
    message_retry_interval integer,
    command_refresh_interval integer,
    command_update_version boolean,
    command_restart_engine boolean,
    command_regenerate_cipher_keys boolean,
    command_update_engine_settings boolean,
    command_update_registration_settings boolean,
    command_create_scan_mode boolean,
    command_update_scan_mode boolean,
    command_delete_scan_mode boolean,
    command_create_ip_filter boolean,
    command_update_ip_filter boolean,
    command_delete_ip_filter boolean,
    command_create_certificate boolean,
    command_update_certificate boolean,
    command_delete_certificate boolean,
    command_create_history_query boolean,
    command_update_history_query boolean,
    command_delete_history_query boolean,
    command_create_or_update_history_items_from_csv boolean,
    command_create_south boolean,
    command_update_south boolean,
    command_delete_south boolean,
    command_create_or_update_south_items_from_csv boolean,
    command_create_north boolean,
    command_update_north boolean,
    command_delete_north boolean,
    command_test_south_connection boolean,
    command_test_south_item boolean,
    command_test_north_connection boolean,
    command_test_history_north_connection boolean,
    command_test_history_south_connection boolean,
    command_test_history_south_item boolean
  );`);

  await trx.schema.raw(`INSERT INTO ${tempTable} (id, created_at, updated_at, host, use_proxy, proxy_url, proxy_username, proxy_password,
    accept_unauthorized, activation_code, check_url, activation_date, activation_expiration_date, token, status, command_setpoint,
    public_key, private_key, command_retry_interval, message_retry_interval, command_refresh_interval, command_update_version,
    command_restart_engine, command_regenerate_cipher_keys, command_update_engine_settings, command_update_registration_settings,
    command_create_scan_mode, command_update_scan_mode, command_delete_scan_mode, command_create_ip_filter, command_update_ip_filter,
    command_delete_ip_filter, command_create_certificate, command_update_certificate, command_delete_certificate,
    command_create_history_query, command_update_history_query, command_delete_history_query,
    command_create_or_update_history_items_from_csv, command_create_south, command_update_south, command_delete_south,
    command_create_or_update_south_items_from_csv, command_create_north, command_update_north, command_delete_north,
    command_test_south_connection, command_test_south_item, command_test_north_connection, command_test_history_north_connection,
    command_test_history_south_connection, command_test_history_south_item)
    SELECT id, created_at, updated_at, host, use_proxy, proxy_url, proxy_username, proxy_password,
    accept_unauthorized, activation_code, check_url, activation_date, activation_expiration_date, token, status, command_setpoint,
    public_key, private_key, command_retry_interval, message_retry_interval, command_refresh_interval, command_update_version,
    command_restart_engine, command_regenerate_cipher_keys, command_update_engine_settings, command_update_registration_settings,
    command_create_scan_mode, command_update_scan_mode, command_delete_scan_mode, command_create_ip_filter, command_update_ip_filter,
    command_delete_ip_filter, command_create_certificate, command_update_certificate, command_delete_certificate,
    command_create_history_query, command_update_history_query, command_delete_history_query,
    command_create_or_update_history_items_from_csv, command_create_south, command_update_south, command_delete_south,
    command_create_or_update_south_items_from_csv, command_create_north, command_update_north, command_delete_north,
    command_test_south_connection, command_test_south_item, command_test_north_connection, command_test_history_north_connection,
    command_test_history_south_connection, command_test_history_south_item FROM ${REGISTRATIONS_TABLE};`);
  await trx.schema.raw(`DROP TABLE ${REGISTRATIONS_TABLE};`);
  await trx.schema.raw(`ALTER TABLE ${tempTable} RENAME TO ${REGISTRATIONS_TABLE};`);
  await trx.schema.raw(`CREATE UNIQUE INDEX ${REGISTRATIONS_TABLE}_host_unique ON ${REGISTRATIONS_TABLE} (host);`);
}

async function recreateCommandsTable(trx: Knex.Transaction): Promise<void> {
  const tempTable = `${COMMANDS_TABLE}_dg_tmp`;

  await trx.schema.raw(`CREATE TABLE ${tempTable} (
    id char(36) PRIMARY KEY,
    created_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    updated_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    type varchar(255) NOT NULL,
    status varchar(255) NOT NULL,
    ack boolean DEFAULT 0 NOT NULL,
    retrieved_date varchar(255),
    completed_date varchar(255),
    result varchar(255),
    command_content text,
    target_version text NOT NULL,
    south_connector_id varchar(255),
    north_connector_id varchar(255),
    scan_mode_id varchar(255),
    certificate_id varchar(255),
    ip_filter_id varchar(255),
    history_id varchar(255),
    item_id varchar(255)
  );`);

  await trx.schema.raw(`INSERT INTO ${tempTable} (id, created_at, updated_at, type, status, ack, retrieved_date, completed_date, result,
    command_content, target_version, south_connector_id, north_connector_id, scan_mode_id, certificate_id, ip_filter_id, history_id, item_id)
    SELECT id, created_at, updated_at, type, status, ack, retrieved_date, completed_date, result,
    command_content, target_version, south_connector_id, north_connector_id, scan_mode_id, certificate_id, ip_filter_id, history_id, item_id FROM ${COMMANDS_TABLE};`);
  await trx.schema.raw(`DROP TABLE ${COMMANDS_TABLE};`);
  await trx.schema.raw(`ALTER TABLE ${tempTable} RENAME TO ${COMMANDS_TABLE};`);
}

async function recreateOIAnalyticsMessagesTable(trx: Knex.Transaction): Promise<void> {
  const tempTable = `${OIANALYTICS_MESSAGE_TABLE}_dg_tmp`;

  await trx.schema.raw(`CREATE TABLE ${tempTable} (
    id char(36) PRIMARY KEY,
    created_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    updated_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    type varchar(255) NOT NULL,
    completed_date datetime,
    error varchar(255),
    status varchar(255) NOT NULL DEFAULT 'PENDING',
    history_id varchar(255)
  );`);

  await trx.schema.raw(`INSERT INTO ${tempTable} (id, created_at, updated_at, type, completed_date, error, status, history_id)
    SELECT id, created_at, updated_at, type, completed_date, error, status, history_id FROM ${OIANALYTICS_MESSAGE_TABLE} ORDER BY id ASC;`);
  await trx.schema.raw(`DROP TABLE ${OIANALYTICS_MESSAGE_TABLE};`);
  await trx.schema.raw(`ALTER TABLE ${tempTable} RENAME TO ${OIANALYTICS_MESSAGE_TABLE};`);
}

async function recreateTransformersTable(trx: Knex.Transaction): Promise<void> {
  const tempTable = `${TRANSFORMERS_TABLE}_dg_tmp`;

  await trx.schema.raw(`CREATE TABLE ${tempTable} (
    id char(36) PRIMARY KEY,
    created_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    updated_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    type varchar(255) NOT NULL,
    input_type varchar(255) NOT NULL,
    output_type varchar(255) NOT NULL,
    function_name varchar(255),
    name varchar(255),
    description varchar(255),
    custom_manifest varchar(255),
    custom_code varchar(255)
  );`);

  await trx.schema
    .raw(`INSERT INTO ${tempTable} (id, created_at, updated_at, type, input_type, output_type, function_name, name, description, custom_manifest, custom_code)
    SELECT id, created_at, updated_at, type, input_type, output_type, function_name, name, description, custom_manifest, custom_code FROM ${TRANSFORMERS_TABLE};`);
  await trx.schema.raw(`DROP TABLE ${TRANSFORMERS_TABLE};`);
  await trx.schema.raw(`ALTER TABLE ${tempTable} RENAME TO ${TRANSFORMERS_TABLE};`);
}

async function recreateSouthConnectorsTable(trx: Knex.Transaction): Promise<void> {
  const tempTable = `${SOUTH_CONNECTORS_TABLE}_dg_tmp`;

  await trx.schema.raw(`CREATE TABLE ${tempTable} (
    id char(36) PRIMARY KEY,
    created_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    updated_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    name varchar(255) NOT NULL UNIQUE,
    type varchar(255) NOT NULL,
    description varchar(255),
    enabled boolean NOT NULL,
    settings json NOT NULL
  );`);

  await trx.schema.raw(`INSERT INTO ${tempTable} (id, created_at, updated_at, name, type, description, enabled, settings)
    SELECT id, created_at, updated_at, name, type, description, enabled, settings FROM ${SOUTH_CONNECTORS_TABLE};`);
  await trx.schema.raw(`DROP TABLE ${SOUTH_CONNECTORS_TABLE};`);
  await trx.schema.raw(`ALTER TABLE ${tempTable} RENAME TO ${SOUTH_CONNECTORS_TABLE};`);
  await trx.schema.raw(`CREATE UNIQUE INDEX ${SOUTH_CONNECTORS_TABLE}_name_unique ON ${SOUTH_CONNECTORS_TABLE} (name);`);
}

async function recreateNorthConnectorsTable(trx: Knex.Transaction): Promise<void> {
  const tempTable = `${NORTH_CONNECTORS_TABLE}_dg_tmp`;

  await trx.schema.raw(`CREATE TABLE ${tempTable} (
    id char(36) PRIMARY KEY,
    created_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    updated_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    name varchar(255) NOT NULL UNIQUE,
    type varchar(255) NOT NULL,
    description varchar(255),
    enabled boolean NOT NULL,
    settings json NOT NULL,
    caching_trigger_schedule varchar(255) NOT NULL,
    caching_trigger_number_of_elements integer NOT NULL,
    caching_trigger_number_of_files integer NOT NULL,
    caching_throttling_run_min_delay integer,
    caching_throttling_cache_max_size integer NOT NULL,
    caching_throttling_max_number_of_elements integer NOT NULL,
    caching_error_retry_interval integer NOT NULL,
    caching_error_retry_count integer NOT NULL,
    caching_error_retention_duration integer,
    caching_archive_enabled integer NOT NULL,
    caching_archive_retention_duration integer NOT NULL,
    FOREIGN KEY (caching_trigger_schedule) REFERENCES ${SCAN_MODES_TABLE}(id)
  );`);

  await trx.schema.raw(`INSERT INTO ${tempTable} (id, created_at, updated_at, name, type, description, enabled, settings,
    caching_trigger_schedule, caching_trigger_number_of_elements, caching_trigger_number_of_files, caching_throttling_run_min_delay,
    caching_throttling_cache_max_size, caching_throttling_max_number_of_elements, caching_error_retry_interval, caching_error_retry_count,
    caching_error_retention_duration, caching_archive_enabled, caching_archive_retention_duration)
    SELECT id, created_at, updated_at, name, type, description, enabled, settings,
    caching_trigger_schedule, caching_trigger_number_of_elements, caching_trigger_number_of_files, caching_throttling_run_min_delay,
    caching_throttling_cache_max_size, caching_throttling_max_number_of_elements, caching_error_retry_interval, caching_error_retry_count,
    caching_error_retention_duration, caching_archive_enabled, caching_archive_retention_duration FROM ${NORTH_CONNECTORS_TABLE};`);
  await trx.schema.raw(`DROP TABLE ${NORTH_CONNECTORS_TABLE};`);
  await trx.schema.raw(`ALTER TABLE ${tempTable} RENAME TO ${NORTH_CONNECTORS_TABLE};`);
  await trx.schema.raw(`CREATE UNIQUE INDEX ${NORTH_CONNECTORS_TABLE}_name_unique ON ${NORTH_CONNECTORS_TABLE} (name);`);
}

async function recreateHistoryQueriesTable(trx: Knex.Transaction): Promise<void> {
  const tempTable = `${HISTORY_QUERIES_TABLE}_dg_tmp`;

  await trx.schema.raw(`CREATE TABLE ${tempTable} (
    id char(36) PRIMARY KEY,
    created_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    updated_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    status text DEFAULT 'PENDING' NOT NULL,
    name varchar(255) NOT NULL UNIQUE,
    description varchar(255),
    start_time datetime NOT NULL,
    end_time datetime NOT NULL,
    south_type varchar(255) NOT NULL,
    north_type varchar(255) NOT NULL,
    south_settings json NOT NULL,
    north_settings json NOT NULL,
    caching_trigger_schedule varchar(255) NOT NULL,
    caching_trigger_number_of_elements integer NOT NULL,
    caching_trigger_number_of_files integer NOT NULL,
    caching_throttling_run_min_delay integer,
    caching_throttling_cache_max_size integer NOT NULL,
    caching_throttling_max_number_of_elements integer NOT NULL,
    caching_error_retry_interval integer NOT NULL,
    caching_error_retry_count integer NOT NULL,
    caching_error_retention_duration integer,
    caching_archive_enabled integer NOT NULL,
    caching_archive_retention_duration integer NOT NULL,
    FOREIGN KEY (caching_trigger_schedule) REFERENCES ${SCAN_MODES_TABLE}(id)
  );`);

  await trx.schema.raw(`INSERT INTO ${tempTable} (id, created_at, updated_at, status, name, description, start_time, end_time,
    south_type, north_type, south_settings, north_settings, caching_trigger_schedule, caching_trigger_number_of_elements,
    caching_trigger_number_of_files, caching_throttling_run_min_delay, caching_throttling_cache_max_size,
    caching_throttling_max_number_of_elements, caching_error_retry_interval, caching_error_retry_count,
    caching_error_retention_duration, caching_archive_enabled, caching_archive_retention_duration)
    SELECT id, created_at, updated_at, status, name, description, start_time, end_time,
    south_type, north_type, south_settings, north_settings, caching_trigger_schedule, caching_trigger_number_of_elements,
    caching_trigger_number_of_files, caching_throttling_run_min_delay, caching_throttling_cache_max_size,
    caching_throttling_max_number_of_elements, caching_error_retry_interval, caching_error_retry_count,
    caching_error_retention_duration, caching_archive_enabled, caching_archive_retention_duration FROM ${HISTORY_QUERIES_TABLE};`);
  await trx.schema.raw(`DROP TABLE ${HISTORY_QUERIES_TABLE};`);
  await trx.schema.raw(`ALTER TABLE ${tempTable} RENAME TO ${HISTORY_QUERIES_TABLE};`);
  await trx.schema.raw(`CREATE UNIQUE INDEX ${HISTORY_QUERIES_TABLE}_name_unique ON ${HISTORY_QUERIES_TABLE} (name);`);
}

async function recreateJunctionTables(
  trx: Knex.Transaction,
  northTransformers: Array<Record<string, unknown>>,
  historyTransformers: Array<Record<string, unknown>>,
  southItems: Array<Record<string, unknown>>,
  subscriptions: Array<Record<string, unknown>>,
  historyItems: Array<Record<string, unknown>>
): Promise<void> {
  // Recreate south_items
  await trx.schema.raw(`CREATE TABLE ${SOUTH_ITEMS_TABLE} (
    id char(36) PRIMARY KEY,
    created_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    updated_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    connector_id char(36) NOT NULL,
    scan_mode_id char(36) NOT NULL,
    name varchar(255) NOT NULL,
    enabled boolean NOT NULL,
    settings json NOT NULL,
    FOREIGN KEY (connector_id) REFERENCES ${SOUTH_CONNECTORS_TABLE}(id),
    FOREIGN KEY (scan_mode_id) REFERENCES ${SCAN_MODES_TABLE}(id)
  );`);
  await trx.schema.raw(`CREATE UNIQUE INDEX ${SOUTH_ITEMS_TABLE}_connector_id_name_unique ON ${SOUTH_ITEMS_TABLE} (connector_id, name);`);

  // Recreate history_items
  await trx.schema.raw(`CREATE TABLE ${HISTORY_ITEMS_TABLE} (
    id char(36) PRIMARY KEY,
    created_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    updated_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    history_id char(36) NOT NULL,
    name varchar(255) NOT NULL,
    enabled boolean NOT NULL,
    settings json NOT NULL,
    FOREIGN KEY (history_id) REFERENCES ${HISTORY_QUERIES_TABLE}(id)
  );`);
  await trx.schema.raw(`CREATE UNIQUE INDEX ${HISTORY_ITEMS_TABLE}_history_id_name_unique ON ${HISTORY_ITEMS_TABLE} (history_id, name);`);

  // Recreate subscription
  await trx.schema.raw(`CREATE TABLE ${SUBSCRIPTION_TABLE} (
    created_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    updated_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    north_connector_id char(36) NOT NULL,
    south_connector_id char(36) NOT NULL,
    PRIMARY KEY (north_connector_id, south_connector_id),
    FOREIGN KEY (north_connector_id) REFERENCES ${NORTH_CONNECTORS_TABLE}(id),
    FOREIGN KEY (south_connector_id) REFERENCES ${SOUTH_CONNECTORS_TABLE}(id)
  );`);

  // Recreate north_transformers
  await trx.schema.raw(`CREATE TABLE north_transformers (
    north_id char(36) NOT NULL,
    transformer_id char(36) NOT NULL,
    options varchar(255),
    input_type varchar(255),
    UNIQUE (north_id, transformer_id, input_type),
    FOREIGN KEY (north_id) REFERENCES ${NORTH_CONNECTORS_TABLE}(id),
    FOREIGN KEY (transformer_id) REFERENCES ${TRANSFORMERS_TABLE}(id)
  );`);

  // Recreate history_query_transformers
  await trx.schema.raw(`CREATE TABLE history_query_transformers (
    history_id char(36) NOT NULL,
    transformer_id char(36) NOT NULL,
    options varchar(255),
    input_type varchar(255),
    UNIQUE (history_id, transformer_id, input_type),
    FOREIGN KEY (history_id) REFERENCES ${HISTORY_QUERIES_TABLE}(id),
    FOREIGN KEY (transformer_id) REFERENCES ${TRANSFORMERS_TABLE}(id)
  );`);

  // Restore all data
  if (southItems.length > 0) {
    for (const row of southItems) {
      await trx(SOUTH_ITEMS_TABLE).insert(row);
    }
  }
  if (historyItems.length > 0) {
    for (const row of historyItems) {
      await trx(HISTORY_ITEMS_TABLE).insert(row);
    }
  }
  if (subscriptions.length > 0) {
    for (const row of subscriptions) {
      await trx(SUBSCRIPTION_TABLE).insert(row);
    }
  }
  if (northTransformers.length > 0) {
    for (const row of northTransformers) {
      await trx('north_transformers').insert(row);
    }
  }
  if (historyTransformers.length > 0) {
    for (const row of historyTransformers) {
      await trx('history_query_transformers').insert(row);
    }
  }
}

async function updateRegistrationSettings(knex: Knex): Promise<void> {
  await knex.schema.alterTable(REGISTRATIONS_TABLE, table => {
    table.boolean('use_api_gateway');
    table.string('api_gateway_header_key');
    table.string('api_gateway_header_value');
  });

  await knex(REGISTRATIONS_TABLE).update({
    use_api_gateway: false,
    api_gateway_header_key: '',
    api_gateway_header_value: ''
  });
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
