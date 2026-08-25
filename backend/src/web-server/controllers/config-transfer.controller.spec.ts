import { describe, it, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { CustomExpressRequest } from '../express';
import { fixTsoaModuleResolution, reloadModule, createMockServices } from '../../tests/utils/test-utils';
import ConfigTransferServiceMock from '../../tests/__mocks__/service/config-transfer-service.mock';
import { ConfigExportEnvelopeDTO } from '../../../shared/model/config-transfer.model';
import type { ConfigTransferController as ConfigTransferControllerShape } from './config-transfer.controller';

const nodeRequire = createRequire(import.meta.url);

let ConfigTransferController: typeof ConfigTransferControllerShape;

before(() => {
  fixTsoaModuleResolution(nodeRequire);
  const mod = reloadModule<{ ConfigTransferController: typeof ConfigTransferControllerShape }>(nodeRequire, './config-transfer.controller');
  ConfigTransferController = mod.ConfigTransferController;
});

describe('ConfigTransferController', () => {
  let controller: ConfigTransferControllerShape;
  let configTransferService: ConfigTransferServiceMock;
  let mockRequest: Partial<CustomExpressRequest>;
  let mockRes: {
    attachment: ReturnType<typeof mock.fn>;
    contentType: ReturnType<typeof mock.fn>;
    status: ReturnType<typeof mock.fn>;
    send: ReturnType<typeof mock.fn>;
  };

  beforeEach(() => {
    controller = new ConfigTransferController();
    configTransferService = new ConfigTransferServiceMock();
    mockRes = {
      attachment: mock.fn(),
      contentType: mock.fn(),
      send: mock.fn(),
      status: mock.fn()
    };
    mockRes.status = mock.fn(() => mockRes);
    mockRequest = {
      services: createMockServices({ configTransferService }),
      user: { id: 'test', login: 'testUser' },
      res: mockRes as unknown as import('express').Response // partial mock of express.Response — only used properties are defined
    } as Partial<CustomExpressRequest>;
  });

  it('should export the configuration as a downloadable, secret-free JSON file', () => {
    const envelope: ConfigExportEnvelopeDTO = {
      formatVersion: 1,
      oibusVersion: '3.9.0',
      exportedAt: '2026-08-25T00:00:00.000Z',
      fullConfiguration: {} as ConfigExportEnvelopeDTO['fullConfiguration'],
      historyQueries: { historyQueries: [] }
    };
    configTransferService.exportConfiguration = mock.fn(() => envelope);

    controller.exportConfiguration(mockRequest as CustomExpressRequest);

    assert.strictEqual(configTransferService.exportConfiguration.mock.calls.length, 1);
    assert.deepStrictEqual(mockRes.attachment.mock.calls[0].arguments, ['oibus-config-export.json']);
    assert.deepStrictEqual(mockRes.contentType.mock.calls[0].arguments, ['application/json']);
    assert.deepStrictEqual(mockRes.status.mock.calls[0].arguments, [200]);
    assert.deepStrictEqual(mockRes.send.mock.calls[0].arguments, [JSON.stringify(envelope, null, 2)]);
  });
});
