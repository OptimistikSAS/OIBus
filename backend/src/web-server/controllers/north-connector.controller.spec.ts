import NorthConnectorController from './north-connector.controller';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';
import JoiValidator from './validators/joi.validator';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { toNorthConnectorDTO, toNorthConnectorLightDTO } from '../../service/north.service';

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

  it('resetMetrics() should reset North metrics', async () => {
    ctx.params.northId = testData.north.list[0].id;

    await northConnectorController.resetMetrics(ctx);
    expect(ctx.app.oIBusService.resetNorthConnectorMetrics).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('searchCacheContent() should search cache content with default params', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.query.folder = 'cache';
    ctx.app.northService.searchCacheContent.mockReturnValueOnce([]);
    await northConnectorController.searchCacheContent(ctx);
    expect(ctx.app.northService.searchCacheContent).toHaveBeenCalledWith(
      testData.north.list[0].id,
      { start: null, end: null, nameContains: null },
      'cache'
    );
    expect(ctx.ok).toHaveBeenCalledWith([]);
  });

  it('searchCacheContent() should fail to search if bad folder', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.query.folder = null;
    await northConnectorController.searchCacheContent(ctx);
    expect(ctx.app.northService.searchCacheContent).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith('A folder must be specified among "cache", "error" or "archive"');
  });

  it('searchCacheContent() should search cache content', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.query.start = testData.constants.dates.DATE_1;
    ctx.query.end = testData.constants.dates.DATE_2;
    ctx.query.nameContains = 'filename';
    ctx.query.folder = 'cache';
    ctx.app.northService.searchCacheContent.mockReturnValueOnce([]);
    await northConnectorController.searchCacheContent(ctx);
    expect(ctx.app.northService.searchCacheContent).toHaveBeenCalledWith(
      testData.north.list[0].id,
      { start: testData.constants.dates.DATE_1, end: testData.constants.dates.DATE_2, nameContains: 'filename' },
      'cache'
    );
    expect(ctx.ok).toHaveBeenCalledWith([]);
  });

  it('getCacheContentFileStream() should get error file content', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.params.filename = 'my file';
    ctx.query.folder = 'cache';
    ctx.app.northService.getCacheContentFileStream.mockReturnValueOnce('file content');
    await northConnectorController.getCacheContentFileStream(ctx);
    expect(ctx.app.northService.getCacheContentFileStream).toHaveBeenCalledWith(testData.north.list[0].id, 'cache', 'my file');
    expect(ctx.attachment).toHaveBeenCalledWith('my file');
    expect(ctx.ok).toHaveBeenCalledWith('file content');
  });

  it('getCacheContentFileStream() should fail to get file if bad folder', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.query.folder = null;
    await northConnectorController.getCacheContentFileStream(ctx);
    expect(ctx.app.northService.getCacheContentFileStream).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith('A folder must be specified among "cache", "error" or "archive"');
  });

  it('getCacheContentFileStream() should fail to get file if no filename', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.query.folder = 'cache';
    ctx.params.filename = null;
    await northConnectorController.getCacheContentFileStream(ctx);
    expect(ctx.app.northService.getCacheContentFileStream).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith('A filename must be specified');
  });

  it('getCacheContentFileStream() should not get error file content if null', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.params.filename = 'my file';
    ctx.query.folder = 'cache';
    ctx.app.northService.getCacheContentFileStream.mockReturnValueOnce(null);
    await northConnectorController.getCacheContentFileStream(ctx);
    expect(ctx.app.northService.getCacheContentFileStream).toHaveBeenCalledWith(testData.north.list[0].id, 'cache', 'my file');
    expect(ctx.attachment).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('removeCacheContent() should fail to remove if bad folder', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.query.folder = null;
    await northConnectorController.removeCacheContent(ctx);
    expect(ctx.app.northService.removeCacheContent).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith('A folder must be specified among "cache", "error" or "archive"');
  });

  it('removeCacheContent() should not remove files if body is not an array', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.request.body = 'my file';
    ctx.query.folder = 'cache';
    await northConnectorController.removeCacheContent(ctx);
    expect(ctx.app.northService.removeCacheContent).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith('Invalid file list');
  });

  it('removeCacheContent() should remove error files', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.query.folder = 'cache';
    ctx.query.filenames = ['my file1', 'my file2'];
    await northConnectorController.removeCacheContent(ctx);
    expect(ctx.app.northService.removeCacheContent).toHaveBeenCalledWith(testData.north.list[0].id, 'cache', ['my file1', 'my file2']);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('removeCacheContent() should remove error files with only one file', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.query.folder = 'cache';
    ctx.query.filenames = 'my file';
    await northConnectorController.removeCacheContent(ctx);
    expect(ctx.app.northService.removeCacheContent).toHaveBeenCalledWith(testData.north.list[0].id, 'cache', ['my file']);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('moveCacheContent() should fail to move all if bad originFolder', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.query.originFolder = null;
    await northConnectorController.moveCacheContent(ctx);
    expect(ctx.app.northService.moveCacheContent).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith('The originFolder must be specified among "cache", "error" or "archive"');
  });

  it('moveCacheContent() should fail to move all if bad destinationFolder', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.query.originFolder = 'cache';
    ctx.query.destinationFolder = null;
    await northConnectorController.moveCacheContent(ctx);
    expect(ctx.app.northService.moveCacheContent).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith('The destinationFolder must be specified among "cache", "error" or "archive"');
  });

  it('moveCacheContent() should not move files if body is not an array', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.request.body = 'my file';
    ctx.query.originFolder = 'cache';
    ctx.query.destinationFolder = 'error';
    await northConnectorController.moveCacheContent(ctx);
    expect(ctx.app.northService.moveCacheContent).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith('Invalid file list');
  });

  it('moveCacheContent() should move files', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.query.originFolder = 'cache';
    ctx.query.destinationFolder = 'error';
    ctx.request.body = ['my file'];
    await northConnectorController.moveCacheContent(ctx);
    expect(ctx.app.northService.moveCacheContent).toHaveBeenCalledWith(testData.north.list[0].id, 'cache', 'error', ['my file']);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('removeAllCacheContent() should remove all cache content', async () => {
    ctx.params.northId = testData.north.list[0].id;
    await northConnectorController.removeAllCacheContent(ctx);
    expect(ctx.app.northService.removeAllCacheContent).toHaveBeenCalledWith(testData.north.list[0].id, 'cache');
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('removeAllCacheContent() should fail to remove all if bad folder', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.query.folder = null;
    await northConnectorController.removeAllCacheContent(ctx);
    expect(ctx.app.northService.removeAllCacheContent).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith('A folder must be specified among "cache", "error" or "archive"');
  });

  it('moveAllCacheContent() should move all cache content', async () => {
    ctx.params.northId = testData.north.list[0].id;
    await northConnectorController.moveAllCacheContent(ctx);
    expect(ctx.app.northService.moveAllCacheContent).toHaveBeenCalledWith(testData.north.list[0].id, 'cache', 'error');
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('moveAllCacheContent() should fail to move all if bad originFolder', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.query.originFolder = null;
    await northConnectorController.moveAllCacheContent(ctx);
    expect(ctx.app.northService.moveAllCacheContent).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith('The originFolder must be specified among "cache", "error" or "archive"');
  });

  it('moveAllCacheContent() should fail to move all if bad destinationFolder', async () => {
    ctx.params.northId = testData.north.list[0].id;
    ctx.query.originFolder = 'cache';
    ctx.query.destinationFolder = null;
    await northConnectorController.moveAllCacheContent(ctx);
    expect(ctx.app.northService.moveAllCacheContent).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith('The destinationFolder must be specified among "cache", "error" or "archive"');
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
});
