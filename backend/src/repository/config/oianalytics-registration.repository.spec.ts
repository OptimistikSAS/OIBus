import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { Database } from 'better-sqlite3';

import { OIAnalyticsRegistration } from '../../model/oianalytics-registration.model';
import AuditService from '../../service/audit.service';
import { emptyDatabase, initDatabase } from '../../tests/utils/database-utils';
import testData from '../../tests/utils/test-data';
import { createAuditServiceMock, Mocked, stripAuditFields } from '../../tests/utils/test-utils';
import OianalyticsRegistrationRepository from './oianalytics-registration.repository';

const TEST_DB_PATH = 'src/tests/test-config-registration.db';

/** The registration fixture once `overrides` are applied. */
const expectedRegistration = (overrides: Partial<OIAnalyticsRegistration>): OIAnalyticsRegistration => ({
  ...JSON.parse(JSON.stringify(testData.oIAnalytics.registration.completed)),
  ...overrides
});

let database: Database;
describe('OianalyticsRegistrationRepository with populated database', () => {
  before(async () => {
    database = await initDatabase('config', true, TEST_DB_PATH);
  });

  after(async () => {
    database.close();
    await emptyDatabase('config', TEST_DB_PATH);
  });

  let repository: OianalyticsRegistrationRepository;
  let auditService: Mocked<AuditService>;

  beforeEach(() => {
    auditService = createAuditServiceMock();
    repository = new OianalyticsRegistrationRepository(database, auditService);
  });

  /** Checks the test recorded a single update of the registration, and returns its snapshots. */
  const onlyRegistrationUpdate = (registrationId: string) => {
    assert.strictEqual(auditService.record.mock.callCount(), 1);
    const [entityType, entityId, action, previousState, newState, userId] = auditService.record.mock.calls[0].arguments;
    assert.strictEqual(entityType, 'oianalytics_registration');
    assert.strictEqual(entityId, registrationId);
    assert.strictEqual(action, 'UPDATE');
    assert.strictEqual(userId, testData.users.list[0].id);
    return { previousState: previousState!, newState: newState! };
  };

  it('should properly get the registration settings', () => {
    assert.deepStrictEqual(repository.get(), testData.oIAnalytics.registration.completed);
  });

  it('should properly register', () => {
    const expectedResult = expectedRegistration({
      status: 'PENDING',
      activationCode: '123ABC',
      checkUrl: 'http://localhost:4200/api/oianalytics/oibus/registration?id=id',
      activationExpirationDate: testData.constants.dates.FAKE_NOW,
      token: '',
      refreshToken: null,
      tokenExpirationDate: null,
      refreshTokenExpirationDate: null,
      // new keys, replaced when the tokens of the registration would expire (set on activation)
      previousPrivateCipherKey: null,
      cipherKeyRotationDate: null
    });

    repository.register(
      testData.oIAnalytics.registration.command,
      '123ABC',
      'http://localhost:4200/api/oianalytics/oibus/registration?id=id',
      testData.constants.dates.FAKE_NOW,
      'public key',
      'private key',
      testData.users.list[0].id
    );

    assert.deepStrictEqual(stripAuditFields(repository.get()), stripAuditFields(expectedResult));
  });

  it('should activate registration', () => {
    const expectedResult = expectedRegistration({
      status: 'REGISTERED',
      activationExpirationDate: '',
      checkUrl: '',
      activationDate: testData.constants.dates.FAKE_NOW,
      activationCode: '',
      token: 'token',
      refreshToken: 'refresh token',
      tokenExpirationDate: testData.constants.dates.DATE_1,
      refreshTokenExpirationDate: testData.constants.dates.DATE_2,
      // the key pair is replaced when the refresh token would have expired
      cipherKeyRotationDate: testData.constants.dates.DATE_2
    });

    repository.activate(testData.constants.dates.FAKE_NOW, {
      token: 'token',
      refreshToken: 'refresh token',
      tokenExpirationDate: testData.constants.dates.DATE_1,
      refreshTokenExpirationDate: testData.constants.dates.DATE_2
    });

    assert.deepStrictEqual(stripAuditFields(repository.get()), stripAuditFields(expectedResult));
  });

  it('should update the tokens', () => {
    repository.updateTokens({
      token: 'new token',
      refreshToken: 'new refresh token',
      tokenExpirationDate: testData.constants.dates.DATE_3,
      refreshTokenExpirationDate: testData.constants.dates.FAKE_NOW
    });

    const result = repository.get()!;
    assert.strictEqual(result.token, 'new token');
    assert.strictEqual(result.refreshToken, 'new refresh token');
    assert.strictEqual(result.tokenExpirationDate, testData.constants.dates.DATE_3);
    assert.strictEqual(result.refreshTokenExpirationDate, testData.constants.dates.FAKE_NOW);
    assert.strictEqual(result.status, 'REGISTERED');
  });

  it('should unregister', () => {
    const expectedResult = expectedRegistration({
      status: 'NOT_REGISTERED',
      activationExpirationDate: '',
      checkUrl: '',
      activationDate: '',
      activationCode: '',
      token: '',
      refreshToken: null,
      tokenExpirationDate: null,
      refreshTokenExpirationDate: null,
      // the keys are kept (a new registration replaces them), with the rotation date set by the activation
      cipherKeyRotationDate: testData.constants.dates.DATE_2
    });

    repository.unregister();

    assert.deepStrictEqual(stripAuditFields(repository.get()), stripAuditFields(expectedResult));
  });

  it('should update registration', () => {
    const specificCommand = {
      ...testData.oIAnalytics.registration.command,
      acceptUnauthorized: false,
      useProxy: true,
      proxyUrl: 'http://localhost:9000',
      proxyUsername: 'oibus',
      proxyPassword: 'pass'
    };
    repository.update(specificCommand, testData.users.list[0].id);

    const result = repository.get()!;
    assert.strictEqual(result.useProxy, specificCommand.useProxy);
    assert.strictEqual(result.proxyUrl, specificCommand.proxyUrl);
    assert.strictEqual(result.proxyUsername, specificCommand.proxyUsername);
    assert.strictEqual(result.proxyPassword, specificCommand.proxyPassword);

    const { previousState, newState } = onlyRegistrationUpdate(result.id);
    assert.strictEqual(previousState.publicCipherKey, '');
    assert.strictEqual(previousState.privateCipherKey, '');
    assert.strictEqual(newState.publicCipherKey, '');
    assert.strictEqual(newState.privateCipherKey, '');
    // The token, proxy password and api gateway header value must never be persisted in the audit trail:
    // only a change of the proxy password is recorded
    assert.strictEqual(previousState.token, '');
    assert.strictEqual(previousState.refreshToken, '');
    assert.strictEqual(previousState.proxyPassword, '');
    assert.strictEqual(previousState.apiGatewayHeaderValue, '');
    assert.strictEqual(newState.token, '');
    assert.strictEqual(newState.refreshToken, '');
    assert.strictEqual(newState.proxyPassword, '<changed>');
    assert.strictEqual(newState.apiGatewayHeaderValue, '');
    // Unrelated fields pass through unchanged
    assert.strictEqual(newState.useProxy, specificCommand.useProxy);
    assert.strictEqual(newState.proxyUrl, specificCommand.proxyUrl);
    assert.strictEqual(newState.proxyUsername, specificCommand.proxyUsername);
  });

  it('should rotate keys, keeping the current private key as the previous one, without auditing it', () => {
    const before = repository.get()!;

    repository.rotateKeys('new public key', 'new private key', testData.constants.dates.DATE_3);

    const result = repository.get()!;
    assert.strictEqual(result.publicCipherKey, 'new public key');
    assert.strictEqual(result.privateCipherKey, 'new private key');
    assert.strictEqual(result.previousPrivateCipherKey, before.privateCipherKey);
    assert.strictEqual(result.cipherKeyRotationDate, testData.constants.dates.DATE_3);
    // OIBus rotates its keys by itself: no user is involved
    assert.strictEqual(result.updatedBy, before.updatedBy);
    assert.strictEqual(result.updatedAt, before.updatedAt);
    assert.strictEqual(auditService.record.mock.callCount(), 0);
  });

  it('should redact the previous private key from the audit trail', () => {
    repository.rotateKeys('new public key', 'new private key', testData.constants.dates.DATE_3);

    repository.update(testData.oIAnalytics.registration.command, testData.users.list[0].id);

    const { previousState, newState } = onlyRegistrationUpdate(repository.get()!.id);
    assert.strictEqual(previousState.previousPrivateCipherKey, '');
    assert.strictEqual(newState.previousPrivateCipherKey, '');
  });
});

describe('OianalyticsRegistrationRepository with empty database', () => {
  before(async () => {
    database = await initDatabase('config', false, TEST_DB_PATH);
  });

  after(async () => {
    database.close();
    await emptyDatabase('config', TEST_DB_PATH);
  });

  it('should properly init registration settings table', () => {
    const repository = new OianalyticsRegistrationRepository(database, createAuditServiceMock());
    const result = stripAuditFields(repository.get());

    assert.ok(result);
    assert.strictEqual(result.host, '');
    assert.strictEqual(result.status, 'NOT_REGISTERED');
    assert.strictEqual(result.acceptUnauthorized, false);
    assert.strictEqual(result.useProxy, false);
    assert.strictEqual(result.commandRefreshInterval, 60);
    assert.strictEqual(result.commandRetryInterval, 5);
    assert.strictEqual(result.messageRetryInterval, 5);
    assert.deepStrictEqual(result.commandPermissions, {
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
    });
  });
});
