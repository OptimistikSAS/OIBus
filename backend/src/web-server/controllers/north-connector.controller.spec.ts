import NorthConnectorController from './north-connector.controller';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';
import JoiValidator from './validators/joi.validator';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { toNorthConnectorDTO, toNorthConnectorItemDTO, toNorthConnectorLightDTO } from '../../service/north.service';
import { northItemToFlattenedCSV } from '../../service/utils';

jest.mock('./validators/joi.validator');
jest.mock('../../service/utils');

const logger: pino.Logger = new PinoLogger();
const ctx = new KoaContextMock();
const validator = new JoiValidator();
const northConnectorController = new NorthConnectorController(validator);

describe('North connector controller', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
  });

  it('getNorthConnectorTypes() should return North connector types', async () => {
    ctx.app.northService.getInstalledNorthManifests.mockReturnValueOnce([testData.north.manifest]);

    await northConnectorController.getNorthConnectorTypes(ctx);

    expect(ctx.ok).toHaveBeenCalledWith([
      {
        id: testData.north.manifest.id,
        category: testData.north.manifest.category,
        modes: testData.north.manifest.modes
      }
    ]);
  });

  it('getNorthConnectorManifest() should return North connector manifest', async () => {
    ctx.params.id = testData.north.manifest.id;
    ctx.app.northService.getInstalledNorthManifests.mockReturnValueOnce([testData.north.manifest]);

    await northConnectorController.getNorthConnectorManifest(ctx);

    expect(ctx.ok).toHaveBeenCalledWith(testData.north.manifest);
  });

  it('getNorthConnectorManifest() should return not found', async () => {
    ctx.params.id = 'invalid';
    ctx.app.northService.getInstalledNorthManifests.mockReturnValueOnce([testData.north.manifest]);

    await northConnectorController.getNorthConnectorManifest(ctx);

    expect(ctx.throw).toHaveBeenCalledWith(404, 'North not found');
  });

  it('findAll() should return North connectors', async () => {
    ctx.app.northService.findAll.mockReturnValueOnce(testData.north.list);

    await northConnectorController.findAll(ctx);

    expect(ctx.app.northService.findAll).toHaveBeenCalled();
    expect(ctx.ok).toHaveBeenCalledWith(testData.north.list.map(element => toNorthConnectorLightDTO(element)));
  });

  it('findById() should return North connector', async () => {
    ctx.params.id = testData.north.list[0].id;
    ctx.app.northService.findById.mockReturnValueOnce(testData.north.list[0]);

    await northConnectorController.findById(ctx);

    expect(ctx.app.northService.findById).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(ctx.ok).toHaveBeenCalledWith(toNorthConnectorDTO(testData.north.list[0], ctx.app.encryptionService));
  });

  it('findById() should return found when North connector not found', async () => {
    ctx.params.id = testData.north.list[0].id;
    ctx.app.northService.findById.mockReturnValueOnce(null);

    await northConnectorController.findById(ctx);

    expect(ctx.app.northService.findById).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('create() should create North connector', async () => {
    ctx.request.body = testData.north.command;
    ctx.app.northService.createNorth.mockReturnValueOnce(testData.north.list[0]);

    await northConnectorController.create(ctx);
    expect(ctx.app.northService.createNorth).toHaveBeenCalledWith(testData.north.command, null);
    expect(ctx.created).toHaveBeenCalledWith(toNorthConnectorDTO(testData.north.list[0], ctx.app.encryptionService));
  });

  it('create() should throw an error', async () => {
    ctx.request.body = testData.north.command;
    ctx.query.duplicate = 'northId';
    ctx.app.northService.createNorth.mockImplementationOnce(() => {
      throw new Error('error');
    });

    await northConnectorController.create(ctx);
    expect(ctx.app.northService.createNorth).toHaveBeenCalledWith(testData.north.command, 'northId');
    expect(ctx.badRequest).toHaveBeenCalledWith('error');
  });

  it('update() should update North connector', async () => {
    ctx.request.body = testData.north.command;
    ctx.params.id = testData.north.list[0].id;

    await northConnectorController.updateNorth(ctx);
    expect(ctx.app.northService.updateNorth).toHaveBeenCalledWith(testData.north.list[0].id, testData.north.command);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('update() should throw an error', async () => {
    ctx.request.body = testData.north.command;
    ctx.params.id = testData.north.list[0].id;

    ctx.app.northService.updateNorth.mockImplementationOnce(() => {
      throw new Error('error');
    });

    await northConnectorController.updateNorth(ctx);
    expect(ctx.app.northService.updateNorth).toHaveBeenCalledWith(testData.north.list[0].id, testData.north.command);
    expect(ctx.badRequest).toHaveBeenCalledWith('error');
  });

  it('delete() should delete North connector', async () => {
    ctx.params.id = testData.north.list[0].id;

    await northConnectorController.delete(ctx);
    expect(ctx.app.northService.deleteNorth).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('delete() should throw an error', async () => {
    ctx.params.id = testData.north.list[0].id;
    ctx.app.northService.deleteNorth.mockImplementationOnce(() => {
      throw new Error('error');
    });

    await northConnectorController.delete(ctx);
    expect(ctx.app.northService.deleteNorth).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(ctx.badRequest).toHaveBeenCalledWith('error');
  });

  it('start() should enable North connector', async () => {
    ctx.params.id = testData.north.list[0].id;

    await northConnectorController.start(ctx);

    expect(ctx.app.northService.startNorth).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('start() should throw an error', async () => {
    ctx.params.id = testData.north.list[0].id;
    ctx.app.northService.startNorth.mockImplementationOnce(() => {
      throw new Error('error');
    });

    await northConnectorController.start(ctx);
    expect(ctx.app.northService.startNorth).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(ctx.badRequest).toHaveBeenCalledWith('error');
  });

  it('stop() should disable North connector', async () => {
    ctx.params.id = testData.north.list[0].id;

    await northConnectorController.stop(ctx);

    expect(ctx.app.northService.stopNorth).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('stop() should throw an error', async () => {
    ctx.params.id = testData.north.list[0].id;
    ctx.app.northService.stopNorth.mockImplementationOnce(() => {
      throw new Error('error');
    });

    await northConnectorController.stop(ctx);
    expect(ctx.app.northService.stopNorth).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(ctx.badRequest).toHaveBeenCalledWith('error');
  });

  it('getErrorFiles() should get error files with default params', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.app.northService.getErrorFiles.mockReturnValueOnce([]);
    await northConnectorController.getErrorFiles(ctx);
    expect(ctx.app.northService.getErrorFiles).toHaveBeenCalledWith(testData.north.list[0].id, null, null, null);
    expect(ctx.ok).toHaveBeenCalledWith([]);
  });

  it('getErrorFiles() should get error files', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.query.start = testData.constants.dates.DATE_1;
    ctx.query.end = testData.constants.dates.DATE_2;
    ctx.query.filenameContains = 'filename';
    ctx.app.northService.getErrorFiles.mockReturnValueOnce([]);
    await northConnectorController.getErrorFiles(ctx);
    expect(ctx.app.northService.getErrorFiles).toHaveBeenCalledWith(
      testData.north.list[0].id,
      new Date(testData.constants.dates.DATE_1).toISOString(),
      new Date(testData.constants.dates.DATE_2).toISOString(),
      'filename'
    );
    expect(ctx.ok).toHaveBeenCalledWith([]);
  });

  it('getErrorFileContent() should get error file content', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.params.filename = 'my file';
    ctx.app.northService.getErrorFileContent.mockReturnValueOnce('file content');
    await northConnectorController.getErrorFileContent(ctx);
    expect(ctx.app.northService.getErrorFileContent).toHaveBeenCalledWith(testData.north.list[0].id, 'my file');
    expect(ctx.attachment).toHaveBeenCalledWith('my file');
    expect(ctx.ok).toHaveBeenCalledWith('file content');
  });

  it('getErrorFileContent() should not get error file content if null', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.params.filename = 'my file';
    ctx.app.northService.getErrorFileContent.mockReturnValueOnce(null);
    await northConnectorController.getErrorFileContent(ctx);
    expect(ctx.app.northService.getErrorFileContent).toHaveBeenCalledWith(testData.north.list[0].id, 'my file');
    expect(ctx.attachment).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('removeErrorFiles() should not remove files if body is not an array', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.request.body = 'my file';
    await northConnectorController.removeErrorFiles(ctx);
    expect(ctx.app.northService.removeErrorFiles).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith('Invalid file list');
  });

  it('removeErrorFiles() should remove error files', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.request.body = ['my file'];
    await northConnectorController.removeErrorFiles(ctx);
    expect(ctx.app.northService.removeErrorFiles).toHaveBeenCalledWith(testData.north.list[0].id, ['my file']);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('retryErrorFiles() should not retry files if body is not an array', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.request.body = 'my file';
    await northConnectorController.retryErrorFiles(ctx);
    expect(ctx.app.northService.retryErrorFiles).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith('Invalid file list');
  });

  it('retryErrorFiles() should retry error files', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.request.body = ['my file'];
    await northConnectorController.retryErrorFiles(ctx);
    expect(ctx.app.northService.retryErrorFiles).toHaveBeenCalledWith(testData.north.list[0].id, ['my file']);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('removeAllErrorFiles() should remove all error files', async () => {
    ctx.params.northId = testData.north.list[0].id;
    await northConnectorController.removeAllErrorFiles(ctx);
    expect(ctx.app.northService.removeAllErrorFiles).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('retryAllErrorFiles() should retry all error files', async () => {
    ctx.params.northId = testData.north.list[0].id;
    await northConnectorController.retryAllErrorFiles(ctx);
    expect(ctx.app.northService.retryAllErrorFiles).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('getCacheFiles() should get cache files with default params', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.query.start = null;
    ctx.query.end = null;
    ctx.query.filenameContains = null;

    ctx.app.northService.getCacheFiles.mockReturnValueOnce([]);
    await northConnectorController.getCacheFiles(ctx);
    expect(ctx.app.northService.getCacheFiles).toHaveBeenCalledWith(testData.north.list[0].id, null, null, null);
    expect(ctx.ok).toHaveBeenCalledWith([]);
  });

  it('getCacheFiles() should get cache files', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.query.start = testData.constants.dates.DATE_1;
    ctx.query.end = testData.constants.dates.DATE_2;
    ctx.query.filenameContains = 'filename';
    ctx.app.northService.getCacheFiles.mockReturnValueOnce([]);
    await northConnectorController.getCacheFiles(ctx);
    expect(ctx.app.northService.getCacheFiles).toHaveBeenCalledWith(
      testData.north.list[0].id,
      new Date(testData.constants.dates.DATE_1).toISOString(),
      new Date(testData.constants.dates.DATE_2).toISOString(),
      'filename'
    );
    expect(ctx.ok).toHaveBeenCalledWith([]);
  });

  it('getCacheFileContent() should get cache file content', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.params.filename = 'my file';
    ctx.app.northService.getCacheFileContent.mockReturnValueOnce('file content');
    await northConnectorController.getCacheFileContent(ctx);
    expect(ctx.app.northService.getCacheFileContent).toHaveBeenCalledWith(testData.north.list[0].id, 'my file');
    expect(ctx.attachment).toHaveBeenCalledWith('my file');
    expect(ctx.ok).toHaveBeenCalledWith('file content');
  });

  it('getCacheFileContent() should not get cache file content if null', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.params.filename = 'my file';
    ctx.app.northService.getCacheFileContent.mockReturnValueOnce(null);
    await northConnectorController.getCacheFileContent(ctx);
    expect(ctx.app.northService.getCacheFileContent).toHaveBeenCalledWith(testData.north.list[0].id, 'my file');
    expect(ctx.attachment).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('removeCacheFiles() should not remove files if body is not an array', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.request.body = 'my file';
    await northConnectorController.removeCacheFiles(ctx);
    expect(ctx.app.northService.removeCacheFiles).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith('Invalid file list');
  });

  it('removeCacheFiles() should remove cache files', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.request.body = ['my file'];
    await northConnectorController.removeCacheFiles(ctx);
    expect(ctx.app.northService.removeCacheFiles).toHaveBeenCalledWith(testData.north.list[0].id, ['my file']);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('archiveCacheFiles() should not archive files if body is not an array', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.request.body = 'my file';
    await northConnectorController.archiveCacheFiles(ctx);
    expect(ctx.app.northService.archiveCacheFiles).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith('Invalid file list');
  });

  it('archiveCacheFiles() should archive cache files', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.request.body = ['my file'];
    await northConnectorController.archiveCacheFiles(ctx);
    expect(ctx.app.northService.archiveCacheFiles).toHaveBeenCalledWith(testData.north.list[0].id, ['my file']);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('removeAllCacheFiles() should remove all error files', async () => {
    ctx.params.northId = testData.north.list[0].id;
    await northConnectorController.removeAllCacheFiles(ctx);
    expect(ctx.app.northService.removeAllCacheFiles).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('getArchiveFiles() should get archive files with default params', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.query.start = null;
    ctx.query.end = null;
    ctx.query.filenameContains = null;
    ctx.app.northService.getArchiveFiles.mockReturnValueOnce([]);
    await northConnectorController.getArchiveFiles(ctx);
    expect(ctx.app.northService.getArchiveFiles).toHaveBeenCalledWith(testData.north.list[0].id, null, null, null);
    expect(ctx.ok).toHaveBeenCalledWith([]);
  });

  it('getArchiveFiles() should get archive files', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.query.start = testData.constants.dates.DATE_1;
    ctx.query.end = testData.constants.dates.DATE_2;
    ctx.query.filenameContains = 'filename';
    ctx.app.northService.getArchiveFiles.mockReturnValueOnce([]);
    await northConnectorController.getArchiveFiles(ctx);
    expect(ctx.app.northService.getArchiveFiles).toHaveBeenCalledWith(
      testData.north.list[0].id,
      new Date(testData.constants.dates.DATE_1).toISOString(),
      new Date(testData.constants.dates.DATE_2).toISOString(),
      'filename'
    );
    expect(ctx.ok).toHaveBeenCalledWith([]);
  });

  it('getArchiveFileContent() should get archive file content', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.params.filename = 'my file';
    ctx.app.northService.getArchiveFileContent.mockReturnValueOnce('file content');
    await northConnectorController.getArchiveFileContent(ctx);
    expect(ctx.app.northService.getArchiveFileContent).toHaveBeenCalledWith(testData.north.list[0].id, 'my file');
    expect(ctx.attachment).toHaveBeenCalledWith('my file');
    expect(ctx.ok).toHaveBeenCalledWith('file content');
  });

  it('getArchiveFileContent() should not get archive file content if null', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.params.filename = 'my file';
    ctx.app.northService.getArchiveFileContent.mockReturnValueOnce(null);
    await northConnectorController.getArchiveFileContent(ctx);
    expect(ctx.app.northService.getArchiveFileContent).toHaveBeenCalledWith(testData.north.list[0].id, 'my file');
    expect(ctx.attachment).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('removeArchiveFiles() should not remove files if body is not an array', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.request.body = 'my file';
    await northConnectorController.removeArchiveFiles(ctx);
    expect(ctx.app.northService.removeArchiveFiles).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith('Invalid file list');
  });

  it('removeArchiveFiles() should remove archive files', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.request.body = ['my file'];
    await northConnectorController.removeArchiveFiles(ctx);
    expect(ctx.app.northService.removeArchiveFiles).toHaveBeenCalledWith(testData.north.list[0].id, ['my file']);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('retryArchiveFiles() should not retry files if body is not an array', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.request.body = 'my file';
    await northConnectorController.retryArchiveFiles(ctx);
    expect(ctx.app.northService.retryArchiveFiles).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith('Invalid file list');
  });

  it('retryArchiveFiles() should retry archive files', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.request.body = ['my file'];
    await northConnectorController.retryArchiveFiles(ctx);
    expect(ctx.app.northService.retryArchiveFiles).toHaveBeenCalledWith(testData.north.list[0].id, ['my file']);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('removeAllArchiveFiles() should remove all error files', async () => {
    ctx.params.northId = testData.north.list[0].id;
    await northConnectorController.removeAllArchiveFiles(ctx);
    expect(ctx.app.northService.removeAllArchiveFiles).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('retryAllArchiveFiles() should retry all error files', async () => {
    ctx.params.northId = testData.north.list[0].id;
    await northConnectorController.retryAllArchiveFiles(ctx);
    expect(ctx.app.northService.retryAllArchiveFiles).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('getCacheValues() should get cache values with default params', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.query.start = null;
    ctx.query.end = null;
    ctx.query.filenameContains = null;

    ctx.app.northService.getCacheValues.mockReturnValueOnce([]);
    await northConnectorController.getCacheValues(ctx);
    expect(ctx.app.northService.getCacheValues).toHaveBeenCalledWith(testData.north.list[0].id, '');
    expect(ctx.ok).toHaveBeenCalledWith([]);
  });

  it('getCacheValues() should get cache values', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.query.filenameContains = 'filename';
    ctx.app.northService.getCacheValues.mockReturnValueOnce([]);
    await northConnectorController.getCacheValues(ctx);
    expect(ctx.app.northService.getCacheValues).toHaveBeenCalledWith(testData.north.list[0].id, 'filename');
    expect(ctx.ok).toHaveBeenCalledWith([]);
  });

  it('removeCacheValues() should not remove values if body is not an array', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.request.body = 'my file';
    await northConnectorController.removeCacheValues(ctx);
    expect(ctx.app.northService.removeCacheValues).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith('Invalid file list');
  });

  it('removeCacheValues() should remove cache values', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.request.body = ['my file'];
    await northConnectorController.removeCacheValues(ctx);
    expect(ctx.app.northService.removeCacheValues).toHaveBeenCalledWith(testData.north.list[0].id, ['my file']);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('removeAllCacheValues() should remove all error files', async () => {
    ctx.params.northId = testData.north.list[0].id;
    await northConnectorController.removeAllCacheValues(ctx);
    expect(ctx.app.northService.removeAllCacheValues).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('getErrorValues() should get error values with default params', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.query.start = null;
    ctx.query.end = null;
    ctx.query.filenameContains = null;
    ctx.app.northService.getErrorValues.mockReturnValueOnce([]);
    await northConnectorController.getErrorValues(ctx);
    expect(ctx.app.northService.getErrorValues).toHaveBeenCalledWith(testData.north.list[0].id, null, null, null);
    expect(ctx.ok).toHaveBeenCalledWith([]);
  });

  it('getErrorValues() should get error values', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.query.start = testData.constants.dates.DATE_1;
    ctx.query.end = testData.constants.dates.DATE_2;
    ctx.query.filenameContains = 'filename';
    ctx.app.northService.getErrorValues.mockReturnValueOnce([]);
    await northConnectorController.getErrorValues(ctx);
    expect(ctx.app.northService.getErrorValues).toHaveBeenCalledWith(
      testData.north.list[0].id,
      new Date(testData.constants.dates.DATE_1).toISOString(),
      new Date(testData.constants.dates.DATE_2).toISOString(),
      'filename'
    );
    expect(ctx.ok).toHaveBeenCalledWith([]);
  });

  it('removeErrorValues() should not remove values if body is not an array', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.request.body = 'my file';
    await northConnectorController.removeErrorValues(ctx);
    expect(ctx.app.northService.removeErrorValues).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith('Invalid file list');
  });

  it('removeErrorValues() should remove error values', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.request.body = ['my file'];
    await northConnectorController.removeErrorValues(ctx);
    expect(ctx.app.northService.removeErrorValues).toHaveBeenCalledWith(testData.north.list[0].id, ['my file']);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('retryErrorValues() should not retry values if body is not an array', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.request.body = 'my file';
    await northConnectorController.retryErrorValues(ctx);
    expect(ctx.app.northService.retryErrorValues).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith('Invalid file list');
  });

  it('retryErrorValues() should retry error values', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.request.body = ['my file'];
    await northConnectorController.retryErrorValues(ctx);
    expect(ctx.app.northService.retryErrorValues).toHaveBeenCalledWith(testData.north.list[0].id, ['my file']);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('removeAllErrorValues() should remove all error values', async () => {
    ctx.params.northId = testData.north.list[0].id;
    await northConnectorController.removeAllErrorValues(ctx);
    expect(ctx.app.northService.removeAllErrorValues).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('retryAllErrorValues() should retry all error values', async () => {
    ctx.params.northId = testData.north.list[0].id;
    await northConnectorController.retryAllErrorValues(ctx);
    expect(ctx.app.northService.retryAllErrorValues).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('testNorthConnection() should test North connector settings on connector update', async () => {
    ctx.params.id = testData.north.list[0].id;
    ctx.request.body = testData.north.command;
    ctx.app.logger.child = jest.fn().mockImplementation(() => logger);

    await northConnectorController.testNorthConnection(ctx);

    expect(ctx.app.northService.testNorth).toHaveBeenCalledWith(testData.north.list[0].id, testData.north.command, logger);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('testNorthConnection() should call badRequest on North test error', async () => {
    ctx.params.id = testData.north.list[0].id;
    ctx.request.body = testData.north.command;
    ctx.app.logger.child = jest.fn().mockImplementation(() => logger);
    ctx.app.northService.testNorth.mockImplementation(() => {
      throw new Error('error');
    });
    await northConnectorController.testNorthConnection(ctx);

    expect(ctx.app.northService.testNorth).toHaveBeenCalledWith(testData.north.list[0].id, testData.north.command, logger);
    expect(ctx.noContent).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith('error');
  });

  it('listNorthItems() should return all North items', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.app.northService.getNorthItems.mockReturnValue(testData.north.list[0].items);
    ctx.app.northService.findById.mockReturnValueOnce(testData.north.list[0]);
    ctx.app.northService.getInstalledNorthManifests.mockReturnValueOnce([{ ...testData.north.manifest, id: testData.north.list[0].type }]);

    await northConnectorController.listNorthItems(ctx);
    expect(ctx.app.northService.getNorthItems).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(ctx.ok).toHaveBeenCalledWith(testData.north.list[0].items);
  });

  it('listNorthItems() should return not found', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.app.northService.findById.mockReturnValueOnce(null);

    await northConnectorController.listNorthItems(ctx);
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('searchNorthItems() should return North items', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.query = {
      page: 1,
      name: 'name'
    };
    const searchParams = {
      page: 1,
      name: 'name'
    };
    ctx.app.northService.searchNorthItems.mockReturnValue({
      content: testData.north.list[0].items.map(item =>
        toNorthConnectorItemDTO(item, testData.north.list[0].type, ctx.app.encryptionService)
      ),
      totalElements: testData.north.list[0].items.length,
      size: 25,
      number: 1,
      totalPages: 1
    });
    ctx.app.northService.findById.mockReturnValueOnce(testData.north.list[0]);
    ctx.app.northService.getInstalledNorthManifests.mockReturnValueOnce([{ ...testData.north.manifest, id: testData.north.list[0].type }]);

    await northConnectorController.searchNorthItems(ctx);

    expect(ctx.app.northService.searchNorthItems).toHaveBeenCalledWith(testData.north.list[0].id, searchParams);
    expect(ctx.ok).toHaveBeenCalledWith({
      content: testData.north.list[0].items.map(item =>
        toNorthConnectorItemDTO(item, testData.north.list[0].type, ctx.app.encryptionService)
      ),
      totalElements: testData.north.list[0].items.length,
      size: 25,
      number: 1,
      totalPages: 1
    });
  });

  it('searchNorthItems() without page should return North items', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.query = {
      name: 'name'
    };
    const searchParams = {
      page: 0,
      name: 'name'
    };
    ctx.app.northService.findById.mockReturnValueOnce(testData.north.list[0]);
    ctx.app.northService.searchNorthItems.mockReturnValue({
      content: testData.north.list[0].items.map(item =>
        toNorthConnectorItemDTO(item, testData.north.list[0].type, ctx.app.encryptionService)
      ),
      totalElements: testData.north.list[0].items.length,
      size: 25,
      number: 0,
      totalPages: 1
    });
    ctx.app.northService.getInstalledNorthManifests.mockReturnValueOnce([{ ...testData.north.manifest, id: testData.north.list[0].type }]);

    await northConnectorController.searchNorthItems(ctx);

    expect(ctx.app.northService.searchNorthItems).toHaveBeenCalledWith(testData.north.list[0].id, searchParams);
    expect(ctx.ok).toHaveBeenCalledWith({
      content: testData.north.list[0].items.map(item =>
        toNorthConnectorItemDTO(item, testData.north.list[0].type, ctx.app.encryptionService)
      ),
      totalElements: testData.north.list[0].items.length,
      size: 25,
      number: 0,
      totalPages: 1
    });
  });

  it('searchNorthItems() should return not found', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.app.northService.findById.mockReturnValueOnce(null);

    await northConnectorController.searchNorthItems(ctx);
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('getNorthItem() should return North item', async () => {
    ctx.params.id = testData.north.list[0].items[0].id;
    ctx.params.norhtId = testData.north.list[0].id;
    ctx.app.northService.findNorthConnectorItemById.mockReturnValue(testData.north.list[0].items[0]);
    ctx.app.northService.findById.mockReturnValueOnce(testData.north.list[0]);
    ctx.app.northService.getInstalledNorthManifests.mockReturnValueOnce([{ ...testData.north.manifest, id: testData.north.list[0].type }]);

    await northConnectorController.getNorthItem(ctx);

    expect(ctx.app.northService.findNorthConnectorItemById).toHaveBeenCalledWith(
      testData.north.list[0].id,
      testData.north.list[0].items[0].id
    );
    expect(ctx.ok).toHaveBeenCalledWith(testData.north.list[0].items[0]);
  });

  it('getNorthItem() should return not found when North item not found', async () => {
    ctx.params.id = testData.north.list[0].items[0].id;
    ctx.params.norhtId = testData.north.list[0].id;
    ctx.app.northService.findNorthConnectorItemById.mockReturnValue(null);
    ctx.app.northService.findById.mockReturnValueOnce(testData.north.list[0]);
    ctx.app.northService.getInstalledNorthManifests.mockReturnValueOnce([{ ...testData.north.manifest, id: testData.north.list[0].type }]);

    await northConnectorController.getNorthItem(ctx);

    expect(ctx.app.northService.findNorthConnectorItemById).toHaveBeenCalledWith(
      testData.north.list[0].id,
      testData.north.list[0].items[0].id
    );
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('getNorthItem() should return not found', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.app.northService.findById.mockReturnValueOnce(null);

    await northConnectorController.getNorthItem(ctx);
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('createNorthItem() should create North item', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.request.body = testData.north.itemCommand;
    ctx.app.northService.createItem.mockReturnValueOnce(testData.north.list[0].items[0]);
    ctx.app.northService.findById.mockReturnValueOnce(testData.north.list[0]);
    ctx.app.northService.getInstalledNorthManifests.mockReturnValueOnce([{ ...testData.north.manifest, id: testData.north.list[0].type }]);

    await northConnectorController.createNorthItem(ctx);

    expect(ctx.app.northService.createItem).toHaveBeenCalledWith(testData.north.list[0].id, testData.north.itemCommand);
    expect(ctx.created).toHaveBeenCalledWith(testData.north.list[0].items[0]);
  });

  it('createNorthItem() should return bad request', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.app.northService.findById.mockReturnValueOnce(testData.north.list[0]);
    ctx.app.northService.createItem.mockImplementationOnce(() => {
      throw new Error('create error');
    });
    await northConnectorController.createNorthItem(ctx);
    expect(ctx.badRequest).toHaveBeenCalledWith('create error');
  });

  it('createNorthItem() should return not found', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.app.northService.findById.mockReturnValueOnce(null);

    await northConnectorController.createNorthItem(ctx);
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('updateNorthItem() should update North item', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.params.id = testData.north.list[0].items[0].id;
    ctx.request.body = testData.north.itemCommand;

    await northConnectorController.updateNorthItem(ctx);

    expect(ctx.app.northService.updateItem).toHaveBeenCalledWith(
      testData.north.list[0].id,
      testData.north.list[0].items[0].id,
      testData.north.itemCommand
    );
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('updateNorthItem() should return bad request', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.params.id = testData.north.list[0].items[0].id;
    ctx.request.body = testData.north.itemCommand;
    ctx.app.northService.updateItem.mockImplementationOnce(() => {
      throw new Error('update error');
    });

    await northConnectorController.updateNorthItem(ctx);
    expect(ctx.badRequest).toHaveBeenCalledWith('update error');
  });

  it('deleteNorthItem() should delete North item', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.params.id = testData.north.list[0].items[0].id;

    await northConnectorController.deleteNorthItem(ctx);

    expect(ctx.app.northService.deleteItem).toHaveBeenCalledWith(testData.north.list[0].id, testData.north.list[0].items[0].id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('deleteNorthItem() should return bad request', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.params.id = testData.north.list[0].items[0].id;
    ctx.app.northService.deleteItem.mockImplementationOnce(() => {
      throw new Error('delete error');
    });

    await northConnectorController.deleteNorthItem(ctx);
    expect(ctx.badRequest).toHaveBeenCalledWith('delete error');
  });

  it('enableNorthItem() should enable North item', async () => {
    ctx.params.id = testData.north.list[0].items[0].id;
    ctx.params.northId = testData.north.list[0].id;

    await northConnectorController.enableNorthItem(ctx);

    expect(ctx.app.northService.enableItem).toHaveBeenCalledWith(testData.north.list[0].id, testData.north.list[0].items[0].id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('enableNorthItem() should return bad request', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.params.id = testData.north.list[0].items[0].id;
    ctx.app.northService.enableItem.mockImplementationOnce(() => {
      throw new Error('enable error');
    });

    await northConnectorController.enableNorthItem(ctx);
    expect(ctx.badRequest).toHaveBeenCalledWith('enable error');
  });

  it('disableNorthItem() should disable North item', async () => {
    ctx.params.id = testData.north.list[0].items[0].id;
    ctx.params.northId = testData.north.list[0].id;

    await northConnectorController.disableNorthItem(ctx);

    expect(ctx.app.northService.disableItem).toHaveBeenCalledWith(testData.north.list[0].id, testData.north.list[0].items[0].id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('disableNorthItem() should return bad request', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.params.id = testData.north.list[0].items[0].id;
    ctx.app.northService.disableItem.mockImplementationOnce(() => {
      throw new Error('disable error');
    });

    await northConnectorController.disableNorthItem(ctx);
    expect(ctx.badRequest).toHaveBeenCalledWith('disable error');
  });

  it('deleteAllNorthItem() should delete all North items', async () => {
    ctx.params.northId = testData.north.list[0].id;

    await northConnectorController.deleteAllNorthItem(ctx);

    expect(ctx.app.northService.deleteAllItemsForNorthConnector).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('deleteAllNorthItem() should return bad request', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.app.northService.deleteAllItemsForNorthConnector.mockImplementationOnce(() => {
      throw new Error('delete all error');
    });

    await northConnectorController.deleteAllNorthItem(ctx);
    expect(ctx.badRequest).toHaveBeenCalledWith('delete all error');
  });

  it('resetNorthMetrics() should reset North metrics', async () => {
    ctx.params.northId = testData.north.list[0].id;

    await northConnectorController.resetNorthMetrics(ctx);
    expect(ctx.app.oIBusService.resetNorthConnectorMetrics).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('northItemsToCsv() should download a csv file', async () => {
    ctx.params.northType = testData.north.list[0].type;
    ctx.request.body = {
      items: testData.north.list[0].items,
      delimiter: ';'
    };
    (northItemToFlattenedCSV as jest.Mock).mockReturnValue('csv content');
    ctx.app.scanModeService.findAll.mockReturnValueOnce(testData.scanMode.list);
    ctx.app.northService.getInstalledNorthManifests.mockReturnValueOnce([{ ...testData.north.manifest, id: testData.north.list[0].type }]);

    await northConnectorController.northConnectorItemsToCsv(ctx);

    expect(ctx.ok).toHaveBeenCalledWith();
    expect(ctx.body).toEqual('csv content');
  });

  it('northItemsToCsv() should throw not found a csv file', async () => {
    ctx.params.northType = 'bad';
    ctx.request.body = {
      items: testData.north.list[0].items,
      delimiter: ';'
    };
    ctx.app.northService.getInstalledNorthManifests.mockReturnValueOnce([{ ...testData.north.manifest, id: testData.north.list[0].type }]);

    await northConnectorController.northConnectorItemsToCsv(ctx);

    expect(ctx.throw).toHaveBeenCalledWith(404, 'North manifest not found');
  });

  it('exportNorthItems() should download a csv file', async () => {
    ctx.params.northType = testData.north.list[0].type;
    ctx.params.northId = testData.north.list[0].id;
    (northItemToFlattenedCSV as jest.Mock).mockReturnValueOnce('csv content');
    ctx.app.northService.findById.mockReturnValueOnce(testData.north.list[0]);
    ctx.request.body = { delimiter: ';' };

    await northConnectorController.exportNorthItems(ctx);

    expect(ctx.ok).toHaveBeenCalledWith();
    expect(ctx.body).toEqual('csv content');
  });

  it('exportNorthItems() should return not found', async () => {
    ctx.params.northType = testData.north.list[0].type;
    ctx.params.northId = testData.north.list[0].id;
    ctx.request.body = { delimiter: ';' };
    ctx.app.northService.findById.mockReturnValueOnce(null);

    await northConnectorController.exportNorthItems(ctx);

    expect(ctx.notFound).toHaveBeenCalledWith();
  });

  it('checkImportNorthItems() should check import of items in a csv file with new north', async () => {
    ctx.params.northType = testData.north.list[0].type;
    ctx.request.file = { path: 'myFile.csv', mimetype: 'text/csv' };
    ctx.request.body = { currentItems: '[]', delimiter: ',' };
    ctx.app.scanModeService.findAll.mockReturnValueOnce(testData.scanMode.list);
    ctx.app.northService.getInstalledNorthManifests.mockReturnValue(testData.north.manifest);

    await northConnectorController.checkImportNorthItems(ctx);
    expect(ctx.app.northService.checkCsvFileImport).toHaveBeenCalledWith(
      testData.north.list[0].type,
      ctx.request.file,
      ctx.request.body.delimiter,
      JSON.parse(ctx.request.body.currentItems)
    );
    expect(ctx.ok).toHaveBeenCalled();
  });

  it('checkImportNorthItems() should return bad request', async () => {
    ctx.params.northType = testData.north.list[0].type;
    ctx.request.file = { path: 'myFile.csv', mimetype: 'text/csv' };
    ctx.request.body = { currentItems: '[]', delimiter: ',' };
    ctx.app.northService.checkCsvFileImport.mockImplementationOnce(() => {
      throw new Error('bad items');
    });

    await northConnectorController.checkImportNorthItems(ctx);
    expect(ctx.badRequest).toHaveBeenCalledWith('bad items');
  });

  it('importNorthItems() should import north items', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.request.body = { items: testData.north.list[0].items };
    await northConnectorController.importNorthItems(ctx);
    expect(ctx.app.northService.importItems).toHaveBeenCalledWith(testData.north.list[0].id, testData.north.list[0].items);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('importNorthItems() should return bad request', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.request.body = { items: testData.north.list[0].items };
    ctx.app.northService.importItems.mockImplementationOnce(() => {
      throw new Error('bad import');
    });
    await northConnectorController.importNorthItems(ctx);
    expect(ctx.app.northService.importItems).toHaveBeenCalledWith(testData.north.list[0].id, testData.north.list[0].items);
    expect(ctx.badRequest).toHaveBeenCalledWith('bad import');
  });
});
