import JoiValidator from '../web-server/controllers/validators/joi.validator';
import { transformerSchema } from '../web-server/controllers/validators/oibus-validation-schema';
import TransformerRepository from '../repository/config/transformer.repository';
import { CustomTransformer, Transformer, TransformerWithOptions } from '../model/transformer.model';
import {
  CustomTransformerCommandDTO,
  InputTemplate,
  InputType,
  TransformerDTO,
  TransformerSearchParam,
  TransformerTestRequest,
  TransformerTestResponse
} from '../../shared/model/transformer.model';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import { Page } from '../../shared/model/types';
import { NorthConnectorEntity } from '../model/north-connector.model';
import { NorthSettings } from '../../shared/model/north-settings.model';
import pino from 'pino';
import OibusTransformer from './transformers/oibus-transformer';
import IsoTransformer from './transformers/iso-transformer';
import OIBusTimeValuesToCsvTransformer from './transformers/time-values/oibus-time-values-to-csv-transformer';
import OIBusTimeValuesToJSONTransformer from './transformers/time-values/oibus-time-values-to-json-transformer';
import OIBusTimeValuesToMQTTTransformer from './transformers/time-values/oibus-time-values-to-mqtt-transformer';
import OIBusTimeValuesToOPCUATransformer from './transformers/time-values/oibus-time-values-to-opcua-transformer';
import OIBusTimeValuesToModbusTransformer from './transformers/time-values/oibus-time-values-to-modbus-transformer';
import IgnoreTransformer from './transformers/ignore-transformer';
import { OIBusObjectAttribute } from '../../shared/model/form.model';
import OIBusSetpointToModbusTransformer from './transformers/setpoint/oibus-setpoint-to-modbus-transformer';
import OIBusSetpointToMQTTTransformer from './transformers/setpoint/oibus-setpoint-to-mqtt-transformer';
import OIBusSetpointToOPCUATransformer from './transformers/setpoint/oibus-setpoint-to-opcua-transformer';
import OIBusTimeValuesToOIAnalyticsTransformer from './transformers/time-values/oibus-time-values-to-oianalytics-transformer';
import { NotFoundError, OIBusValidationError } from '../model/types';
import OIBusCustomTransformer from './transformers/oibus-custom-transformer';
import { Readable } from 'node:stream';
import { DateTime } from 'luxon';
import { OIBusSetpoint, OIBusTimeValue } from '../../shared/model/engine.model';
import JSONToTimeValuesTransformer from './transformers/time-values/json-to-time-values-transformer';
import JSONToCSVTransformer from './transformers/time-values/json-to-csv-transformer';

export default class TransformerService {
  constructor(
    protected readonly validator: JoiValidator,
    private transformerRepository: TransformerRepository,
    private oIAnalyticsMessageService: OIAnalyticsMessageService
  ) {}

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

  async create(command: CustomTransformerCommandDTO): Promise<CustomTransformer> {
    await this.validator.validate(transformerSchema, command);

    // Check for unique name (only custom transformers have names)
    const existingTransformers = this.transformerRepository.list();
    if (existingTransformers.some(t => t.type === 'custom' && (t as CustomTransformer).name === command.name)) {
      throw new OIBusValidationError(`Transformer name "${command.name}" already exists`);
    }

    const transformer = { type: 'custom' } as CustomTransformer;
    await copyTransformerCommandToTransformerEntity(transformer, command);
    this.transformerRepository.save(transformer);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    return transformer;
  }

