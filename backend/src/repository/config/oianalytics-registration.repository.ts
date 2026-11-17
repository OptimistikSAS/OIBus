import { Database } from 'better-sqlite3';

import { Instant } from '../../../shared/model/common/types';
import {
  COMMAND_PERMISSIONS,
  CommandPermission,
  RegistrationCommandPermissions,
  RegistrationStatus
} from '../../../shared/model/domain/engine.model';

import { OIAnalyticsRegistration, OIAnalyticsRegistrationEditCommand } from '../../model/oianalytics-registration.model';
import AuditService, { redactAuditSnapshots } from '../../service/audit.service';
import { generateRandomId } from '../../service/utils';

const REGISTRATIONS_TABLE = 'registrations';

/**
 * The column storing each permission granted to OIAnalytics.
 */
const PERMISSION_COLUMNS: Readonly<Record<CommandPermission, string>> = {
  updateVersion: 'command_update_version',
  operate: 'command_operate',
  configureEngine: 'command_configure_engine',
  configureDataFlow: 'command_configure_data_flow',
  configureCustomCode: 'command_configure_custom_code',
  manageAccess: 'command_manage_access',
  manageRegistration: 'command_manage_registration',
  connectToDataSources: 'command_connect_to_data_sources',
  manageCache: 'command_manage_cache',
  diagnostics: 'command_diagnostics',
  setpoint: 'command_setpoint'
};
const PERMISSION_COLUMN_LIST = COMMAND_PERMISSIONS.map(permission => PERMISSION_COLUMNS[permission]);
const PERMISSION_COLUMNS_SELECT = PERMISSION_COLUMN_LIST.join(', ');
const PERMISSION_COLUMNS_UPDATE = PERMISSION_COLUMN_LIST.map(column => `${column} = ?`).join(', ');

const toPermissionValues = (permissions: RegistrationCommandPermissions): Array<number> =>
  COMMAND_PERMISSIONS.map(permission => +permissions[permission]);

export default class OIAnalyticsRegistrationRepository {
  constructor(
    private readonly database: Database,
    private readonly auditService: AuditService
  ) {
    this.createDefault({
      host: '',
      useProxy: false,
      acceptUnauthorized: false,
      proxyUrl: null,
      proxyUsername: null,
      proxyPassword: null,
      useApiGateway: false,
      apiGatewayHeaderKey: null,
      apiGatewayHeaderValue: null,
      apiGatewayBaseEndpoint: null,
      commandRefreshInterval: 60,
      commandRetryInterval: 5,
      messageRetryInterval: 5,
      commandPermissions: {
        updateVersion: true,
        operate: true,
        configureEngine: true,
        configureDataFlow: true,
        configureCustomCode: false,
        manageAccess: true,
        manageRegistration: true,
        connectToDataSources: true,
        manageCache: true,
        diagnostics: false,
        setpoint: false
      }
    });
  }

