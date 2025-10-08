import JoiValidator from '../web-server/controllers/validators/joi.validator';
import { transformerSchema } from '../web-server/controllers/validators/oibus-validation-schema';
import testData from '../tests/utils/test-data';
import TransformerService, { createTransformer, getStandardManifest } from './transformer.service';
import TransformerRepository from '../repository/config/transformer.repository';
import TransformerRepositoryMock from '../tests/__mocks__/repository/config/transformer-repository.mock';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import OianalyticsMessageServiceMock from '../tests/__mocks__/service/oia/oianalytics-message-service.mock';
import { CustomTransformer, StandardTransformer } from '../model/transformer.model';
import pino from 'pino';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import IsoTransformer from './transformers/iso-transformer';
import OIBusTimeValuesToJSONTransformer from './transformers/time-values/oibus-time-values-to-json-transformer';
import OIBusTimeValuesToCsvTransformer from './transformers/time-values/oibus-time-values-to-csv-transformer';
import OIBusTimeValuesToModbusTransformer from './transformers/time-values/oibus-time-values-to-modbus-transformer';
import OIBusTimeValuesToOPCUATransformer from './transformers/time-values/oibus-time-values-to-opcua-transformer';
import OIBusTimeValuesToMQTTTransformer from './transformers/time-values/oibus-time-values-to-mqtt-transformer';
import IgnoreTransformer from './transformers/ignore-transformer';
import OIBusSetpointToMQTTTransformer from './transformers/setpoint/oibus-setpoint-to-mqtt-transformer';
import OIBusSetpointToModbusTransformer from './transformers/setpoint/oibus-setpoint-to-modbus-transformer';
import OIBusSetpointToOPCUATransformer from './transformers/setpoint/oibus-setpoint-to-opcua-transformer';
import OIBusCustomTransformer from './transformers/oibus-custom-transformer';

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
    expect(result).toEqual(testData.transformers.command);
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
      type: 'standard'
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
      type: 'standard'
    } as StandardTransformer;
    (transformerRepository.findById as jest.Mock).mockReturnValueOnce(standardTransformer);

    await expect(service.delete(standardTransformer.id)).rejects.toThrow(
      new Error(`Cannot delete standard transformer ${standardTransformer.id}`)
    );

    expect(transformerRepository.findById).toHaveBeenCalledWith(standardTransformer.id);
    expect(transformerRepository.save).not.toHaveBeenCalled();
  });

  it('createTransformer() should create standard transformers', async () => {
    const logger: pino.Logger = new PinoLogger();

    const transformer: StandardTransformer = JSON.parse(JSON.stringify(testData.transformers.list[0]));
    transformer.type = 'standard';
    transformer.functionName = 'time-values-to-csv';
    expect(createTransformer({ transformer, options: {}, inputType: 'time-values' }, testData.north.list[0], logger)).toBeInstanceOf(
      OIBusTimeValuesToCsvTransformer
    );

    transformer.functionName = 'time-values-to-json';
    expect(createTransformer({ transformer, options: {}, inputType: 'time-values' }, testData.north.list[0], logger)).toBeInstanceOf(
      OIBusTimeValuesToJSONTransformer
    );

    transformer.functionName = 'time-values-to-modbus';
    expect(createTransformer({ transformer, options: {}, inputType: 'time-values' }, testData.north.list[0], logger)).toBeInstanceOf(
      OIBusTimeValuesToModbusTransformer
    );

    transformer.functionName = 'time-values-to-opcua';
    expect(createTransformer({ transformer, options: {}, inputType: 'time-values' }, testData.north.list[0], logger)).toBeInstanceOf(
      OIBusTimeValuesToOPCUATransformer
    );

    transformer.functionName = 'time-values-to-mqtt';
    expect(createTransformer({ transformer, options: {}, inputType: 'time-values' }, testData.north.list[0], logger)).toBeInstanceOf(
      OIBusTimeValuesToMQTTTransformer
    );

    transformer.functionName = 'setpoint-to-mqtt';
    expect(createTransformer({ transformer, options: {}, inputType: 'setpoint' }, testData.north.list[0], logger)).toBeInstanceOf(
      OIBusSetpointToMQTTTransformer
    );

    transformer.functionName = 'setpoint-to-modbus';
    expect(createTransformer({ transformer, options: {}, inputType: 'setpoint' }, testData.north.list[0], logger)).toBeInstanceOf(
      OIBusSetpointToModbusTransformer
    );

    transformer.functionName = 'setpoint-to-opcua';
    expect(createTransformer({ transformer, options: {}, inputType: 'setpoint' }, testData.north.list[0], logger)).toBeInstanceOf(
      OIBusSetpointToOPCUATransformer
    );

    transformer.functionName = 'bad-id';
    expect(() => createTransformer({ transformer, options: {}, inputType: 'any' }, testData.north.list[0], logger)).toThrow(
      'Transformer transformerId1 (standard) not implemented'
    );
  });

  it('createTransformer() should create a custom transformer', async () => {
    const logger: pino.Logger = new PinoLogger();

    const transformer: CustomTransformer = JSON.parse(JSON.stringify(testData.transformers.list[0]));
    expect(createTransformer({ transformer, options: {}, inputType: 'time-values' }, testData.north.list[0], logger)).toBeInstanceOf(
      OIBusCustomTransformer
    );
  });

  it('getStandardManifest() should get standard manifest', async () => {
    expect(getStandardManifest('iso')).toEqual(IsoTransformer.manifestSettings);
    expect(getStandardManifest('ignore')).toEqual(IgnoreTransformer.manifestSettings);
    expect(getStandardManifest('time-values-to-csv')).toEqual(OIBusTimeValuesToCsvTransformer.manifestSettings);
    expect(getStandardManifest('time-values-to-json')).toEqual(OIBusTimeValuesToJSONTransformer.manifestSettings);
    expect(getStandardManifest('time-values-to-modbus')).toEqual(OIBusTimeValuesToModbusTransformer.manifestSettings);
    expect(getStandardManifest('time-values-to-opcua')).toEqual(OIBusTimeValuesToOPCUATransformer.manifestSettings);
    expect(getStandardManifest('time-values-to-mqtt')).toEqual(OIBusTimeValuesToMQTTTransformer.manifestSettings);
    expect(getStandardManifest('setpoint-to-mqtt')).toEqual(OIBusSetpointToMQTTTransformer.manifestSettings);
    expect(getStandardManifest('setpoint-to-modbus')).toEqual(OIBusSetpointToModbusTransformer.manifestSettings);
    expect(getStandardManifest('setpoint-to-opcua')).toEqual(OIBusSetpointToOPCUATransformer.manifestSettings);
    expect(() => getStandardManifest('bad-id')).toThrow(`Could not find manifest for bad-id transformer`);
  });

  describe('test', () => {
    it('should test a custom transformer successfully', async () => {
      const customTransformer: CustomTransformer = {
        id: 'test-transformer',
        type: 'custom',
        name: 'Test Transformer',
        description: 'Test transformer for testing',
        inputType: 'time-values',
        outputType: 'any',
        customCode: `
          function transform(data, source, filename, options) {
            return {
              data: JSON.parse(data),
              filename: 'test-output.json',
              numberOfElement: 1
            };
          }
        `,
        language: 'javascript',
        customManifest: {
          type: 'object',
          key: 'options',
          translationKey: 'test',
          attributes: [],
          enablingConditions: [],
          validators: [],
          displayProperties: {
            visible: true,
            wrapInBox: false
          }
        }
      };

      (transformerRepository.findById as jest.Mock).mockReturnValueOnce(customTransformer);

      const testRequest = {
        inputData: JSON.stringify([{ pointId: 'test', timestamp: '2023-01-01T00:00:00Z', data: { value: 42 } }]),
        options: { testOption: 'value' }
      };

      const result = await service.test('test-transformer', testRequest);

      expect(result).toHaveProperty('output');
      expect(result).toHaveProperty('metadata');
      expect(result.metadata).toHaveProperty('contentType', 'any');
      expect(result.metadata).toHaveProperty('numberOfElement', 1);
    });

    it('should throw error when transformer not found', async () => {
      (transformerRepository.findById as jest.Mock).mockReturnValueOnce(null);

      const testRequest = {
        inputData: 'test data',
        options: {}
      };

      await expect(service.test('non-existent', testRequest)).rejects.toThrow('Transformer non-existent not found');
    });

    it('should throw error when trying to test standard transformer', async () => {
      const standardTransformer: StandardTransformer = {
        id: 'standard-transformer',
        type: 'standard',
        inputType: 'time-values',
        outputType: 'any',
        functionName: 'iso'
      };

      (transformerRepository.findById as jest.Mock).mockReturnValueOnce(standardTransformer);

      const testRequest = {
        inputData: 'test data',
        options: {}
      };

      await expect(service.test('standard-transformer', testRequest)).rejects.toThrow(
        'Cannot test standard transformer standard-transformer'
      );
    });

    it('should test a custom transformer with undefined options', async () => {
      const customTransformer: CustomTransformer = {
        id: 'test-transformer',
        type: 'custom',
        name: 'Test Transformer',
        description: 'Test transformer for testing',
        inputType: 'time-values',
        outputType: 'any',
        customCode: `
          function transform(data, source, filename, options) {
            return {
              data: JSON.parse(data),
              filename: 'test-output.json',
              numberOfElement: 1
            };
          }
        `,
        language: 'javascript',
        customManifest: {
          type: 'object',
          key: 'options',
          translationKey: 'test',
          attributes: [],
          enablingConditions: [],
          validators: [],
          displayProperties: {
            visible: true,
            wrapInBox: false
          }
        }
      };

      (transformerRepository.findById as jest.Mock).mockReturnValueOnce(customTransformer);

      const testRequest = {
        inputData: JSON.stringify([{ pointId: 'test', timestamp: '2023-01-01T00:00:00Z', data: { value: 42 } }])
        // options is undefined
      };

      const result = await service.test('test-transformer', testRequest);

      expect(result).toHaveProperty('output');
      expect(result).toHaveProperty('metadata');
      expect(result.metadata).toHaveProperty('contentType', 'any');
      expect(result.metadata).toHaveProperty('numberOfElement', 1);
    });
  });
});
