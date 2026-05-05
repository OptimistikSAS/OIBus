import JoiValidator from '../web-server/controllers/validators/joi.validator';
import { transformerSchema } from '../web-server/controllers/validators/oibus-validation-schema';
import TransformerRepository from '../repository/config/transformer.repository';
import { CustomTransformer, NorthTransformerWithOptions, Transformer } from '../model/transformer.model';
import {
  CustomTransformerCommandDTO,
  InputTemplate,
  InputType,
  TransformerDTO,
  TransformerManifest,
  TransformerSearchParam,
  TransformerTestRequest,
  TransformerTestResponse
} from '../../shared/model/transformer.model';
import type { IOIAnalyticsMessageService } from '../model/oianalytics-message.model';
import { GetUserInfo, Page } from '../../shared/model/types';
import { NorthConnectorEntity } from '../model/north-connector.model';
import { NorthSettings } from '../../shared/model/north-settings.model';
import OibusTransformer from '../transformers/oibus-transformer';
import OIBusTimeValuesToCsvTransformer from '../transformers/time-values/oibus-time-values-to-csv/oibus-time-values-to-csv-transformer';
import OIBusTimeValuesToJSONTransformer from '../transformers/time-values/oibus-time-values-to-json/oibus-time-values-to-json-transformer';
import OIBusTimeValuesToMQTTTransformer from '../transformers/time-values/oibus-time-values-to-mqtt/oibus-time-values-to-mqtt-transformer';
import OIBusTimeValuesToOPCUATransformer from '../transformers/time-values/oibus-time-values-to-opcua/oibus-time-values-to-opcua-transformer';
import OIBusTimeValuesToModbusTransformer from '../transformers/time-values/oibus-time-values-to-modbus/oibus-time-values-to-modbus-transformer';
import { OIBusObjectAttribute } from '../../shared/model/form.model';
import OIBusSetpointToModbusTransformer from '../transformers/setpoint/oibus-setpoint-to-modbus/oibus-setpoint-to-modbus-transformer';
import OIBusSetpointToMQTTTransformer from '../transformers/setpoint/oibus-setpoint-to-mqtt/oibus-setpoint-to-mqtt-transformer';
import OIBusSetpointToOPCUATransformer from '../transformers/setpoint/oibus-setpoint-to-opcua/oibus-setpoint-to-opcua-transformer';
import OIBusTimeValuesToOIAnalyticsTransformer from '../transformers/time-values/oibus-time-values-to-oianalytics/oibus-time-values-to-oianalytics-transformer';
import { NotFoundError, OIBusValidationError } from '../model/types';
import OIBusCustomTransformer from '../transformers/oibus-custom-transformer';
import { Readable } from 'node:stream';
import { DateTime } from 'luxon';
import { OIBusSetpoint, OIBusTimeValue } from '../../shared/model/engine.model';
import JSONToCSVTransformer from '../transformers/any/json-to-csv/json-to-csv-transformer';
import CSVToMQTTTransformer from '../transformers/any/csv-to-mqtt/csv-to-mqtt-transformer';
import CSVToTimeValuesTransformer from '../transformers/any/csv-to-time-values/csv-to-time-values-transformer';
import isoManifest from '../transformers/iso-transformer/manifest';
import ignoreManifest from '../transformers/ignore-transformer/manifest';
import csvToMqttManifest from '../transformers/any/csv-to-mqtt/manifest';
import csvToTimeValuesManifest from '../transformers/any/csv-to-time-values/manifest';
import jsonToCsvManifest from '../transformers/any/json-to-csv/manifest';
import timeValuesToCsvManifest from '../transformers/time-values/oibus-time-values-to-csv/manifest';
import timeValuesToJsonManifest from '../transformers/time-values/oibus-time-values-to-json/manifest';
import timeValuesToModbusManifest from '../transformers/time-values/oibus-time-values-to-modbus/manifest';
import timeValuesToMqttManifest from '../transformers/time-values/oibus-time-values-to-mqtt/manifest';
import timeValuesToOianalyticsManifest from '../transformers/time-values/oibus-time-values-to-oianalytics/manifest';
import timeValuesToOpcuaManifest from '../transformers/time-values/oibus-time-values-to-opcua/manifest';
import setpointToModbusManifest from '../transformers/setpoint/oibus-setpoint-to-modbus/manifest';
import setpointToMqttManifest from '../transformers/setpoint/oibus-setpoint-to-mqtt/manifest';
import setpointToOpcuaManifest from '../transformers/setpoint/oibus-setpoint-to-opcua/manifest';
import type { ILogger } from '../model/logger.model';

