import JoiValidator from '../web-server/controllers/validators/joi.validator';
import { transformerSchema } from '../web-server/controllers/validators/oibus-validation-schema';
import testData from '../tests/utils/test-data';
import TransformerService from './transformer.service';
import TransformerRepository from '../repository/config/transformer.repository';
import TransformerRepositoryMock from '../tests/__mocks__/repository/config/transformer-repository.mock';

jest.mock('./utils');
jest.mock('../web-server/controllers/validators/joi.validator');

const validator = new JoiValidator();
const transformerRepository: TransformerRepository = new TransformerRepositoryMock();

let service: TransformerService;
describe('Transformer Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    service = new TransformerService(validator, transformerRepository);
  });

  it('findAll() should find all transformers', () => {
    (transformerRepository.searchTransformers as jest.Mock).mockReturnValueOnce(testData.transformers.list);

    const result = service.searchTransformers({});

    expect(transformerRepository.searchTransformers).toHaveBeenCalled();
    expect(result).toEqual(testData.transformers.list);
  });

  it('findById() should find a transformer by id', () => {
    (transformerRepository.findTransformerById as jest.Mock).mockReturnValueOnce(testData.transformers.list[0]);

    const result = service.findById(testData.transformers.list[0].id);

    expect(transformerRepository.findTransformerById).toHaveBeenCalledWith(testData.transformers.list[0].id);
    expect(result).toEqual(testData.transformers.list[0]);
  });

  it('create() should create a transformer', async () => {
    const result = await service.create(testData.transformers.command);

    expect(validator.validate).toHaveBeenCalledWith(transformerSchema, testData.transformers.command);
    expect(result).toEqual(testData.transformers.command);
  });

  it('update() should update a transformer', async () => {
    (transformerRepository.findTransformerById as jest.Mock).mockReturnValueOnce(testData.transformers.list[0]);

    await service.update(testData.transformers.list[0].id, testData.transformers.command);

    expect(validator.validate).toHaveBeenCalledWith(transformerSchema, testData.transformers.command);
    expect(transformerRepository.findTransformerById).toHaveBeenCalledWith(testData.transformers.list[0].id);
    expect(transformerRepository.saveTransformer).toHaveBeenCalledWith({
      ...testData.transformers.command,
      id: testData.transformers.list[0].id
    });
  });

  it('update() should not update if the transformer is not found', async () => {
    (transformerRepository.findTransformerById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.update(testData.transformers.list[0].id, testData.transformers.command)).rejects.toThrow(
      new Error(`Transformer ${testData.transformers.list[0].id} not found`)
    );

    expect(transformerRepository.findTransformerById).toHaveBeenCalledWith(testData.transformers.list[0].id);
    expect(transformerRepository.saveTransformer).not.toHaveBeenCalled();
  });

  it('delete() should delete a transformer', async () => {
    (transformerRepository.findTransformerById as jest.Mock).mockReturnValueOnce(testData.transformers.list[0]);

    await service.delete(testData.transformers.list[0].id);

    expect(transformerRepository.findTransformerById).toHaveBeenCalledWith(testData.transformers.list[0].id);
    expect(transformerRepository.deleteTransformer).toHaveBeenCalledWith(testData.transformers.list[0].id);
  });

  it('delete() should not delete if the transformer is not found', async () => {
    (transformerRepository.findTransformerById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.delete(testData.transformers.list[0].id)).rejects.toThrow(
      new Error(`Transformer ${testData.transformers.list[0].id} not found`)
    );

    expect(transformerRepository.findTransformerById).toHaveBeenCalledWith(testData.transformers.list[0].id);
    expect(transformerRepository.deleteTransformer).not.toHaveBeenCalled();
  });
});
