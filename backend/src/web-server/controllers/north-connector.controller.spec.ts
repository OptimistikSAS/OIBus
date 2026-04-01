import { NorthConnectorController } from './north-connector.controller';
import { NorthConnectorCommandDTO, OIBusNorthType } from '../../../shared/model/north-connector.model';
import { CustomExpressRequest } from '../express';
import testData from '../../tests/utils/test-data';
import NorthServiceMock from '../../tests/__mocks__/service/north-service.mock';
import { StandardTransformerDTO, TransformerDTOWithOptions } from '../../../shared/model/transformer.model';
import { CacheContentUpdateCommand, CacheMetadata } from '../../../shared/model/engine.model';
import OibusServiceMock from '../../tests/__mocks__/service/oibus-service.mock';
import { OIBusTestingError } from '../../model/types';
import UserService from 'src/service/user.service';

// Mock the services
jest.mock('../../service/north.service', () => ({
  toNorthConnectorDTO: jest.fn().mockImplementation((connector, getUserInfo) => {
    getUserInfo('');
    return connector;
  }),
  toNorthConnectorLightDTO: jest.fn().mockImplementation((connector, getUserInfo) => {
    getUserInfo('');
    return connector;
  })
}));

describe('NorthConnectorController', () => {
  let controller: NorthConnectorController;
  const mockRequest: Partial<CustomExpressRequest> = {
    services: {
      northService: new NorthServiceMock(),
      oIBusService: new OibusServiceMock(),
      userService: { getUserInfo: jest.fn().mockReturnValue({ id: 'test', friendlyName: 'Test' }) } as unknown as UserService
    },
    user: {
      id: 'test',
      login: 'testUser'
    },
    res: {
      setHeader: jest.fn(),
      pipe: jest.fn()
    }
  } as unknown as CustomExpressRequest;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new NorthConnectorController();
  });

  it('should return north connector types', async () => {
    const mockManifests = [testData.north.manifest];
    (mockRequest.services!.northService.listManifest as jest.Mock).mockReturnValue(mockManifests);

    const result = controller.listManifest(mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.northService.listManifest).toHaveBeenCalled();
    expect(result).toEqual([
      {
        id: testData.north.manifest.id,
        category: testData.north.manifest.category,
        types: testData.north.manifest.types
      }
    ]);
  });

  it('should return a north connector manifest', async () => {
    const mockManifest = testData.north.manifest;
    const type = testData.north.manifest.id;
    (mockRequest.services!.northService.getManifest as jest.Mock).mockReturnValue(mockManifest);

    const result = controller.getManifest(type, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.northService.getManifest).toHaveBeenCalled();
    expect(result).toEqual(mockManifest);
  });

  it('should return a list of north connectors', async () => {
    const mockNorthConnectors = testData.north.list;
    (mockRequest.services!.northService.list as jest.Mock).mockReturnValue(mockNorthConnectors);

    const result = controller.list(mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.northService.list).toHaveBeenCalled();
    expect(result).toEqual(mockNorthConnectors);
  });

  it('should return a north connector by ID', async () => {
    const mockNorthConnector = testData.north.list[0];
    const northId = mockNorthConnector.id;
    (mockRequest.services!.northService.findById as jest.Mock).mockReturnValue(mockNorthConnector);

    const result = await controller.findById(northId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.northService.findById).toHaveBeenCalledWith(northId);
    expect(result).toEqual(mockNorthConnector);
  });

  it('should create a new north connector', async () => {
    const command: NorthConnectorCommandDTO = testData.north.command;
    const createdNorthConnector = testData.north.list[0];
    (mockRequest.services!.northService.create as jest.Mock).mockResolvedValue(createdNorthConnector);

    const result = await controller.create(command, undefined, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.northService.create).toHaveBeenCalledWith(command, null, 'test');
    expect(result).toEqual(createdNorthConnector);
  });

  it('should update an existing north connector', async () => {
    const northId = testData.north.list[0].id;
    const command: NorthConnectorCommandDTO = testData.north.command;
    (mockRequest.services!.northService.update as jest.Mock).mockResolvedValue(undefined);

    await controller.update(northId, command, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.northService.update).toHaveBeenCalledWith(northId, command, 'test');
  });

  it('should delete a north connector', async () => {
    const northId = testData.north.list[0].id;
    (mockRequest.services!.northService.delete as jest.Mock).mockResolvedValue(undefined);

    await controller.delete(northId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.northService.delete).toHaveBeenCalledWith(northId);
  });

  it('should start a north connector', async () => {
    const northId = testData.north.list[0].id;
    (mockRequest.services!.northService.start as jest.Mock).mockResolvedValue(undefined);

    await controller.start(northId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.northService.start).toHaveBeenCalledWith(northId);
  });

  it('should stop a north connector', async () => {
    const northId = testData.north.list[0].id;
    (mockRequest.services!.northService.stop as jest.Mock).mockResolvedValue(undefined);

    await controller.stop(northId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.northService.stop).toHaveBeenCalledWith(northId);
  });

  it('should reset north connector metrics', async () => {
    const northId = testData.north.list[0].id;
    (mockRequest.services!.oIBusService.resetNorthMetrics as jest.Mock).mockResolvedValue(undefined);

    await controller.resetMetrics(northId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.oIBusService.resetNorthMetrics).toHaveBeenCalledWith(northId);
  });

  it('should test north connection', async () => {
    const northId = testData.north.list[0].id;
    const northType: OIBusNorthType = testData.north.command.type;
    const settings = testData.north.command.settings;

    (mockRequest.services!.northService.testNorth as jest.Mock).mockResolvedValue({ items: [] });

    await controller.testNorth(northId, northType, settings, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.northService.testNorth).toHaveBeenCalledWith(northId, northType, settings);
  });

  it('should wrap errors when testing north connection', async () => {
    const northId = testData.north.list[0].id;
    const northType: OIBusNorthType = testData.north.command.type;
    const settings = testData.north.command.settings;

    (mockRequest.services!.northService.testNorth as jest.Mock).mockRejectedValue(new Error('North connection failure'));

    const promise = controller.testNorth(northId, northType, settings, mockRequest as CustomExpressRequest);

    await expect(promise).rejects.toThrow('North connection failure');
    await promise.catch(error => {
      expect(error).toBeInstanceOf(OIBusTestingError);
    });
    expect(mockRequest.services!.northService.testNorth).toHaveBeenCalledWith(northId, northType, settings);
  });

  it('should add or edit a transformer', async () => {
    const northId = testData.north.list[0].id;
    const transformer: TransformerDTOWithOptions = {
      id: 'northTransformerId1',
      transformer: testData.transformers.list[0] as StandardTransformerDTO,
      options: {},
      source: {
        type: 'oianalytics-setpoint'
      }
    };

    (mockRequest.services!.northService.addOrEditTransformer as jest.Mock).mockResolvedValue(undefined);

    await controller.addOrEditTransformer(northId, transformer, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.northService.addOrEditTransformer).toHaveBeenCalledWith(northId, transformer);
  });

  it('should remove a transformer', async () => {
    const northId = testData.north.list[0].id;
    const transformerId = testData.transformers.list[0].id;

    (mockRequest.services!.northService.removeTransformer as jest.Mock).mockResolvedValue(undefined);

    await controller.removeTransformer(northId, transformerId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.northService.removeTransformer).toHaveBeenCalledWith(northId, transformerId);
  });

  it('should search cache content with default params', async () => {
    const northId = testData.north.list[0].id;

    const mockCacheMetadata: Array<{ metadataFilename: string; metadata: CacheMetadata }> = [];
    (mockRequest.services!.oIBusService.searchCacheContent as jest.Mock).mockResolvedValue(mockCacheMetadata);

    const result = await controller.searchCacheContent(
      northId,
      undefined,
      undefined,
      undefined,
      undefined,
      mockRequest as CustomExpressRequest
    );

    expect(mockRequest.services!.oIBusService.searchCacheContent).toHaveBeenCalledWith('north', northId, {
      start: undefined,
      end: undefined,
      nameContains: undefined,
      maxNumberOfFilesReturned: 0
    });
    expect(result).toEqual(mockCacheMetadata);
  });

  it('should search cache content with parameters', async () => {
    const northId = testData.north.list[0].id;
    const nameContains = 'test';
    const start = testData.constants.dates.DATE_1;
    const end = testData.constants.dates.DATE_2;

    const mockCacheMetadata: Array<{ metadataFilename: string; metadata: CacheMetadata }> = [];
    (mockRequest.services!.oIBusService.searchCacheContent as jest.Mock).mockResolvedValue(mockCacheMetadata);

    const result = await controller.searchCacheContent(northId, nameContains, start, end, 10000, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.oIBusService.searchCacheContent).toHaveBeenCalledWith('north', northId, {
      start,
      end,
      nameContains,
      maxNumberOfFilesReturned: 10000
    });
    expect(result).toEqual(mockCacheMetadata);
  });

  it('should get cache file content', async () => {
    const northId = testData.north.list[0].id;
    const folder = 'cache';
    const filename = 'test-file';

    const mockFileStream = { pipe: jest.fn() };
    (mockRequest.services!.oIBusService.getFileFromCache as jest.Mock).mockResolvedValue(mockFileStream);

    await controller.getCacheFileContent(northId, filename, folder, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.oIBusService.getFileFromCache).toHaveBeenCalledWith('north', northId, folder, filename);
  });

  it('should update cache content', async () => {
    const northId = testData.north.list[0].id;

    (mockRequest.services!.oIBusService.updateCacheContent as jest.Mock).mockResolvedValue(undefined);

    await controller.updateCacheContent(northId, {} as CacheContentUpdateCommand, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.oIBusService.updateCacheContent).toHaveBeenCalledWith('north', northId, {});
  });
});
