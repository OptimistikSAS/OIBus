import { describe, it, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import { CustomExpressRequest } from '../express';
import { fixTsoaModuleResolution, reloadModule, createMockServices } from '../../tests/utils/test-utils';
import ConfigTransferServiceMock from '../../tests/__mocks__/service/config-transfer-service.mock';
import ConfigImportServiceMock from '../../tests/__mocks__/service/config-import-service.mock';
import OIBusServiceMock from '../../tests/__mocks__/service/oibus-service.mock';
import { ConfigExportEnvelopeDTO, ConfigImportResponseDTO } from '../../../shared/model/config-transfer.model';
import { ConfigImportError } from '../../service/config-transfer/config-import.service';
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
  let configImportService: ConfigImportServiceMock;
  let oIBusService: OIBusServiceMock;
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
    configImportService = new ConfigImportServiceMock();
    oIBusService = new OIBusServiceMock();
    mockRes = {
      attachment: mock.fn(),
      contentType: mock.fn(),
      send: mock.fn(),
      status: mock.fn()
    };
    mockRes.status = mock.fn(() => mockRes);
    mockRequest = {
      services: createMockServices({ configTransferService, configImportService, oIBusService }),
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

  describe('importConfiguration', () => {
    it('should import a well-formed export file and clean up the temp file', async () => {
      const file = { path: 'importPath' } as Express.Multer.File;
      const parsedEnvelope = { formatVersion: 1 };
      const response: ConfigImportResponseDTO = { appliedUpgrades: [{ scope: 'south:opcua', version: '3.9.0' }], warnings: ['a warning'] };
      const readFileMock = mock.method(fs, 'readFile', async () => JSON.stringify(parsedEnvelope));
      const unlinkMock = mock.method(fs, 'unlink', async () => undefined);
      configImportService.importConfiguration = mock.fn(async () => response);

      const result = await controller.importConfiguration(file, mockRequest as CustomExpressRequest);

      assert.strictEqual(readFileMock.mock.calls.length, 1);
      assert.strictEqual(configImportService.importConfiguration.mock.calls.length, 1);
      assert.deepStrictEqual(configImportService.importConfiguration.mock.calls[0].arguments, [parsedEnvelope, 'test']);
      assert.strictEqual(unlinkMock.mock.calls.length, 1);
      assert.deepStrictEqual(unlinkMock.mock.calls[0].arguments, ['importPath']);
      assert.deepStrictEqual(result, response);
      // The engine must restart on a successful import so the running south/north connectors and
      // history queries pick up the newly wiped+recreated configuration.
      assert.strictEqual(oIBusService.restart.mock.calls.length, 1);
    });

    it('should reject with a validation error when the file is missing', async () => {
      await assert.rejects(
        controller.importConfiguration(undefined as unknown as Express.Multer.File, mockRequest as CustomExpressRequest),
        { message: 'Missing file "file"' }
      );
    });

    it('should reject with a validation error when the file is not valid JSON', async () => {
      const file = { path: 'importPath' } as Express.Multer.File;
      mock.method(fs, 'readFile', async () => 'not json{');
      const unlinkMock = mock.method(fs, 'unlink', async () => undefined);

      await assert.rejects(controller.importConfiguration(file, mockRequest as CustomExpressRequest), {
        message: 'Uploaded file is not valid JSON'
      });
      // The temp file must still be cleaned up even though parsing failed.
      assert.strictEqual(unlinkMock.mock.calls.length, 1);
    });

    it('should propagate a ConfigImportError (e.g. format-too-new / failed validation) without swallowing it', async () => {
      const file = { path: 'importPath' } as Express.Multer.File;
      mock.method(fs, 'readFile', async () => '{}');
      const unlinkMock = mock.method(fs, 'unlink', async () => undefined);
      const importError = new ConfigImportError('Unsupported export format version 2', []);
      configImportService.importConfiguration = mock.fn(async () => {
        throw importError;
      });

      await assert.rejects(controller.importConfiguration(file, mockRequest as CustomExpressRequest), importError);
      assert.strictEqual(unlinkMock.mock.calls.length, 1);
      // Nothing was written, so the engine must not restart.
      assert.strictEqual(oIBusService.restart.mock.calls.length, 0);
    });

    it('should still unlink the temp file when import fails for a reason other than ConfigImportError', async () => {
      const file = { path: 'importPath' } as Express.Multer.File;
      mock.method(fs, 'readFile', async () => '{}');
      const unlinkMock = mock.method(fs, 'unlink', async () => undefined);
      configImportService.importConfiguration = mock.fn(async () => {
        throw new Error('unexpected failure');
      });

      await assert.rejects(controller.importConfiguration(file, mockRequest as CustomExpressRequest), { message: 'unexpected failure' });
      assert.strictEqual(unlinkMock.mock.calls.length, 1);
    });

    it('should not fail the request if unlinking the temp file itself throws', async () => {
      const file = { path: 'importPath' } as Express.Multer.File;
      mock.method(fs, 'readFile', async () => '{}');
      mock.method(fs, 'unlink', async () => {
        throw new Error('unlink failed');
      });
      const response: ConfigImportResponseDTO = { appliedUpgrades: [], warnings: [] };
      configImportService.importConfiguration = mock.fn(async () => response);

      const result = await controller.importConfiguration(file, mockRequest as CustomExpressRequest);
      assert.deepStrictEqual(result, response);
    });
  });
});
