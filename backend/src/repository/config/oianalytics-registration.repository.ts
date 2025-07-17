import { generateRandomId } from '../../service/utils';
import { Database } from 'better-sqlite3';
import { Instant } from '../../../shared/model/types';
import { OIAnalyticsRegistration, OIAnalyticsRegistrationEditCommand } from '../../model/oianalytics-registration.model';
import { RegistrationStatus } from '../../../shared/model/engine.model';

const REGISTRATIONS_TABLE = 'registrations';

export default class OIAnalyticsRegistrationRepository {
  constructor(private readonly database: Database) {
    this.createDefault({
      host: '',
      useProxy: false,
      acceptUnauthorized: false,
      proxyUrl: null,
      proxyUsername: null,
      proxyPassword: null,
      commandRefreshInterval: 10,
      commandRetryInterval: 5,
      messageRetryInterval: 5,
      commandPermissions: {
        updateVersion: true,
        restartEngine: true,
        regenerateCipherKeys: true,
        updateEngineSettings: true,
        updateRegistrationSettings: true,
        createScanMode: true,
        updateScanMode: true,
        deleteScanMode: true,
        createIpFilter: true,
        updateIpFilter: true,
        deleteIpFilter: true,
        createCertificate: true,
        updateCertificate: true,
        deleteCertificate: true,
        createHistoryQuery: true,
        updateHistoryQuery: true,
        deleteHistoryQuery: true,
        createOrUpdateHistoryItemsFromCsv: true,
        testHistoryNorthConnection: true,
        testHistorySouthConnection: true,
        testHistorySouthItem: true,
        createSouth: true,
        updateSouth: true,
        deleteSouth: true,
        createOrUpdateSouthItemsFromCsv: true,
        testSouthConnection: true,
        testSouthItem: true,
        createNorth: true,
        updateNorth: true,
        deleteNorth: true,
        testNorthConnection: true,
        setpoint: true
      }
    });
  }

  get(): OIAnalyticsRegistration | null {
    const query =
      `SELECT id, host, token, public_key, private_key, activation_code, status, activation_date, check_url, ` +
      `activation_expiration_date, use_proxy, proxy_url, proxy_username, proxy_password, accept_unauthorized, command_refresh_interval, command_retry_interval, message_retry_interval, ` +
      `command_update_version, command_restart_engine, command_regenerate_cipher_keys, command_update_engine_settings, command_update_registration_settings, ` +
      `command_create_scan_mode, command_update_scan_mode, command_delete_scan_mode, ` +
      `command_create_ip_filter, command_update_ip_filter, command_delete_ip_filter, ` +
      `command_create_certificate, command_update_certificate, command_delete_certificate, ` +
      `command_create_history_query, command_update_history_query, command_delete_history_query, command_create_or_update_history_items_from_csv, ` +
      `command_test_history_north_connection, command_test_history_south_connection, command_test_history_south_item, ` +
      `command_create_south, command_update_south, command_delete_south, command_create_or_update_south_items_from_csv, command_test_south_connection, command_test_south_item, ` +
      `command_create_north, command_update_north, command_delete_north, command_test_north_connection, command_setpoint ` +
      `FROM ${REGISTRATIONS_TABLE};`;
    const results = this.database.prepare(query).all();

    if (results.length > 0) {
      return this.toOIAnalyticsRegistration(results[0] as Record<string, string | number>);
    } else {
      return null;
    }
  }

