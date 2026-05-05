import { mock } from 'node:test';
import type { Database } from 'better-sqlite3';
import { NorthConnectorEntity, NorthConnectorEntityLight } from '../../../../model/north-connector.model';
import { NorthSettings } from '../../../../../shared/model/north-settings.model';
import { NorthTransformerWithOptions } from '../../../../model/transformer.model';
import NorthConnectorRepository from '../../../../repository/config/north-connector.repository';

/**
 * Create a mock object for North Connector repository
 */
export default class NorthConnectorRepositoryMock extends NorthConnectorRepository {
  constructor() {
    super({} as Database);
  }
  override findAllNorth = mock.fn((): Array<NorthConnectorEntityLight> => []);
  override findAllNorthFull = mock.fn((): Array<NorthConnectorEntity<NorthSettings>> => []);
  override findNorthById = mock.fn((_id: string): NorthConnectorEntity<NorthSettings> | null => null);
  override saveNorth = mock.fn((_north: NorthConnectorEntity<NorthSettings>): void => undefined);
  override startNorth = mock.fn((_id: string): void => undefined);
  override stopNorth = mock.fn((_id: string): void => undefined);
  override deleteNorth = mock.fn((_id: string): void => undefined);
  override addOrEditTransformer = mock.fn((_northId: string, _transformerWithOptions: NorthTransformerWithOptions): void => undefined);
  override removeTransformer = mock.fn((_id: string): void => undefined);
  override removeTransformersByTransformerId = mock.fn((_transformerId: string): void => undefined);
}