  async update(transformerId: string, command: CustomTransformerCommandDTO): Promise<void> {
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

    await copyTransformerCommandToTransformerEntity(transformer as CustomTransformer, command);
    this.transformerRepository.save(transformer);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  delete(transformerId: string): void {
    const transformer = this.findById(transformerId);
    if (transformer.type === 'standard') {
      throw new OIBusValidationError(`Cannot delete standard transformer "${transformerId}"`);
    }
    this.transformerRepository.delete(transformerId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  async test(id: string, testRequest: TransformerTestRequest): Promise<TransformerTestResponse> {
    const transformer = this.findById(id);
    if (transformer.type === 'standard') {
      throw new OIBusValidationError(`Cannot test standard transformer "${transformer.functionName}"`);
    }

    const customTransformer = transformer as CustomTransformer;

    // Create a mock north connector for testing
    const mockNorthConnector = {
      id: 'test-connector',
      name: 'Test Connector',
      type: 'test',
      description: 'Mock connector for testing',
      enabled: true,
      settings: {},
      caching: {
        enabled: false,
        maxSize: 0,
        maxCount: 0,
        throttling: {
          maxNumberOfElements: 0,
          maxDuration: 0
        }
      },
      transformers: []
    } as unknown as NorthConnectorEntity<NorthSettings>;

    // Create a mock logger
    const mockLogger = pino({ level: 'silent' });

    // Create the custom transformer instance
    const transformerInstance = new OIBusCustomTransformer(mockLogger, customTransformer, mockNorthConnector, testRequest.options || {});

    // Execute the transformer
    const inputStream = Readable.from([Buffer.from(testRequest.inputData, 'utf-8')]);
    const { metadata, output } = await transformerInstance.transform(inputStream, 'test-source', 'test-input.json');

    return {
      output,
      metadata: {
        contentType: metadata.contentType,
        numberOfElement: metadata.numberOfElement
      }
    };
  }

  generateTemplate(inputType: InputType): InputTemplate {
    switch (inputType) {
      case 'time-values':
        return this.generateTimeValuesTemplate();
      case 'setpoint':
        return this.generateSetpointTemplate();
      case 'any':
      default:
        return this.generateFileTemplate();
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
  private generateFileTemplate(): InputTemplate {
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
      type: 'any',
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
};

export const toTransformerDTO = (transformer: Transformer): TransformerDTO => {
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
        manifest: transformer.customManifest
      };
  }
};

export const createTransformer = (
  transformerWithOptions: TransformerWithOptions,
  northConnector: NorthConnectorEntity<NorthSettings>,
  logger: pino.Logger
): OibusTransformer => {
  if (transformerWithOptions.transformer.type === 'standard') {
    switch (transformerWithOptions.transformer.functionName) {
      case OIBusTimeValuesToCsvTransformer.transformerName: {
        return new OIBusTimeValuesToCsvTransformer(
          logger,
          transformerWithOptions.transformer,
          northConnector,
          transformerWithOptions.options
        );
      }
      case OIBusTimeValuesToJSONTransformer.transformerName: {
        return new OIBusTimeValuesToJSONTransformer(
          logger,
          transformerWithOptions.transformer,
          northConnector,
          transformerWithOptions.options
        );
      }
      case OIBusTimeValuesToMQTTTransformer.transformerName: {
        return new OIBusTimeValuesToMQTTTransformer(
          logger,
          transformerWithOptions.transformer,
          northConnector,
          transformerWithOptions.options
        );
      }
      case OIBusTimeValuesToOPCUATransformer.transformerName: {
        return new OIBusTimeValuesToOPCUATransformer(
          logger,
          transformerWithOptions.transformer,
          northConnector,
          transformerWithOptions.options
        );
      }
      case OIBusTimeValuesToModbusTransformer.transformerName: {
        return new OIBusTimeValuesToModbusTransformer(
          logger,
          transformerWithOptions.transformer,
          northConnector,
          transformerWithOptions.options
        );
      }
      case OIBusTimeValuesToOIAnalyticsTransformer.transformerName: {
        return new OIBusTimeValuesToOIAnalyticsTransformer(
          logger,
          transformerWithOptions.transformer,
          northConnector,
          transformerWithOptions.options
        );
      }
      case OIBusSetpointToModbusTransformer.transformerName: {
        return new OIBusSetpointToModbusTransformer(
          logger,
          transformerWithOptions.transformer,
          northConnector,
          transformerWithOptions.options
        );
      }
      case OIBusSetpointToMQTTTransformer.transformerName: {
        return new OIBusSetpointToMQTTTransformer(
          logger,
          transformerWithOptions.transformer,
          northConnector,
          transformerWithOptions.options
        );
      }
      case OIBusSetpointToOPCUATransformer.transformerName: {
        return new OIBusSetpointToOPCUATransformer(
          logger,
          transformerWithOptions.transformer,
          northConnector,
          transformerWithOptions.options
        );
      }
      case JSONToTimeValuesTransformer.transformerName: {
        return new JSONToTimeValuesTransformer(logger, transformerWithOptions.transformer, northConnector, transformerWithOptions.options);
      }
      case JSONToCSVTransformer.transformerName: {
        return new JSONToCSVTransformer(logger, transformerWithOptions.transformer, northConnector, transformerWithOptions.options);
      }

      default:
        throw new Error(
          `Transformer ${transformerWithOptions.transformer.id} (${transformerWithOptions.transformer.type}) not implemented`
        );
    }
  } else {
    return new OIBusCustomTransformer(logger, transformerWithOptions.transformer, northConnector, transformerWithOptions.options);
  }
};

export const getStandardManifest = (functionName: string): OIBusObjectAttribute => {
  switch (functionName) {
    case IsoTransformer.transformerName: {
      return IsoTransformer.manifestSettings;
    }
    case IgnoreTransformer.transformerName: {
      return IgnoreTransformer.manifestSettings;
    }
    case OIBusTimeValuesToCsvTransformer.transformerName: {
      return OIBusTimeValuesToCsvTransformer.manifestSettings;
    }
    case OIBusTimeValuesToJSONTransformer.transformerName: {
      return OIBusTimeValuesToJSONTransformer.manifestSettings;
    }
    case OIBusTimeValuesToMQTTTransformer.transformerName: {
      return OIBusTimeValuesToMQTTTransformer.manifestSettings;
    }
    case OIBusTimeValuesToOPCUATransformer.transformerName: {
      return OIBusTimeValuesToOPCUATransformer.manifestSettings;
    }
    case OIBusTimeValuesToModbusTransformer.transformerName: {
      return OIBusTimeValuesToModbusTransformer.manifestSettings;
    }
    case OIBusTimeValuesToOIAnalyticsTransformer.transformerName: {
      return OIBusTimeValuesToOIAnalyticsTransformer.manifestSettings;
    }
    case OIBusSetpointToModbusTransformer.transformerName: {
      return OIBusSetpointToModbusTransformer.manifestSettings;
    }
    case OIBusSetpointToMQTTTransformer.transformerName: {
      return OIBusSetpointToMQTTTransformer.manifestSettings;
    }
    case OIBusSetpointToOPCUATransformer.transformerName: {
      return OIBusSetpointToOPCUATransformer.manifestSettings;
    }
    case JSONToTimeValuesTransformer.transformerName: {
      return JSONToTimeValuesTransformer.manifestSettings;
    }
    case JSONToCSVTransformer.transformerName: {
      return JSONToCSVTransformer.manifestSettings;
    }
    default:
      throw new Error(`Could not find manifest for ${functionName} transformer`);
  }
};