  get(): OIAnalyticsRegistration | null {
    const query =
      `SELECT id, host, token, public_key, private_key, activation_code, status, activation_date, check_url, ` +
      `activation_expiration_date, use_proxy, proxy_url, proxy_username, proxy_password, accept_unauthorized, use_api_gateway, api_gateway_header_key, api_gateway_header_value, api_gateway_base_endpoint, ` +
      `command_refresh_interval, command_retry_interval, message_retry_interval, ${PERMISSION_COLUMNS_SELECT}, ` +
      `created_by, updated_by, created_at, updated_at ` +
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
   * check URL, and the expiration date, we store this information in OIBus
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
    privateKey: string,
    updatedBy: string
  ): void {
    const query =
      `UPDATE ${REGISTRATIONS_TABLE} SET host = ?, status = 'PENDING', token = '', activation_code = ?, ` +
      `check_url = ?, activation_expiration_date = ?, use_proxy = ?, proxy_url = ?, proxy_username = ?, proxy_password = ?, ` +
      `use_api_gateway = ?, api_gateway_header_key = ?, api_gateway_header_value = ?, api_gateway_base_endpoint = ?,` +
      `accept_unauthorized = ?, public_key = ?, private_key = ?, command_refresh_interval = ?, command_retry_interval = ?, message_retry_interval = ?, ` +
      `${PERMISSION_COLUMNS_UPDATE}, ` +
      `updated_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') ` +
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
        +command.useApiGateway,
        command.apiGatewayHeaderKey,
        command.apiGatewayHeaderValue,
        command.apiGatewayBaseEndpoint,
        +command.acceptUnauthorized,
        publicKey,
        privateKey,
        command.commandRefreshInterval,
        command.commandRetryInterval,
        command.messageRetryInterval,
        ...toPermissionValues(command.commandPermissions),
        updatedBy
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

  update(command: Omit<OIAnalyticsRegistrationEditCommand, 'host'>, updatedBy: string): void {
    const before = this.get();
    const query =
      `UPDATE ${REGISTRATIONS_TABLE} SET ` +
      `use_proxy = ?, proxy_url = ?, proxy_username = ?, proxy_password = ?, use_api_gateway = ?, api_gateway_header_key = ?, api_gateway_header_value = ?, api_gateway_base_endpoint = ?, ` +
      `accept_unauthorized = ?, command_refresh_interval = ?, command_retry_interval = ?, message_retry_interval = ?, ` +
      `${PERMISSION_COLUMNS_UPDATE}, ` +
      `updated_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') ` +
      `WHERE rowid=(SELECT MIN(rowid) FROM ${REGISTRATIONS_TABLE});`;
    this.database
      .prepare(query)
      .run(
        +command.useProxy,
        command.proxyUrl,
        command.proxyUsername,
        command.proxyPassword,
        +command.useApiGateway,
        command.apiGatewayHeaderKey,
        command.apiGatewayHeaderValue,
        command.apiGatewayBaseEndpoint,
        +command.acceptUnauthorized,
        command.commandRefreshInterval,
        command.commandRetryInterval,
        command.messageRetryInterval,
        ...toPermissionValues(command.commandPermissions),
        updatedBy
      );
    const after = this.get();
    this.auditService.record(
      'oianalytics_registration',
      after!.id,
      'UPDATE',
      ...redactAuditSnapshots(before, after, r => this.redact(r)),
      updatedBy
    );
  }

  updateKeys(privateKey: string, publicKey: string, updatedBy: string): void {
    const before = this.get();
    const query = `UPDATE ${REGISTRATIONS_TABLE} SET private_key = ?, public_key = ? WHERE rowid=(SELECT MIN(rowid) FROM ${REGISTRATIONS_TABLE});`;
    this.database.prepare(query).run(privateKey, publicKey);
    const after = this.get();
    this.auditService.record(
      'oianalytics_registration',
      after!.id,
      'UPDATE',
      ...redactAuditSnapshots(before, after, r => this.redact(r)),
      updatedBy
    );
  }

  protected createDefault(command: OIAnalyticsRegistrationEditCommand): void {
    if (this.get()) {
      return;
    }
    const query =
      `INSERT INTO ${REGISTRATIONS_TABLE} (id, host, status, use_proxy, proxy_url, proxy_username, proxy_password, use_api_gateway, api_gateway_header_key, api_gateway_header_value, api_gateway_base_endpoint, ` +
      `accept_unauthorized, command_refresh_interval, command_retry_interval, message_retry_interval, ${PERMISSION_COLUMNS_SELECT}, ` +
      `created_by, updated_by, created_at, updated_at` +
      `) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${PERMISSION_COLUMN_LIST.map(() => '?').join(', ')}, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));`;
    this.database
      .prepare(query)
      .run(
        generateRandomId(),
        command.host,
        'NOT_REGISTERED',
        +command.useProxy,
        command.proxyUrl,
        command.proxyUsername,
        command.proxyPassword,
        +command.useApiGateway,
        command.apiGatewayHeaderKey,
        command.apiGatewayHeaderValue,
        command.apiGatewayBaseEndpoint,
        +command.acceptUnauthorized,
        command.commandRefreshInterval,
        command.commandRetryInterval,
        command.messageRetryInterval,
        ...toPermissionValues(command.commandPermissions),
        'system',
        'system'
      );
  }

  /**
   * Returns a shallow copy of the registration with the cipher key material redacted, so real key
   * bytes never end up persisted in the audit trail, even for calls that do not touch the keys.
   */
  private redact(registration: OIAnalyticsRegistration | null): Record<string, unknown> | null {
    if (!registration) return null;
    return {
      ...registration,
      publicCipherKey: '',
      privateCipherKey: '',
      token: '',
      proxyPassword: '',
      apiGatewayHeaderValue: ''
    };
  }

  private toOIAnalyticsRegistration(result: Record<string, string | number>): OIAnalyticsRegistration {
    return {
      id: result.id as string,
      createdBy: result.created_by as string,
      updatedBy: result.updated_by as string,
      createdAt: result.created_at as string,
      updatedAt: result.updated_at as string,
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
      useApiGateway: Boolean(result.use_api_gateway),
      apiGatewayHeaderKey: result.api_gateway_header_key as string,
      apiGatewayHeaderValue: result.api_gateway_header_value as string,
      apiGatewayBaseEndpoint: result.api_gateway_base_endpoint as string,
      acceptUnauthorized: Boolean(result.accept_unauthorized),
      commandRefreshInterval: result.command_refresh_interval as number,
      commandRetryInterval: result.command_retry_interval as number,
      messageRetryInterval: result.message_retry_interval as number,
      commandPermissions: Object.fromEntries(
        COMMAND_PERMISSIONS.map(permission => [permission, Boolean(result[PERMISSION_COLUMNS[permission]])])
      ) as Record<CommandPermission, boolean>
    };
  }
}