  /**
   * After OIAnalytics confirm the creation of a registration, answering with the activation code, the
   * check URL and the expiration date, we store these information in OIBus
   * Next step is for the user to enter the activation code in OIAnalytics
   * OIBus regularly checks if the activation code has been entered
   * Once the activation code entered in OIAnalytics, it goes into the activate method
   */
  register(
    command: OIAnalyticsRegistrationEditCommand,
    activationCode: string,
    checkUrl: string,
    expirationDate: Instant,
    publicKey: string,
    privateKey: string
  ): void {
    const query =
      `UPDATE ${REGISTRATIONS_TABLE} SET host = ?, status = 'PENDING', token = '', activation_code = ?, ` +
      `check_url = ?, activation_expiration_date = ?, use_proxy = ?, proxy_url = ?, proxy_username = ?, proxy_password = ?, ` +
      `accept_unauthorized = ?, public_key = ?, private_key = ?, command_refresh_interval = ?, command_retry_interval = ?, message_retry_interval = ?, command_update_version = ?, ` +
      `command_restart_engine = ?, command_regenerate_cipher_keys = ?, command_update_engine_settings = ?, command_update_registration_settings = ?, ` +
      `command_create_scan_mode = ?, command_update_scan_mode = ?, command_delete_scan_mode = ?, ` +
      `command_create_ip_filter = ?, command_update_ip_filter = ?, command_delete_ip_filter = ?, ` +
      `command_create_certificate = ?, command_update_certificate = ?, command_delete_certificate = ?, ` +
      `command_create_history_query = ?, command_update_history_query = ?, command_delete_history_query = ?, ` +
      `command_create_or_update_history_items_from_csv = ?, command_test_history_north_connection = ?, command_test_history_south_connection = ?, command_test_history_south_item = ?, ` +
      `command_create_south = ?, command_update_south = ?, command_delete_south = ?, command_create_or_update_south_items_from_csv = ?, command_test_south_connection = ?, command_test_south_item = ?, ` +
      `command_create_north = ?, command_update_north = ?, command_delete_north = ?, command_test_north_connection = ?, command_setpoint = ? ` +
      `WHERE rowid=(SELECT MIN(rowid) FROM ${REGISTRATIONS_TABLE});`;
    this.database
      .prepare(query)
      .run(
        command.host,
        activationCode,
        checkUrl,
        expirationDate,
        +command.useProxy,
        command.proxyUrl,
        command.proxyUsername,
        command.proxyPassword,
        +command.acceptUnauthorized,
        publicKey,
        privateKey,
        command.commandRefreshInterval,
        command.commandRetryInterval,
        command.messageRetryInterval,
        +command.commandPermissions.updateVersion,
        +command.commandPermissions.restartEngine,
        +command.commandPermissions.regenerateCipherKeys,
        +command.commandPermissions.updateEngineSettings,
        +command.commandPermissions.updateRegistrationSettings,
        +command.commandPermissions.createScanMode,
        +command.commandPermissions.updateScanMode,
        +command.commandPermissions.deleteScanMode,
        +command.commandPermissions.createIpFilter,
        +command.commandPermissions.updateIpFilter,
        +command.commandPermissions.deleteIpFilter,
        +command.commandPermissions.createCertificate,
        +command.commandPermissions.updateCertificate,
        +command.commandPermissions.deleteCertificate,
        +command.commandPermissions.createHistoryQuery,
        +command.commandPermissions.updateHistoryQuery,
        +command.commandPermissions.deleteHistoryQuery,
        +command.commandPermissions.createOrUpdateHistoryItemsFromCsv,
        +command.commandPermissions.testHistoryNorthConnection,
        +command.commandPermissions.testHistorySouthConnection,
        +command.commandPermissions.testHistorySouthItem,
        +command.commandPermissions.createSouth,
        +command.commandPermissions.updateSouth,
        +command.commandPermissions.deleteSouth,
        +command.commandPermissions.createOrUpdateSouthItemsFromCsv,
        +command.commandPermissions.testSouthConnection,
        +command.commandPermissions.testSouthItem,
        +command.commandPermissions.createNorth,
        +command.commandPermissions.updateNorth,
        +command.commandPermissions.deleteNorth,
        +command.commandPermissions.testNorthConnection,
        +command.commandPermissions.setpoint
      );
  }

  /**
   * When OIBus has an answer from OIAnalytics saying that the user correctly entered the activation code,
   * OIAnalytics also answer with the token that can be used to authenticate to OIAnalytics to send data, logs, settings etc.
   */
  activate(activationDate: Instant, token: string) {
    const query = `UPDATE ${REGISTRATIONS_TABLE} SET status = 'REGISTERED', activation_expiration_date = '', activation_code = '', check_url = '', activation_date = ?, token = ? WHERE rowid=(SELECT MIN(rowid) FROM ${REGISTRATIONS_TABLE});`;
    this.database.prepare(query).run(activationDate, token);
  }

  unregister() {
    const query = `UPDATE ${REGISTRATIONS_TABLE} SET status = 'NOT_REGISTERED', activation_expiration_date = '', check_url = '', activation_date = '', activation_code = '', token = '' WHERE rowid=(SELECT MIN(rowid) FROM ${REGISTRATIONS_TABLE});`;
    this.database.prepare(query).run();
  }

