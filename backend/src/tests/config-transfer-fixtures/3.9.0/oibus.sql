PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;
CREATE TABLE `migrations` (`id` integer not null primary key autoincrement, `name` varchar(255), `batch` integer, `migration_time` datetime);
CREATE TABLE `migrations_lock` (`index` integer not null primary key autoincrement, `is_locked` integer);
CREATE TABLE `scan_modes` (`id` char(36), `name` varchar(255) not null, `description` varchar(255), `cron` varchar(255) not null, `created_at` datetime, `updated_at` datetime, `created_by` varchar(255), `updated_by` varchar(255), primary key (`id`));
CREATE TABLE "engines" (
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
  , `created_by` varchar(255), `updated_by` varchar(255), `log_syslog_level` varchar(255), `log_syslog_host` varchar(255), `log_syslog_port` integer, `log_syslog_protocol` varchar(255), `forward_proxy_url` varchar(255) null, `forward_proxy_username` varchar(255) null, `forward_proxy_password` varchar(255) null, `proxy_username` varchar(255) null, `proxy_password` varchar(255) null, `auth_token_duration` varchar(255), `forward_proxy_enabled` integer);
CREATE TABLE "users" (
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
  , `created_by` varchar(255), `updated_by` varchar(255));
CREATE TABLE "ip_filters" (
    id char(36) PRIMARY KEY,
    created_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    updated_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    address varchar(255) NOT NULL UNIQUE,
    description varchar(255)
  , `created_by` varchar(255), `updated_by` varchar(255));
CREATE TABLE "certificates" (
    id char(36) PRIMARY KEY,
    created_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    updated_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    name varchar(255) NOT NULL,
    description varchar(255),
    public_key varchar NOT NULL,
    private_key varchar NOT NULL,
    expiry varchar,
    certificate varchar NOT NULL
  , `created_by` varchar(255), `updated_by` varchar(255));
CREATE TABLE "registrations" (
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
  , `use_api_gateway` boolean, `api_gateway_header_key` varchar(255), `api_gateway_header_value` varchar(255), `api_gateway_base_endpoint` varchar(255), `created_by` varchar(255), `updated_by` varchar(255), `command_search_history_cache_content` boolean, `command_get_history_cache_file_content` boolean, `command_update_history_cache_content` boolean, `command_search_north_cache_content` boolean, `command_get_north_cache_file_content` boolean, `command_update_north_cache_content` boolean, `command_create_custom_transformer` boolean, `command_update_custom_transformer` boolean, `command_delete_custom_transformer` boolean, `command_test_custom_transformer` boolean);
CREATE TABLE "commands" (
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
  , `created_by` varchar(255), `updated_by` varchar(255), `transformer_id` varchar(255));
CREATE TABLE "oianalytics_messages" (
    id char(36) PRIMARY KEY,
    created_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    updated_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    type varchar(255) NOT NULL,
    completed_date datetime,
    error varchar(255),
    status varchar(255) NOT NULL DEFAULT 'PENDING',
    history_id varchar(255)
  , `created_by` varchar(255), `updated_by` varchar(255));
CREATE TABLE "transformers" (
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
  , `created_by` varchar(255), `updated_by` varchar(255), `language` varchar(255), `timeout` integer);
CREATE TABLE "south_connectors" (
    id char(36) PRIMARY KEY,
    created_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    updated_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    name varchar(255) NOT NULL UNIQUE,
    type varchar(255) NOT NULL,
    description varchar(255),
    enabled boolean NOT NULL,
    settings json NOT NULL
  , `created_by` varchar(255), `updated_by` varchar(255));
CREATE TABLE "north_connectors" (
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
    caching_archive_retention_duration integer NOT NULL, `created_by` varchar(255), `updated_by` varchar(255),
    FOREIGN KEY (caching_trigger_schedule) REFERENCES scan_modes(id)
  );
CREATE TABLE "history_queries" (
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
    caching_archive_retention_duration integer NOT NULL, `created_by` varchar(255), `updated_by` varchar(255), `throttling_max_read_interval` integer, `throttling_read_delay` integer,
    FOREIGN KEY (caching_trigger_schedule) REFERENCES scan_modes(id)
  );
CREATE TABLE history_items (
    id char(36) PRIMARY KEY,
    created_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    updated_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    history_id char(36) NOT NULL,
    name varchar(255) NOT NULL,
    enabled boolean NOT NULL,
    settings json NOT NULL, `created_by` varchar(255), `updated_by` varchar(255),
    FOREIGN KEY (history_id) REFERENCES history_queries(id)
  );
CREATE TABLE "south_items" (
      id char(36) PRIMARY KEY,
      created_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      updated_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      connector_id char(36) NOT NULL,
      scan_mode_id char(36),
      name varchar(255) NOT NULL,
      enabled boolean NOT NULL,
      settings json NOT NULL, `created_by` varchar(255), `updated_by` varchar(255), `max_read_interval` integer, `read_delay` integer, `sync_with_group` integer not null default '0', `recovery_strategy` varchar(255) null, `start_time_offset` integer null, `end_time_offset` integer null,
      FOREIGN KEY (connector_id) REFERENCES south_connectors(id),
      FOREIGN KEY (scan_mode_id) REFERENCES scan_modes(id)
    );
