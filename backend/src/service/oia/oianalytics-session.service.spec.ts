import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import { ServerTrustState } from '../../../shared/model/domain/server-identity.model';
import { OIBusInteractiveSessionRequestDTO } from '../../../shared/model/oia/interactive-session.model';

import { OIAnalyticsRegistration } from '../../model/oianalytics-registration.model';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import LoggerMock from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { createMock, flushPromises, Mocked, mockModule, reloadModule } from '../../tests/utils/test-utils';
import type ConfigurationWorkflowRunService from '../configuration-workflow-run.service';
import type HistoryQueryService from '../history-query.service';
import type NorthService from '../north.service';
import type SouthService from '../south.service';
import type OIAnalyticsClient from './oianalytics-client.service';
import type OIAnalyticsRegistrationService from './oianalytics-registration.service';
import type * as SessionModule from './oianalytics-session.service';

type OIAnalyticsSessionServiceType = SessionModule.default;

const nodeRequire = createRequire(import.meta.url);

const encryptionServiceExports = { encryptionService: new EncryptionServiceMock() };
const TMP_FOLDER = path.join(os.tmpdir(), `oibus-session-service-spec-${process.pid}`);
const REGISTRATION = testData.oIAnalytics.registration.completed;
const SOUTH_SETTINGS = { host: 'localhost' } as never;

let sessionModule: typeof SessionModule;
let OIAnalyticsSessionService: typeof SessionModule.default;

let logger: LoggerMock;
let encryptionService: EncryptionServiceMock;
let registrationService: Mocked<OIAnalyticsRegistrationService>;
let client: Mocked<OIAnalyticsClient>;
let southService: Mocked<SouthService>;
let northService: Mocked<NorthService>;
let historyQueryService: Mocked<HistoryQueryService>;
let workflowRunService: Mocked<ConfigurationWorkflowRunService>;
let registration: OIAnalyticsRegistration;
let now: number;
let service: OIAnalyticsSessionServiceType;

before(async () => {
  mockModule(nodeRequire, '../encryption.service', encryptionServiceExports);
  sessionModule = reloadModule<typeof SessionModule>(nodeRequire, './oianalytics-session.service');
  OIAnalyticsSessionService = sessionModule.default;
  await fs.mkdir(TMP_FOLDER, { recursive: true });
});

after(async () => {
  await fs.rm(TMP_FOLDER, { recursive: true, force: true });
});

/** Lets the polls and the requests (not awaited by the polls) run */
async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await flushPromises();
  }
}

function request(type: OIBusInteractiveSessionRequestDTO['type'], content: unknown, id = 'request1'): OIBusInteractiveSessionRequestDTO {
  return { id, type, content, creationDate: testData.constants.dates.FAKE_NOW };
}

function southContent(southId: string | null = 'southId') {
  return { southId, southType: 'opcua', settings: SOUTH_SETTINGS };
}

/** Answers the given requests to the next poll, and none to the following ones */
function respondWith(...requests: Array<OIBusInteractiveSessionRequestDTO>) {
  client.retrieveSessionRequests.mock.mockImplementationOnce(async () => requests);
}

function completions() {
  return client.completeSessionRequest.mock.calls.map(call => call.arguments);
}

