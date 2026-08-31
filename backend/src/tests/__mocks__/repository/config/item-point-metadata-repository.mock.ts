import { mock } from 'node:test';
import type { Database } from 'better-sqlite3';
import { ItemPointMetadataEntity, ItemPointMetadataWrite } from '../../../../model/item-point-metadata.model';
import ItemPointMetadataRepository from '../../../../repository/config/item-point-metadata.repository';

/**
 * Create a mock object for Item Point Metadata repository
 */
export default class ItemPointMetadataRepositoryMock extends ItemPointMetadataRepository {
  constructor() {
    super({} as Database);
  }
  override findById = mock.fn((_id: string): ItemPointMetadataEntity | null => null);
  override findByWorkflowAndKey = mock.fn((_workflowId: string, _discoveredEntryKey: string): ItemPointMetadataEntity | null => null);
  override findAllByWorkflow = mock.fn((_workflowId: string): Array<ItemPointMetadataEntity> => []);
  override findBySouthItemId = mock.fn((_southItemId: string): Array<ItemPointMetadataEntity> => []);
  override create = mock.fn((_write: ItemPointMetadataWrite): ItemPointMetadataEntity => ({}) as ItemPointMetadataEntity);
  override update = mock.fn((_id: string, _write: Omit<ItemPointMetadataWrite, 'workflowId' | 'southItemId'>): void => undefined);
  override markOrphaned = mock.fn((_id: string): void => undefined);
  override markPushed = mock.fn((_id: string): void => undefined);
  override delete = mock.fn((_id: string): void => undefined);
}
