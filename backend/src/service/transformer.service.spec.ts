import JoiValidator from '../web-server/controllers/validators/joi.validator';
import { transformerSchema } from '../web-server/controllers/validators/oibus-validation-schema';
import testData from '../tests/utils/test-data';
import TransformerService, { createTransformer } from './transformer.service';
import TransformerRepository from '../repository/config/transformer.repository';
import TransformerRepositoryMock from '../tests/__mocks__/repository/config/transformer-repository.mock';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import OianalyticsMessageServiceMock from '../tests/__mocks__/service/oia/oianalytics-message-service.mock';
import { StandardTransformer, Transformer } from '../model/transformer.model';
import pino from 'pino';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import IsoRawTransformer from './transformers/iso-raw-transformer';
import IsoTimeValuesTransformer from './transformers/iso-time-values-transformer';
import OIBusTimeValuesToJSONTransformer from './transformers/oibus-time-values-to-json-transformer';
import OIBusTimeValuesToCsvTransformer from './transformers/oibus-time-values-to-csv-transformer';
import OIBusTimeValuesToModbusTransformer from './transformers/oibus-time-values-to-modbus-transformer';
import OIBusTimeValuesToOPCUATransformer from './transformers/oibus-time-values-to-opcua-transformer';
import OIBusTimeValuesToMQTTTransformer from './transformers/oibus-time-values-to-mqtt-transformer';

jest.mock('papaparse');
jest.mock('./utils');
jest.mock('../web-server/controllers/validators/joi.validator');

const validator = new JoiValidator();
const transformerRepository: TransformerRepository = new TransformerRepositoryMock();
const oiAnalyticsMessageService: OIAnalyticsMessageService = new OianalyticsMessageServiceMock();

