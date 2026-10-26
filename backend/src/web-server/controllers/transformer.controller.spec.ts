import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { before, beforeEach, describe, it, mock } from 'node:test';

import {
  CustomTransformerCommandDTO,
  InputTemplate,
  TransformerTestRequest,
  TransformerTestResponse
} from '../../../shared/model/api/transformer.model';
import { OIBusDataType } from '../../../shared/model/common/content.model';
import { createPageFromArray } from '../../../shared/model/common/types';
import { InputType, TransformerManifest } from '../../../shared/model/connector/transformer-manifest.model';
import { TransformerSearchParam } from '../../../shared/model/domain/transformer.model';

import type { CustomTransformer } from '../../model/transformer.model';
import type TransformerService from '../../service/transformer.service';
import type UserService from '../../service/user.service';
import testData from '../../tests/utils/test-data';
import { createMock, createMockServices, fixTsoaModuleResolution, Mocked, mockModule, reloadModule } from '../../tests/utils/test-utils';
import { CustomExpressRequest } from '../express';
import type { TransformerController as TransformerControllerShape } from './transformer.controller';

const nodeRequire = createRequire(import.meta.url);

// The DTO mapper returns the entity as is, after asking for the user info like the real one
const createTransformerServiceModuleMocks = () => ({
  toTransformerDTO: mock.fn((transformer: unknown, getUserInfo: (id: string) => void) => {
    getUserInfo('');
    return transformer;
  })
});
// Same object for the whole file (the controller keeps it): its functions are replaced in beforeEach
const transformerServiceModule = createTransformerServiceModuleMocks();
let TransformerController: typeof TransformerControllerShape;

before(() => {
  fixTsoaModuleResolution(nodeRequire);
  mockModule(nodeRequire, '../../service/transformer.service', transformerServiceModule);
  const mod = reloadModule<{ TransformerController: typeof TransformerControllerShape }>(nodeRequire, './transformer.controller');
  TransformerController = mod.TransformerController;
});

