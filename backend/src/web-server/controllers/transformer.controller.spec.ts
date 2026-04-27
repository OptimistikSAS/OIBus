import { describe, it, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  CustomTransformerCommandDTO,
  TransformerManifest,
  TransformerSearchParam,
  TransformerTestRequest
} from '../../../shared/model/transformer.model';
import { CustomExpressRequest } from '../express';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule, fixTsoaModuleResolution } from '../../tests/utils/test-utils';
import TransformerServiceMock from '../../tests/__mocks__/service/transformer-service.mock';
import UserServiceMock from '../../tests/__mocks__/service/user-service.mock';
import { createPageFromArray } from '../../../shared/model/types';
import { OIBusDataType } from '../../../shared/model/engine.model';
import type { TransformerController as TransformerControllerShape } from './transformer.controller';

const nodeRequire = createRequire(import.meta.url);

let mockTransformerServiceModule: Record<string, ReturnType<typeof mock.fn>>;
let TransformerController: typeof TransformerControllerShape;

before(() => {
  fixTsoaModuleResolution(nodeRequire);
  mockTransformerServiceModule = {
    toTransformerDTO: mock.fn((transformer: unknown, getUserInfo: (id: string) => void) => {
      getUserInfo('');
      return transformer;
    })
  };
  mockModule(nodeRequire, '../../service/transformer.service', mockTransformerServiceModule);
  const mod = reloadModule<{ TransformerController: typeof TransformerControllerShape }>(nodeRequire, './transformer.controller');
  TransformerController = mod.TransformerController;
});

