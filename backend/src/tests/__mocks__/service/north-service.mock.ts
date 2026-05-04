import { mock } from 'node:test';
import { NorthConnectorCommandDTO, NorthConnectorManifest, OIBusNorthType } from '../../../../shared/model/north-connector.model';
import { NorthConnectorEntity, NorthConnectorEntityLight } from '../../../model/north-connector.model';
import { NorthSettings } from '../../../../shared/model/north-settings.model';
import { NorthTransformerWithOptions, TransformerSource } from '../../../model/transformer.model';
import { TransformerSourceCommandDTO } from '../../../../shared/model/transformer.model';
import { OIBusConnectionTestResult } from '../../../../shared/model/engine.model';
import { NorthConnectorMetrics } from '../../../../shared/model/engine.model';
import { PassThrough } from 'node:stream';

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
  delete = mock.fn(async (_northId: string): Promise<void> => undefined);
  start = mock.fn(async (_northId: string): Promise<void> => undefined);
  stop = mock.fn(async (_northId: string): Promise<void> => undefined);
  getNorthDataStream = mock.fn((_northId: string): PassThrough | null => null);
  getNorthMetric = mock.fn((_northId: string): NorthConnectorMetrics | null => null);
  testNorth = mock.fn(
    async (_northId: string, _northType: OIBusNorthType, _settingsToTest: NorthSettings): Promise<OIBusConnectionTestResult> =>
      ({ items: [] }) as unknown as OIBusConnectionTestResult
  );
  addOrEditTransformer = mock.fn((_northId: string, _transformerWithOptions: NorthTransformerWithOptions): void => undefined);
  removeTransformer = mock.fn((_northId: string, _northTransformerId: string): void => undefined);
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
  executeSetpoint = mock.fn(async (): Promise<void> => undefined);
  retrieveSecretsFromNorth = mock.fn(
    (_retrieveSecretsFromNorth: string | null, _manifest: NorthConnectorManifest): NorthConnectorEntity<NorthSettings> | null => null
  );
  transformerSourceFromCommand = mock.fn((_sourceCommand: TransformerSourceCommandDTO): TransformerSource => ({}) as TransformerSource);
}