interface TransformerReloadEngine {
  reloadTransformer(transformerId: string): Promise<void>;
  removeAndReloadTransformer(transformerId: string): Promise<void>;
  logger: ILogger;
}

export const transformerManifestList: Array<TransformerManifest> = [
  isoManifest,
  ignoreManifest,
  csvToMqttManifest,
  csvToTimeValuesManifest,
  jsonToCsvManifest,
  timeValuesToCsvManifest,
  timeValuesToJsonManifest,
  timeValuesToModbusManifest,
  timeValuesToMqttManifest,
  timeValuesToOianalyticsManifest,
  timeValuesToOpcuaManifest,
  setpointToModbusManifest,
  setpointToMqttManifest,
  setpointToOpcuaManifest
];

export default class TransformerService {
  constructor(
    protected readonly validator: JoiValidator,
    private transformerRepository: TransformerRepository,
    private oIAnalyticsMessageService: IOIAnalyticsMessageService,
    private engine: TransformerReloadEngine
  ) {}

  listManifest(): Array<TransformerManifest> {
    return transformerManifestList;
  }

  getManifest(type: string): TransformerManifest {
    const manifest = transformerManifestList.find(element => element.id === type);
    if (!manifest) {
      throw new NotFoundError(`Transformer manifest "${type}" not found`);
    }
    return manifest;
  }

  findAll(): Array<Transformer> {
    return this.transformerRepository.list();
  }

  search(searchParams: TransformerSearchParam): Page<Transformer> {
    return this.transformerRepository.search(searchParams);
  }

  findById(transformerId: string): Transformer {
    const transformer = this.transformerRepository.findById(transformerId);
    if (!transformer) {
      throw new NotFoundError(`Transformer "${transformerId}" not found`);
    }
    return transformer;
  }

  async create(command: CustomTransformerCommandDTO, createdBy: string): Promise<CustomTransformer> {
    await this.validator.validate(transformerSchema, command);

    const existingTransformers = this.transformerRepository.list();
    if (existingTransformers.some(t => t.type === 'custom' && (t as CustomTransformer).name === command.name)) {
      throw new OIBusValidationError(`Transformer name "${command.name}" already exists`);
    }

    const transformer = { type: 'custom', createdBy, updatedBy: createdBy } as CustomTransformer;
    await copyTransformerCommandToTransformerEntity(transformer, command);
    this.transformerRepository.save(transformer);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    return transformer;
  }

  async update(transformerId: string, command: CustomTransformerCommandDTO, updatedBy: string): Promise<void> {
    await this.validator.validate(transformerSchema, command);
    const transformer = this.findById(transformerId);
    if (transformer.type === 'standard') {
      throw new OIBusValidationError(`Cannot edit standard transformer "${transformerId}"`);
    }

    // Check for unique name (excluding current entity, only custom transformers have names)
    const customTransformer = transformer as CustomTransformer;
    if (command.name !== customTransformer.name) {
      const existingTransformers = this.transformerRepository.list();
      if (existingTransformers.some(t => t.type === 'custom' && t.id !== transformerId && (t as CustomTransformer).name === command.name)) {
        throw new OIBusValidationError(`Transformer name "${command.name}" already exists`);
      }
    }

    const manifestChanged = JSON.stringify(command.customManifest) !== JSON.stringify(customTransformer.customManifest);
    const codeChanged = command.customCode !== customTransformer.customCode;
    customTransformer.updatedBy = updatedBy;
    await copyTransformerCommandToTransformerEntity(customTransformer, command);
    this.transformerRepository.save(customTransformer);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();

    if (manifestChanged) {
      await this.engine.removeAndReloadTransformer(transformerId);
    } else if (codeChanged) {
      await this.engine.reloadTransformer(transformerId);
    }
  }

