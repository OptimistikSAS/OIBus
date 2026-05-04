import { mock } from 'node:test';
import { CustomTransformer, Transformer } from '../../../../model/transformer.model';
import { TransformerSearchParam } from '../../../../../shared/model/transformer.model';
import { Page } from '../../../../../shared/model/types';

/**
 * Create a mock object for Transformer repository
 */
export default class TransformerRepositoryMock {
  list = mock.fn((): Array<Transformer> => []);
  search = mock.fn(
    (_searchParams: TransformerSearchParam): Page<Transformer> => ({
      content: [],
      size: 10,
      number: 0,
      totalElements: 0,
      totalPages: 0
    })
  );
  save = mock.fn((_transformer: CustomTransformer): void => undefined);
  findById = mock.fn((_id: string): Transformer | null => null);
  delete = mock.fn((_id: string): void => undefined);
}
