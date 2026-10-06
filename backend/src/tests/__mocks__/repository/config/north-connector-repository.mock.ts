import { mock } from 'node:test';

import type { Database } from 'better-sqlite3';

import { NorthSettings } from '../../../../../shared/model/connector/north-settings.model';

import { NorthConnectorEntity, NorthConnectorEntityLight } from '../../../../model/north-connector.model';
import { NorthTransformerWithOptions } from '../../../../model/transformer.model';
import NorthConnectorRepository from '../../../../repository/config/north-connector.repository';
import { createAuditServiceMock } from '../../../utils/test-utils';

/**
 * Create a mock object for North Connector repository
 */
export default class NorthConnectorRepositoryMock extends NorthConnectorRepository {
  constructor() {
    super({} as Database, createAuditServiceMock());
  }
  override findAllNorth = mock.fn((): Array<NorthConnectorEntityLight> => []);
  override findAllNorthFull = mock.fn((): Array<NorthConnectorEntity<NorthSettings>> => []);
  override findNorthById = mock.fn((_id: string): NorthConnectorEntity<NorthSettings> | null => null);
  override saveNorth = mock.fn((_north: NorthConnectorEntity<NorthSettings>): void => undefined);
  override startNorth = mock.fn((_id: string): void => undefined);
  override stopNorth = mock.fn((_id: string): void => undefined);
  override deleteNorth = mock.fn((_id: string, _deletedBy: string): void => undefined);
  override addOrEditTransformer = mock.fn(
    (_northId: string, _transformerWithOptions: NorthTransformerWithOptions, _updatedBy: string): void => undefined
  );
  override removeTransformer = mock.fn((_id: string, _deletedBy: string): void => undefined);
  override removeTransformersByTransformerId = mock.fn((_transformerId: string, _deletedBy: string): void => undefined);
}
