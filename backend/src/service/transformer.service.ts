import JoiValidator from '../web-server/controllers/validators/joi.validator';
import { transformerSchema } from '../web-server/controllers/validators/oibus-validation-schema';
import TransformerRepository from '../repository/config/transformer.repository';
import { CustomTransformer, Transformer, TransformerLight } from '../model/transformer.model';
import {
  CustomTransformerCommand,
  TransformerDTO,
  TransformerLightDTO,
  TransformerSearchParam
} from '../../shared/model/transformer.model';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import { Page } from '../../shared/model/types';
import { NorthConnectorEntity } from '../model/north-connector.model';
import { NorthSettings } from '../../shared/model/north-settings.model';
import pino from 'pino';
import OibusTransformer from './transformers/oibus-transformer';
import IsoRawTransformer from './transformers/iso-raw-transformer';
import IsoTimeValuesTransformer from './transformers/iso-time-values-transformer';
import OIBusTimeValuesToCsvTransformer from './transformers/oibus-time-values-to-csv-transformer';
import OIBusTimeValuesToJSONTransformer from './transformers/oibus-time-values-to-json-transformer';
import OIBusTimeValuesToMQTTTransformer from './transformers/oibus-time-values-to-mqtt-transformer';
import OIBusTimeValuesToOPCUATransformer from './transformers/oibus-time-values-to-opcua-transformer';
import OIBusTimeValuesToModbusTransformer from './transformers/oibus-time-values-to-modbus-transformer';

export default class TransformerService {
  constructor(
    protected readonly validator: JoiValidator,
    private transformerRepository: TransformerRepository,
    private oIAnalyticsMessageService: OIAnalyticsMessageService
  ) {}

  findAll(): Array<Transformer> {
    return this.transformerRepository.findAll();
  }

  search(searchParams: TransformerSearchParam): Page<Transformer> {
    return this.transformerRepository.search(searchParams);
  }

  findById(id: string): Transformer | null {
    return this.transformerRepository.findById(id);
  }

  async create(command: CustomTransformerCommand): Promise<CustomTransformer> {
    await this.validator.validate(transformerSchema, command);

    const transformer = { type: 'custom' } as CustomTransformer;
    await copyTransformerCommandToTransformerEntity(transformer, command);
    this.transformerRepository.save(transformer);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    return transformer;
  }

  async update(id: string, command: CustomTransformerCommand): Promise<void> {
    await this.validator.validate(transformerSchema, command);
    const transformer = this.transformerRepository.findById(id);
    if (!transformer) {
      throw new Error(`Transformer ${id} not found`);
    }
    if (transformer.type === 'standard') {
      throw new Error(`Cannot edit standard transformer ${id}`);
    }
    await copyTransformerCommandToTransformerEntity(transformer as CustomTransformer, command);

    this.transformerRepository.save(transformer);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  async delete(id: string): Promise<void> {
    const transformer = this.transformerRepository.findById(id);
    if (!transformer) {
      throw new Error(`Transformer ${id} not found`);
    }
    if (transformer.type === 'standard') {
      throw new Error(`Cannot delete standard transformer ${id}`);
    }
    this.transformerRepository.delete(id);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }
}

export const copyTransformerCommandToTransformerEntity = async (
  transformer: CustomTransformer,
  command: CustomTransformerCommand
): Promise<void> => {
  transformer.name = command.name;
  transformer.description = command.description;
  transformer.inputType = command.inputType;
  transformer.outputType = command.outputType;
  transformer.customCode = command.customCode;
};

export const toTransformerLightDTO = (transformer: TransformerLight): TransformerLightDTO => {
  return {
    id: transformer.id,
    type: transformer.type,
    name: transformer.name,
    description: transformer.description,
    inputType: transformer.inputType,
    outputType: transformer.outputType
  };
};

export const toTransformerDTO = (transformer: Transformer): TransformerDTO => {
  switch (transformer.type) {
    case 'standard':
      return {
        id: transformer.id,
        type: transformer.type,
        name: transformer.name,
        description: transformer.description,
        inputType: transformer.inputType,
        outputType: transformer.outputType,
        standardCode: transformer.standardCode
      };
    case 'custom':
      return {
        id: transformer.id,
        type: transformer.type,
        name: transformer.name,
        description: transformer.description,
        inputType: transformer.inputType,
        outputType: transformer.outputType,
        customCode: transformer.customCode
      };
  }
};

export const createTransformer = (
  transformer: Transformer,
  northConnector: NorthConnectorEntity<NorthSettings>,
  logger: pino.Logger
): OibusTransformer => {
  switch (transformer.id) {
    case IsoRawTransformer.transformerName: {
      return new IsoRawTransformer(logger, transformer, northConnector);
    }
    case IsoTimeValuesTransformer.transformerName: {
      return new IsoTimeValuesTransformer(logger, transformer, northConnector);
    }
    case OIBusTimeValuesToCsvTransformer.transformerName: {
      return new OIBusTimeValuesToCsvTransformer(logger, transformer, northConnector);
    }
    case OIBusTimeValuesToJSONTransformer.transformerName: {
      return new OIBusTimeValuesToJSONTransformer(logger, transformer, northConnector);
    }
    case OIBusTimeValuesToMQTTTransformer.transformerName: {
      return new OIBusTimeValuesToMQTTTransformer(logger, transformer, northConnector);
    }
    case OIBusTimeValuesToOPCUATransformer.transformerName: {
      return new OIBusTimeValuesToOPCUATransformer(logger, transformer, northConnector);
    }
    case OIBusTimeValuesToModbusTransformer.transformerName: {
      return new OIBusTimeValuesToModbusTransformer(logger, transformer, northConnector);
    }
    default:
      throw new Error(`Could not create ${transformer.id} transformer`);
  }
};