const isoManifest: TransformerManifest = {
  id: 'file',
  inputType: 'file',
  outputType: 'file',
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

describe('TransformerController', () => {
  let controller: TransformerControllerShape;
  let transformerService: Mocked<TransformerService>;
  let userService: Mocked<UserService>;
  let mockRequest: Partial<CustomExpressRequest>;

  beforeEach(() => {
    transformerService = createMock<TransformerService>();
    userService = createMock<UserService>();
    mockRequest = {
      services: createMockServices({ transformerService, userService }),
      user: { id: 'test', login: 'testUser' }
    };
    Object.assign(transformerServiceModule, createTransformerServiceModuleMocks());
    controller = new TransformerController();
  });

  it('should return transformer types', async () => {
    const mockManifests = [isoManifest];
    transformerService.listManifest.mock.mockImplementation(() => mockManifests);

    const result = await controller.listManifest(mockRequest as CustomExpressRequest);

    assert.strictEqual(transformerService.listManifest.mock.calls.length, 1);
    assert.deepStrictEqual(result, [{ id: 'file', inputType: 'file', outputType: 'file' }]);
  });

  it('should return a transformer manifest', async () => {
    const mockManifest = isoManifest;
    const type = 'file';
    transformerService.getManifest.mock.mockImplementation(() => mockManifest);

    const result = await controller.getManifest(type, mockRequest as CustomExpressRequest);

    assert.strictEqual(transformerService.getManifest.mock.calls.length, 1);
    assert.deepStrictEqual(transformerService.getManifest.mock.calls[0].arguments[0], type);
    assert.deepStrictEqual(result, mockManifest);
  });

  it('should search for transformers with parameters', async () => {
    const type: 'standard' | 'custom' = 'custom';
    const inputType: OIBusDataType = 'file';
    const outputType: OIBusDataType = 'file';
    const page = 1;

    const searchParams: TransformerSearchParam = { type, inputType, outputType, page };

    const expectedResult = createPageFromArray(testData.transformers.list, 25, 0);
    transformerService.search.mock.mockImplementation(() => expectedResult);

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
    transformerService.search.mock.mockImplementation(() => expectedResult);

    const result = await controller.search(undefined, undefined, undefined, undefined, mockRequest as CustomExpressRequest);

    assert.strictEqual(transformerService.search.mock.calls.length, 1);
    assert.deepStrictEqual(transformerService.search.mock.calls[0].arguments[0], searchParams);
    assert.deepStrictEqual(result, { ...expectedResult, content: expectedResult.content });
  });

  it('should return a list of all transformers', async () => {
    const mockTransformers = testData.transformers.list;
    transformerService.findAll.mock.mockImplementation(() => mockTransformers);

    const result = await controller.list(mockRequest as CustomExpressRequest);

    assert.strictEqual(transformerService.findAll.mock.calls.length, 1);
    assert.deepStrictEqual(result, mockTransformers);
  });

  it('should return a transformer by ID', async () => {
    const mockTransformer = testData.transformers.list[0];
    const transformerId = mockTransformer.id;
    transformerService.findById.mock.mockImplementation(() => mockTransformer);

    const result = await controller.findById(transformerId, mockRequest as CustomExpressRequest);

    assert.strictEqual(transformerService.findById.mock.calls.length, 1);
    assert.deepStrictEqual(transformerService.findById.mock.calls[0].arguments[0], transformerId);
    assert.deepStrictEqual(result, mockTransformer);
  });

  it('should create a new custom transformer', async () => {
    const command: CustomTransformerCommandDTO = testData.transformers.command;
    const createdTransformer = testData.transformers.list[0] as CustomTransformer;
    transformerService.create.mock.mockImplementation(async () => createdTransformer);

    const result = await controller.create(command, mockRequest as CustomExpressRequest);

    assert.strictEqual(transformerService.create.mock.calls.length, 1);
    assert.deepStrictEqual(transformerService.create.mock.calls[0].arguments, [command, 'test']);
    assert.deepStrictEqual(result, createdTransformer);
  });

  it('should update an existing transformer', async () => {
    const transformerId = testData.transformers.list[0].id;
    const command: CustomTransformerCommandDTO = testData.transformers.command;
    transformerService.update.mock.mockImplementation(async () => undefined);

    await controller.update(transformerId, command, mockRequest as CustomExpressRequest);

    assert.strictEqual(transformerService.update.mock.calls.length, 1);
    assert.deepStrictEqual(transformerService.update.mock.calls[0].arguments, [transformerId, command, 'test']);
  });

  it('should delete a transformer', async () => {
    const transformerId = testData.transformers.list[0].id;
    transformerService.delete.mock.mockImplementation(async () => undefined);

    await controller.delete(transformerId, mockRequest as CustomExpressRequest);

    assert.strictEqual(transformerService.delete.mock.calls.length, 1);
    assert.deepStrictEqual(transformerService.delete.mock.calls[0].arguments, [transformerId, 'test']);
  });

  it('should test a transformer', async () => {
    const testRequest: TransformerTestRequest = { inputData: 'record-list', options: {} };
    const transformerCommand: CustomTransformerCommandDTO = testData.transformers.command;
    const body = { transformer: transformerCommand, testRequest };
    transformerService.test.mock.mockImplementation(
      async (_command: CustomTransformerCommandDTO, _testRequest: TransformerTestRequest): Promise<TransformerTestResponse> =>
        ({}) as TransformerTestResponse
    );

    await controller.test(body, mockRequest as CustomExpressRequest);

    assert.strictEqual(transformerService.test.mock.calls.length, 1);
    assert.deepStrictEqual(transformerService.test.mock.calls[0].arguments, [transformerCommand, testRequest]);
  });

  it('should wrap a transformer test failure in an OIBusTestingError', async () => {
    const testRequest: TransformerTestRequest = { inputData: 'record-list', options: {} };
    const transformerCommand: CustomTransformerCommandDTO = testData.transformers.command;
    const body = { transformer: transformerCommand, testRequest };
    transformerService.test.mock.mockImplementation(async () => {
      throw new Error('transformer failed');
    });

    await assert.rejects(controller.test(body, mockRequest as CustomExpressRequest), { message: 'transformer failed' });
  });

  it('should test a transformer with input data by id', async () => {
    const testRequest: TransformerTestRequest = { inputData: '[]', options: { foo: 'bar' } };
    const testResult = {
      raw: { type: 'file', content: '[]' },
      transformed: { type: 'file', content: 'out' },
      connectionDuration: 0,
      queryDuration: 0
    };
    transformerService.testTransformer.mock.mockImplementation(async () => testResult as never);

    const result = await controller.testTransformer('transformer-id', testRequest, mockRequest as CustomExpressRequest);

    assert.strictEqual(transformerService.testTransformer.mock.calls.length, 1);
    assert.deepStrictEqual(transformerService.testTransformer.mock.calls[0].arguments, ['transformer-id', { foo: 'bar' }, '[]']);
    assert.deepStrictEqual(result, testResult);
  });

  it('should wrap testTransformer errors in an OIBusTestingError', async () => {
    transformerService.testTransformer.mock.mockImplementation(async () => {
      throw new Error('boom');
    });

    await assert.rejects(
      () => controller.testTransformer('transformer-id', { inputData: 'x' } as TransformerTestRequest, mockRequest as CustomExpressRequest),
      /boom/
    );
  });

  it('should get a template for transformer', async () => {
    const inputType = 'record-list';
    transformerService.generateTemplate.mock.mockImplementation((_inputType: InputType): InputTemplate => ({}) as InputTemplate);

    await controller.getInputTemplate(inputType, mockRequest as CustomExpressRequest);

    assert.strictEqual(transformerService.generateTemplate.mock.calls.length, 1);
    assert.deepStrictEqual(transformerService.generateTemplate.mock.calls[0].arguments[0], inputType);
  });
});
