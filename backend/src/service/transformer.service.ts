import { createReadStream } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

import { DateTime } from 'luxon';

import { SouthConnectorItemTestResult } from '../../shared/model/api/south-connector.model';
import {
  CustomTransformerCommandDTO,
  InputTemplate,
  TransformerDTO,
  TransformerTestRequest,
  TransformerTestResponse
} from '../../shared/model/api/transformer.model';
import { OIBusContent, OIBusPointRecord, OIBusSetpoint } from '../../shared/model/common/content.model';
import { GetUserInfo, Page } from '../../shared/model/common/types';
import { OIBusObjectAttribute } from '../../shared/model/connector/form.model';
import { NorthSettings } from '../../shared/model/connector/north-settings.model';
import { InputType, TransformerManifest } from '../../shared/model/connector/transformer-manifest.model';
import { CacheMetadata } from '../../shared/model/domain/engine.model';
import { TransformerSearchParam } from '../../shared/model/domain/transformer.model';

import { CacheMetadataSource } from '../model/engine.model';
import type { ILogger } from '../model/logger.model';
import { NorthConnectorEntity } from '../model/north-connector.model';
import { CustomTransformer, NorthTransformerWithOptions, Transformer } from '../model/transformer.model';
import { NotFoundError, OIBusValidationError } from '../model/types';
import TransformerRepository from '../repository/config/transformer.repository';
import FileTransformer from '../transformers/file/file/file-transformer';
import fileManifest from '../transformers/file/file/manifest';
import FileToMQTTTransformer from '../transformers/file/file-to-mqtt/file-to-mqtt-transformer';
import fileToMqttManifest from '../transformers/file/file-to-mqtt/manifest';
import FileToOIAnalyticsTransformer from '../transformers/file/file-to-oianalytics/file-to-oianalytics-transformer';
import fileToOianalyticsManifest from '../transformers/file/file-to-oianalytics/manifest';
import FileToRecordListTransformer from '../transformers/file/file-to-record-list/file-to-record-list-transformer';
import fileToRecordListManifest from '../transformers/file/file-to-record-list/manifest';
import JSONToCSVTransformer from '../transformers/file/json-to-csv/json-to-csv-transformer';
import jsonToCsvManifest from '../transformers/file/json-to-csv/manifest';
import OIBusCustomTransformer from '../transformers/oibus-custom-transformer';
import OibusTransformer from '../transformers/oibus-transformer';
import recordListToCsvManifest from '../transformers/record-list/record-list-to-csv/manifest';
import RecordListToCsvTransformer from '../transformers/record-list/record-list-to-csv/record-list-to-csv-transformer';
import recordListToJsonManifest from '../transformers/record-list/record-list-to-json/manifest';
import RecordListToJSONTransformer from '../transformers/record-list/record-list-to-json/record-list-to-json-transformer';
import recordListToModbusManifest from '../transformers/record-list/record-list-to-modbus/manifest';
import RecordListToModbusTransformer from '../transformers/record-list/record-list-to-modbus/record-list-to-modbus-transformer';
import recordListToMqttManifest from '../transformers/record-list/record-list-to-mqtt/manifest';
import RecordListToMQTTTransformer from '../transformers/record-list/record-list-to-mqtt/record-list-to-mqtt-transformer';
import recordListToOianalyticsManifest from '../transformers/record-list/record-list-to-oianalytics/manifest';
import RecordListToOIAnalyticsTransformer from '../transformers/record-list/record-list-to-oianalytics/record-list-to-oianalytics-transformer';
import recordListToOpcuaManifest from '../transformers/record-list/record-list-to-opcua/manifest';
import RecordListToOPCUATransformer from '../transformers/record-list/record-list-to-opcua/record-list-to-opcua-transformer';
import setpointToJsonManifest from '../transformers/setpoint/oibus-setpoint-to-json/manifest';
import OIBusSetpointToJSONTransformer from '../transformers/setpoint/oibus-setpoint-to-json/oibus-setpoint-to-json-transformer';
import setpointToModbusManifest from '../transformers/setpoint/oibus-setpoint-to-modbus/manifest';
import OIBusSetpointToModbusTransformer from '../transformers/setpoint/oibus-setpoint-to-modbus/oibus-setpoint-to-modbus-transformer';
import setpointToMqttManifest from '../transformers/setpoint/oibus-setpoint-to-mqtt/manifest';
import OIBusSetpointToMQTTTransformer from '../transformers/setpoint/oibus-setpoint-to-mqtt/oibus-setpoint-to-mqtt-transformer';
import setpointToOpcuaManifest from '../transformers/setpoint/oibus-setpoint-to-opcua/manifest';
import OIBusSetpointToOPCUATransformer from '../transformers/setpoint/oibus-setpoint-to-opcua/oibus-setpoint-to-opcua-transformer';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import { transformerSchema } from '../web-server/controllers/validators/oibus-validation-schema';
import type OIAnalyticsMessageService from './oia/oianalytics-message.service';
import { generateRandomId } from './utils';