let service: TransformerService;
describe('Transformer Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    service = new TransformerService(validator, transformerRepository, oiAnalyticsMessageService);
  });

  it('search() should search transformers', () => {
    (transformerRepository.search as jest.Mock).mockReturnValueOnce(testData.transformers.list);

    const result = service.search({});

    expect(transformerRepository.search).toHaveBeenCalled();
    expect(result).toEqual(testData.transformers.list);
  });

  it('findAll() should find all transformers', () => {
    (transformerRepository.findAll as jest.Mock).mockReturnValueOnce(testData.transformers.list);

    const result = service.findAll();

    expect(transformerRepository.findAll).toHaveBeenCalled();
    expect(result).toEqual(testData.transformers.list);
  });

  it('findById() should find a transformer by id', () => {
    (transformerRepository.findById as jest.Mock).mockReturnValueOnce(testData.transformers.list[0]);

    const result = service.findById(testData.transformers.list[0].id);

    expect(transformerRepository.findById).toHaveBeenCalledWith(testData.transformers.list[0].id);
    expect(result).toEqual(testData.transformers.list[0]);
  });

  it('create() should create a transformer', async () => {
    const result = await service.create(testData.transformers.command);

    expect(validator.validate).toHaveBeenCalledWith(transformerSchema, testData.transformers.command);
    expect(result).toEqual({ type: 'custom', ...testData.transformers.command });
  });

  it('update() should update a transformer', async () => {
    (transformerRepository.findById as jest.Mock).mockReturnValueOnce(testData.transformers.list[0]);

    await service.update(testData.transformers.list[0].id, testData.transformers.command);

    expect(validator.validate).toHaveBeenCalledWith(transformerSchema, testData.transformers.command);
    expect(transformerRepository.findById).toHaveBeenCalledWith(testData.transformers.list[0].id);
    expect(transformerRepository.save).toHaveBeenCalledWith({
      ...testData.transformers.command,
      id: testData.transformers.list[0].id,
      type: 'custom'
    });
  });

  it('update() should not update if the transformer is not found', async () => {
    (transformerRepository.findById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.update(testData.transformers.list[0].id, testData.transformers.command)).rejects.toThrow(
      new Error(`Transformer ${testData.transformers.list[0].id} not found`)
    );

    expect(transformerRepository.findById).toHaveBeenCalledWith(testData.transformers.list[0].id);
    expect(transformerRepository.save).not.toHaveBeenCalled();
  });

  it('update() should not update if the transformer is a standard one', async () => {
    const standardTransformer: StandardTransformer = {
      id: 'id',
      type: 'standard',
      standardCode: 'code'
    } as StandardTransformer;
    (transformerRepository.findById as jest.Mock).mockReturnValueOnce(standardTransformer);

    await expect(service.update(standardTransformer.id, testData.transformers.command)).rejects.toThrow(
      new Error(`Cannot edit standard transformer ${standardTransformer.id}`)
    );

    expect(transformerRepository.findById).toHaveBeenCalledWith(standardTransformer.id);
    expect(transformerRepository.save).not.toHaveBeenCalled();
  });

  it('delete() should delete a transformer', async () => {
    (transformerRepository.findById as jest.Mock).mockReturnValueOnce(testData.transformers.list[0]);

    await service.delete(testData.transformers.list[0].id);

    expect(transformerRepository.findById).toHaveBeenCalledWith(testData.transformers.list[0].id);
    expect(transformerRepository.delete).toHaveBeenCalledWith(testData.transformers.list[0].id);
  });

  it('delete() should not delete if the transformer is not found', async () => {
    (transformerRepository.findById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.delete(testData.transformers.list[0].id)).rejects.toThrow(
      new Error(`Transformer ${testData.transformers.list[0].id} not found`)
    );

    expect(transformerRepository.findById).toHaveBeenCalledWith(testData.transformers.list[0].id);
    expect(transformerRepository.delete).not.toHaveBeenCalled();
  });

  it('delete() should not delete if the transformer is a standard one', async () => {
    const standardTransformer: StandardTransformer = {
      id: 'id',
      type: 'standard',
      standardCode: 'code'
    } as StandardTransformer;
    (transformerRepository.findById as jest.Mock).mockReturnValueOnce(standardTransformer);

    await expect(service.delete(standardTransformer.id)).rejects.toThrow(
      new Error(`Cannot delete standard transformer ${standardTransformer.id}`)
    );

    expect(transformerRepository.findById).toHaveBeenCalledWith(standardTransformer.id);
    expect(transformerRepository.save).not.toHaveBeenCalled();
  });

  it('createTransformer() should create the transformer', async () => {
    const logger: pino.Logger = new PinoLogger();

    const transformer: Transformer = JSON.parse(JSON.stringify(testData.transformers.list[0]));
    transformer.id = 'iso-raw';
    expect(createTransformer(transformer, testData.north.list[0], logger)).toBeInstanceOf(IsoRawTransformer);

    transformer.id = 'iso-time-values';
    expect(createTransformer(transformer, testData.north.list[0], logger)).toBeInstanceOf(IsoTimeValuesTransformer);

    transformer.id = 'time-values-to-csv';
    expect(createTransformer(transformer, testData.north.list[0], logger)).toBeInstanceOf(OIBusTimeValuesToCsvTransformer);

    transformer.id = 'time-values-to-json';
    expect(createTransformer(transformer, testData.north.list[0], logger)).toBeInstanceOf(OIBusTimeValuesToJSONTransformer);

    transformer.id = 'time-values-to-modbus';
    expect(createTransformer(transformer, testData.north.list[0], logger)).toBeInstanceOf(OIBusTimeValuesToModbusTransformer);

    transformer.id = 'time-values-to-opcua';
    expect(createTransformer(transformer, testData.north.list[0], logger)).toBeInstanceOf(OIBusTimeValuesToOPCUATransformer);

    transformer.id = 'time-values-to-mqtt';
    expect(createTransformer(transformer, testData.north.list[0], logger)).toBeInstanceOf(OIBusTimeValuesToMQTTTransformer);

    transformer.id = 'bad-id';
    expect(() => createTransformer(transformer, testData.north.list[0], logger)).toThrow(new Error('Could not create bad-id transformer'));
  });
});
