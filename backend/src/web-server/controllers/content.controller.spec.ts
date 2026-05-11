import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import { CustomExpressRequest } from '../express';
import { reloadModule, fixTsoaModuleResolution, createMockServices } from '../../tests/utils/test-utils';
import OIBusServiceMock from '../../tests/__mocks__/service/oibus-service.mock';
import type { ContentController as ContentControllerShape } from './content.controller';

const nodeRequire = createRequire(import.meta.url);

let ContentController: typeof ContentControllerShape;

before(() => {
  fixTsoaModuleResolution(nodeRequire);
  const mod = reloadModule<{ ContentController: typeof ContentControllerShape }>(nodeRequire, './content.controller');
  ContentController = mod.ContentController;
});

describe('ContentController', () => {
  let controller: ContentControllerShape;
  let oIBusService: OIBusServiceMock;
  let mockRequest: Partial<CustomExpressRequest>;

  beforeEach(() => {
    oIBusService = new OIBusServiceMock();
    mockRequest = {
      services: createMockServices({ oIBusService })
    } as Partial<CustomExpressRequest>;
    controller = new ContentController();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('should wrap JSON body as any-content and add it to each north connector', async () => {
    const northId = 'northId1,northId2';
    const dataSourceId = 'dataSourceId';
    const body = { type: 'time-values', content: [] };
    oIBusService.addExternalContent = mock.fn(async () => undefined);

    await controller.addContent(northId, dataSourceId, body, mockRequest as CustomExpressRequest);

    const expectedContent = { type: 'any-content', content: JSON.stringify(body) };
    assert.strictEqual(oIBusService.addExternalContent.mock.calls.length, 2);
    assert.deepStrictEqual(oIBusService.addExternalContent.mock.calls[0].arguments, ['northId1', dataSourceId, expectedContent]);
    assert.deepStrictEqual(oIBusService.addExternalContent.mock.calls[1].arguments, ['northId2', dataSourceId, expectedContent]);
  });

  it('should add file', async () => {
    const northId = 'northId1';
    const dataSourceId = 'dataSourceId';
    const mockFile = { path: 'filePath' } as Express.Multer.File;
    oIBusService.addExternalContent = mock.fn(async () => undefined);
    const unlinkMock = mock.method(fs, 'unlink', async () => undefined);

    await controller.addFile(northId, dataSourceId, mockFile, mockRequest as CustomExpressRequest);

    assert.strictEqual(oIBusService.addExternalContent.mock.calls.length, 1);
    assert.deepStrictEqual(oIBusService.addExternalContent.mock.calls[0].arguments, [
      'northId1',
      dataSourceId,
      { type: 'any', filePath: 'filePath' }
    ]);
    assert.strictEqual(unlinkMock.mock.calls.length, 1);
    assert.strictEqual(unlinkMock.mock.calls[0].arguments[0], 'filePath');
  });

  it('should add file and not throw if unlink fails', async () => {
    const northId = 'northId1';
    const dataSourceId = 'dataSourceId';
    const mockFile = { path: 'filePath' } as Express.Multer.File;
    oIBusService.addExternalContent = mock.fn(async () => undefined);
    const unlinkMock = mock.method(fs, 'unlink', async () => {
      throw new Error('unlink error');
    });

    await assert.doesNotReject(controller.addFile(northId, dataSourceId, mockFile, mockRequest as CustomExpressRequest));

    assert.strictEqual(oIBusService.addExternalContent.mock.calls.length, 1);
    assert.strictEqual(unlinkMock.mock.calls.length, 1);
  });

  it('should throw an error if file is missing', async () => {
    const northId = 'northId1';
    const dataSourceId = 'dataSourceId';

    await assert.rejects(controller.addFile(northId, dataSourceId, undefined!, mockRequest as CustomExpressRequest), {
      message: 'Missing file'
    });
  });
});