interface TransformerReloadEngine {
  reloadTransformer(transformerId: string): Promise<void>;
  removeAndReloadTransformer(transformerId: string, updatedBy: string): Promise<void>;
  logger: ILogger;
}

export const transformerManifestList: Array<TransformerManifest> = [
  fileToMqttManifest,
  fileToRecordListManifest,
  fileManifest,
  jsonToCsvManifest,
  fileToOianalyticsManifest,
  recordListToCsvManifest,
  recordListToJsonManifest,
  recordListToModbusManifest,
  recordListToMqttManifest,
  recordListToOianalyticsManifest,
  recordListToOpcuaManifest,
  setpointToJsonManifest,
  setpointToModbusManifest,
  setpointToMqttManifest,
  setpointToOpcuaManifest
];

/**
 * Wrap a copy-pasted input string into the OIBusContent shape matching a transformer input type.
 * `record-list` / `setpoint` inputs are JSON arrays; everything else is treated as raw file content.
 */
const buildContentFromInput = (inputType: string, inputData: string): OIBusContent => {
  switch (inputType) {
    case 'setpoint':
      return { type: 'setpoint', content: JSON.parse(inputData) };
    case 'record-list':
      return { type: 'record-list', content: JSON.parse(inputData) };
    default:
      return { type: 'file-content', content: inputData };
  }
};

/**
 * Wrap a transformer's raw output string into an OIBusContent using the content type it produced,
 * so the UI renders records as a table, file/CSV output as a table, and anything else as text.
 */
export const toTransformedContent = (output: string, contentType: string | undefined, contentFile: string | undefined): OIBusContent => {
  if (contentType === 'record-list') {
    try {
      return { type: 'record-list', content: JSON.parse(output) };
    } catch {
      return { type: 'file-content', content: output };
    }
  }
  if (contentType === 'file') {
    return { type: 'file', filePath: contentFile || 'output', content: output };
  }
  return { type: 'file-content', content: output };
};

export default class TransformerService {
  constructor(
    protected readonly validator: JoiValidator,
    private transformerRepository: TransformerRepository,
    private oIAnalyticsMessageService: OIAnalyticsMessageService,
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
    this.transformerRepository.save(transformer, true);
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
    this.transformerRepository.save(customTransformer, false);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();

    if (manifestChanged) {
      await this.engine.removeAndReloadTransformer(transformerId, updatedBy);
    } else if (codeChanged) {
      await this.engine.reloadTransformer(transformerId);
    }
  }