describe('OIAnalytics Session Service', () => {
  beforeEach(() => {
    mock.timers.enable({ apis: ['setTimeout'] });
    now = 0;
    mock.method(Date, 'now', () => now);
    encryptionService = encryptionServiceExports.encryptionService = new EncryptionServiceMock();
    encryptionService.decryptText.mock.mockImplementation(() => 'private key');
    encryptionService.decryptSecretsWithPrivateKey.mock.mockImplementation(
      <T>(settings: T) => ({ ...(settings as object), decrypted: true }) as T
    );
    logger = new LoggerMock();
    registration = { ...REGISTRATION };
    registrationService = createMock<OIAnalyticsRegistrationService>({ getRegistrationSettings: () => registration });
    client = createMock<OIAnalyticsClient>({ retrieveSessionRequests: async () => [] });
    southService = createMock<SouthService>({ getManifest: () => testData.south.manifest });
    northService = createMock<NorthService>();
    historyQueryService = createMock<HistoryQueryService>();
    workflowRunService = createMock<ConfigurationWorkflowRunService>();
    service = new OIAnalyticsSessionService(
      registrationService,
      client,
      southService,
      northService,
      historyQueryService,
      workflowRunService,
      logger,
      TMP_FOLDER
    );
  });

  afterEach(async () => {
    await service.stop();
    mock.timers.reset();
    mock.restoreAll();
  });

  async function openSession(): Promise<void> {
    service.open('session1');
    mock.timers.tick(0);
    await settle();
  }

  describe('polling', () => {
    it('should poll the requests of an open session at a short interval', async () => {
      await openSession();

      assert.deepStrictEqual(client.retrieveSessionRequests.mock.calls[0].arguments, [registration, 'session1']);
      assert.deepStrictEqual(service.getOpenSessionIds(), ['session1']);

      mock.timers.tick(sessionModule.SESSION_POLL_INTERVAL_MS);
      await settle();
      assert.strictEqual(client.retrieveSessionRequests.mock.calls.length, 2);
    });

    it('should not open a session twice', async () => {
      service.open('session1');
      service.open('session1');
      mock.timers.tick(0);
      await settle();

      assert.strictEqual(client.retrieveSessionRequests.mock.calls.length, 1);
    });

    it('should close a session OIAnalytics does not know anymore, with its explores', async () => {
      southService.startExplore.mock.mockImplementationOnce(async () => ({ sessionId: 'explore1', entries: [] }));
      respondWith(request('START_EXPLORE', southContent()));
      await openSession();
      client.retrieveSessionRequests.mock.mockImplementationOnce(async () => {
        throw new Error('404 - Not Found');
      });

      mock.timers.tick(sessionModule.SESSION_POLL_INTERVAL_MS);
      await settle();

      assert.deepStrictEqual(service.getOpenSessionIds(), []);
      assert.deepStrictEqual(southService.closeExplore.mock.calls[0].arguments, ['explore1']);
      mock.timers.tick(sessionModule.SESSION_POLL_INTERVAL_MS);
      await settle();
      assert.strictEqual(client.retrieveSessionRequests.mock.calls.length, 2);
    });

    it('should retry after an error, and close the session once OIAnalytics is unreachable for too long', async () => {
      client.retrieveSessionRequests.mock.mockImplementation(async () => {
        throw new Error('500 - Internal Server Error');
      });
      await openSession();

      assert.deepStrictEqual(service.getOpenSessionIds(), ['session1']);
      assert.ok(logger.warn.mock.calls[0].arguments[0].includes('500 - Internal Server Error'));

      now = sessionModule.SESSION_UNREACHABLE_TIMEOUT_MS;
      mock.timers.tick(registration.commandRetryInterval * 1000);
      await settle();

      assert.strictEqual(client.retrieveSessionRequests.mock.calls.length, 2);
      assert.deepStrictEqual(service.getOpenSessionIds(), []);
    });

    it('should close the session when OIBus is not registered anymore', async () => {
      registration = { ...REGISTRATION, status: 'NOT_REGISTERED' };

      await openSession();

      assert.strictEqual(client.retrieveSessionRequests.mock.calls.length, 0);
      assert.deepStrictEqual(service.getOpenSessionIds(), []);
    });

    it('should close the session, on OIAnalytics too, when connecting to the data sources is revoked', async () => {
      southService.startExplore.mock.mockImplementationOnce(async () => ({ sessionId: 'explore1', entries: [] }));
      respondWith(request('START_EXPLORE', southContent()));
      await openSession();
      registration = { ...REGISTRATION, commandPermissions: { ...REGISTRATION.commandPermissions, connectToDataSources: false } };

      mock.timers.tick(sessionModule.SESSION_POLL_INTERVAL_MS);
      await settle();

      assert.strictEqual(client.retrieveSessionRequests.mock.calls.length, 1);
      assert.deepStrictEqual(service.getOpenSessionIds(), []);
      assert.deepStrictEqual(southService.closeExplore.mock.calls[0].arguments, ['explore1']);
      assert.deepStrictEqual(client.closeSession.mock.calls[0].arguments, [registration, 'session1']);
    });

    it('should ignore the error of OIAnalytics when closing a session whose permission is revoked', async () => {
      registration = { ...REGISTRATION, commandPermissions: { ...REGISTRATION.commandPermissions, connectToDataSources: false } };
      client.closeSession.mock.mockImplementationOnce(async () => {
        throw new Error('404 - Not Found');
      });

      await openSession();

      assert.deepStrictEqual(service.getOpenSessionIds(), []);
      assert.ok(
        logger.debug.mock.calls.some(
          call => call.arguments[0] === 'Could not close interactive session session1 on OIAnalytics: 404 - Not Found'
        )
      );
    });
  });

  describe('requests', () => {
    it('should start an explore of a connector not saved yet, with its secrets decrypted', async () => {
      const entries = [{ id: 'node1', name: 'Node 1', type: 'container', hasChildren: true }] as never;
      southService.startExplore.mock.mockImplementationOnce(async () => ({ sessionId: 'explore1', entries }));
      respondWith(request('START_EXPLORE', southContent(null)));

      await openSession();

      assert.deepStrictEqual(encryptionService.decryptSecretsWithPrivateKey.mock.calls[0].arguments, [
        SOUTH_SETTINGS,
        testData.south.manifest.settings,
        ['private key']
      ]);
      assert.deepStrictEqual(southService.startExplore.mock.calls[0].arguments, [
        'create',
        'opcua',
        { host: 'localhost', decrypted: true },
        null
      ]);
      assert.deepStrictEqual(completions(), [
        [registration, 'session1', 'request1', { status: 'COMPLETED', result: { exploreId: 'explore1', entries } }]
      ]);
    });

    it('should browse and close an explore of the session', async () => {
      southService.startExplore.mock.mockImplementationOnce(async () => ({ sessionId: 'explore1', entries: [] }));
      southService.browseExplore.mock.mockImplementationOnce(async () => ({ entries: [] }));
      respondWith(
        request('START_EXPLORE', southContent(), 'start'),
        request('BROWSE', { exploreId: 'explore1', parentId: 'node1' }, 'browse')
      );
      await openSession();
      // the browse ran concurrently with the start: it did not know the explore yet
      assert.deepStrictEqual(completions()[0], [
        registration,
        'session1',
        'browse',
        { status: 'ERRORED', result: 'Explore "explore1" not found in interactive session session1' }
      ]);

      respondWith(
        request('BROWSE', { exploreId: 'explore1', parentId: 'node1' }, 'browse2'),
        request('CLOSE_EXPLORE', { exploreId: 'explore1' }, 'close')
      );
      mock.timers.tick(sessionModule.SESSION_POLL_INTERVAL_MS);
      await settle();

      assert.deepStrictEqual(southService.browseExplore.mock.calls[0].arguments, ['explore1', 'node1']);
      assert.deepStrictEqual(southService.closeExplore.mock.calls[0].arguments, ['explore1']);
      assert.deepStrictEqual(completions().slice(2), [
        [registration, 'session1', 'browse2', { status: 'COMPLETED', result: { entries: [] } }],
        [registration, 'session1', 'close', { status: 'COMPLETED', result: null }]
      ]);
    });

    it('should not browse an explore of another session', async () => {
      respondWith(request('BROWSE', { exploreId: 'localExplore', parentId: null }));

      await openSession();

      assert.strictEqual(southService.browseExplore.mock.calls.length, 0);
      assert.deepStrictEqual(completions(), [
        [
          registration,
          'session1',
          'request1',
          { status: 'ERRORED', result: 'Explore "localExplore" not found in interactive session session1' }
        ]
      ]);
    });

    it('should close an explore started after its session was closed', async () => {
      let resolveExplore: (value: { sessionId: string; entries: [] }) => void = () => undefined;
      southService.startExplore.mock.mockImplementationOnce(() => new Promise(resolve => (resolveExplore = resolve)));
      respondWith(request('START_EXPLORE', southContent()));
      await openSession();

      await service.stop();
      resolveExplore({ sessionId: 'explore1', entries: [] });
      await settle();

      assert.deepStrictEqual(southService.closeExplore.mock.calls[0].arguments, ['explore1']);
      assert.deepStrictEqual(completions(), [
        [registration, 'session1', 'request1', { status: 'ERRORED', result: 'Interactive session session1 closed' }]
      ]);
    });

    it('should test the connection of a south connector', async () => {
      const result = { items: [] } as never;
      southService.testSouth.mock.mockImplementationOnce(async () => result);
      respondWith(request('TEST_SOUTH_CONNECTION', southContent()));

      await openSession();

      // with the identity of a server not trusted, which OIAnalytics shows for the user to review it
      assert.deepStrictEqual(southService.testSouth.mock.calls[0].arguments, [
        'southId',
        'opcua',
        { host: 'localhost', decrypted: true },
        null,
        null,
        true
      ]);
      assert.deepStrictEqual(completions(), [[registration, 'session1', 'request1', { status: 'COMPLETED', result }]]);
    });

    it('should trust the identity trusted in the form of the connector when testing, exploring and previewing', async () => {
      southService.testSouth.mock.mockImplementation(async () => ({ items: [] }));
      southService.startExplore.mock.mockImplementation(async () => ({ sessionId: 'explore1', entries: [] }));
      southService.testItem.mock.mockImplementation(async () => ({}) as never);
      workflowRunService.previewCommand.mock.mockImplementation(async () => ({}) as never);
      const content = { ...southContent(), trustedFingerprint: 'SHA256:form' };
      respondWith(
        request('TEST_SOUTH_CONNECTION', content, 'test'),
        request('START_EXPLORE', content, 'explore'),
        request('TEST_SOUTH_ITEM', { ...content, itemName: 'item', itemSettings: {}, testingSettings: {} }, 'item'),
        request('PREVIEW_WORKFLOW', { ...content, workflowId: null, workflow: {} }, 'preview')
      );

      await openSession();

      assert.strictEqual(southService.testSouth.mock.calls[0].arguments[3], 'SHA256:form');
      assert.strictEqual(southService.startExplore.mock.calls[0].arguments[3], 'SHA256:form');
      assert.strictEqual(southService.testItem.mock.calls[0].arguments[7], 'SHA256:form');
      assert.strictEqual(workflowRunService.previewCommand.mock.calls[0].arguments[5], 'SHA256:form');
    });

    it('should test an item, with the secrets of the item decrypted', async () => {
      const result = { raw: { type: 'any', content: '' }, transformed: null, connectionDuration: 1, queryDuration: 2 } as never;
      southService.testItem.mock.mockImplementationOnce(async () => result);
      const testingSettings = { history: undefined } as never;
      respondWith(
        request('TEST_SOUTH_ITEM', { ...southContent(), itemName: 'item', itemSettings: { query: 'SELECT 1' }, testingSettings })
      );

      await openSession();

      assert.deepStrictEqual(southService.testItem.mock.calls[0].arguments, [
        'southId',
        'opcua',
        'item',
        { host: 'localhost', decrypted: true },
        { query: 'SELECT 1', decrypted: true },
        testingSettings,
        undefined,
        null
      ]);
      assert.deepStrictEqual(completions(), [[registration, 'session1', 'request1', { status: 'COMPLETED', result }]]);
    });

    it('should preview a configuration workflow', async () => {
      const result = { records: [] } as never;
      const workflow = { name: 'workflow' } as never;
      workflowRunService.previewCommand.mock.mockImplementationOnce(async () => result);
      respondWith(request('PREVIEW_WORKFLOW', { ...southContent(), workflowId: 'workflowId', workflow }));

      await openSession();

      assert.deepStrictEqual(workflowRunService.previewCommand.mock.calls[0].arguments, [
        'southId',
        'opcua',
        { host: 'localhost', decrypted: true },
        'workflowId',
        workflow,
        null
      ]);
      assert.deepStrictEqual(completions(), [[registration, 'session1', 'request1', { status: 'COMPLETED', result }]]);
    });

    it('should send the trust of a connector, or of a side of a history query, in the identity of its server', async () => {
      const southTrust: ServerTrustState = { identity: null, trustOnFirstUse: false, pending: null };
      const northTrust: ServerTrustState = {
        identity: null,
        trustOnFirstUse: false,
        pending: { identity: { type: 'ssh-host-key', fingerprint: 'SHA256:north', details: { keyType: 'ssh-ed25519' } }, status: 'unknown' }
      };
      const historyTrust: ServerTrustState = { identity: null, trustOnFirstUse: true, pending: null };
      southService.getServerTrustState.mock.mockImplementation(() => southTrust);
      northService.getServerTrustState.mock.mockImplementation(() => northTrust);
      historyQueryService.getServerTrustState.mock.mockImplementation(() => historyTrust);
      respondWith(
        request('GET_SERVER_TRUST', { target: 'south', id: 'southId' }, 'south'),
        request('GET_SERVER_TRUST', { target: 'north', id: 'northId' }, 'north'),
        request('GET_SERVER_TRUST', { target: 'history-query', id: 'historyId', side: 'south' }, 'history'),
        request('GET_SERVER_TRUST', { target: 'history-query', id: 'historyId' }, 'no-side')
      );

      await openSession();

      assert.deepStrictEqual(southService.getServerTrustState.mock.calls[0].arguments, ['southId']);
      assert.deepStrictEqual(northService.getServerTrustState.mock.calls[0].arguments, ['northId']);
      assert.deepStrictEqual(
        historyQueryService.getServerTrustState.mock.calls.map(call => call.arguments),
        [['historyId', 'south']]
      );
      assert.deepStrictEqual(
        completions().map(([, , id, completion]) => [id, completion]),
        [
          ['south', { status: 'COMPLETED', result: southTrust }],
          ['north', { status: 'COMPLETED', result: northTrust }],
          ['history', { status: 'COMPLETED', result: historyTrust }],
          ['no-side', { status: 'ERRORED', result: 'The side of history query "historyId" whose server is concerned is missing' }]
        ]
      );
    });

    it('should trust the identity of the server of a connector, or of a side of a history query, by OIAnalytics', async () => {
      respondWith(
        request('TRUST_SERVER_IDENTITY', { target: 'south', id: 'southId', fingerprint: 'SHA256:south' }, 'south'),
        request('TRUST_SERVER_IDENTITY', { target: 'north', id: 'northId', fingerprint: 'SHA256:north' }, 'north'),
        request(
          'TRUST_SERVER_IDENTITY',
          { target: 'history-query', id: 'historyId', side: 'north', fingerprint: 'SHA256:history' },
          'history'
        )
      );

      await openSession();

      assert.deepStrictEqual(southService.trustServerIdentity.mock.calls[0].arguments, ['southId', 'SHA256:south', 'oianalytics']);
      assert.deepStrictEqual(northService.trustServerIdentity.mock.calls[0].arguments, ['northId', 'SHA256:north', 'oianalytics']);
      assert.deepStrictEqual(historyQueryService.trustServerIdentity.mock.calls[0].arguments, [
        'historyId',
        'north',
        'SHA256:history',
        'oianalytics'
      ]);
      assert.deepStrictEqual(
        completions().map(([, , id, completion]) => [id, completion]),
        [
          ['south', { status: 'COMPLETED', result: null }],
          ['north', { status: 'COMPLETED', result: null }],
          ['history', { status: 'COMPLETED', result: null }]
        ]
      );
    });

    it('should not trust the identity of a server without the side of a history query, nor of another target', async () => {
      respondWith(
        request('TRUST_SERVER_IDENTITY', { target: 'history-query', id: 'historyId', fingerprint: 'SHA256:history' }, 'history'),
        request('TRUST_SERVER_IDENTITY', { target: 'engine', id: 'engineId', fingerprint: 'SHA256:engine' }, 'engine')
      );

      await openSession();

      assert.strictEqual(historyQueryService.trustServerIdentity.mock.calls.length, 0);
      assert.deepStrictEqual(
        completions().map(([, , id, completion]) => [id, completion]),
        [
          ['history', { status: 'ERRORED', result: 'The side of history query "historyId" whose server is concerned is missing' }],
          ['engine', { status: 'ERRORED', result: 'Unknown target "engine" of a server trust request' }]
        ]
      );
    });

    it('should not trust the identity of a server when OIAnalytics is not allowed to configure the data flow', async () => {
      registration = { ...REGISTRATION, commandPermissions: { ...REGISTRATION.commandPermissions, configureDataFlow: false } };
      southService.testSouth.mock.mockImplementation(async () => ({ items: [] }));
      respondWith(
        request('TRUST_SERVER_IDENTITY', { target: 'south', id: 'southId', fingerprint: 'SHA256:south' }, 'trust'),
        request('TEST_SOUTH_CONNECTION', southContent(), 'test')
      );

      await openSession();

      assert.strictEqual(southService.trustServerIdentity.mock.calls.length, 0);
      assert.deepStrictEqual(
        completions().map(([, , id, completion]) => [id, completion]),
        [
          [
            'trust',
            {
              status: 'ERRORED',
              result: 'OIAnalytics is not allowed to request TRUST_SERVER_IDENTITY: it requires the permission configureDataFlow'
            }
          ],
          // the review of the identity only requires connecting to the data sources
          ['test', { status: 'COMPLETED', result: { items: [] } }]
        ]
      );
    });

    it('should not execute an unsupported request', async () => {
      respondWith(request('UNKNOWN' as never, {}));

      await openSession();

      assert.deepStrictEqual(completions(), [
        [registration, 'session1', 'request1', { status: 'ERRORED', result: 'Interactive session request type "UNKNOWN" not supported' }]
      ]);
    });

    it('should upload a result too large to be sent inline', async () => {
      const result = { records: ['a'.repeat(sessionModule.MAX_INLINE_RESULT_LENGTH)] } as never;
      workflowRunService.previewCommand.mock.mockImplementationOnce(async () => result);
      let uploadedContent = '';
      client.uploadSessionRequestFile.mock.mockImplementationOnce(async (_registration, _sessionId, _requestId, filePath) => {
        uploadedContent = await fs.readFile(filePath, 'utf8');
      });
      respondWith(request('PREVIEW_WORKFLOW', { ...southContent(), workflowId: null, workflow: {} }));

      await openSession();
      // the file is written to and removed from the disk
      const deadline = performance.now() + 5000;
      while (client.completeSessionRequest.mock.calls.length === 0 && performance.now() < deadline) {
        await flushPromises();
      }

      const [, sessionId, requestId, filePath, fileName] = client.uploadSessionRequestFile.mock.calls[0].arguments;
      assert.deepStrictEqual([sessionId, requestId, fileName], ['session1', 'request1', 'preview-workflow-result.json']);
      assert.strictEqual(uploadedContent, JSON.stringify(result));
      await assert.rejects(fs.access(filePath));
      assert.deepStrictEqual(completions(), [
        [
          registration,
          'session1',
          'request1',
          { status: 'COMPLETED', result: { fileName: 'preview-workflow-result.json', size: JSON.stringify(result).length } }
        ]
      ]);
    });

    it('should log the error when a result cannot be sent', async () => {
      client.completeSessionRequest.mock.mockImplementationOnce(async () => {
        throw new Error('400 - Bad Request');
      });
      respondWith(request('UNKNOWN' as never, {}));

      await openSession();

      assert.deepStrictEqual(logger.error.mock.calls[0].arguments, [
        'Error while executing request request1 of interactive session session1: 400 - Bad Request'
      ]);
    });
  });

  describe('stop', () => {
    it('should close every session on OIAnalytics and their explores', async () => {
      southService.startExplore.mock.mockImplementationOnce(async () => ({ sessionId: 'explore1', entries: [] }));
      respondWith(request('START_EXPLORE', southContent()));
      await openSession();

      await service.stop();

      assert.deepStrictEqual(service.getOpenSessionIds(), []);
      assert.deepStrictEqual(southService.closeExplore.mock.calls[0].arguments, ['explore1']);
      assert.deepStrictEqual(client.closeSession.mock.calls[0].arguments, [registration, 'session1']);
      mock.timers.tick(sessionModule.SESSION_POLL_INTERVAL_MS);
      await settle();
      assert.strictEqual(client.retrieveSessionRequests.mock.calls.length, 1);
    });

    it('should ignore the errors when closing a session', async () => {
      southService.startExplore.mock.mockImplementationOnce(async () => ({ sessionId: 'explore1', entries: [] }));
      southService.closeExplore.mock.mockImplementationOnce(async () => {
        throw new Error('explore error');
      });
      client.closeSession.mock.mockImplementationOnce(async () => {
        throw new Error('404 - Not Found');
      });
      respondWith(request('START_EXPLORE', southContent()));
      await openSession();

      await service.stop();

      assert.deepStrictEqual(service.getOpenSessionIds(), []);
      assert.strictEqual(logger.debug.mock.calls.filter(call => call.arguments[0].startsWith('Could not close')).length, 2);
    });

    it('should not call OIAnalytics when OIBus is not registered anymore', async () => {
      await openSession();
      registration = { ...REGISTRATION, status: 'NOT_REGISTERED' };

      await service.stop();

      assert.strictEqual(client.closeSession.mock.calls.length, 0);
    });
  });

  it('should change logger', async () => {
    const anotherLogger = new LoggerMock();
    service.setLogger(anotherLogger);

    await openSession();

    assert.strictEqual(logger.info.mock.calls.length, 0);
    assert.deepStrictEqual(anotherLogger.info.mock.calls[0].arguments, ['Interactive session session1 opened']);
  });
});
