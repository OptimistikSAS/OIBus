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
import { NotFoundError, OIBusValidationError } from '../model/types';
import OIBusTimeValuesToOIAnalyticsTransformer from './transformers/time-values/oibus-time-values-to-oianalytics-transformer';

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

  it('should create the transformer', async () => {
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

    transformer.functionName = 'time-values-to-oianalytics';
    expect(createTransformer({ transformer, options: {}, inputType: 'time-values' }, testData.north.list[0], logger)).toBeInstanceOf(
      OIBusTimeValuesToOIAnalyticsTransformer
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

    const customTransformer: CustomTransformer = JSON.parse(JSON.stringify(testData.transformers.list[0]));
    customTransformer.type = 'custom';
    expect(() =>
      createTransformer({ transformer: customTransformer, options: {}, inputType: 'any' }, testData.north.list[0], logger)
    ).toThrow('Transformer transformerId1 (custom) not implemented');
  });

  it('should get standard manifest', async () => {
    expect(getStandardManifest('iso')).toEqual(IsoTransformer.manifestSettings);
    expect(getStandardManifest('ignore')).toEqual(IgnoreTransformer.manifestSettings);
    expect(getStandardManifest('time-values-to-csv')).toEqual(OIBusTimeValuesToCsvTransformer.manifestSettings);
    expect(getStandardManifest('time-values-to-json')).toEqual(OIBusTimeValuesToJSONTransformer.manifestSettings);
    expect(getStandardManifest('time-values-to-modbus')).toEqual(OIBusTimeValuesToModbusTransformer.manifestSettings);
    expect(getStandardManifest('time-values-to-opcua')).toEqual(OIBusTimeValuesToOPCUATransformer.manifestSettings);
    expect(getStandardManifest('time-values-to-mqtt')).toEqual(OIBusTimeValuesToMQTTTransformer.manifestSettings);
    expect(getStandardManifest('time-values-to-oianalytics')).toEqual(OIBusTimeValuesToOIAnalyticsTransformer.manifestSettings);
    expect(getStandardManifest('setpoint-to-mqtt')).toEqual(OIBusSetpointToMQTTTransformer.manifestSettings);
    expect(getStandardManifest('setpoint-to-modbus')).toEqual(OIBusSetpointToModbusTransformer.manifestSettings);
    expect(getStandardManifest('setpoint-to-opcua')).toEqual(OIBusSetpointToOPCUATransformer.manifestSettings);
    expect(() => getStandardManifest('bad-id')).toThrow(`Could not find manifest for bad-id transformer`);
  });

  it('should properly convert to DTO', () => {
    const customTransformer = testData.transformers.list[0] as CustomTransformer;
    expect(toTransformerDTO(testData.transformers.list[0])).toEqual({
      id: customTransformer.id,
      type: customTransformer.type,
      name: customTransformer.name,
      description: customTransformer.description,
      inputType: customTransformer.inputType,
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
