import JoiValidator from '../web-server/controllers/validators/joi.validator';
import { transformerSchema } from '../web-server/controllers/validators/oibus-validation-schema';
import TransformerRepository from '../repository/config/transformer.repository';
import { Transformer } from '../model/transformer.model';
import { TransformerCommand, TransformerDTO, TransformerSearchParam } from '../../shared/model/transformer.model';

export default class TransformerService {
  constructor(
    protected readonly validator: JoiValidator,
    private transformerRepository: TransformerRepository
  ) {}

  searchTransformers(searchParams: TransformerSearchParam): Array<Transformer> {
    return this.transformerRepository.searchTransformers(searchParams);
  }

  findById(id: string): Transformer | null {
    return this.transformerRepository.findTransformerById(id);
  }

  async create(command: TransformerCommand): Promise<Transformer> {
    await this.validator.validate(transformerSchema, command);

    const transformer = {} as Transformer;
    await copyTransformerCommandToTransformerEntity(transformer, command);
    this.transformerRepository.saveTransformer(transformer);

    // TODO this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    return transformer;
  }

  async update(id: string, command: TransformerCommand): Promise<void> {
    await this.validator.validate(transformerSchema, command);
    const transformer = this.transformerRepository.findTransformerById(id);
    if (!transformer) {
      throw new Error(`Transformer ${id} not found`);
    }
    await copyTransformerCommandToTransformerEntity(transformer, command);

    this.transformerRepository.saveTransformer(transformer);
    // TODO this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  async delete(id: string): Promise<void> {
    const ipFilter = this.transformerRepository.findTransformerById(id);
    if (!ipFilter) {
      throw new Error(`Transformer ${id} not found`);
    }

    this.transformerRepository.deleteTransformer(id);
    // TODO this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }
}

export const copyTransformerCommandToTransformerEntity = async (transformer: Transformer, command: TransformerCommand): Promise<void> => {
  transformer.name = command.name;
  transformer.description = command.description;
  transformer.inputType = command.inputType;
  transformer.outputType = command.outputType;
  transformer.code = command.code;
};

export const toTransformerDTO = (transformer: Transformer): TransformerDTO => {
  return {
    id: transformer.id,
    name: transformer.name,
    description: transformer.description,
    inputType: transformer.inputType,
    outputType: transformer.outputType,
    code: transformer.code
  };
};