CREATE TABLE `_migration_v380_file_connector_hints` (`connector_id` varchar(255) not null, `item_id` varchar(255) not null, `preserve_files` integer not null, `regex` varchar(255) not null);
CREATE TABLE `south_item_groups` (`id` varchar(36), `created_at` datetime not null, `updated_at` datetime not null, `created_by` varchar(255), `updated_by` varchar(255), `name` varchar(255) not null, `south_id` varchar(36) not null, `scan_mode_id` varchar(36) not null, `max_read_interval` integer, `read_delay` integer, `recovery_strategy` varchar(255) null, `start_time_offset` integer null, `end_time_offset` integer null, foreign key(`south_id`) references `south_connectors`(`id`) on delete CASCADE, foreign key(`scan_mode_id`) references `scan_modes`(`id`), primary key (`id`));
CREATE TABLE `history_query_transformers` (`id` char(36) not null, `history_id` char(36) not null, `transformer_id` char(36) not null, `options` varchar(255), foreign key(`history_id`) references `history_queries`(`id`) on delete CASCADE, foreign key(`transformer_id`) references `transformers`(`id`) on delete CASCADE, primary key (`id`));
CREATE TABLE `north_transformers` (`id` char(36) not null, `north_id` char(36) not null, `transformer_id` char(36) not null, `source_type` varchar(255), `source_api_data_source_id` varchar(255), `source_south_south_id` varchar(255) null, `source_south_group_id` varchar(255) null, `options` varchar(255), foreign key(`north_id`) references `north_connectors`(`id`) on delete CASCADE, foreign key(`transformer_id`) references `transformers`(`id`) on delete CASCADE, foreign key(`source_south_south_id`) references `south_connectors`(`id`) on delete SET NULL, foreign key(`source_south_group_id`) references `south_item_groups`(`id`) on delete SET NULL, primary key (`id`));
CREATE TABLE `group_items` (`group_id` char(36) not null, `item_id` char(36) not null, foreign key(`group_id`) references `south_item_groups`(`id`) on delete CASCADE, foreign key(`item_id`) references `south_items`(`id`) on delete CASCADE, primary key (`group_id`, `item_id`));
CREATE TABLE `north_transformers_items` (`id` char(36), `item_id` varchar(255), `group_id` varchar(255) null, foreign key(`id`) references `north_transformers`(`id`), foreign key(`item_id`) references `south_items`(`id`), foreign key(`group_id`) references `south_item_groups`(`id`) on delete SET NULL);
CREATE TABLE `history_query_transformers_items` (`id` char(36), `item_id` varchar(255), foreign key(`id`) references `history_query_transformers`(`id`), foreign key(`item_id`) references `history_items`(`id`));
INSERT INTO "migrations" ("id", "name", "batch", "migration_time") VALUES (1, 'v3.0-initial-setup.ts', 1, 1790346323748);
INSERT INTO "migrations" ("id", "name", "batch", "migration_time") VALUES (2, 'v3.1.0-initial-setup-fix.ts', 1, 1790346323750);
INSERT INTO "migrations" ("id", "name", "batch", "migration_time") VALUES (3, 'v3.1.1-add-certificates-table.ts', 1, 1790346323750);
INSERT INTO "migrations" ("id", "name", "batch", "migration_time") VALUES (4, 'v3.1.1-add-history-overlap.ts', 1, 1790346323750);
INSERT INTO "migrations" ("id", "name", "batch", "migration_time") VALUES (5, 'v3.2.0-oia-registration.ts', 1, 1790346323757);
INSERT INTO "migrations" ("id", "name", "batch", "migration_time") VALUES (6, 'v3.2.1-oracle-thick-mode.ts', 1, 1790346323758);
INSERT INTO "migrations" ("id", "name", "batch", "migration_time") VALUES (7, 'v3.3.1-oia-registration.ts', 1, 1790346323758);
INSERT INTO "migrations" ("id", "name", "batch", "migration_time") VALUES (8, 'v3.3.12-add-azure-blob-proxy.ts', 1, 1790346323759);
INSERT INTO "migrations" ("id", "name", "batch", "migration_time") VALUES (9, 'v3.3.5-add-opcua-read-timeout.ts', 1, 1790346323759);
INSERT INTO "migrations" ("id", "name", "batch", "migration_time") VALUES (10, 'v3.3.7-add-oia-message.ts', 1, 1790346323759);
INSERT INTO "migrations" ("id", "name", "batch", "migration_time") VALUES (11, 'v3.5.0.ts', 1, 1790346323785);
INSERT INTO "migrations" ("id", "name", "batch", "migration_time") VALUES (12, 'v3.6.0.ts', 1, 1790346323803);
INSERT INTO "migrations" ("id", "name", "batch", "migration_time") VALUES (13, 'v3.6.3.ts', 1, 1790346323803);
INSERT INTO "migrations" ("id", "name", "batch", "migration_time") VALUES (14, 'v3.6.8.ts', 1, 1790346323804);
INSERT INTO "migrations" ("id", "name", "batch", "migration_time") VALUES (15, 'v3.7.0.ts', 1, 1790346323810);
INSERT INTO "migrations" ("id", "name", "batch", "migration_time") VALUES (16, 'v3.7.1.ts', 1, 1790346323848);
INSERT INTO "migrations" ("id", "name", "batch", "migration_time") VALUES (17, 'v3.7.11.ts', 1, 1790346323849);
INSERT INTO "migrations" ("id", "name", "batch", "migration_time") VALUES (18, 'v3.7.2.ts', 1, 1790346323849);
INSERT INTO "migrations" ("id", "name", "batch", "migration_time") VALUES (19, 'v3.7.4.ts', 1, 1790346323849);
INSERT INTO "migrations" ("id", "name", "batch", "migration_time") VALUES (20, 'v3.7.8.ts', 1, 1790346323864);
INSERT INTO "migrations" ("id", "name", "batch", "migration_time") VALUES (21, 'v3.7.9.ts', 1, 1790346323865);
INSERT INTO "migrations" ("id", "name", "batch", "migration_time") VALUES (22, 'v3.8.0.ts', 1, 1790346323898);
INSERT INTO "migrations" ("id", "name", "batch", "migration_time") VALUES (23, 'v3.8.0_1.ts', 1, 1790346323899);
INSERT INTO "migrations" ("id", "name", "batch", "migration_time") VALUES (24, 'v3.8.3_1.ts', 1, 1790346323899);
INSERT INTO "migrations" ("id", "name", "batch", "migration_time") VALUES (25, 'v3.9.0.ts', 1, 1790346323905);
INSERT INTO "migrations" ("id", "name", "batch", "migration_time") VALUES (26, 'v3.9.0_1.ts', 1, 1790346323906);
INSERT INTO "migrations" ("id", "name", "batch", "migration_time") VALUES (27, 'v3.9.0_2.ts', 1, 1790346323906);
INSERT INTO "migrations_lock" ("index", "is_locked") VALUES (1, 0);
INSERT INTO "scan_modes" ("id", "name", "description", "cron", "created_at", "updated_at", "created_by", "updated_by") VALUES ('scanModeId1', 'scanMode1', 'my first scanMode', '* * * * * *', '', '', '', '');
INSERT INTO "scan_modes" ("id", "name", "description", "cron", "created_at", "updated_at", "created_by", "updated_by") VALUES ('scanModeId2', 'scanMode2', 'my second scanMode', '0 * * * * *', '', '', '', '');
INSERT INTO "scan_modes" ("id", "name", "description", "cron", "created_at", "updated_at", "created_by", "updated_by") VALUES ('subscription', 'Subscription', 'Subscription', 'subscription', '', '', '', '');
INSERT INTO "engines" ("id", "created_at", "updated_at", "name", "port", "log_console_level", "log_file_level", "log_file_max_file_size", "log_file_number_of_files", "log_database_level", "log_database_max_number_of_logs", "log_loki_level", "log_loki_interval", "log_loki_address", "log_loki_username", "log_loki_password", "log_oia_level", "log_oia_interval", "proxy_enabled", "proxy_port", "oibus_version", "oibus_launcher_version", "created_by", "updated_by", "log_syslog_level", "log_syslog_host", "log_syslog_port", "log_syslog_protocol", "forward_proxy_url", "forward_proxy_username", "forward_proxy_password", "proxy_username", "proxy_password", "auth_token_duration", "forward_proxy_enabled") VALUES ('oibusId1', '', '', 'OIBus', 2223, 'info', 'info', 50, 5, 'info', 100000, 'info', 60, 'http://localhost:8080', '', 'test', 'info', 10, 1, 9000, '3.4.9', '3.4.9', '', '', 'info', 'syslog.example.com', 514, 'udp4', 'http://forward-proxy:3128', 'proxy-user', 'encrypted-proxy-password', 'proxy-server-user', 'encrypted-proxy-server-password', '7d', 1);
INSERT INTO "users" ("id", "created_at", "updated_at", "login", "password", "first_name", "last_name", "email", "language", "timezone", "created_by", "updated_by") VALUES ('user1', '', '', 'admin', 'password', NULL, NULL, NULL, 'en', 'Europe/Paris', '', '');
INSERT INTO "users" ("id", "created_at", "updated_at", "login", "password", "first_name", "last_name", "email", "language", "timezone", "created_by", "updated_by") VALUES ('user2', '', '', 'secondUser', 'password', 'first name', 'last name', 'email', 'fr', 'Europe/Paris', '', '');
INSERT INTO "ip_filters" ("id", "created_at", "updated_at", "address", "description", "created_by", "updated_by") VALUES ('ipFilterId1', '', '', '192.168.1.1', 'my first ip filter', '', '');
INSERT INTO "ip_filters" ("id", "created_at", "updated_at", "address", "description", "created_by", "updated_by") VALUES ('ipFilterId2', '', '', '*', 'All ips', '', '');
INSERT INTO "certificates" ("id", "created_at", "updated_at", "name", "description", "public_key", "private_key", "expiry", "certificate", "created_by", "updated_by") VALUES ('certificate1', '', '', 'Certificate 1', '', 'public key', 'private key', '2020-03-15T00:00:00.000Z', 'certificate', '', '');
INSERT INTO "certificates" ("id", "created_at", "updated_at", "name", "description", "public_key", "private_key", "expiry", "certificate", "created_by", "updated_by") VALUES ('certificate2', '', '', 'Certificate 2', '', 'public key', 'private key', '2020-03-20T00:00:00.000Z', 'certificate', '', '');
INSERT INTO "registrations" ("id", "created_at", "updated_at", "host", "use_proxy", "proxy_url", "proxy_username", "proxy_password", "accept_unauthorized", "activation_code", "check_url", "activation_date", "activation_expiration_date", "token", "status", "command_setpoint", "public_key", "private_key", "command_retry_interval", "message_retry_interval", "command_refresh_interval", "command_update_version", "command_restart_engine", "command_regenerate_cipher_keys", "command_update_engine_settings", "command_update_registration_settings", "command_create_scan_mode", "command_update_scan_mode", "command_delete_scan_mode", "command_create_ip_filter", "command_update_ip_filter", "command_delete_ip_filter", "command_create_certificate", "command_update_certificate", "command_delete_certificate", "command_create_history_query", "command_update_history_query", "command_delete_history_query", "command_create_or_update_history_items_from_csv", "command_create_south", "command_update_south", "command_delete_south", "command_create_or_update_south_items_from_csv", "command_create_north", "command_update_north", "command_delete_north", "command_test_south_connection", "command_test_south_item", "command_test_north_connection", "command_test_history_north_connection", "command_test_history_south_connection", "command_test_history_south_item", "use_api_gateway", "api_gateway_header_key", "api_gateway_header_value", "api_gateway_base_endpoint", "created_by", "updated_by", "command_search_history_cache_content", "command_get_history_cache_file_content", "command_update_history_cache_content", "command_search_north_cache_content", "command_get_north_cache_file_content", "command_update_north_cache_content", "command_create_custom_transformer", "command_update_custom_transformer", "command_delete_custom_transformer", "command_test_custom_transformer") VALUES ('registrationId1', '', '', 'http://localhost:4200', 0, NULL, NULL, NULL, 0, '123ABC', '', '2020-03-20T00:00:00.000Z', '2020-03-15T00:00:00.000Z', 'token', 'REGISTERED', 1, 'public key', 'private key', 5, 5, 10, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, NULL, NULL, NULL, '', '', 1, 1, 1, 1, 1, 1, 1, 1, 1, 1);
INSERT INTO "commands" ("id", "created_at", "updated_at", "type", "status", "ack", "retrieved_date", "completed_date", "result", "command_content", "target_version", "south_connector_id", "north_connector_id", "scan_mode_id", "certificate_id", "ip_filter_id", "history_id", "item_id", "created_by", "updated_by", "transformer_id") VALUES ('commandId1', '2021-01-02T00:00:00.000Z', '2021-01-02T00:00:00.000Z', 'update-version', 'RUNNING', 0, '2020-03-15T00:00:00.000Z', '', 'ok', '{"version":"v3.5.0-beta","assetId":"assetId","backupFolders":"cache/*","updateLauncher":false}', '3.4.9', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '', '', NULL);
INSERT INTO "commands" ("id", "created_at", "updated_at", "type", "status", "ack", "retrieved_date", "completed_date", "result", "command_content", "target_version", "south_connector_id", "north_connector_id", "scan_mode_id", "certificate_id", "ip_filter_id", "history_id", "item_id", "created_by", "updated_by", "transformer_id") VALUES ('commandId2', '2021-01-02T00:00:00.000Z', '2021-01-02T00:00:00.000Z', 'update-engine-general', 'RETRIEVED', 0, '2020-03-15T00:00:00.000Z', '', 'ok', '{"name":"updated OIBus"}', '3.4.9', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '', '', NULL);
INSERT INTO "commands" ("id", "created_at", "updated_at", "type", "status", "ack", "retrieved_date", "completed_date", "result", "command_content", "target_version", "south_connector_id", "north_connector_id", "scan_mode_id", "certificate_id", "ip_filter_id", "history_id", "item_id", "created_by", "updated_by", "transformer_id") VALUES ('commandId3', '2021-01-02T00:00:00.000Z', '2021-01-02T00:00:00.000Z', 'restart-engine', 'RETRIEVED', 0, '2020-03-15T00:00:00.000Z', '', 'ok', NULL, '3.4.9', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '', '', NULL);
INSERT INTO "commands" ("id", "created_at", "updated_at", "type", "status", "ack", "retrieved_date", "completed_date", "result", "command_content", "target_version", "south_connector_id", "north_connector_id", "scan_mode_id", "certificate_id", "ip_filter_id", "history_id", "item_id", "created_by", "updated_by", "transformer_id") VALUES ('commandId4', '2021-01-02T00:00:00.000Z', '2021-01-02T00:00:00.000Z', 'update-scan-mode', 'RETRIEVED', 0, '2020-03-15T00:00:00.000Z', '', 'ok', '{"name":"my new scan mode","description":"another scan mode","cron":"0 * * * * *"}', '3.4.9', NULL, NULL, 'scanModeId1', NULL, NULL, NULL, NULL, '', '', NULL);
INSERT INTO "commands" ("id", "created_at", "updated_at", "type", "status", "ack", "retrieved_date", "completed_date", "result", "command_content", "target_version", "south_connector_id", "north_connector_id", "scan_mode_id", "certificate_id", "ip_filter_id", "history_id", "item_id", "created_by", "updated_by", "transformer_id") VALUES ('commandId5', '2021-01-02T00:00:00.000Z', '2021-01-02T00:00:00.000Z', 'update-south', 'RETRIEVED', 0, '2020-03-15T00:00:00.000Z', '', 'ok', '{"name":"South 1","type":"folder-scanner","description":"my folder scanner","enabled":true,"settings":{"inputFolder":"input","compression":true,"username":null,"password":null,"domain":null},"items":[{"id":"newSouthItemFromConnectorId","name":"my new item from south connector","enabled":true,"settings":{"regex":"*","minAge":100,"preserveFiles":true,"ignoreModifiedDate":false,"maxFiles":0,"maxSize":0,"recursive":false},"scanModeId":"scanModeId2","scanModeName":null,"groupId":null,"groupName":null,"syncWithGroup":false,"maxReadInterval":null,"readDelay":null,"startTimeOffset":0,"endTimeOffset":0,"recoveryStrategy":null}],"groups":[]}', '3.4.9', 'southId1', NULL, NULL, NULL, NULL, NULL, NULL, '', '', NULL);
INSERT INTO "commands" ("id", "created_at", "updated_at", "type", "status", "ack", "retrieved_date", "completed_date", "result", "command_content", "target_version", "south_connector_id", "north_connector_id", "scan_mode_id", "certificate_id", "ip_filter_id", "history_id", "item_id", "created_by", "updated_by", "transformer_id") VALUES ('commandId6', '2021-01-02T00:00:00.000Z', '2021-01-02T00:00:00.000Z', 'update-north', 'RETRIEVED', 0, '2020-03-15T00:00:00.000Z', '', 'ok', '{"name":"North 1","type":"file-writer","description":"my file writer","enabled":true,"settings":{"outputFolder":"output-folder","prefix":"prefix-","suffix":"-suffix","username":null,"password":null,"domain":null},"caching":{"trigger":{"scanModeId":"scanModeId1","scanModeName":null,"numberOfElements":1000,"numberOfFiles":1},"throttling":{"runMinDelay":200,"maxSize":30,"maxNumberOfElements":10000},"error":{"retryInterval":1000,"retryCount":3,"retentionDuration":24},"archive":{"enabled":false,"retentionDuration":0}},"transformers":[{"id":"northTransformerId4","transformerId":"transformerId1","options":{},"source":{"type":"south","southId":"southId1","items":[{"id":"southItemId1","name":"item1","enabled":true}]}},{"id":"northTransformerId5","transformerId":"transformerId2","options":{},"source":{"type":"oibus-api","dataSourceId":"dataSourceId"}}]}', '3.4.9', NULL, 'northId1', NULL, NULL, NULL, NULL, NULL, '', '', NULL);
INSERT INTO "commands" ("id", "created_at", "updated_at", "type", "status", "ack", "retrieved_date", "completed_date", "result", "command_content", "target_version", "south_connector_id", "north_connector_id", "scan_mode_id", "certificate_id", "ip_filter_id", "history_id", "item_id", "created_by", "updated_by", "transformer_id") VALUES ('commandId7', '2021-01-02T00:00:00.000Z', '2021-01-02T00:00:00.000Z', 'delete-scan-mode', 'RETRIEVED', 0, '2020-03-15T00:00:00.000Z', '', 'ok', NULL, '3.4.9', NULL, NULL, 'scanModeId1', NULL, NULL, NULL, NULL, '', '', NULL);
INSERT INTO "commands" ("id", "created_at", "updated_at", "type", "status", "ack", "retrieved_date", "completed_date", "result", "command_content", "target_version", "south_connector_id", "north_connector_id", "scan_mode_id", "certificate_id", "ip_filter_id", "history_id", "item_id", "created_by", "updated_by", "transformer_id") VALUES ('commandId8', '2021-01-02T00:00:00.000Z', '2021-01-02T00:00:00.000Z', 'delete-south', 'RETRIEVED', 0, '2020-03-15T00:00:00.000Z', '', 'ok', NULL, '3.4.9', 'southId1', NULL, NULL, NULL, NULL, NULL, NULL, '', '', NULL);
INSERT INTO "commands" ("id", "created_at", "updated_at", "type", "status", "ack", "retrieved_date", "completed_date", "result", "command_content", "target_version", "south_connector_id", "north_connector_id", "scan_mode_id", "certificate_id", "ip_filter_id", "history_id", "item_id", "created_by", "updated_by", "transformer_id") VALUES ('commandId9', '2021-01-02T00:00:00.000Z', '2021-01-02T00:00:00.000Z', 'delete-north', 'RETRIEVED', 0, '2020-03-15T00:00:00.000Z', '', 'ok', NULL, '3.4.9', NULL, 'northId1', NULL, NULL, NULL, NULL, NULL, '', '', NULL);
INSERT INTO "commands" ("id", "created_at", "updated_at", "type", "status", "ack", "retrieved_date", "completed_date", "result", "command_content", "target_version", "south_connector_id", "north_connector_id", "scan_mode_id", "certificate_id", "ip_filter_id", "history_id", "item_id", "created_by", "updated_by", "transformer_id") VALUES ('commandId10', '2021-01-02T00:00:00.000Z', '2021-01-02T00:00:00.000Z', 'create-scan-mode', 'RETRIEVED', 0, '2020-03-15T00:00:00.000Z', '', 'ok', '{"name":"my new scan mode","description":"another scan mode","cron":"0 * * * * *"}', '3.4.9', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '', '', NULL);
INSERT INTO "commands" ("id", "created_at", "updated_at", "type", "status", "ack", "retrieved_date", "completed_date", "result", "command_content", "target_version", "south_connector_id", "north_connector_id", "scan_mode_id", "certificate_id", "ip_filter_id", "history_id", "item_id", "created_by", "updated_by", "transformer_id") VALUES ('commandId11', '2021-01-02T00:00:00.000Z', '2021-01-02T00:00:00.000Z', 'create-south', 'RETRIEVED', 0, '2020-03-15T00:00:00.000Z', '', 'ok', '{"name":"South 1","type":"folder-scanner","description":"my folder scanner","enabled":true,"settings":{"inputFolder":"input","compression":true,"username":null,"password":null,"domain":null},"items":[{"id":"newSouthItemFromConnectorId","name":"my new item from south connector","enabled":true,"settings":{"regex":"*","minAge":100,"preserveFiles":true,"ignoreModifiedDate":false,"maxFiles":0,"maxSize":0,"recursive":false},"scanModeId":"scanModeId2","scanModeName":null,"groupId":null,"groupName":null,"syncWithGroup":false,"maxReadInterval":null,"readDelay":null,"startTimeOffset":0,"endTimeOffset":0,"recoveryStrategy":null}],"groups":[]}', '3.4.9', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '', '', NULL);
INSERT INTO "commands" ("id", "created_at", "updated_at", "type", "status", "ack", "retrieved_date", "completed_date", "result", "command_content", "target_version", "south_connector_id", "north_connector_id", "scan_mode_id", "certificate_id", "ip_filter_id", "history_id", "item_id", "created_by", "updated_by", "transformer_id") VALUES ('commandId12', '2021-01-02T00:00:00.000Z', '2021-01-02T00:00:00.000Z', 'create-north', 'RETRIEVED', 0, '2020-03-15T00:00:00.000Z', '', 'ok', '{"name":"North 1","type":"file-writer","description":"my file writer","enabled":true,"settings":{"outputFolder":"output-folder","prefix":"prefix-","suffix":"-suffix","username":null,"password":null,"domain":null},"caching":{"trigger":{"scanModeId":"scanModeId1","scanModeName":null,"numberOfElements":1000,"numberOfFiles":1},"throttling":{"runMinDelay":200,"maxSize":30,"maxNumberOfElements":10000},"error":{"retryInterval":1000,"retryCount":3,"retentionDuration":24},"archive":{"enabled":false,"retentionDuration":0}},"transformers":[{"id":"northTransformerId4","transformerId":"transformerId1","options":{},"source":{"type":"south","southId":"southId1","items":[{"id":"southItemId1","name":"item1","enabled":true}]}},{"id":"northTransformerId5","transformerId":"transformerId2","options":{},"source":{"type":"oibus-api","dataSourceId":"dataSourceId"}}]}', '3.4.9', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '', '', NULL);
INSERT INTO "commands" ("id", "created_at", "updated_at", "type", "status", "ack", "retrieved_date", "completed_date", "result", "command_content", "target_version", "south_connector_id", "north_connector_id", "scan_mode_id", "certificate_id", "ip_filter_id", "history_id", "item_id", "created_by", "updated_by", "transformer_id") VALUES ('commandId13', '2021-01-02T00:00:00.000Z', '2021-01-02T00:00:00.000Z', 'regenerate-cipher-keys', 'RETRIEVED', 0, '2020-03-15T00:00:00.000Z', '', 'ok', NULL, '3.4.9', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '', '', NULL);
INSERT INTO "commands" ("id", "created_at", "updated_at", "type", "status", "ack", "retrieved_date", "completed_date", "result", "command_content", "target_version", "south_connector_id", "north_connector_id", "scan_mode_id", "certificate_id", "ip_filter_id", "history_id", "item_id", "created_by", "updated_by", "transformer_id") VALUES ('commandId14', '2021-01-02T00:00:00.000Z', '2021-01-02T00:00:00.000Z', 'regenerate-cipher-keys', 'RETRIEVED', 0, '2020-03-15T00:00:00.000Z', '', 'ok', NULL, '3.4.9', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '', '', NULL);
INSERT INTO "commands" ("id", "created_at", "updated_at", "type", "status", "ack", "retrieved_date", "completed_date", "result", "command_content", "target_version", "south_connector_id", "north_connector_id", "scan_mode_id", "certificate_id", "ip_filter_id", "history_id", "item_id", "created_by", "updated_by", "transformer_id") VALUES ('commandId15', '2021-01-02T00:00:00.000Z', '2021-01-02T00:00:00.000Z', 'create-or-update-south-items-from-csv', 'RETRIEVED', 0, '2020-03-15T00:00:00.000Z', '', 'ok', '{"deleteItemsNotPresent":false,"csvContent":"","delimiter":","}', '3.4.9', 'southId1', NULL, NULL, NULL, NULL, NULL, NULL, '', '', NULL);
INSERT INTO "commands" ("id", "created_at", "updated_at", "type", "status", "ack", "retrieved_date", "completed_date", "result", "command_content", "target_version", "south_connector_id", "north_connector_id", "scan_mode_id", "certificate_id", "ip_filter_id", "history_id", "item_id", "created_by", "updated_by", "transformer_id") VALUES ('newCommandId16', '2021-01-02T00:00:00.000Z', '2021-01-02T00:00:00.000Z', 'update-registration-settings', 'RETRIEVED', 0, '2020-03-15T00:00:00.000Z', '', 'ok', '{"commandRefreshInterval":15,"commandRetryInterval":5,"messageRetryInterval":5,"commandPermissions":{"updateVersion":true,"restartEngine":true,"regenerateCipherKeys":true,"updateEngineSettings":true,"updateRegistrationSettings":true,"createScanMode":true,"updateScanMode":true,"deleteScanMode":true,"createIpFilter":true,"updateIpFilter":true,"deleteIpFilter":true,"createCertificate":true,"updateCertificate":true,"deleteCertificate":true,"createHistoryQuery":true,"updateHistoryQuery":true,"deleteHistoryQuery":true,"createOrUpdateHistoryItemsFromCsv":true,"testHistoryNorthConnection":true,"testHistorySouthConnection":true,"testHistorySouthItem":true,"createSouth":true,"updateSouth":true,"deleteSouth":true,"createOrUpdateSouthItemsFromCsv":true,"testSouthConnection":true,"testSouthItem":true,"createNorth":true,"updateNorth":true,"deleteNorth":true,"testNorthConnection":true,"setpoint":true,"searchHistoryCacheContent":true,"getHistoryCacheFileContent":true,"updateHistoryCacheContent":true,"searchNorthCacheContent":true,"getNorthCacheFileContent":true,"updateNorthCacheContent":true,"createCustomTransformer":true,"updateCustomTransformer":true,"deleteCustomTransformer":true,"testCustomTransformer":true}}', '3.4.9', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '', '', NULL);
INSERT INTO "oianalytics_messages" ("id", "created_at", "updated_at", "type", "completed_date", "error", "status", "history_id", "created_by", "updated_by") VALUES ('messageId1', '2021-01-02T00:00:00.000Z', '2021-01-02T00:00:00.000Z', 'full-config', NULL, NULL, 'PENDING', NULL, 'system', 'system');
INSERT INTO "oianalytics_messages" ("id", "created_at", "updated_at", "type", "completed_date", "error", "status", "history_id", "created_by", "updated_by") VALUES ('messageId2', '2021-01-02T00:00:00.000Z', '2021-01-02T00:00:00.000Z', 'full-config', NULL, NULL, 'PENDING', NULL, 'system', 'system');
INSERT INTO "transformers" ("id", "created_at", "updated_at", "type", "input_type", "output_type", "function_name", "name", "description", "custom_manifest", "custom_code", "created_by", "updated_by", "language", "timeout") VALUES ('827fed', '2026-09-25T14:25:23.889Z', '2026-09-25T14:25:23.889Z', 'standard', 'any', 'mqtt', 'csv-to-mqtt', NULL, NULL, NULL, NULL, 'system', 'system', NULL, NULL);
INSERT INTO "transformers" ("id", "created_at", "updated_at", "type", "input_type", "output_type", "function_name", "name", "description", "custom_manifest", "custom_code", "created_by", "updated_by", "language", "timeout") VALUES ('f2b4H1', '2026-09-25T14:25:23.889Z', '2026-09-25T14:25:23.889Z', 'standard', 'any', 'time-values', 'csv-to-time-values', NULL, NULL, NULL, NULL, 'system', 'system', NULL, NULL);
INSERT INTO "transformers" ("id", "created_at", "updated_at", "type", "input_type", "output_type", "function_name", "name", "description", "custom_manifest", "custom_code", "created_by", "updated_by", "language", "timeout") VALUES ('OcHBt6', '2026-09-25T14:25:23.889Z', '2026-09-25T14:25:23.889Z', 'standard', 'any', 'any', 'ignore', NULL, NULL, NULL, NULL, 'system', 'system', NULL, NULL);
INSERT INTO "transformers" ("id", "created_at", "updated_at", "type", "input_type", "output_type", "function_name", "name", "description", "custom_manifest", "custom_code", "created_by", "updated_by", "language", "timeout") VALUES ('RfzYaZ', '2026-09-25T14:25:23.889Z', '2026-09-25T14:25:23.889Z', 'standard', 'any', 'any', 'iso', NULL, NULL, NULL, NULL, 'system', 'system', NULL, NULL);
INSERT INTO "transformers" ("id", "created_at", "updated_at", "type", "input_type", "output_type", "function_name", "name", "description", "custom_manifest", "custom_code", "created_by", "updated_by", "language", "timeout") VALUES ('hqTupn', '2026-09-25T14:25:23.889Z', '2026-09-25T14:25:23.889Z', 'standard', 'any', 'any', 'json-to-csv', NULL, NULL, NULL, NULL, 'system', 'system', NULL, NULL);
INSERT INTO "transformers" ("id", "created_at", "updated_at", "type", "input_type", "output_type", "function_name", "name", "description", "custom_manifest", "custom_code", "created_by", "updated_by", "language", "timeout") VALUES ('Uo2Ubv', '2026-09-25T14:25:23.889Z', '2026-09-25T14:25:23.889Z', 'standard', 'time-values', 'any', 'time-values-to-csv', NULL, NULL, NULL, NULL, 'system', 'system', NULL, NULL);
INSERT INTO "transformers" ("id", "created_at", "updated_at", "type", "input_type", "output_type", "function_name", "name", "description", "custom_manifest", "custom_code", "created_by", "updated_by", "language", "timeout") VALUES ('KCR34P', '2026-09-25T14:25:23.889Z', '2026-09-25T14:25:23.889Z', 'standard', 'time-values', 'any', 'time-values-to-json', NULL, NULL, NULL, NULL, 'system', 'system', NULL, NULL);
INSERT INTO "transformers" ("id", "created_at", "updated_at", "type", "input_type", "output_type", "function_name", "name", "description", "custom_manifest", "custom_code", "created_by", "updated_by", "language", "timeout") VALUES ('K3Dq77', '2026-09-25T14:25:23.889Z', '2026-09-25T14:25:23.889Z', 'standard', 'time-values', 'modbus', 'time-values-to-modbus', NULL, NULL, NULL, NULL, 'system', 'system', NULL, NULL);
INSERT INTO "transformers" ("id", "created_at", "updated_at", "type", "input_type", "output_type", "function_name", "name", "description", "custom_manifest", "custom_code", "created_by", "updated_by", "language", "timeout") VALUES ('UwP1iB', '2026-09-25T14:25:23.889Z', '2026-09-25T14:25:23.889Z', 'standard', 'time-values', 'mqtt', 'time-values-to-mqtt', NULL, NULL, NULL, NULL, 'system', 'system', NULL, NULL);
INSERT INTO "transformers" ("id", "created_at", "updated_at", "type", "input_type", "output_type", "function_name", "name", "description", "custom_manifest", "custom_code", "created_by", "updated_by", "language", "timeout") VALUES ('8yVydz', '2026-09-25T14:25:23.889Z', '2026-09-25T14:25:23.889Z', 'standard', 'time-values', 'oianalytics', 'time-values-to-oianalytics', NULL, NULL, NULL, NULL, 'system', 'system', NULL, NULL);
INSERT INTO "transformers" ("id", "created_at", "updated_at", "type", "input_type", "output_type", "function_name", "name", "description", "custom_manifest", "custom_code", "created_by", "updated_by", "language", "timeout") VALUES ('Vkhbve', '2026-09-25T14:25:23.889Z', '2026-09-25T14:25:23.889Z', 'standard', 'time-values', 'opcua', 'time-values-to-opcua', NULL, NULL, NULL, NULL, 'system', 'system', NULL, NULL);
INSERT INTO "transformers" ("id", "created_at", "updated_at", "type", "input_type", "output_type", "function_name", "name", "description", "custom_manifest", "custom_code", "created_by", "updated_by", "language", "timeout") VALUES ('hHo18K', '2026-09-25T14:25:23.889Z', '2026-09-25T14:25:23.889Z', 'standard', 'setpoint', 'modbus', 'setpoint-to-modbus', NULL, NULL, NULL, NULL, 'system', 'system', NULL, NULL);
INSERT INTO "transformers" ("id", "created_at", "updated_at", "type", "input_type", "output_type", "function_name", "name", "description", "custom_manifest", "custom_code", "created_by", "updated_by", "language", "timeout") VALUES ('5DyO3T', '2026-09-25T14:25:23.889Z', '2026-09-25T14:25:23.889Z', 'standard', 'setpoint', 'mqtt', 'setpoint-to-mqtt', NULL, NULL, NULL, NULL, 'system', 'system', NULL, NULL);
INSERT INTO "transformers" ("id", "created_at", "updated_at", "type", "input_type", "output_type", "function_name", "name", "description", "custom_manifest", "custom_code", "created_by", "updated_by", "language", "timeout") VALUES ('S2IGeN', '2026-09-25T14:25:23.889Z', '2026-09-25T14:25:23.889Z', 'standard', 'setpoint', 'opcua', 'setpoint-to-opcua', NULL, NULL, NULL, NULL, 'system', 'system', NULL, NULL);
INSERT INTO "transformers" ("id", "created_at", "updated_at", "type", "input_type", "output_type", "function_name", "name", "description", "custom_manifest", "custom_code", "created_by", "updated_by", "language", "timeout") VALUES ('transformerId1', '2026-09-25T14:25:23.924Z', '2026-09-25T14:25:23.924Z', 'custom', 'time-values', 'any', NULL, 'my transformer 1', 'description', '{"type":"object","key":"transformers.options","translationKey":"","attributes":[],"enablingConditions":[],"validators":[],"displayProperties":{"visible":true,"wrapInBox":false}}', 'console.log("Hello World");', NULL, NULL, 'javascript', 2000);
INSERT INTO "transformers" ("id", "created_at", "updated_at", "type", "input_type", "output_type", "function_name", "name", "description", "custom_manifest", "custom_code", "created_by", "updated_by", "language", "timeout") VALUES ('transformerId2', '2026-09-25T14:25:23.925Z', '2026-09-25T14:25:23.925Z', 'custom', 'any', 'any', NULL, 'my transformer 2', 'description', '{"type":"object","key":"transformers.options","translationKey":"","attributes":[],"enablingConditions":[],"validators":[],"displayProperties":{"visible":true,"wrapInBox":false}}', 'console.log("Hello World");', NULL, NULL, 'javascript', 2000);
INSERT INTO "transformers" ("id", "created_at", "updated_at", "type", "input_type", "output_type", "function_name", "name", "description", "custom_manifest", "custom_code", "created_by", "updated_by", "language", "timeout") VALUES ('transformerId3', '2026-09-25T14:25:23.926Z', '2026-09-25T14:25:23.926Z', 'custom', 'setpoint', 'any', NULL, 'my transformer 3', 'description', '{"type":"object","key":"transformers.options","translationKey":"","attributes":[],"enablingConditions":[],"validators":[],"displayProperties":{"visible":true,"wrapInBox":false}}', 'console.log("Hello World");', NULL, NULL, 'javascript', 2000);
INSERT INTO "transformers" ("id", "created_at", "updated_at", "type", "input_type", "output_type", "function_name", "name", "description", "custom_manifest", "custom_code", "created_by", "updated_by", "language", "timeout") VALUES ('8dkvpg', '2026-09-25T14:25:23.946Z', '2026-09-25T14:25:23.946Z', 'standard', 'any', 'oianalytics', 'json-to-oianalytics', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO "south_connectors" ("id", "created_at", "updated_at", "name", "type", "description", "enabled", "settings", "created_by", "updated_by") VALUES ('southId1', '2026-09-25T14:25:23.926Z', '2026-09-25T14:25:23.926Z', 'South 1', 'folder-scanner', 'my folder scanner', 1, '{"inputFolder":"input","compression":true,"username":null,"password":null,"domain":null}', NULL, NULL);
INSERT INTO "south_connectors" ("id", "created_at", "updated_at", "name", "type", "description", "enabled", "settings", "created_by", "updated_by") VALUES ('southId2', '2026-09-25T14:25:23.928Z', '2026-09-25T14:25:23.928Z', 'South 2', 'mssql', 'my MSSQL south connector', 0, '{"host":"host","port":1433,"connectionTimeout":1000,"database":"database","username":"oibus","password":"pass","domain":"domain","encryption":true,"trustServerCertificate":true,"requestTimeout":5000}', NULL, NULL);
INSERT INTO "south_connectors" ("id", "created_at", "updated_at", "name", "type", "description", "enabled", "settings", "created_by", "updated_by") VALUES ('southId3', '2026-09-25T14:25:23.930Z', '2026-09-25T14:25:23.930Z', 'South 3', 'opcua', 'my OPCUA south connector', 1, '{"url":"opc.tcp://localhost:666/OPCUA/SimulationServer","retryInterval":10000,"readTimeout":15000,"maxParallelRun":1,"flushMessageTimeout":1000,"maxNumberOfMessages":1000,"authentication":{"type":"none"},"securityMode":"none","securityPolicy":"none","keepSessionAlive":false}', NULL, NULL);
INSERT INTO "north_connectors" ("id", "created_at", "updated_at", "name", "type", "description", "enabled", "settings", "caching_trigger_schedule", "caching_trigger_number_of_elements", "caching_trigger_number_of_files", "caching_throttling_run_min_delay", "caching_throttling_cache_max_size", "caching_throttling_max_number_of_elements", "caching_error_retry_interval", "caching_error_retry_count", "caching_error_retention_duration", "caching_archive_enabled", "caching_archive_retention_duration", "created_by", "updated_by") VALUES ('northId1', '2026-09-25T14:25:23.934Z', '2026-09-25T14:25:23.934Z', 'North 1', 'file-writer', 'my file writer', 1, '{"outputFolder":"output-folder","prefix":"prefix-","suffix":"-suffix","username":null,"password":null,"domain":null}', 'scanModeId1', 250, 1, 200, 30, 10000, 1000, 3, 24, 0, 72, NULL, NULL);
INSERT INTO "north_connectors" ("id", "created_at", "updated_at", "name", "type", "description", "enabled", "settings", "caching_trigger_schedule", "caching_trigger_number_of_elements", "caching_trigger_number_of_files", "caching_throttling_run_min_delay", "caching_throttling_cache_max_size", "caching_throttling_max_number_of_elements", "caching_error_retry_interval", "caching_error_retry_count", "caching_error_retention_duration", "caching_archive_enabled", "caching_archive_retention_duration", "created_by", "updated_by") VALUES ('northId2', '2026-09-25T14:25:23.936Z', '2026-09-25T14:25:23.936Z', 'North 2', 'oianalytics', 'my oianalytics', 0, '{"useOiaModule":true,"timeout":5000,"compress":true}', 'scanModeId2', 1000, 1, 200, 30, 10000, 1000, 1, 24, 0, 72, NULL, NULL);
INSERT INTO "history_queries" ("id", "created_at", "updated_at", "status", "name", "description", "start_time", "end_time", "south_type", "north_type", "south_settings", "north_settings", "caching_trigger_schedule", "caching_trigger_number_of_elements", "caching_trigger_number_of_files", "caching_throttling_run_min_delay", "caching_throttling_cache_max_size", "caching_throttling_max_number_of_elements", "caching_error_retry_interval", "caching_error_retry_count", "caching_error_retention_duration", "caching_archive_enabled", "caching_archive_retention_duration", "created_by", "updated_by", "throttling_max_read_interval", "throttling_read_delay") VALUES ('historyId1', '2026-09-25T14:25:23.937Z', '2026-09-25T14:25:23.937Z', 'RUNNING', 'my first History Query', 'description', '2020-03-15T00:00:00.000Z', '2020-03-20T00:00:00.000Z', 'mssql', 'oianalytics', '{"host":"host","port":1433,"connectionTimeout":1000,"database":"database","username":"oibus","password":"pass","domain":"domain","encryption":true,"trustServerCertificate":true,"requestTimeout":5000}', '{"useOiaModule":true,"timeout":5000,"compress":true}', 'scanModeId1', 100, 1, 200, 10000, 1000, 1000, 3, 24, 1, 1000, NULL, NULL, 3600, 200);
INSERT INTO "history_queries" ("id", "created_at", "updated_at", "status", "name", "description", "start_time", "end_time", "south_type", "north_type", "south_settings", "north_settings", "caching_trigger_schedule", "caching_trigger_number_of_elements", "caching_trigger_number_of_files", "caching_throttling_run_min_delay", "caching_throttling_cache_max_size", "caching_throttling_max_number_of_elements", "caching_error_retry_interval", "caching_error_retry_count", "caching_error_retention_duration", "caching_archive_enabled", "caching_archive_retention_duration", "created_by", "updated_by", "throttling_max_read_interval", "throttling_read_delay") VALUES ('historyId2', '2026-09-25T14:25:23.941Z', '2026-09-25T14:25:23.941Z', 'PENDING', 'My second History Query', 'description', '2020-03-15T00:00:00.000Z', '2020-03-20T00:00:00.000Z', 'mssql', 'file-writer', '{"host":"host","port":1433,"connectionTimeout":1000,"database":"database","username":"oibus","password":"pass","domain":"domain","encryption":true,"trustServerCertificate":true,"requestTimeout":5000}', '{"outputFolder":"output-folder","prefix":"prefix-","suffix":"-suffix","username":null,"password":null,"domain":null}', 'scanModeId1', 100, 0, 200, 10000, 1000, 1000, 3, 24, 1, 1000, NULL, NULL, 3600, 200);
INSERT INTO "history_items" ("id", "created_at", "updated_at", "history_id", "name", "enabled", "settings", "created_by", "updated_by") VALUES ('historyQueryItem1', '2026-09-25T14:25:23.938Z', '2026-09-25T14:25:23.938Z', 'historyId1', 'item1', 1, '{"query":"SELECT * FROM table1","dateTimeFields":null,"serialization":{"type":"csv","filename":"item1.csv","delimiter":"COMMA","compression":false,"outputTimestampFormat":"yyyy-MM-dd HH:mm:ss.SSS","outputTimezone":"UTC"}}', NULL, NULL);
INSERT INTO "history_items" ("id", "created_at", "updated_at", "history_id", "name", "enabled", "settings", "created_by", "updated_by") VALUES ('historyQueryItem2', '2026-09-25T14:25:23.939Z', '2026-09-25T14:25:23.939Z', 'historyId1', 'item2', 1, '{"query":"SELECT * FROM table2","dateTimeFields":null,"serialization":{"type":"csv","filename":"item2.csv","delimiter":"COMMA","compression":false,"outputTimestampFormat":"yyyy-MM-dd HH:mm:ss.SSS","outputTimezone":"UTC"}}', NULL, NULL);
INSERT INTO "history_items" ("id", "created_at", "updated_at", "history_id", "name", "enabled", "settings", "created_by", "updated_by") VALUES ('historyQueryItem3', '2026-09-25T14:25:23.942Z', '2026-09-25T14:25:23.942Z', 'historyId2', 'item3', 1, '{"query":"SELECT * FROM table3","dateTimeFields":null,"serialization":{"type":"csv","filename":"item3.csv","delimiter":"COMMA","compression":false,"outputTimestampFormat":"yyyy-MM-dd HH:mm:ss.SSS","outputTimezone":"UTC"}}', NULL, NULL);
INSERT INTO "south_items" ("id", "created_at", "updated_at", "connector_id", "scan_mode_id", "name", "enabled", "settings", "created_by", "updated_by", "max_read_interval", "read_delay", "sync_with_group", "recovery_strategy", "start_time_offset", "end_time_offset") VALUES ('southItemId1', '2026-09-25T14:25:23.927Z', '2026-09-25T14:25:23.927Z', 'southId1', 'scanModeId1', 'item1', 1, '{}', NULL, NULL, NULL, NULL, 0, NULL, 0, 0);
INSERT INTO "south_items" ("id", "created_at", "updated_at", "connector_id", "scan_mode_id", "name", "enabled", "settings", "created_by", "updated_by", "max_read_interval", "read_delay", "sync_with_group", "recovery_strategy", "start_time_offset", "end_time_offset") VALUES ('southItemId2', '2026-09-25T14:25:23.927Z', '2026-09-25T14:25:23.927Z', 'southId1', 'scanModeId1', 'item2', 1, '{}', NULL, NULL, NULL, NULL, 1, NULL, 0, 0);
INSERT INTO "south_items" ("id", "created_at", "updated_at", "connector_id", "scan_mode_id", "name", "enabled", "settings", "created_by", "updated_by", "max_read_interval", "read_delay", "sync_with_group", "recovery_strategy", "start_time_offset", "end_time_offset") VALUES ('southItemId3', '2026-09-25T14:25:23.928Z', '2026-09-25T14:25:23.928Z', 'southId2', 'scanModeId1', 'item3', 1, '{"query":"SELECT * FROM logs WHERE timestamp > @StartTime AND timestamp <= @EndTime","dateTimeFields":[{"fieldName":"timestamp","useAsReference":true,"type":"iso-string","timezone":null,"format":null,"locale":null},{"fieldName":"created","useAsReference":false,"type":"string","timezone":"Europe/Paris","format":"yyyy-MM-dd HH:mm:ss","locale":"en-En"}],"serialization":{"type":"csv","filename":"logs-@CurrentDate.csv","delimiter":"SEMI_COLON","compression":true,"outputTimestampFormat":"yyyy-MM-dd HH:mm:ss.SSS","outputTimezone":"Europe/Paris"}}', NULL, NULL, 3600, 200, 0, NULL, 0, NULL);
INSERT INTO "south_items" ("id", "created_at", "updated_at", "connector_id", "scan_mode_id", "name", "enabled", "settings", "created_by", "updated_by", "max_read_interval", "read_delay", "sync_with_group", "recovery_strategy", "start_time_offset", "end_time_offset") VALUES ('southItemId4', '2026-09-25T14:25:23.929Z', '2026-09-25T14:25:23.929Z', 'southId2', 'scanModeId1', 'item4', 1, '{"query":"SELECT * FROM values","dateTimeFields":null,"serialization":{"type":"csv","filename":"values.csv","delimiter":"COMMA","compression":false,"outputTimestampFormat":"yyyy-MM-dd HH:mm:ss.SSS","outputTimezone":"UTC"}}', NULL, NULL, 3600, 200, 1, NULL, 0, NULL);
INSERT INTO "south_items" ("id", "created_at", "updated_at", "connector_id", "scan_mode_id", "name", "enabled", "settings", "created_by", "updated_by", "max_read_interval", "read_delay", "sync_with_group", "recovery_strategy", "start_time_offset", "end_time_offset") VALUES ('southItemId5', '2026-09-25T14:25:23.931Z', '2026-09-25T14:25:23.931Z', 'southId3', 'scanModeId1', 'opcua ha', 1, '{"mode":"ha","timestampOrigin":""}', NULL, NULL, 3600, 200, 0, NULL, 10, NULL);
INSERT INTO "south_items" ("id", "created_at", "updated_at", "connector_id", "scan_mode_id", "name", "enabled", "settings", "created_by", "updated_by", "max_read_interval", "read_delay", "sync_with_group", "recovery_strategy", "start_time_offset", "end_time_offset") VALUES ('southItemId6', '2026-09-25T14:25:23.932Z', '2026-09-25T14:25:23.932Z', 'southId3', 'subscription', 'opcua sub', 1, '{"mode":"da"}', NULL, NULL, 3600, 200, 0, NULL, 10, NULL);
INSERT INTO "south_items" ("id", "created_at", "updated_at", "connector_id", "scan_mode_id", "name", "enabled", "settings", "created_by", "updated_by", "max_read_interval", "read_delay", "sync_with_group", "recovery_strategy", "start_time_offset", "end_time_offset") VALUES ('southItemId7', '2026-09-25T14:25:23.932Z', '2026-09-25T14:25:23.932Z', 'southId3', 'scanModeId2', 'opcua da', 1, '{"mode":"da"}', NULL, NULL, 3600, 200, 0, NULL, 10, NULL);
INSERT INTO "south_items" ("id", "created_at", "updated_at", "connector_id", "scan_mode_id", "name", "enabled", "settings", "created_by", "updated_by", "max_read_interval", "read_delay", "sync_with_group", "recovery_strategy", "start_time_offset", "end_time_offset") VALUES ('southItemId8', '2026-09-25T14:25:23.933Z', '2026-09-25T14:25:23.933Z', 'southId3', 'scanModeId1', 'opcua ha 2', 1, '{"mode":"ha"}', NULL, NULL, 3600, 200, 0, NULL, 10, NULL);
INSERT INTO "south_item_groups" ("id", "created_at", "updated_at", "created_by", "updated_by", "name", "south_id", "scan_mode_id", "max_read_interval", "read_delay", "recovery_strategy", "start_time_offset", "end_time_offset") VALUES ('fixtureGroup', '2026-09-25T14:25:23Z', '2026-09-25T14:25:23Z', 'fixture', 'fixture', 'Fixture group', 'southId1', 'scanModeId1', 3600, 200, 'oldest', 0, 0);
INSERT INTO "south_item_groups" ("id", "created_at", "updated_at", "created_by", "updated_by", "name", "south_id", "scan_mode_id", "max_read_interval", "read_delay", "recovery_strategy", "start_time_offset", "end_time_offset") VALUES ('fixtureMssqlGroup', '2026-09-25T14:25:23Z', '2026-09-25T14:25:23Z', 'fixture', 'fixture', 'Fixture mssql group', 'southId2', 'scanModeId1', NULL, NULL, NULL, NULL, NULL);
INSERT INTO "history_query_transformers" ("id", "history_id", "transformer_id", "options") VALUES ('historyTransformerId1', 'historyId1', 'transformerId1', '{}');
INSERT INTO "history_query_transformers" ("id", "history_id", "transformer_id", "options") VALUES ('historyTransformerId2', 'historyId1', 'transformerId2', '{}');
INSERT INTO "history_query_transformers" ("id", "history_id", "transformer_id", "options") VALUES ('fixtureHistoryLink1', 'historyId2', 'RfzYaZ', '{}');
INSERT INTO "history_query_transformers" ("id", "history_id", "transformer_id", "options") VALUES ('fixtureHistoryLink2', 'historyId2', '8yVydz', '{}');
INSERT INTO "north_transformers" ("id", "north_id", "transformer_id", "source_type", "source_api_data_source_id", "source_south_south_id", "source_south_group_id", "options") VALUES ('northTransformerId1', 'northId1', 'transformerId1', 'south', NULL, 'southId1', NULL, '{}');
INSERT INTO "north_transformers" ("id", "north_id", "transformer_id", "source_type", "source_api_data_source_id", "source_south_south_id", "source_south_group_id", "options") VALUES ('northTransformerId2', 'northId1', 'transformerId2', 'oibus-api', 'dataSourceId1', NULL, NULL, '{}');
INSERT INTO "north_transformers" ("id", "north_id", "transformer_id", "source_type", "source_api_data_source_id", "source_south_south_id", "source_south_group_id", "options") VALUES ('northTransformerId3', 'northId1', 'transformerId3', 'south', NULL, 'southId2', NULL, '{}');
INSERT INTO "north_transformers" ("id", "north_id", "transformer_id", "source_type", "source_api_data_source_id", "source_south_south_id", "source_south_group_id", "options") VALUES ('fixtureLink1', 'northId2', 'OcHBt6', 'south', NULL, 'southId2', NULL, '{}');
INSERT INTO "north_transformers" ("id", "north_id", "transformer_id", "source_type", "source_api_data_source_id", "source_south_south_id", "source_south_group_id", "options") VALUES ('fixtureLink2', 'northId2', 'RfzYaZ', 'south', NULL, 'southId2', NULL, '{}');
INSERT INTO "north_transformers" ("id", "north_id", "transformer_id", "source_type", "source_api_data_source_id", "source_south_south_id", "source_south_group_id", "options") VALUES ('fixtureLink3', 'northId1', 'RfzYaZ', 'south', NULL, 'southId2', 'fixtureMssqlGroup', '{}');
INSERT INTO "north_transformers" ("id", "north_id", "transformer_id", "source_type", "source_api_data_source_id", "source_south_south_id", "source_south_group_id", "options") VALUES ('fixtureLink4', 'northId2', '8yVydz', 'south', NULL, 'southId3', NULL, '{"precision":"ms"}');
INSERT INTO "north_transformers" ("id", "north_id", "transformer_id", "source_type", "source_api_data_source_id", "source_south_south_id", "source_south_group_id", "options") VALUES ('fixtureLink5', 'northId2', '8dkvpg', 'south', NULL, 'southId3', NULL, '{"referenceProcess":"reference"}');
INSERT INTO "group_items" ("group_id", "item_id") VALUES ('fixtureGroup', 'southItemId2');
INSERT INTO "group_items" ("group_id", "item_id") VALUES ('fixtureMssqlGroup', 'southItemId4');
INSERT INTO "north_transformers_items" ("id", "item_id", "group_id") VALUES ('northTransformerId1', 'southItemId1', NULL);
INSERT INTO "north_transformers_items" ("id", "item_id", "group_id") VALUES ('fixtureLink1', 'southItemId3', NULL);
INSERT INTO "history_query_transformers_items" ("id", "item_id") VALUES ('historyTransformerId1', 'historyQueryItem2');
INSERT INTO "sqlite_sequence" ("name", "seq") VALUES ('migrations_lock', 1);
INSERT INTO "sqlite_sequence" ("name", "seq") VALUES ('migrations', 27);
CREATE UNIQUE INDEX `scan_modes_name_unique` on `scan_modes` (`name`);
CREATE UNIQUE INDEX engines_name_unique ON engines (name);
CREATE UNIQUE INDEX users_login_unique ON users (login);
CREATE UNIQUE INDEX ip_filters_address_unique ON ip_filters (address);
CREATE UNIQUE INDEX registrations_host_unique ON registrations (host);
CREATE UNIQUE INDEX south_connectors_name_unique ON south_connectors (name);
CREATE UNIQUE INDEX north_connectors_name_unique ON north_connectors (name);
CREATE UNIQUE INDEX history_queries_name_unique ON history_queries (name);
CREATE UNIQUE INDEX history_items_history_id_name_unique ON history_items (history_id, name);
CREATE UNIQUE INDEX south_items_connector_id_name_unique ON south_items (connector_id, name);
CREATE UNIQUE INDEX `south_item_groups_name_south_id_unique` on `south_item_groups` (`name`, `south_id`);
CREATE UNIQUE INDEX `north_transformers_items_id_item_id_group_id_unique` on `north_transformers_items` (`id`, `item_id`, `group_id`);
CREATE UNIQUE INDEX `history_query_transformers_items_id_item_id_unique` on `history_query_transformers_items` (`id`, `item_id`);
CREATE INDEX `group_items_item_id_idx` on `group_items` (`item_id`);
COMMIT;
PRAGMA foreign_keys = ON;