describe('TransformerController', () => {
  let controller: TransformerControllerShape;
  let transformerService: TransformerServiceMock;
  let userService: UserServiceMock;
  let mockRequest: Partial<CustomExpressRequest>;

  beforeEach(() => {
    transformerService = new TransformerServiceMock();
    userService = new UserServiceMock();
    mockRequest = {
      services: { transformerService, userService },
      user: { id: 'test', login: 'testUser' }
    } as Partial<CustomExpressRequest>;
    mockTransformerServiceModule.toTransformerDTO = mock.fn((transformer: unknown, getUserInfo: (id: string) => void) => {
      getUserInfo('');
      return transformer;
    });
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
    transformerService.listManifest = mock.fn(() => mockManifests);

    const result = await controller.listManifest(mockRequest as CustomExpressRequest);

    assert.strictEqual(transformerService.listManifest.mock.calls.length, 1);
    assert.deepStrictEqual(result, [{ id: 'iso', inputType: 'any', outputType: 'any' }]);
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
    transformerService.getManifest = mock.fn(() => mockManifest);

    const result = await controller.getManifest(type, mockRequest as CustomExpressRequest);

    assert.strictEqual(transformerService.getManifest.mock.calls.length, 1);
    assert.deepStrictEqual(transformerService.getManifest.mock.calls[0].arguments[0], type);
    assert.deepStrictEqual(result, mockManifest);
  });

  it('should search for transformers with parameters', async () => {
    const type: 'standard' | 'custom' = 'custom';
    const inputType: OIBusDataType = 'any';
    const outputType: OIBusDataType = 'any';
    const page = 1;

    const searchParams: TransformerSearchParam = { type, inputType, outputType, page };

    const expectedResult = createPageFromArray(testData.transformers.list, 25, 0);
    transformerService.search = mock.fn(() => expectedResult);

    const result = await controller.search(type, inputType, outputType, page, mockRequest as CustomExpressRequest);

    assert.strictEqual(transformerService.search.mock.calls.length, 1);
    assert.deepStrictEqual(transformerService.search.mock.calls[0].arguments[0], searchParams);
    assert.deepStrictEqual(result, { ...expectedResult, content: expectedResult.content });
  });

  it('should return transformers with default search parameters', async () => {
    const searchParams: TransformerSearchParam = {
      type: undefined,
      inputType: undefined,
      outputType: undefined,
      page: 0
    };

    const expectedResult = createPageFromArray(testData.transformers.list, 25, 0);
    transformerService.search = mock.fn(() => expectedResult);

    const result = await controller.search(undefined, undefined, undefined, undefined, mockRequest as CustomExpressRequest);

    assert.strictEqual(transformerService.search.mock.calls.length, 1);
    assert.deepStrictEqual(transformerService.search.mock.calls[0].arguments[0], searchParams);
    assert.deepStrictEqual(result, { ...expectedResult, content: expectedResult.content });
  });

  it('should return a list of all transformers', async () => {
    const mockTransformers = testData.transformers.list;
    transformerService.findAll = mock.fn(() => mockTransformers);

    const result = await controller.list(mockRequest as CustomExpressRequest);

    assert.strictEqual(transformerService.findAll.mock.calls.length, 1);
    assert.deepStrictEqual(result, mockTransformers);
  });

  it('should return a transformer by ID', async () => {
    const mockTransformer = testData.transformers.list[0];
    const transformerId = mockTransformer.id;
    transformerService.findById = mock.fn(() => mockTransformer);

    const result = await controller.findById(transformerId, mockRequest as CustomExpressRequest);

    assert.strictEqual(transformerService.findById.mock.calls.length, 1);
    assert.deepStrictEqual(transformerService.findById.mock.calls[0].arguments[0], transformerId);
    assert.deepStrictEqual(result, mockTransformer);
  });

  it('should create a new custom transformer', async () => {
    const command: CustomTransformerCommandDTO = testData.transformers.command;
    const createdTransformer = testData.transformers.list[0];
    transformerService.create = mock.fn(async () => createdTransformer);

    const result = await controller.create(command, mockRequest as CustomExpressRequest);

    assert.strictEqual(transformerService.create.mock.calls.length, 1);
    assert.deepStrictEqual(transformerService.create.mock.calls[0].arguments, [command, 'test']);
    assert.deepStrictEqual(result, createdTransformer);
  });

  it('should update an existing transformer', async () => {
    const transformerId = testData.transformers.list[0].id;
    const command: CustomTransformerCommandDTO = testData.transformers.command;
    transformerService.update = mock.fn(async () => undefined);

    await controller.update(transformerId, command, mockRequest as CustomExpressRequest);

    assert.strictEqual(transformerService.update.mock.calls.length, 1);
    assert.deepStrictEqual(transformerService.update.mock.calls[0].arguments, [transformerId, command, 'test']);
  });

  it('should delete a transformer', async () => {
    const transformerId = testData.transformers.list[0].id;
    transformerService.delete = mock.fn(async () => undefined);

    await controller.delete(transformerId, mockRequest as CustomExpressRequest);

    assert.strictEqual(transformerService.delete.mock.calls.length, 1);
    assert.deepStrictEqual(transformerService.delete.mock.calls[0].arguments[0], transformerId);
  });

  it('should test a transformer', async () => {
    const transformerId = testData.transformers.list[0].id;
    const command: TransformerTestRequest = { inputData: 'time-values', options: {} };
    transformerService.test = mock.fn(async () => undefined);

    await controller.test(transformerId, command, mockRequest as CustomExpressRequest);

    assert.strictEqual(transformerService.test.mock.calls.length, 1);
    assert.deepStrictEqual(transformerService.test.mock.calls[0].arguments, [transformerId, command]);
  });

  it('should get a template for transformer', async () => {
    const inputType = 'time-values';
    transformerService.generateTemplate = mock.fn(async () => undefined);

    await controller.getInputTemplate(inputType, mockRequest as CustomExpressRequest);

    assert.strictEqual(transformerService.generateTemplate.mock.calls.length, 1);
    assert.deepStrictEqual(transformerService.generateTemplate.mock.calls[0].arguments[0], inputType);
  });
});
