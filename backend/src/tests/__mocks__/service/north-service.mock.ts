import { mock } from 'node:test';

import { NorthConnectorMetrics, OIBusConnectionTestResult } from '../../../../shared/model/api/engine.model';
import { NorthConnectorCommandDTO } from '../../../../shared/model/api/north-connector.model';
import { TransformerSourceCommandDTO } from '../../../../shared/model/api/transformer.model';
import { NorthConnectorManifest, OIBusNorthType } from '../../../../shared/model/connector/north-manifest.model';
import { NorthSettings } from '../../../../shared/model/connector/north-settings.model';

import { NorthConnectorEntity, NorthConnectorEntityLight } from '../../../model/north-connector.model';
import { NorthTransformerWithOptions, TransformerSource } from '../../../model/transformer.model';

/**
 * Create a mock object for North Service
 */
export default class NorthServiceMock {
  listManifest = mock.fn((): Array<NorthConnectorManifest> => []);
  getManifest = mock.fn((_type: string): NorthConnectorManifest => ({}) as NorthConnectorManifest);
  list = mock.fn((): Array<NorthConnectorEntityLight> => []);
  findById = mock.fn((_northId: string): NorthConnectorEntity<NorthSettings> => ({}) as NorthConnectorEntity<NorthSettings>);
  create = mock.fn(
    async (
      _command: NorthConnectorCommandDTO,
      _retrieveSecretsFromNorth: string | null,
      _createdBy: string
    ): Promise<NorthConnectorEntity<NorthSettings>> => ({}) as NorthConnectorEntity<NorthSettings>
  );
  update = mock.fn(async (_northId: string, _command: NorthConnectorCommandDTO, _updatedBy: string): Promise<void> => undefined);
  delete = mock.fn(async (_northId: string, _userId: string): Promise<void> => undefined);
  start = mock.fn(async (_northId: string): Promise<void> => undefined);
  stop = mock.fn(async (_northId: string): Promise<void> => undefined);
  getNorthMetric = mock.fn((_northId: string): NorthConnectorMetrics => ({}) as NorthConnectorMetrics);
  testNorth = mock.fn(
    async (_northId: string, _northType: OIBusNorthType, _settingsToTest: NorthSettings): Promise<OIBusConnectionTestResult> =>
      ({ items: [] }) as unknown as OIBusConnectionTestResult
  );
  addOrEditTransformer = mock.fn(
    (_northId: string, _transformerWithOptions: NorthTransformerWithOptions, _userId: string): void => undefined
  );
  removeTransformer = mock.fn((_northId: string, _northTransformerId: string, _userId: string): void => undefined);
  checkSubscription = mock.fn((): boolean => false);
  subscribeToSouth = mock.fn((): void => undefined);
  unsubscribeFromSouth = mock.fn((): void => undefined);
  unsubscribeFromAllSouth = mock.fn((): void => undefined);
  searchCacheContent = mock.fn(async (): Promise<unknown> => ({}));
  getCacheFileContent = mock.fn(async (): Promise<unknown> => ({}));
  removeCacheContent = mock.fn(async (): Promise<void> => undefined);
  removeAllCacheContent = mock.fn(async (): Promise<void> => undefined);
  moveCacheContent = mock.fn(async (): Promise<void> => undefined);
  moveAllCacheContent = mock.fn(async (): Promise<void> => undefined);
  executeSetpoint = mock.fn(
    async (
      _northConnectorId: string,
      _commandContent: Array<{ reference: string; value: string }>,
      _callback: (result: string) => void
    ): Promise<void> => undefined
  );
  retrieveSecretsFromNorth = mock.fn(
    (_retrieveSecretsFromNorth: string | null, _manifest: NorthConnectorManifest): NorthConnectorEntity<NorthSettings> | null => null
  );
  transformerSourceFromCommand = mock.fn((_sourceCommand: TransformerSourceCommandDTO): TransformerSource => ({}) as TransformerSource);
}
