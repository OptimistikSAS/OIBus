import { mock } from 'node:test';
import { NorthConnectorEntity, NorthConnectorEntityLight } from '../../../../model/north-connector.model';
import { NorthSettings } from '../../../../../shared/model/north-settings.model';
import { NorthTransformerWithOptions } from '../../../../model/transformer.model';

/**
 * Create a mock object for North Connector repository
 */
export default class NorthConnectorRepositoryMock {
  findAllNorth = mock.fn((): Array<NorthConnectorEntityLight> => []);
  findAllNorthFull = mock.fn((): Array<NorthConnectorEntity<NorthSettings>> => []);
  findNorthById = mock.fn((_id: string): NorthConnectorEntity<NorthSettings> | null => null);
  saveNorth = mock.fn((_north: NorthConnectorEntity<NorthSettings>): void => undefined);
  startNorth = mock.fn((_id: string): void => undefined);
  stopNorth = mock.fn((_id: string): void => undefined);
  deleteNorth = mock.fn((_id: string): void => undefined);
  addOrEditTransformer = mock.fn((_northId: string, _transformerWithOptions: NorthTransformerWithOptions): void => undefined);
  removeTransformer = mock.fn((_id: string): void => undefined);
  removeTransformersByTransformerId = mock.fn((_transformerId: string): void => undefined);
}
