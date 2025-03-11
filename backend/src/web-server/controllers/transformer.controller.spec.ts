import Joi from 'joi';
import JoiValidator from './validators/joi.validator';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';
import testData from '../../tests/utils/test-data';
import TransformerController from './transformer.controller';
import { toTransformerDTO, toTransformerLightDTO } from '../../service/transformer.service';
import { StandardTransformer } from '../../model/transformer.model';
import IsoRawTransformer from '../../service/transformers/iso-raw-transformer';

jest.mock('./validators/joi.validator');

const validator = new JoiValidator();
const schema = Joi.object({});
const transformerController = new TransformerController(validator, schema);

const ctx = new KoaContextMock();

describe('Transformer Controller', () => {
  const standardTransformer: StandardTransformer = {
    id: IsoRawTransformer.transformerName,
    type: 'standard',
    name: IsoRawTransformer.transformerName,
    description: '',
    standardCode: '',
    inputType: 'raw',
    outputType: 'raw'
  };
  beforeEach(async () => {
    jest.clearAllMocks();
  });

  it('findAll() should return transformers', async () => {
    ctx.app.transformerService.findAll.mockReturnValueOnce(testData.transformers.list);

    await transformerController.findAll(ctx);

    expect(ctx.app.transformerService.findAll).toHaveBeenCalled();
    expect(ctx.ok).toHaveBeenCalledWith(testData.transformers.list.map(element => toTransformerLightDTO(element)));
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
      content: [...testData.transformers.list.map(element => toTransformerLightDTO(element)), toTransformerLightDTO(standardTransformer)],
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
    expect(ctx.created).toHaveBeenCalledWith(toTransformerLightDTO(testData.transformers.list[0]));
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
});