  update(command: Omit<OIAnalyticsRegistrationEditCommand, 'host'>): void {
    const query =
      `UPDATE ${REGISTRATIONS_TABLE} SET ` +
      `use_proxy = ?, proxy_url = ?, proxy_username = ?, proxy_password = ?, accept_unauthorized = ?, command_refresh_interval = ?, command_retry_interval = ?, message_retry_interval = ?,
      command_update_version = ?, command_restart_engine = ?, command_regenerate_cipher_keys = ?, command_update_engine_settings = ?, command_update_registration_settings = ?, ` +
      `command_create_scan_mode = ?, command_update_scan_mode = ?, command_delete_scan_mode = ?, ` +
      `command_create_ip_filter = ?, command_update_ip_filter = ?, command_delete_ip_filter = ?, ` +
      `command_create_certificate = ?, command_update_certificate = ?, command_delete_certificate = ?, ` +
      `command_create_history_query = ?, command_update_history_query = ?, command_delete_history_query = ?, ` +
      `command_create_or_update_history_items_from_csv = ?, command_test_history_north_connection = ?, command_test_history_south_connection = ?, command_test_history_south_item = ?,` +
      `command_create_south = ?, command_update_south = ?, command_delete_south = ?, command_create_or_update_south_items_from_csv = ?, command_test_south_connection = ?, command_test_south_item = ?,` +
      `command_create_north = ?, command_update_north = ?, command_delete_north = ?, command_test_north_connection = ?, command_setpoint = ? ` +
      `WHERE rowid=(SELECT MIN(rowid) FROM ${REGISTRATIONS_TABLE});`;
    this.database
      .prepare(query)
      .run(
        +command.useProxy,
        command.proxyUrl,
        command.proxyUsername,
        command.proxyPassword,
        +command.acceptUnauthorized,
        command.commandRefreshInterval,
        command.commandRetryInterval,
        command.messageRetryInterval,
        +command.commandPermissions.updateVersion,
        +command.commandPermissions.restartEngine,
        +command.commandPermissions.regenerateCipherKeys,
        +command.commandPermissions.updateEngineSettings,
        +command.commandPermissions.updateRegistrationSettings,
        +command.commandPermissions.createScanMode,
        +command.commandPermissions.updateScanMode,
        +command.commandPermissions.deleteScanMode,
        +command.commandPermissions.createIpFilter,
        +command.commandPermissions.updateIpFilter,
        +command.commandPermissions.deleteIpFilter,
        +command.commandPermissions.createCertificate,
        +command.commandPermissions.updateCertificate,
        +command.commandPermissions.deleteCertificate,
        +command.commandPermissions.createHistoryQuery,
        +command.commandPermissions.updateHistoryQuery,
        +command.commandPermissions.deleteHistoryQuery,
        +command.commandPermissions.createOrUpdateHistoryItemsFromCsv,
        +command.commandPermissions.testHistoryNorthConnection,
        +command.commandPermissions.testHistorySouthConnection,
        +command.commandPermissions.testHistorySouthItem,
        +command.commandPermissions.createSouth,
        +command.commandPermissions.updateSouth,
        +command.commandPermissions.deleteSouth,
        +command.commandPermissions.createOrUpdateSouthItemsFromCsv,
        +command.commandPermissions.testSouthConnection,
        +command.commandPermissions.testSouthItem,
        +command.commandPermissions.createNorth,
        +command.commandPermissions.updateNorth,
        +command.commandPermissions.deleteNorth,
        +command.commandPermissions.testNorthConnection,
        +command.commandPermissions.setpoint
      );
  }

  updateKeys(privateKey: string, publicKey: string): void {
    const query = `UPDATE ${REGISTRATIONS_TABLE} SET private_key = ?, public_key = ? WHERE rowid=(SELECT MIN(rowid) FROM ${REGISTRATIONS_TABLE});`;
    this.database.prepare(query).run(privateKey, publicKey);
  }