  async delete(transformerId: string): Promise<void> {
    const transformer = this.findById(transformerId);
    if (transformer.type === 'standard') {
      throw new OIBusValidationError(`Cannot delete standard transformer "${transformerId}"`);
    }
    await this.engine.removeAndReloadTransformer(transformerId);
    this.transformerRepository.delete(transformerId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  async test(command: CustomTransformerCommandDTO, testRequest: TransformerTestRequest): Promise<TransformerTestResponse> {
    // Create the custom transformer instance
    const transformer: CustomTransformer = {
      id: 'test',
      name: command.name,
      inputType: command.inputType,
      outputType: command.outputType,
      customCode: command.customCode,
      customManifest: command.customManifest,
      language: command.language,
      timeout: command.timeout
    } as CustomTransformer;
    const transformerInstance = new OIBusCustomTransformer(this.engine.logger, transformer, testRequest.options || {});

    // Execute the transformer
    const result = await transformerInstance.transform(
      Readable.from(testRequest.inputData),
      {
        source: 'test'
      },
      'test-input.json'
    );
    return { ...result, output: result.output.toString('utf-8') };
  }

  generateTemplate(inputType: InputType): InputTemplate {
    switch (inputType) {
      case 'time-values':
        return this.generateTimeValuesTemplate();
      case 'any':
      case 'any-content':
        return this.generateFileTemplate(inputType);
      case 'setpoint':
      default:
        return this.generateSetpointTemplate();
    }
  }

  /**
   * Generate input template for time-values input type
   */
  private generateTimeValuesTemplate(): InputTemplate {
    const now = DateTime.now().toUTC().toISO()!;
    const timeValues: Array<OIBusTimeValue> = [
      {
        pointId: 'temperature_sensor_01',
        timestamp: now,
        data: {
          value: 23.5,
          unit: '°C',
          quality: 'good'
        }
      },
      {
        pointId: 'pressure_sensor_01',
        timestamp: now,
        data: {
          value: 1013.25,
          unit: 'hPa',
          quality: 'good'
        }
      },
      {
        pointId: 'humidity_sensor_01',
        timestamp: now,
        data: {
          value: 65.2,
          unit: '%',
          quality: 'good'
        }
      }
    ];

    return {
      type: 'time-values',
      data: JSON.stringify(timeValues, null, 2),
      description: 'Sample time-series data with multiple sensor readings'
    };
  }

  /**
   * Generate input template for setpoint input type
   */
  private generateSetpointTemplate(): InputTemplate {
    const setpoints: Array<OIBusSetpoint> = [
      {
        reference: 'setpoint_temperature',
        value: 22.0
      },
      {
        reference: 'setpoint_pressure',
        value: 1000.0
      },
      {
        reference: 'setpoint_enabled',
        value: true
      },
      {
        reference: 'setpoint_mode',
        value: 'auto'
      }
    ];

    return {
      type: 'setpoint',
      data: JSON.stringify(setpoints, null, 2),
      description: 'Sample setpoint commands for various parameters'
    };
  }

  /**
   * Generate input template for any (file) input type
   */
  private generateFileTemplate(contentType: 'any' | 'any-content'): InputTemplate {
    const fileContent = {
      timestamp: DateTime.now().toUTC().toISO(),
      source: 'test_device',
      measurements: {
        temperature: 23.5,
        humidity: 65.2,
        pressure: 1013.25
      },
      metadata: {
        device_id: 'sensor_001',
        location: 'building_a_floor_2',
        firmware_version: '1.2.3'
      }
    };

    return {
      type: contentType,
      data: JSON.stringify(fileContent, null, 2),
      description: 'Sample file content with structured data'
    };
  }
}

export const copyTransformerCommandToTransformerEntity = async (
  transformer: CustomTransformer,
  command: CustomTransformerCommandDTO
): Promise<void> => {
  transformer.name = command.name;
  transformer.description = command.description;
  transformer.inputType = command.inputType;
  transformer.outputType = command.outputType;
  transformer.customCode = command.customCode;
  transformer.language = command.language;
  transformer.customManifest = command.customManifest;
  transformer.timeout = command.timeout;
};

export const toTransformerDTO = (transformer: Transformer, getUserInfo: GetUserInfo): TransformerDTO => {
  switch (transformer.type) {
    case 'standard':
      return {
        id: transformer.id,
        type: transformer.type,
        inputType: transformer.inputType,
        outputType: transformer.outputType,
        functionName: transformer.functionName,
        manifest: getStandardManifest(transformer.functionName)
      };
    case 'custom':
      return {
        id: transformer.id,
        type: transformer.type,
        name: transformer.name,
        description: transformer.description,
        inputType: transformer.inputType,
        outputType: transformer.outputType,
        customCode: transformer.customCode,
        language: transformer.language,
        manifest: transformer.customManifest,
        timeout: transformer.timeout,
        createdBy: getUserInfo(transformer.createdBy),
        updatedBy: getUserInfo(transformer.updatedBy),
        createdAt: transformer.createdAt,
        updatedAt: transformer.updatedAt
      };
  }
};

export const createTransformer = (
  transformerWithOptions: NorthTransformerWithOptions,
  northConnector: NorthConnectorEntity<NorthSettings>,
  logger: ILogger
): OibusTransformer => {
  if (transformerWithOptions.transformer.type === 'standard') {
    switch (transformerWithOptions.transformer.functionName) {
      case CSVToMQTTTransformer.transformerName: {
        return new CSVToMQTTTransformer(logger, transformerWithOptions.transformer, transformerWithOptions.options);
      }
      case CSVToTimeValuesTransformer.transformerName: {
        return new CSVToTimeValuesTransformer(logger, transformerWithOptions.transformer, transformerWithOptions.options);
      }
      case JSONToCSVTransformer.transformerName: {
        return new JSONToCSVTransformer(logger, transformerWithOptions.transformer, transformerWithOptions.options);
      }
      case OIBusTimeValuesToCsvTransformer.transformerName: {
        return new OIBusTimeValuesToCsvTransformer(logger, transformerWithOptions.transformer, transformerWithOptions.options);
      }
      case OIBusTimeValuesToJSONTransformer.transformerName: {
        return new OIBusTimeValuesToJSONTransformer(logger, transformerWithOptions.transformer, transformerWithOptions.options);
      }
      case OIBusTimeValuesToModbusTransformer.transformerName: {
        return new OIBusTimeValuesToModbusTransformer(logger, transformerWithOptions.transformer, transformerWithOptions.options);
      }
      case OIBusTimeValuesToMQTTTransformer.transformerName: {
        return new OIBusTimeValuesToMQTTTransformer(logger, transformerWithOptions.transformer, transformerWithOptions.options);
      }
      case OIBusTimeValuesToOIAnalyticsTransformer.transformerName: {
        return new OIBusTimeValuesToOIAnalyticsTransformer(logger, transformerWithOptions.transformer, transformerWithOptions.options);
      }
      case OIBusTimeValuesToOPCUATransformer.transformerName: {
        return new OIBusTimeValuesToOPCUATransformer(logger, transformerWithOptions.transformer, transformerWithOptions.options);
      }
      case OIBusSetpointToModbusTransformer.transformerName: {
        return new OIBusSetpointToModbusTransformer(logger, transformerWithOptions.transformer, transformerWithOptions.options);
      }
      case OIBusSetpointToMQTTTransformer.transformerName: {
        return new OIBusSetpointToMQTTTransformer(logger, transformerWithOptions.transformer, transformerWithOptions.options);
      }
      case OIBusSetpointToOPCUATransformer.transformerName: {
        return new OIBusSetpointToOPCUATransformer(logger, transformerWithOptions.transformer, transformerWithOptions.options);
      }

      default:
        throw new Error(
          `Transformer ${transformerWithOptions.transformer.id} (${transformerWithOptions.transformer.type}) not implemented`
        );
    }
  } else {
    return new OIBusCustomTransformer(logger, transformerWithOptions.transformer, transformerWithOptions.options);
  }
};

export const getStandardManifest = (functionName: string): OIBusObjectAttribute => {
  switch (functionName) {
    case csvToMqttManifest.id: {
      return csvToMqttManifest.settings;
    }
    case csvToTimeValuesManifest.id: {
      return csvToTimeValuesManifest.settings;
    }
    case isoManifest.id: {
      return isoManifest.settings;
    }
    case ignoreManifest.id: {
      return ignoreManifest.settings;
    }
    case jsonToCsvManifest.id: {
      return jsonToCsvManifest.settings;
    }
    case timeValuesToCsvManifest.id: {
      return timeValuesToCsvManifest.settings;
    }
    case timeValuesToJsonManifest.id: {
      return timeValuesToJsonManifest.settings;
    }
    case timeValuesToModbusManifest.id: {
      return timeValuesToModbusManifest.settings;
    }
    case timeValuesToMqttManifest.id: {
      return timeValuesToMqttManifest.settings;
    }
    case timeValuesToOianalyticsManifest.id: {
      return timeValuesToOianalyticsManifest.settings;
    }
    case timeValuesToOpcuaManifest.id: {
      return timeValuesToOpcuaManifest.settings;
    }
    case setpointToModbusManifest.id: {
      return setpointToModbusManifest.settings;
    }
    case setpointToMqttManifest.id: {
      return setpointToMqttManifest.settings;
    }
    case setpointToOpcuaManifest.id: {
      return setpointToOpcuaManifest.settings;
    }
    default:
      throw new Error(`Could not find manifest for "${functionName}" transformer`);
  }
};
