import { TransformerController } from './transformer.controller';
import { CustomTransformerCommandDTO, TransformerManifest, TransformerSearchParam, TransformerTestRequest } from '../../../shared/model/transformer.model';
import { CustomExpressRequest } from '../express';
import testData from '../../tests/utils/test-data';
import TransformerServiceMock from '../../tests/__mocks__/service/transformer-service.mock';
import { createPageFromArray } from '../../../shared/model/types';
import { OIBusDataType } from '../../../shared/model/engine.model';

// Mock the services
jest.mock('../../service/transformer.service', () => ({
  toTransformerDTO: jest.fn().mockImplementation(transformer => transformer)
}));

describe('TransformerController', () => {
  let controller: TransformerController;
  const mockRequest: Partial<CustomExpressRequest> = {
    services: {
      transformerService: new TransformerServiceMock()
    }
  } as CustomExpressRequest;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new TransformerController();
  });

  it('should return transformer types', async () => {
    const mockManifests: Array<TransformerManifest> = [
      {
        id: 'iso',
        inputType: 'any',
        outputType: 'any',
        settings: {
          type: 'object',
          key: 'options',
          translationKey: 'configuration.oibus.manifest.transformers.options',
          attributes: [],
          enablingConditions: [],
          validators: [],
          displayProperties: {
            visible: true,
            wrapInBox: false
          }
        }
      }
    ];
    (mockRequest.services!.transformerService.listManifest as jest.Mock).mockReturnValue(mockManifests);

    const result = await controller.listManifest(mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.transformerService.listManifest).toHaveBeenCalled();
    expect(result).toEqual([
      {
        id: 'iso',
        inputType: 'any',
        outputType: 'any'
      }
    ]);
  });

  it('should return a transformer manifest', async () => {
    const mockManifest: TransformerManifest = {
      id: 'iso',
      inputType: 'any',
      outputType: 'any',
      settings: {
        type: 'object',
        key: 'options',
        translationKey: 'configuration.oibus.manifest.transformers.options',
        attributes: [],
        enablingConditions: [],
        validators: [],
        displayProperties: {
          visible: true,
          wrapInBox: false
        }
      }
    };
    const type = 'iso';
    (mockRequest.services!.transformerService.getManifest as jest.Mock).mockReturnValue(mockManifest);

    const result = await controller.getManifest(type, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.transformerService.getManifest).toHaveBeenCalledWith(type);
    expect(result).toEqual(mockManifest);
  });

  it('should search for transformers with parameters', async () => {
    const type: 'standard' | 'custom' = 'custom';
    const inputType: OIBusDataType = 'any';
    const outputType: OIBusDataType = 'any';
    const page = 1;

    const searchParams: TransformerSearchParam = {
      type,
      inputType,
      outputType,
      page
    };

    const expectedResult = createPageFromArray(testData.transformers.list, 25, 0);
    (mockRequest.services!.transformerService.search as jest.Mock).mockReturnValue(expectedResult);

    const result = await controller.search(type, inputType, outputType, page, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.transformerService.search).toHaveBeenCalledWith(searchParams);
    expect(result).toEqual({
      ...expectedResult,
      content: expectedResult.content
    });
  });

  it('should return transformers with default search parameters', async () => {
    const searchParams: TransformerSearchParam = {
      type: undefined,
      inputType: undefined,
      outputType: undefined,
      page: 0
    };

    const expectedResult = createPageFromArray(testData.transformers.list, 25, 0);
    (mockRequest.services!.transformerService.search as jest.Mock).mockReturnValue(expectedResult);

    const result = await controller.search(undefined, undefined, undefined, undefined, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.transformerService.search).toHaveBeenCalledWith(searchParams);
    expect(result).toEqual({
      ...expectedResult,
      content: expectedResult.content
    });
  });

  it('should return a list of all transformers', async () => {
    const mockTransformers = testData.transformers.list;
    (mockRequest.services!.transformerService.findAll as jest.Mock).mockReturnValue(mockTransformers);

    const result = await controller.list(mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.transformerService.findAll).toHaveBeenCalled();
    expect(result).toEqual(mockTransformers);
  });

  it('should return a transformer by ID', async () => {
    const mockTransformer = testData.transformers.list[0];
    const transformerId = mockTransformer.id;
    (mockRequest.services!.transformerService.findById as jest.Mock).mockReturnValue(mockTransformer);

    const result = await controller.findById(transformerId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.transformerService.findById).toHaveBeenCalledWith(transformerId);
    expect(result).toEqual(mockTransformer);
  });

  it('should create a new custom transformer', async () => {
    const command: CustomTransformerCommandDTO = testData.transformers.command;
    const createdTransformer = testData.transformers.list[0];
    (mockRequest.services!.transformerService.create as jest.Mock).mockResolvedValue(createdTransformer);

    const result = await controller.create(command, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.transformerService.create).toHaveBeenCalledWith(command);
    expect(result).toEqual(createdTransformer);
  });

  it('should update an existing transformer', async () => {
    const transformerId = testData.transformers.list[0].id;
    const command: CustomTransformerCommandDTO = testData.transformers.command;
    (mockRequest.services!.transformerService.update as jest.Mock).mockResolvedValue(undefined);

    await controller.update(transformerId, command, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.transformerService.update).toHaveBeenCalledWith(transformerId, command);
  });

  it('should delete a transformer', async () => {
    const transformerId = testData.transformers.list[0].id;
    (mockRequest.services!.transformerService.delete as jest.Mock).mockResolvedValue(undefined);

    await controller.delete(transformerId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.transformerService.delete).toHaveBeenCalledWith(transformerId);
  });

  it('should test a transformer', async () => {
    const transformerId = testData.transformers.list[0].id;
    (mockRequest.services!.transformerService.test as jest.Mock).mockResolvedValue(undefined);

    const command: TransformerTestRequest = {
      inputData: 'time-values',
      options: {}
    };

    await controller.test(
      transformerId,
      {
        inputData: 'time-values',
        options: {}
      },
      mockRequest as CustomExpressRequest
    );

    expect(mockRequest.services!.transformerService.test).toHaveBeenCalledWith(transformerId, command);
  });

  it('should get a template for transformer', async () => {
    const inputType = 'time-values';
    (mockRequest.services!.transformerService.generateTemplate as jest.Mock).mockResolvedValue(undefined);

    await controller.getInputTemplate(inputType, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.transformerService.generateTemplate).toHaveBeenCalledWith(inputType);
  });
});