  async delete(transformerId: string, userId: string): Promise<void> {
    const transformer = this.findById(transformerId);
    if (transformer.type === 'standard') {
      throw new OIBusValidationError(`Cannot delete standard transformer "${transformerId}"`);
    }
    await this.engine.removeAndReloadTransformer(transformerId, userId);
    this.transformerRepository.delete(transformerId, userId);
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

  /**
   * Run an existing transformer (custom or standard, resolved by catalog id) with the given options
   * over an OIBusContent payload, returning the transformed output wrapped as OIBusContent so the UI
   * can render it (records → table, file/CSV → table, otherwise raw text). Shared by the
   * south/history item test (#4773) and the transformer test-with-input feature (#4774).
   */
  async runTransformer(transformerId: string, options: Record<string, unknown>, content: OIBusContent): Promise<OIBusContent> {
    const transformer = this.findById(transformerId);
    const transformerToRun: NorthTransformerWithOptions = {
      id: 'test',
      transformer,
      options,
      // `source` drives north-side routing only; it is unused when the transformer is run directly.
      source: { type: 'oianalytics-setpoint' }
    };
    const results = await runTransformerOnContent(createTransformer(transformerToRun, null, this.engine.logger), content, {
      source: 'test'
    });
    const output = Buffer.concat(results.map(result => result.output)).toString('utf-8');
    const metadata = results[0]?.metadata;
    return toTransformedContent(output, metadata?.contentType, metadata?.contentFile);
  }

  /**
   * Test a configured transformer with copy-pasted input. The pasted string is wrapped into the
   * OIBusContent shape matching the transformer's input type, then run through {@link runTransformer}.
   * Returns both the wrapped input (`raw`) and the produced output (`transformed`) so the UI can show
   * the same Raw → transformer → output pipeline as the south/history item test.
   */
  async testTransformer(transformerId: string, options: Record<string, unknown>, inputData: string): Promise<SouthConnectorItemTestResult> {
    const raw = buildContentFromInput(this.findById(transformerId).inputType, inputData);
    return {
      raw,
      transformed: await this.runTransformer(transformerId, options, raw),
      // Pasted input, not a south connector query — there's no connection or query to time.
      connectionDuration: 0,
      queryDuration: 0
    };
  }

  generateTemplate(inputType: InputType): InputTemplate {
    switch (inputType) {
      case 'file':
        return this.generateFileTemplate();
      case 'record-list':
        return this.generateRecordListTemplate();
      case 'setpoint':
      default:
        return this.generateSetpointTemplate();
    }
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
   * Generate input template for record-list input type: point records, as sent by point-based sources (OPC UA,
   * Modbus...), with the columns the record-list transformers read by default
   */
  private generateRecordListTemplate(): InputTemplate {
    const now = DateTime.now().toUTC().toISO()!;
    const records: Array<OIBusPointRecord> = [
      { pointId: 'temperature_sensor_01', timestamp: now, value: 23.5, quality: 'good' },
      { pointId: 'pressure_sensor_01', timestamp: now, value: 1013.25, quality: 'good' },
      { pointId: 'humidity_sensor_01', timestamp: now, value: 65.2, quality: 'good' }
    ];

    return {
      type: 'record-list',
      data: JSON.stringify(records, null, 2),
      description: 'Sample records with a point ID, a timestamp and a value, as sent by point-based sources (OPC UA, Modbus...)'
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
      type: 'file',
      data: JSON.stringify(fileContent, null, 2),
      description: 'Sample file content with structured data'
    };
  }
}

export const copyTransformerCommandToTransformerEntity = (transformer: CustomTransformer, command: CustomTransformerCommandDTO): void => {
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
  _northConnector: NorthConnectorEntity<NorthSettings> | null,
  logger: ILogger
): OibusTransformer => {
  if (transformerWithOptions.transformer.type === 'standard') {
    switch (transformerWithOptions.transformer.functionName) {
      case FileToMQTTTransformer.transformerName: {
        return new FileToMQTTTransformer(logger, transformerWithOptions.transformer, transformerWithOptions.options);
      }
      case FileToRecordListTransformer.transformerName: {
        return new FileToRecordListTransformer(logger, transformerWithOptions.transformer, transformerWithOptions.options);
      }
      case FileTransformer.transformerName: {
        return new FileTransformer(logger, transformerWithOptions.transformer, transformerWithOptions.options);
      }
      case JSONToCSVTransformer.transformerName: {
        return new JSONToCSVTransformer(logger, transformerWithOptions.transformer, transformerWithOptions.options);
      }
      case FileToOIAnalyticsTransformer.transformerName: {
        return new FileToOIAnalyticsTransformer(logger, transformerWithOptions.transformer, transformerWithOptions.options);
      }
      case RecordListToCsvTransformer.transformerName: {
        return new RecordListToCsvTransformer(logger, transformerWithOptions.transformer, transformerWithOptions.options);
      }
      case RecordListToJSONTransformer.transformerName: {
        return new RecordListToJSONTransformer(logger, transformerWithOptions.transformer, transformerWithOptions.options);
      }
      case RecordListToModbusTransformer.transformerName: {
        return new RecordListToModbusTransformer(logger, transformerWithOptions.transformer, transformerWithOptions.options);
      }
      case RecordListToMQTTTransformer.transformerName: {
        return new RecordListToMQTTTransformer(logger, transformerWithOptions.transformer, transformerWithOptions.options);
      }
      case RecordListToOIAnalyticsTransformer.transformerName: {
        return new RecordListToOIAnalyticsTransformer(logger, transformerWithOptions.transformer, transformerWithOptions.options);
      }
      case RecordListToOPCUATransformer.transformerName: {
        return new RecordListToOPCUATransformer(logger, transformerWithOptions.transformer, transformerWithOptions.options);
      }
      case OIBusSetpointToJSONTransformer.transformerName: {
        return new OIBusSetpointToJSONTransformer(logger, transformerWithOptions.transformer, transformerWithOptions.options);
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

/**
 * Run a transformer instance over an OIBusContent payload and return the produced output(s).
 * In-memory payloads (record-list / setpoint / file-content) go through `transformInMemory`;
 * true file-on-disk payloads (`any`) stay on the stream API to avoid slurping the file.
 * When `maxElements > 0`, record batches larger than that are split into several outputs.
 */
export const runTransformerOnContent = async (
  transformer: OibusTransformer,
  data: OIBusContent,
  source: CacheMetadataSource,
  maxElements = 0
): Promise<Array<{ output: Buffer; metadata: CacheMetadata }>> => {
  const results: Array<{ output: Buffer; metadata: CacheMetadata }> = [];
  switch (data.type) {
    case 'record-list': {
      const content = data.content;
      if (maxElements > 0 && content.length > maxElements) {
        for (let i = 0; i < content.length; i += maxElements) {
          results.push(await transformer.transformInMemory(content.slice(i, i + maxElements), source, null));
        }
      } else {
        results.push(await transformer.transformInMemory(content, source, null));
      }
      break;
    }
    case 'setpoint':
      results.push(await transformer.transformInMemory(data.content, source, null));
      break;
    case 'file-content':
      // file-content is already a serialised string; pass it through as-is.
      results.push(await transformer.transformInMemory(data.content, source, null));
      break;
    case 'file': {
      const randomId = generateRandomId(10);
      // Use the logical filename when provided, otherwise fall back to the basename of the disk path.
      const logicalName = data.filename ?? path.basename(data.filePath);
      const { name, ext } = path.parse(logicalName);
      const cacheFilename = `${name}-${randomId}${ext}`;
      if (data.content !== undefined) {
        // No file on disk to stream from (e.g. south item / north transformer test runs, which produce
        // content in memory without writing it to filePath) — use the in-memory content instead.
        results.push(await transformer.transformInMemory(data.content, source, cacheFilename));
      } else {
        // True file-on-disk path stays on the stream API.
        results.push(await transformer.transform(createReadStream(data.filePath), source, cacheFilename));
      }
      break;
    }
  }
  return results;
};

export const getStandardManifest = (functionName: string): OIBusObjectAttribute => {
  switch (functionName) {
    case fileToMqttManifest.id: {
      return fileToMqttManifest.settings;
    }
    case fileToRecordListManifest.id: {
      return fileToRecordListManifest.settings;
    }
    case fileManifest.id: {
      return fileManifest.settings;
    }
    case jsonToCsvManifest.id: {
      return jsonToCsvManifest.settings;
    }
    case fileToOianalyticsManifest.id: {
      return fileToOianalyticsManifest.settings;
    }
    case recordListToCsvManifest.id: {
      return recordListToCsvManifest.settings;
    }
    case recordListToJsonManifest.id: {
      return recordListToJsonManifest.settings;
    }
    case recordListToModbusManifest.id: {
      return recordListToModbusManifest.settings;
    }
    case recordListToMqttManifest.id: {
      return recordListToMqttManifest.settings;
    }
    case recordListToOianalyticsManifest.id: {
      return recordListToOianalyticsManifest.settings;
    }
    case recordListToOpcuaManifest.id: {
      return recordListToOpcuaManifest.settings;
    }
    case setpointToJsonManifest.id: {
      return setpointToJsonManifest.settings;
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