  private createDefault(command: OIAnalyticsRegistrationEditCommand): void {
    if (this.get()) {
      return;
    }

    const query =
      `INSERT INTO ${REGISTRATIONS_TABLE} (id, host, status, command_refresh_interval, command_retry_interval, message_retry_interval, command_update_version, ` +
      `command_restart_engine, command_regenerate_cipher_keys, command_update_engine_settings, command_update_registration_settings, ` +
      `command_create_scan_mode, command_update_scan_mode, command_delete_scan_mode, ` +
      `command_create_ip_filter, command_update_ip_filter, command_delete_ip_filter, ` +
      `command_create_certificate, command_update_certificate, command_delete_certificate, ` +
      `command_create_history_query, command_update_history_query, command_delete_history_query, command_create_or_update_history_items_from_csv, ` +
      `command_test_history_north_connection, command_test_history_south_connection, command_test_history_south_item, ` +
      `command_create_south, command_update_south, command_delete_south, command_create_or_update_south_items_from_csv, ` +
      `command_test_south_connection, command_test_south_item, ` +
      `command_create_north, command_update_north, command_delete_north, command_test_north_connection, command_setpoint ` +
      `) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;
    this.database
      .prepare(query)
      .run(
        generateRandomId(),
        command.host,
        'NOT_REGISTERED',
        command.commandRefreshInterval,
        command.commandRetryInterval,
        command.messageRetryInterval,
        +command.commandPermissions.updateVersion,
        +command.commandPermissions.restartEngine,
        +command.commandPermissions.regenerateCipherKeys,
        +command.commandPermissions.updateEngineSettings,
        +command.commandPermissions.updateRegistrationSettings,
        +command.commandPermissions.createScanMode,
        +command.commandPermissions.updateScanMode,
        +command.commandPermissions.deleteScanMode,
        +command.commandPermissions.createIpFilter,
        +command.commandPermissions.updateIpFilter,
        +command.commandPermissions.deleteIpFilter,
        +command.commandPermissions.createCertificate,
        +command.commandPermissions.updateCertificate,
        +command.commandPermissions.deleteCertificate,
        +command.commandPermissions.createHistoryQuery,
        +command.commandPermissions.updateHistoryQuery,
        +command.commandPermissions.deleteHistoryQuery,
        +command.commandPermissions.createOrUpdateHistoryItemsFromCsv,
        +command.commandPermissions.testHistoryNorthConnection,
        +command.commandPermissions.testHistorySouthConnection,
        +command.commandPermissions.testHistorySouthItem,
        +command.commandPermissions.createSouth,
        +command.commandPermissions.updateSouth,
        +command.commandPermissions.deleteSouth,
        +command.commandPermissions.createOrUpdateSouthItemsFromCsv,
        +command.commandPermissions.testSouthConnection,
        +command.commandPermissions.testSouthItem,
        +command.commandPermissions.createNorth,
        +command.commandPermissions.updateNorth,
        +command.commandPermissions.deleteNorth,
        +command.commandPermissions.testNorthConnection,
        +command.commandPermissions.setpoint
      );
  }

  private toOIAnalyticsRegistration(result: Record<string, string | number>): OIAnalyticsRegistration {
    return {
      id: result.id as string,
      host: result.host as string,
      activationCode: result.activation_code as string,
      token: result.token as string,
      publicCipherKey: result.public_key as string,
      privateCipherKey: result.private_key as string,
      status: result.status as RegistrationStatus,
      activationDate: result.activation_date as string,
      activationExpirationDate: result.activation_expiration_date as string,
      checkUrl: result.check_url as string,
      useProxy: Boolean(result.use_proxy),
      proxyUrl: result.proxy_url as string,
      proxyUsername: result.proxy_username as string,
      proxyPassword: result.proxy_password as string,
      acceptUnauthorized: Boolean(result.accept_unauthorized),
      commandRefreshInterval: result.command_refresh_interval as number,
      commandRetryInterval: result.command_retry_interval as number,
      messageRetryInterval: result.message_retry_interval as number,
      commandPermissions: {
        updateVersion: Boolean(result.command_update_version),
        restartEngine: Boolean(result.command_restart_engine),
        regenerateCipherKeys: Boolean(result.command_regenerate_cipher_keys),
        updateEngineSettings: Boolean(result.command_update_engine_settings),
        updateRegistrationSettings: Boolean(result.command_update_registration_settings),
        createScanMode: Boolean(result.command_create_scan_mode),
        updateScanMode: Boolean(result.command_update_scan_mode),
        deleteScanMode: Boolean(result.command_delete_scan_mode),
        createIpFilter: Boolean(result.command_create_ip_filter),
        updateIpFilter: Boolean(result.command_update_ip_filter),
        deleteIpFilter: Boolean(result.command_delete_ip_filter),
        createCertificate: Boolean(result.command_create_certificate),
        updateCertificate: Boolean(result.command_update_certificate),
        deleteCertificate: Boolean(result.command_delete_certificate),
        createHistoryQuery: Boolean(result.command_create_history_query),
        updateHistoryQuery: Boolean(result.command_update_history_query),
        deleteHistoryQuery: Boolean(result.command_delete_history_query),
        createOrUpdateHistoryItemsFromCsv: Boolean(result.command_create_or_update_history_items_from_csv),
        testHistoryNorthConnection: Boolean(result.command_test_history_north_connection),
        testHistorySouthConnection: Boolean(result.command_test_history_south_connection),
        testHistorySouthItem: Boolean(result.command_test_history_south_item),
        createSouth: Boolean(result.command_create_south),
        updateSouth: Boolean(result.command_update_south),
        deleteSouth: Boolean(result.command_delete_south),
        createOrUpdateSouthItemsFromCsv: Boolean(result.command_create_or_update_south_items_from_csv),
        testSouthConnection: Boolean(result.command_test_south_connection),
        testSouthItem: Boolean(result.command_test_south_item),
        createNorth: Boolean(result.command_create_north),
        updateNorth: Boolean(result.command_update_north),
        deleteNorth: Boolean(result.command_delete_north),
        testNorthConnection: Boolean(result.command_test_north_connection),
        setpoint: Boolean(result.command_setpoint)
      }
    };
  }
}
