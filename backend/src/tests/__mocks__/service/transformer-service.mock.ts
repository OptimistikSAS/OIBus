import { mock } from 'node:test';
import { CustomTransformer, Transformer } from '../../../model/transformer.model';
import { CustomTransformerCommandDTO, TransformerSearchParam } from '../../../../shared/model/transformer.model';
import { Page } from '../../../../shared/model/types';
import type { TransformerManifest } from '../../../../shared/model/transformer.model';
import { InputType } from '../../../../shared/model/transformer.model';

/**
 * Create a mock object for Transformer service
 */
export default class TransformerServiceMock {
  listManifest = mock.fn((): Array<TransformerManifest> => []);
  getManifest = mock.fn((_type: string): TransformerManifest => ({}) as TransformerManifest);
  search = mock.fn(
    (_searchParams: TransformerSearchParam): Page<Transformer> => ({
      content: [],
      size: 10,
      number: 0,
      totalElements: 0,
      totalPages: 0
    })
  );
  findAll = mock.fn((): Array<Transformer> => []);
  findById = mock.fn((_transformerId: string): Transformer => ({}) as Transformer);
  create = mock.fn(
    async (_command: CustomTransformerCommandDTO, _createdBy: string): Promise<CustomTransformer> => ({}) as CustomTransformer
  );
  update = mock.fn(async (_transformerId: string, _command: CustomTransformerCommandDTO, _updatedBy: string): Promise<void> => undefined);
  delete = mock.fn(async (_transformerId: string): Promise<void> => undefined);
  test = mock.fn(async (): Promise<unknown> => ({}));
  generateTemplate = mock.fn((_inputType: InputType): unknown => ({}));
}
