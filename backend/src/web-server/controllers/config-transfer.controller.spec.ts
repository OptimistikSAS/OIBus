import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import type express from 'express';

import { ConfigExportDTO, ConfigImportPreviewDTO, ConfigImportResponseDTO } from '../../../shared/model/oia/config-transfer.model';

import type ConfigImportService from '../../service/config-transfer/config-import.service';
import { ConfigImportError } from '../../service/config-transfer/config-import.service';
import type ConfigTransferService from '../../service/config-transfer/config-transfer.service';
import type OIBusService from '../../service/oibus.service';
import { createMock, createMockServices, fixTsoaModuleResolution, Mocked, reloadModule } from '../../tests/utils/test-utils';
import { CustomExpressRequest } from '../express';
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
  let configTransferService: Mocked<ConfigTransferService>;
  let configImportService: Mocked<ConfigImportService>;
  let oIBusService: Mocked<OIBusService>;
  let mockRequest: Partial<CustomExpressRequest>;
  let mockRes: Mocked<express.Response>;

  beforeEach(() => {
    controller = new ConfigTransferController();
    configTransferService = createMock<ConfigTransferService>();
    configImportService = createMock<ConfigImportService>();
    oIBusService = createMock<OIBusService>();
    mockRes = createMock<express.Response>();
    mockRes.status.mock.mockImplementation(() => mockRes);
    mockRequest = {
      services: createMockServices({ configTransferService, configImportService, oIBusService }),
      user: { id: 'test', login: 'testUser' },
      res: mockRes
    };
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('should export the configuration as a downloadable, secret-free JSON file', () => {
    const envelope: ConfigExportDTO = {
      oibusVersion: '3.10.0',
      exportedAt: '2026-08-25T00:00:00.000Z',
      config: {} as ConfigExportDTO['config']
    };
    configTransferService.exportConfiguration.mock.mockImplementation(() => envelope);

    controller.exportConfiguration(mockRequest as CustomExpressRequest);

    assert.strictEqual(configTransferService.exportConfiguration.mock.calls.length, 1);
    assert.deepStrictEqual(mockRes.attachment.mock.calls[0].arguments, ['oibus-config-export.json']);
    assert.deepStrictEqual(mockRes.contentType.mock.calls[0].arguments, ['application/json']);
    assert.deepStrictEqual(mockRes.status.mock.calls[0].arguments, [200]);
    assert.deepStrictEqual(mockRes.send.mock.calls[0].arguments, [JSON.stringify(envelope, null, 2)]);
  });

  describe('previewConfiguration', () => {
    const file = { path: 'previewPath' } as Express.Multer.File;

    it('should preview a well-formed export file, clean up the temp file and not restart', async () => {
      const parsedEnvelope = { oibusVersion: '3.10.0' };
      const preview: ConfigImportPreviewDTO = {
        fromVersion: '3.10.0',
        toVersion: '3.10.1',
        appliedUpgrades: [{ version: '3.10.1', description: 'an upgrade' }],
        config: {} as ConfigImportPreviewDTO['config']
      };
      mock.method(fs, 'readFile', async () => JSON.stringify(parsedEnvelope));
      const unlinkMock = mock.method(fs, 'unlink', async () => undefined);
      configImportService.previewConfiguration.mock.mockImplementation(async () => preview);

      const result = await controller.previewConfiguration(file, mockRequest as CustomExpressRequest);

      assert.deepStrictEqual(configImportService.previewConfiguration.mock.calls[0].arguments, [parsedEnvelope]);
      assert.deepStrictEqual(unlinkMock.mock.calls[0].arguments, ['previewPath']);
      assert.deepStrictEqual(result, preview);
      assert.strictEqual(configImportService.importConfiguration.mock.calls.length, 0);
      assert.strictEqual(oIBusService.restart.mock.calls.length, 0);
    });

    it('should reject with a validation error when the file is missing', async () => {
      await assert.rejects(controller.previewConfiguration(undefined!, mockRequest as CustomExpressRequest), {
        message: 'Missing file "file"'
      });
    });

    it('should reject with a validation error when the file is not valid JSON', async () => {
      mock.method(fs, 'readFile', async () => 'not json{');
      const unlinkMock = mock.method(fs, 'unlink', async () => undefined);

      await assert.rejects(controller.previewConfiguration(file, mockRequest as CustomExpressRequest), {
        message: 'Uploaded file is not valid JSON'
      });
      assert.strictEqual(unlinkMock.mock.calls.length, 1);
    });
  });

  describe('importConfiguration', () => {
    const file = { path: 'importPath' } as Express.Multer.File;

    it('should import a well-formed export file and clean up the temp file', async () => {
      const parsedEnvelope = { oibusVersion: '3.10.0' };
      const response: ConfigImportResponseDTO = {
        fromVersion: '3.10.0',
        toVersion: '3.10.1',
        appliedUpgrades: [{ version: '3.10.1', description: 'an upgrade' }],
        warnings: ['a warning'],
        newPort: null,
        newProtocol: null
      };
      const readFileMock = mock.method(fs, 'readFile', async () => JSON.stringify(parsedEnvelope));
      const unlinkMock = mock.method(fs, 'unlink', async () => undefined);
      configImportService.importConfiguration.mock.mockImplementation(async () => response);

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
      await assert.rejects(controller.importConfiguration(undefined!, mockRequest as CustomExpressRequest), {
        message: 'Missing file "file"'
      });
    });

    it('should reject with a validation error when the file is not valid JSON', async () => {
      mock.method(fs, 'readFile', async () => 'not json{');
      const unlinkMock = mock.method(fs, 'unlink', async () => undefined);

      await assert.rejects(controller.importConfiguration(file, mockRequest as CustomExpressRequest), {
        message: 'Uploaded file is not valid JSON'
      });
      // The temp file must still be cleaned up even though parsing failed.
      assert.strictEqual(unlinkMock.mock.calls.length, 1);
    });

    it('should propagate a ConfigImportError (e.g. format-too-new / failed validation) without swallowing it', async () => {
      mock.method(fs, 'readFile', async () => '{}');
      const unlinkMock = mock.method(fs, 'unlink', async () => undefined);
      const importError = new ConfigImportError('Unsupported export format version 2', []);
      configImportService.importConfiguration.mock.mockImplementation(async () => {
        throw importError;
      });

      await assert.rejects(controller.importConfiguration(file, mockRequest as CustomExpressRequest), importError);
      assert.strictEqual(unlinkMock.mock.calls.length, 1);
      // Nothing was written, so the engine must not restart.
      assert.strictEqual(oIBusService.restart.mock.calls.length, 0);
    });

    it('should still unlink the temp file when import fails for a reason other than ConfigImportError', async () => {
      mock.method(fs, 'readFile', async () => '{}');
      const unlinkMock = mock.method(fs, 'unlink', async () => undefined);
      configImportService.importConfiguration.mock.mockImplementation(async () => {
        throw new Error('unexpected failure');
      });

      await assert.rejects(controller.importConfiguration(file, mockRequest as CustomExpressRequest), { message: 'unexpected failure' });
      assert.strictEqual(unlinkMock.mock.calls.length, 1);
    });

    it('should not fail the request if unlinking the temp file itself throws', async () => {
      mock.method(fs, 'readFile', async () => '{}');
      mock.method(fs, 'unlink', async () => {
        throw new Error('unlink failed');
      });
      const response: ConfigImportResponseDTO = {
        fromVersion: '3.10.0',
        toVersion: '3.10.0',
        appliedUpgrades: [],
        warnings: [],
        newPort: null,
        newProtocol: null
      };
      configImportService.importConfiguration.mock.mockImplementation(async () => response);

      const result = await controller.importConfiguration(file, mockRequest as CustomExpressRequest);
      assert.deepStrictEqual(result, response);
    });
  });
});
