import { mock } from 'node:test';

import type { Database } from 'better-sqlite3';

import { TransformerSearchParam } from '../../../../../shared/model/api/transformer.model';
import { Page } from '../../../../../shared/model/common/types';

import { CustomTransformer, Transformer } from '../../../../model/transformer.model';
import TransformerRepository from '../../../../repository/config/transformer.repository';
import { createAuditServiceMock } from '../../../utils/test-utils';

/**
 * Create a mock object for Transformer repository
 */
export default class TransformerRepositoryMock extends TransformerRepository {
  constructor() {
    super({} as Database, createAuditServiceMock());
  }
  protected override createStandardTransformers(): void {
    return;
  }
  override list = mock.fn((): Array<Transformer> => []);
  override search = mock.fn((_searchParams: TransformerSearchParam): Page<Transformer> => ({
    content: [],
    size: 10,
    number: 0,
    totalElements: 0,
    totalPages: 0
  }));
  override save = mock.fn((_transformer: CustomTransformer): void => undefined);
  override findById = mock.fn((_id: string): Transformer | null => null);
  override delete = mock.fn((_id: string, _deletedBy: string): void => undefined);
}
