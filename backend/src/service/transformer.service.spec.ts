import JoiValidator from '../web-server/controllers/validators/joi.validator';
import { transformerSchema } from '../web-server/controllers/validators/oibus-validation-schema';
import testData from '../tests/utils/test-data';
import TransformerService, { createTransformer, getStandardManifest, toTransformerDTO } from './transformer.service';
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
import OIBusTimeValuesToOIAnalyticsTransformer from './transformers/time-values/oibus-time-values-to-oianalytics-transformer';
import OIBusCustomTransformer from './transformers/oibus-custom-transformer';
import { NotFoundError, OIBusValidationError } from '../model/types';
import JSONToTimeValuesTransformer from './transformers/any/json-to-time-values-transformer';
import JSONToCSVTransformer from './transformers/any/json-to-csv-transformer';
import CSVToMQTTTransformer from './transformers/any/csv-to-mqtt-transformer';
import CSVToTimeValuesTransformer from './transformers/any/csv-to-time-values-transformer';
import JSONToMQTTTransformer from './transformers/any/json-to-mqtt-transformer';

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
    (transformerRepository.list as jest.Mock).mockReturnValue([]);

    service = new TransformerService(validator, transformerRepository, oiAnalyticsMessageService);
  });

  it('should search transformers', () => {
    (transformerRepository.search as jest.Mock).mockReturnValueOnce(testData.transformers.list);

    const result = service.search({
      type: undefined,
      inputType: undefined,
      outputType: undefined,
      page: 0
    });

    expect(transformerRepository.search).toHaveBeenCalledWith({ type: undefined, inputType: undefined, outputType: undefined, page: 0 });
    expect(result).toEqual(testData.transformers.list);
  });

  it('should list all transformers', () => {
    (transformerRepository.list as jest.Mock).mockReturnValueOnce(testData.transformers.list);

    const result = service.findAll();

    expect(transformerRepository.list).toHaveBeenCalled();
    expect(result).toEqual(testData.transformers.list);
  });

  it('should find a transformer by id', () => {
    (transformerRepository.findById as jest.Mock).mockReturnValueOnce(testData.transformers.list[0]);

    const result = service.findById(testData.transformers.list[0].id);

    expect(transformerRepository.findById).toHaveBeenCalledWith(testData.transformers.list[0].id);
    expect(result).toEqual(testData.transformers.list[0]);
  });

  it('should not get if the transformer is not found', async () => {
    (transformerRepository.findById as jest.Mock).mockReturnValueOnce(null);

    expect(() => service.findById(testData.transformers.list[0].id)).toThrow(
      new NotFoundError(`Transformer "${testData.transformers.list[0].id}" not found`)
    );
    expect(transformerRepository.findById).toHaveBeenCalledWith(testData.transformers.list[0].id);
  });

  it('should create a transformer', async () => {
    (transformerRepository.list as jest.Mock).mockReturnValueOnce([]);
    const result = await service.create(testData.transformers.command);

    expect(validator.validate).toHaveBeenCalledWith(transformerSchema, testData.transformers.command);
    expect(result).toEqual(testData.transformers.command);
  });

  it('should not create a transformer with duplicate name', async () => {
    (transformerRepository.list as jest.Mock).mockReturnValueOnce([
      { id: 'existing-id', type: 'custom', name: testData.transformers.command.name }
    ]);

    await expect(service.create(testData.transformers.command)).rejects.toThrow(
      new OIBusValidationError(`Transformer name "${testData.transformers.command.name}" already exists`)
    );
  });

  it('should update a transformer', async () => {
    (transformerRepository.findById as jest.Mock).mockReturnValueOnce(testData.transformers.list[0]);
    (transformerRepository.list as jest.Mock).mockReturnValueOnce(testData.transformers.list);

    await service.update(testData.transformers.list[0].id, testData.transformers.command);

    expect(validator.validate).toHaveBeenCalledWith(transformerSchema, testData.transformers.command);
    expect(transformerRepository.findById).toHaveBeenCalledWith(testData.transformers.list[0].id);
    expect(transformerRepository.save).toHaveBeenCalledWith({
      ...testData.transformers.command,
      id: testData.transformers.list[0].id,
      type: 'custom'
    });
  });

  it('should update a transformer without changing the name', async () => {
    const command = JSON.parse(JSON.stringify(testData.transformers.command));
    command.name = (testData.transformers.list[0] as CustomTransformer).name;
    (transformerRepository.findById as jest.Mock).mockReturnValueOnce(testData.transformers.list[0]);
    (transformerRepository.list as jest.Mock).mockClear();

    await service.update(testData.transformers.list[0].id, command);

    expect(transformerRepository.save).toHaveBeenCalledWith({
      ...command,
      id: testData.transformers.list[0].id,
      type: 'custom'
    });
    expect(transformerRepository.list).not.toHaveBeenCalled();
  });

  it('should update a transformer with a new unique name', async () => {
    const command = JSON.parse(JSON.stringify(testData.transformers.command));
    command.name = 'Updated Transformer Name';
    (transformerRepository.findById as jest.Mock).mockReturnValueOnce(testData.transformers.list[0]);
    (transformerRepository.list as jest.Mock).mockReturnValueOnce(testData.transformers.list);

    await service.update(testData.transformers.list[0].id, command);

    expect(transformerRepository.save).toHaveBeenCalledWith({
      ...command,
      id: testData.transformers.list[0].id,
      type: 'custom'
    });
  });

  it('should not update if the transformer is not found', async () => {
    (transformerRepository.findById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.update(testData.transformers.list[0].id, testData.transformers.command)).rejects.toThrow(
      new Error(`Transformer "${testData.transformers.list[0].id}" not found`)
    );

    expect(transformerRepository.findById).toHaveBeenCalledWith(testData.transformers.list[0].id);
    expect(transformerRepository.save).not.toHaveBeenCalled();
  });

  it('should not update a transformer with duplicate name', async () => {
    const command = JSON.parse(JSON.stringify(testData.transformers.command));
    command.name = 'Duplicate Name';
    (transformerRepository.findById as jest.Mock).mockReturnValueOnce(testData.transformers.list[0]);
    // Mock list to return existing custom transformer with same name but different id
    (transformerRepository.list as jest.Mock).mockReturnValueOnce([{ id: 'other-id', type: 'custom', name: 'Duplicate Name' }]);

    await expect(service.update(testData.transformers.list[0].id, command)).rejects.toThrow(
      new OIBusValidationError(`Transformer name "Duplicate Name" already exists`)
    );
  });

  it('should not update if the transformer is a standard one', async () => {
    const standardTransformer: StandardTransformer = {
      id: 'id',
      type: 'standard'
    } as StandardTransformer;
    (transformerRepository.findById as jest.Mock).mockReturnValueOnce(standardTransformer);

    await expect(service.update(standardTransformer.id, testData.transformers.command)).rejects.toThrow(
      new Error(`Cannot edit standard transformer "${standardTransformer.id}"`)
    );

    expect(transformerRepository.findById).toHaveBeenCalledWith(standardTransformer.id);
    expect(transformerRepository.save).not.toHaveBeenCalled();
  });

  it('should delete a transformer', async () => {
    (transformerRepository.findById as jest.Mock).mockReturnValueOnce(testData.transformers.list[0]);

    await service.delete(testData.transformers.list[0].id);

    expect(transformerRepository.findById).toHaveBeenCalledWith(testData.transformers.list[0].id);
    expect(transformerRepository.delete).toHaveBeenCalledWith(testData.transformers.list[0].id);
  });

  it('should not delete if the transformer is not found', async () => {
    (transformerRepository.findById as jest.Mock).mockReturnValueOnce(null);

    expect(() => service.delete(testData.transformers.list[0].id)).toThrow(
      new Error(`Transformer "${testData.transformers.list[0].id}" not found`)
    );

    expect(transformerRepository.findById).toHaveBeenCalledWith(testData.transformers.list[0].id);
    expect(transformerRepository.delete).not.toHaveBeenCalled();
  });

  it('should not delete if the transformer is a standard one', async () => {
    const standardTransformer: StandardTransformer = {
      id: 'id',
      type: 'standard'
    } as StandardTransformer;
    (transformerRepository.findById as jest.Mock).mockReturnValueOnce(standardTransformer);

    expect(() => service.delete(standardTransformer.id)).toThrow(
      new Error(`Cannot delete standard transformer "${standardTransformer.id}"`)
    );

    expect(transformerRepository.findById).toHaveBeenCalledWith(standardTransformer.id);
    expect(transformerRepository.save).not.toHaveBeenCalled();
  });

  it('should create standard transformers', async () => {
    const logger: pino.Logger = new PinoLogger();

    const transformer: StandardTransformer = JSON.parse(JSON.stringify(testData.transformers.list[0]));
    transformer.type = 'standard';

    transformer.functionName = 'csv-to-mqtt';
    expect(
      createTransformer(
        { id: 'northTransformerId1', transformer, options: {}, inputType: 'any', south: undefined },
        testData.north.list[0],
        logger
      )
    ).toBeInstanceOf(CSVToMQTTTransformer);

    transformer.functionName = 'csv-to-time-values';
    expect(
      createTransformer(
        { id: 'northTransformerId1', transformer, options: {}, inputType: 'any', south: undefined },
        testData.north.list[0],
        logger
      )
    ).toBeInstanceOf(CSVToTimeValuesTransformer);

    transformer.functionName = 'json-to-csv';
    expect(
      createTransformer(
        { id: 'northTransformerId1', transformer, options: {}, inputType: 'any', south: undefined },
        testData.north.list[0],
        logger
      )
    ).toBeInstanceOf(JSONToCSVTransformer);

    transformer.functionName = 'json-to-mqtt';
    expect(
      createTransformer(
        { id: 'northTransformerId1', transformer, options: {}, inputType: 'any', south: undefined },
        testData.north.list[0],
        logger
      )
    ).toBeInstanceOf(JSONToMQTTTransformer);

    transformer.functionName = 'json-to-time-values';
    expect(
      createTransformer(
        { id: 'northTransformerId1', transformer, options: {}, inputType: 'any', south: undefined },
        testData.north.list[0],
        logger
      )
    ).toBeInstanceOf(JSONToTimeValuesTransformer);

    transformer.functionName = 'time-values-to-csv';
    expect(
      createTransformer(
        { id: 'northTransformerId1', transformer, options: {}, inputType: 'time-values', south: undefined },
        testData.north.list[0],
        logger
      )
    ).toBeInstanceOf(OIBusTimeValuesToCsvTransformer);

    transformer.functionName = 'time-values-to-json';
    expect(
      createTransformer(
        { id: 'northTransformerId1', transformer, options: {}, inputType: 'time-values', south: undefined },
        testData.north.list[0],
        logger
      )
    ).toBeInstanceOf(OIBusTimeValuesToJSONTransformer);

    transformer.functionName = 'time-values-to-modbus';
    expect(
      createTransformer(
        { id: 'northTransformerId1', transformer, options: {}, inputType: 'time-values', south: undefined },
        testData.north.list[0],
        logger
      )
    ).toBeInstanceOf(OIBusTimeValuesToModbusTransformer);

    transformer.functionName = 'time-values-to-mqtt';
    expect(
      createTransformer(
        { id: 'northTransformerId1', transformer, options: {}, inputType: 'time-values', south: undefined },
        testData.north.list[0],
        logger
      )
    ).toBeInstanceOf(OIBusTimeValuesToMQTTTransformer);

    transformer.functionName = 'time-values-to-oianalytics';
    expect(
      createTransformer(
        { id: 'northTransformerId1', transformer, options: {}, inputType: 'time-values', south: undefined },
        testData.north.list[0],
        logger
      )
    ).toBeInstanceOf(OIBusTimeValuesToOIAnalyticsTransformer);

    transformer.functionName = 'time-values-to-opcua';
    expect(
      createTransformer(
        { id: 'northTransformerId1', transformer, options: {}, inputType: 'time-values', south: undefined },
        testData.north.list[0],
        logger
      )
    ).toBeInstanceOf(OIBusTimeValuesToOPCUATransformer);

    transformer.functionName = 'setpoint-to-modbus';
    expect(
      createTransformer(
        { id: 'northTransformerId1', transformer, options: {}, inputType: 'setpoint', south: undefined },
        testData.north.list[0],
        logger
      )
    ).toBeInstanceOf(OIBusSetpointToModbusTransformer);

    transformer.functionName = 'setpoint-to-mqtt';
    expect(
      createTransformer(
        { id: 'northTransformerId1', transformer, options: {}, inputType: 'setpoint', south: undefined },
        testData.north.list[0],
        logger
      )
    ).toBeInstanceOf(OIBusSetpointToMQTTTransformer);

    transformer.functionName = 'setpoint-to-opcua';
    expect(
      createTransformer(
        { id: 'northTransformerId1', transformer, options: {}, inputType: 'setpoint', south: undefined },
        testData.north.list[0],
        logger
      )
    ).toBeInstanceOf(OIBusSetpointToOPCUATransformer);

    transformer.functionName = 'bad-id';
    expect(() =>
      createTransformer(
        { id: 'northTransformerId1', transformer, options: {}, inputType: 'any', south: undefined },
        testData.north.list[0],
        logger
      )
    ).toThrow('Transformer transformerId1 (standard) not implemented');
  });

  it('createTransformer() should create a custom transformer', async () => {
    const logger: pino.Logger = new PinoLogger();

    const transformer: CustomTransformer = JSON.parse(JSON.stringify(testData.transformers.list[0]));
    expect(
      createTransformer(
        { id: 'northTransformerId1', transformer, options: {}, inputType: 'time-values', south: undefined },
        testData.north.list[0],
        logger
      )
    ).toBeInstanceOf(OIBusCustomTransformer);
  });

  describe('test a custom transformer', () => {
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

    it('should throw an error if transformer is a standard one', async () => {
      const standardTransformer: StandardTransformer = {
        id: 'test-transformer',
        type: 'standard',
        functionName: 'Test Transformer',
        inputType: 'time-values',
        outputType: 'any'
      };

      (transformerRepository.findById as jest.Mock).mockReturnValueOnce(standardTransformer);

      const testRequest = {
        inputData: JSON.stringify([{ pointId: 'test', timestamp: '2023-01-01T00:00:00Z', data: { value: 42 } }])
        // options is undefined
      };

      await expect(service.test('test-transformer', testRequest)).rejects.toThrow(
        `Cannot test standard transformer "${standardTransformer.functionName}"`
      );
    });
  });

  describe('generateTimeValuesTemplate', () => {
    it('should generate time-values template with sample data', () => {
      const template = service.generateTemplate('time-values');

      expect(template.type).toBe('time-values');
      expect(template.description).toBe('Sample time-series data with multiple sensor readings');

      const data = JSON.parse(template.data);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(3);

      // Check first time value
      expect(data[0]).toHaveProperty('pointId', 'temperature_sensor_01');
      expect(data[0]).toHaveProperty('timestamp');
      expect(data[0]).toHaveProperty('data');
      expect(data[0].data).toHaveProperty('value', 23.5);
      expect(data[0].data).toHaveProperty('unit', '°C');
      expect(data[0].data).toHaveProperty('quality', 'good');
    });
  });

  describe('generateSetpointTemplate', () => {
    it('should generate setpoint template with sample data', () => {
      const template = service.generateTemplate('setpoint');

      expect(template.type).toBe('setpoint');
      expect(template.description).toBe('Sample setpoint commands for various parameters');

      const data = JSON.parse(template.data);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(4);

      // Check first setpoint
      expect(data[0]).toHaveProperty('reference', 'setpoint_temperature');
      expect(data[0]).toHaveProperty('value', 22.0);

      // Check boolean setpoint
      expect(data[2]).toHaveProperty('reference', 'setpoint_enabled');
      expect(data[2]).toHaveProperty('value', true);
    });
  });

  describe('generateFileTemplate', () => {
    it('should generate file template with sample data', () => {
      const template = service.generateTemplate('any');

      expect(template.type).toBe('any');
      expect(template.description).toBe('Sample file content with structured data');

      const data = JSON.parse(template.data);
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('source', 'test_device');
      expect(data).toHaveProperty('measurements');
      expect(data).toHaveProperty('metadata');

      expect(data.measurements).toHaveProperty('temperature', 23.5);
      expect(data.measurements).toHaveProperty('humidity', 65.2);
      expect(data.measurements).toHaveProperty('pressure', 1013.25);

      expect(data.metadata).toHaveProperty('device_id', 'sensor_001');
      expect(data.metadata).toHaveProperty('location', 'building_a_floor_2');
      expect(data.metadata).toHaveProperty('firmware_version', '1.2.3');
    });
  });

  it('should get standard manifest', async () => {
    expect(getStandardManifest('csv-to-mqtt')).toEqual(CSVToMQTTTransformer.manifestSettings);
    expect(getStandardManifest('csv-to-time-values')).toEqual(CSVToTimeValuesTransformer.manifestSettings);
    expect(getStandardManifest('iso')).toEqual(IsoTransformer.manifestSettings);
    expect(getStandardManifest('ignore')).toEqual(IgnoreTransformer.manifestSettings);
    expect(getStandardManifest('json-to-csv')).toEqual(JSONToCSVTransformer.manifestSettings);
    expect(getStandardManifest('json-to-mqtt')).toEqual(JSONToMQTTTransformer.manifestSettings);
    expect(getStandardManifest('json-to-time-values')).toEqual(JSONToTimeValuesTransformer.manifestSettings);
    expect(getStandardManifest('time-values-to-csv')).toEqual(OIBusTimeValuesToCsvTransformer.manifestSettings);
    expect(getStandardManifest('time-values-to-json')).toEqual(OIBusTimeValuesToJSONTransformer.manifestSettings);
    expect(getStandardManifest('time-values-to-modbus')).toEqual(OIBusTimeValuesToModbusTransformer.manifestSettings);
    expect(getStandardManifest('time-values-to-mqtt')).toEqual(OIBusTimeValuesToMQTTTransformer.manifestSettings);
    expect(getStandardManifest('time-values-to-oianalytics')).toEqual(OIBusTimeValuesToOIAnalyticsTransformer.manifestSettings);
    expect(getStandardManifest('time-values-to-opcua')).toEqual(OIBusTimeValuesToOPCUATransformer.manifestSettings);
    expect(getStandardManifest('setpoint-to-modbus')).toEqual(OIBusSetpointToModbusTransformer.manifestSettings);
    expect(getStandardManifest('setpoint-to-mqtt')).toEqual(OIBusSetpointToMQTTTransformer.manifestSettings);
    expect(getStandardManifest('setpoint-to-opcua')).toEqual(OIBusSetpointToOPCUATransformer.manifestSettings);
    expect(() => getStandardManifest('bad-id')).toThrow(`Could not find manifest for "bad-id" transformer`);
  });

  it('should properly convert to DTO', () => {
    const customTransformer = testData.transformers.list[0] as CustomTransformer;
    expect(toTransformerDTO(testData.transformers.list[0])).toEqual({
      id: customTransformer.id,
      type: customTransformer.type,
      name: customTransformer.name,
      description: customTransformer.description,
      inputType: customTransformer.inputType,
      language: customTransformer.language,
      outputType: customTransformer.outputType,
      customCode: customTransformer.customCode,
      manifest: customTransformer.customManifest
    });
    const standardTransformer: StandardTransformer = {
      id: 'standardId',
      inputType: 'time-values',
      outputType: 'time-values',
      type: 'standard',
      functionName: 'iso'
    };
    expect(toTransformerDTO(standardTransformer)).toEqual({
      id: standardTransformer.id,
      type: standardTransformer.type,
      inputType: standardTransformer.inputType,
      outputType: standardTransformer.outputType,
      functionName: standardTransformer.functionName,
      manifest: IgnoreTransformer.manifestSettings
    });
  });
});
