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
  });

  it('getNorthConnectorTypes() should return North connector types', async () => {
    ctx.app.northService.getInstalledNorthManifests.mockReturnValueOnce([testData.north.manifest]);

    await northConnectorController.getNorthConnectorTypes(ctx);

    expect(ctx.ok).toHaveBeenCalledWith([
      {
        id: testData.north.manifest.id,
        category: testData.north.manifest.category,
        name: testData.north.manifest.name,
        description: testData.north.manifest.description,
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
    expect(ctx.app.northService.createNorth).toHaveBeenCalledWith(testData.north.command);
    expect(ctx.created).toHaveBeenCalledWith(toNorthConnectorDTO(testData.north.list[0], ctx.app.encryptionService));
  });

  it('update() should update North connector', async () => {
    ctx.request.body = testData.north.command;
    ctx.params.id = testData.north.list[0].id;

    await northConnectorController.updateNorth(ctx);
    expect(ctx.app.northService.updateNorth).toHaveBeenCalledWith(ctx.params.id, testData.north.command);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('delete() should delete North connector', async () => {
    ctx.params.id = testData.north.list[0].id;

    await northConnectorController.delete(ctx);
    expect(ctx.app.northService.deleteNorth).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('start() should enable North connector', async () => {
    ctx.params.id = testData.north.list[0].id;

    await northConnectorController.start(ctx);

    expect(ctx.app.northService.startNorth).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('stop() should disable North connector', async () => {
    ctx.params.id = testData.north.list[0].id;

    await northConnectorController.stop(ctx);

    expect(ctx.app.northService.stopNorth).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('resetMetrics() should reset North metrics', async () => {
    ctx.params.northId = testData.north.list[0].id;

    await northConnectorController.resetMetrics(ctx);

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
});
