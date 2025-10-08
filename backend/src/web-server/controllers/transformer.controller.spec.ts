import Joi from 'joi';
import JoiValidator from './validators/joi.validator';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';
import testData from '../../tests/utils/test-data';
import TransformerController from './transformer.controller';
import { toTransformerDTO } from '../../service/transformer.service';
import { StandardTransformer } from '../../model/transformer.model';
import IsoTransformer from '../../service/transformers/iso-transformer';

jest.mock('./validators/joi.validator');

const validator = new JoiValidator();
const schema = Joi.object({});
const transformerController = new TransformerController(validator, schema);

const ctx = new KoaContextMock();

describe('Transformer Controller', () => {
  const standardTransformer: StandardTransformer = {
    id: IsoTransformer.transformerName,
    type: 'standard',
    functionName: IsoTransformer.transformerName,
    inputType: 'any',
    outputType: 'any'
  };

  beforeEach(async () => {
    jest.clearAllMocks();
  });

  it('findAll() should return transformers', async () => {
    ctx.app.transformerService.findAll.mockReturnValueOnce([...testData.transformers.list, standardTransformer]);

    await transformerController.findAll(ctx);

    expect(ctx.app.transformerService.findAll).toHaveBeenCalled();
    expect(ctx.ok).toHaveBeenCalledWith([
      ...testData.transformers.list.map(element => toTransformerDTO(element)),
      toTransformerDTO(standardTransformer)
    ]);
  });

  it('search() should return transformers', async () => {
    ctx.app.transformerService.search.mockReturnValueOnce({
      content: [...testData.transformers.list, standardTransformer],
      totalElements: testData.transformers.list.length + 1,
      size: 25,
      number: 1,
      totalPages: 1
    });

    await transformerController.search(ctx);

    expect(ctx.app.transformerService.search).toHaveBeenCalled();
    expect(ctx.ok).toHaveBeenCalledWith({
      content: [...testData.transformers.list.map(element => toTransformerDTO(element)), toTransformerDTO(standardTransformer)],
      totalElements: testData.transformers.list.length + 1,
      size: 25,
      number: 1,
      totalPages: 1
    });
  });

  it('findById() should return a custom transformer', async () => {
    const id = 'id';

    ctx.params.id = id;
    ctx.app.transformerService.findById.mockReturnValueOnce(testData.transformers.list[0]);

    await transformerController.findById(ctx);

    expect(ctx.app.transformerService.findById).toHaveBeenCalledWith(id);
    expect(ctx.ok).toHaveBeenCalledWith(toTransformerDTO(testData.transformers.list[0]));
  });

  it('findById() should return a standard transformer', async () => {
    const id = 'id';

    ctx.params.id = id;
    ctx.app.transformerService.findById.mockReturnValueOnce(standardTransformer);

    await transformerController.findById(ctx);

    expect(ctx.app.transformerService.findById).toHaveBeenCalledWith(id);
    expect(ctx.ok).toHaveBeenCalledWith(toTransformerDTO(standardTransformer));
  });

  it('findById() should return not found', async () => {
    const id = 'id';
    ctx.params.id = id;
    ctx.app.transformerService.findById.mockReturnValueOnce(null);

    await transformerController.findById(ctx);

    expect(ctx.app.transformerService.findById).toHaveBeenCalledWith(id);
    expect(ctx.notFound).toHaveBeenCalledWith();
  });

  it('create() should create a transformer', async () => {
    ctx.request.body = testData.transformers.command;
    ctx.app.transformerService.create.mockReturnValueOnce(testData.transformers.list[0]);

    await transformerController.create(ctx);

    expect(ctx.app.transformerService.create).toHaveBeenCalledWith(testData.transformers.command);
    expect(ctx.created).toHaveBeenCalledWith(toTransformerDTO(testData.transformers.list[0]));
  });

  it('create() should throw bad request', async () => {
    ctx.request.body = testData.transformers.command;
    ctx.app.transformerService.create.mockImplementationOnce(() => {
      throw Error('bad request');
    });

    await transformerController.create(ctx);

    expect(ctx.app.transformerService.create).toHaveBeenCalledWith(testData.transformers.command);
    expect(ctx.badRequest).toHaveBeenCalledWith('bad request');
  });

  it('update() should update a transformer', async () => {
    ctx.params.id = 'id';
    ctx.request.body = testData.transformers.command;

    await transformerController.update(ctx);

    expect(ctx.app.transformerService.update).toHaveBeenCalledWith('id', testData.transformers.command);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('update() should throw bad request', async () => {
    ctx.params.id = 'id';
    ctx.request.body = testData.transformers.command;
    ctx.app.transformerService.update.mockImplementationOnce(() => {
      throw Error('bad request');
    });

    await transformerController.update(ctx);

    expect(ctx.app.transformerService.update).toHaveBeenCalledWith('id', testData.transformers.command);
    expect(ctx.badRequest).toHaveBeenCalledWith('bad request');
  });

  it('delete() should delete a transformer', async () => {
    const id = 'id';
    ctx.params.id = id;

    await transformerController.delete(ctx);

    expect(ctx.app.transformerService.delete).toHaveBeenCalledWith(id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('delete() should delete a transformer', async () => {
    const id = 'id';
    ctx.params.id = id;
    ctx.app.transformerService.delete.mockImplementationOnce(() => {
      throw Error('bad request');
    });

    await transformerController.delete(ctx);

    expect(ctx.app.transformerService.delete).toHaveBeenCalledWith(id);
    expect(ctx.badRequest).toHaveBeenCalledWith('bad request');
  });

  it('test() should test a transformer successfully', async () => {
    const id = 'test-transformer';
    const testRequest = {
      inputData: JSON.stringify([{ pointId: 'test', timestamp: '2023-01-01T00:00:00Z', data: { value: 42 } }]),
      options: { testOption: 'value' }
    };
    const testResponse = {
      output: '{"result": "success"}',
      metadata: {
        contentType: 'any',
        numberOfElement: 1
      }
    };

    ctx.params.id = id;
    ctx.request.body = testRequest;
    ctx.app.transformerService.test.mockResolvedValueOnce(testResponse);

    await transformerController.test(ctx);

    expect(ctx.app.transformerService.test).toHaveBeenCalledWith(id, testRequest);
    expect(ctx.ok).toHaveBeenCalledWith(testResponse);
  });

  it('test() should handle test errors', async () => {
    const id = 'test-transformer';
    const testRequest = {
      inputData: 'test data',
      options: {}
    };

    ctx.params.id = id;
    ctx.request.body = testRequest;
    ctx.app.transformerService.test.mockImplementationOnce(() => {
      throw new Error('Test failed');
    });

    await transformerController.test(ctx);

    expect(ctx.app.transformerService.test).toHaveBeenCalledWith(id, testRequest);
    expect(ctx.badRequest).toHaveBeenCalledWith('Test failed');
  });

  it('getInputTemplate() should return input template for time-values', async () => {
    ctx.query.inputType = 'time-values';

    await transformerController.getInputTemplate(ctx);

    expect(ctx.ok).toHaveBeenCalled();
    const response = ctx.ok.mock.calls[0][0];
    expect(response.type).toBe('time-values');
    expect(response.description).toBe('Sample time-series data with multiple sensor readings');
    expect(JSON.parse(response.data)).toBeInstanceOf(Array);
  });

  it('getInputTemplate() should return input template for setpoint', async () => {
    ctx.query.inputType = 'setpoint';

    await transformerController.getInputTemplate(ctx);

    expect(ctx.ok).toHaveBeenCalled();
    const response = ctx.ok.mock.calls[0][0];
    expect(response.type).toBe('setpoint');
    expect(response.description).toBe('Sample setpoint commands for various parameters');
    expect(JSON.parse(response.data)).toBeInstanceOf(Array);
  });

  it('getInputTemplate() should return input template for any', async () => {
    ctx.query.inputType = 'any';

    await transformerController.getInputTemplate(ctx);

    expect(ctx.ok).toHaveBeenCalled();
    const response = ctx.ok.mock.calls[0][0];
    expect(response.type).toBe('any');
    expect(response.description).toBe('Sample file content with structured data');
    expect(JSON.parse(response.data)).toHaveProperty('timestamp');
  });

  it('getInputTemplate() should return bad request when inputType is missing', async () => {
    ctx.query.inputType = undefined;

    await transformerController.getInputTemplate(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('inputType query parameter is required');
  });

  it('getInputTemplate() should handle errors', async () => {
    ctx.query.inputType = 'invalid-type';

    await transformerController.getInputTemplate(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('Unsupported input type: invalid-type');
  });
});
