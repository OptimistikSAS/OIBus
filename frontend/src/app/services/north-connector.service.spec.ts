import { TestBed } from '@angular/core/testing';

import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { NorthConnectorService } from './north-connector.service';
import {
  NorthConnectorCommandDTO,
  NorthConnectorDTO,
  NorthConnectorLightDTO,
  NorthConnectorManifest,
  NorthType
} from '../../../../backend/shared/model/north-connector.model';
import { HttpResponse, provideHttpClient } from '@angular/common/http';
import { SouthConnectorLightDTO } from '../../../../backend/shared/model/south-connector.model';
import { NorthSettings } from '../../../../backend/shared/model/north-settings.model';
import { CacheMetadata } from '../../../../backend/shared/model/engine.model';

describe('NorthConnectorService', () => {
  let http: HttpTestingController;
  let service: NorthConnectorService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(NorthConnectorService);
  });

  afterEach(() => http.verify());

  it('should get all North connector types', () => {
    let expectedNorthConnectorTypes: Array<NorthType> = [];
    service.getNorthConnectorTypes().subscribe(types => (expectedNorthConnectorTypes = types));

    http.expectOne('/api/north-types').flush([
      { category: 'Database', type: 'SQL', description: 'SQL description' },
      { category: 'IoT', type: 'MQTT', description: 'MQTT description' }
    ]);

    expect(expectedNorthConnectorTypes.length).toBe(2);
  });

  it('should get a North connector manifest', () => {
    let expectedNorthConnectorSchema: NorthConnectorManifest | null = null;
    service.getNorthConnectorTypeManifest('console').subscribe(manifest => (expectedNorthConnectorSchema = manifest));

    http.expectOne('/api/north-types/console').flush({ id: 'console' });

    expect(expectedNorthConnectorSchema!).toEqual({ id: 'console' } as NorthConnectorManifest);
  });

  it('should get all North connectors', () => {
    let expectedNorthConnectors: Array<NorthConnectorLightDTO> = [];
    service.list().subscribe(northConnectors => (expectedNorthConnectors = northConnectors));

    http.expectOne('/api/north').flush([{ name: 'North connector 1' }, { name: 'North connector 2' }]);

    expect(expectedNorthConnectors.length).toBe(2);
  });

  it('should get a North connector', () => {
    let expectedNorthConnector: NorthConnectorDTO<NorthSettings> | null = null;
    const northConnector = { id: 'id1' } as NorthConnectorDTO<NorthSettings>;

    service.get('id1').subscribe(c => (expectedNorthConnector = c));

    http.expectOne({ url: '/api/north/id1', method: 'GET' }).flush(northConnector);
    expect(expectedNorthConnector!).toEqual(northConnector);
  });

  it('should get a North connector schema', () => {
    let expectedNorthConnectorType: object | null = null;
    const northConnectorSchema = {};

    service.getSchema('SQL').subscribe(c => (expectedNorthConnectorType = c));

    http.expectOne({ url: '/api/north-type/SQL', method: 'GET' }).flush(northConnectorSchema);
    expect(expectedNorthConnectorType!).toEqual(northConnectorSchema);
  });

  it('should create a North connector', () => {
    let done = false;
    const command: NorthConnectorCommandDTO<NorthSettings> = {
      name: 'myNorthConnector',
      description: 'a test north connector',
      enabled: true,
      type: 'file-writer',
      settings: {} as NorthSettings,
      caching: {
        scanModeId: 'scanModeId1',
        scanModeName: null,
        retryInterval: 1000,
        retryCount: 3,
        runMinDelay: 200,
        maxSize: 30,
        oibusTimeValues: {
          groupCount: 1000,
          maxSendCount: 10000
        },
        rawFiles: {
          sendFileImmediately: true
        },
        archive: {
          enabled: false,
          retentionDuration: 0
        }
      },
      subscriptions: []
    };

    service.create(command, '').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/north' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should update a North connector', () => {
    let done = false;
    const command: NorthConnectorCommandDTO<NorthSettings> = {
      name: 'myNorthConnector',
      description: 'a test north connector',
      enabled: true,
      type: 'file-writer',
      settings: {} as NorthSettings,
      caching: {
        scanModeId: 'scanModeId1',
        scanModeName: null,
        retryInterval: 1000,
        retryCount: 3,
        runMinDelay: 200,
        maxSize: 30,
        oibusTimeValues: {
          groupCount: 1000,
          maxSendCount: 10000
        },
        rawFiles: {
          sendFileImmediately: true
        },
        archive: {
          enabled: false,
          retentionDuration: 0
        }
      },
      subscriptions: []
    };

    service.update('id1', command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/north/id1' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should delete a North connector', () => {
    let done = false;
    service.delete('id1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'DELETE', url: '/api/north/id1' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should get North connector subscriptions', () => {
    let expectedNorthConnectorSubscriptions: Array<SouthConnectorLightDTO> | null = null;
    const northConnectorSubscriptions: Array<SouthConnectorLightDTO> = [];

    service.getSubscriptions('id1').subscribe(c => (expectedNorthConnectorSubscriptions = c));

    http.expectOne({ url: '/api/north/id1/subscriptions', method: 'GET' }).flush(northConnectorSubscriptions);
    expect(expectedNorthConnectorSubscriptions!).toEqual(northConnectorSubscriptions);
  });

  it('should create a North connector subscription', () => {
    let done = false;
    service.createSubscription('id1', 'southId').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/north/id1/subscriptions/southId' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should delete a North connector subscription', () => {
    let done = false;
    service.deleteSubscription('id1', 'southId').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'DELETE', url: '/api/north/id1/subscriptions/southId' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should search cache content', () => {
    let expectedNorthCacheFiles: Array<{ metadataFilename: string; metadata: CacheMetadata }> | null = null;
    const northCacheFiles: Array<{ metadataFilename: string; metadata: CacheMetadata }> = [];

    service
      .searchCacheContent('id1', { start: '2020-01-01T00:00:00.000Z', end: '2021-01-01T00:00:00.000Z', nameContains: 'file' }, 'cache')
      .subscribe(c => (expectedNorthCacheFiles = c));

    http
      .expectOne({
        url: '/api/north/id1/cache/content?folder=cache&start=2020-01-01T00:00:00.000Z&end=2021-01-01T00:00:00.000Z&nameContains=file',
        method: 'GET'
      })
      .flush(northCacheFiles);
    expect(expectedNorthCacheFiles!).toEqual(northCacheFiles);
  });

  it('should get cache file content', () => {
    let httpResponse: HttpResponse<Blob>;
    const northCacheFileContent = new Blob(['test'], { type: 'text/plain' });
    service.getCacheFileContent('id1', 'cache', 'file1').subscribe(c => (httpResponse = c));

    http.expectOne({ url: '/api/north/id1/cache/content/file1?folder=cache', method: 'GET' }).flush(northCacheFileContent);
    expect(httpResponse!.body).toEqual(northCacheFileContent);
  });

  it('should remove listed cache files', () => {
    let done = false;
    service.removeCacheContent('id1', 'cache', ['file1', 'file2']).subscribe(() => (done = true));
    const testRequest = http.expectOne({
      method: 'DELETE',
      url: '/api/north/id1/cache/content/remove?folder=cache&filenames=file1&filenames=file2'
    });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should remove all archive files', () => {
    let done = false;
    service.removeAllCacheContent('id1', 'archive').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'DELETE', url: '/api/north/id1/cache/content/remove-all?folder=archive' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should move listed cache files into archive', () => {
    let done = false;
    service.moveCacheContent('id1', 'cache', 'archive', ['file1', 'file2']).subscribe(() => (done = true));
    const testRequest = http.expectOne({
      method: 'POST',
      url: '/api/north/id1/cache/content/move?originFolder=cache&destinationFolder=archive'
    });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should move all archive files into cache', () => {
    let done = false;
    service.moveAllCacheContent('id1', 'archive', 'cache').subscribe(() => (done = true));
    const testRequest = http.expectOne({
      method: 'POST',
      url: '/api/north/id1/cache/content/move-all?originFolder=archive&destinationFolder=cache'
    });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should reset North metrics', () => {
    let done = false;

    service.resetMetrics('id1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/north/id1/cache/reset-metrics' });
    expect(testRequest.request.body).toBeNull();
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should test a North connector connection', () => {
    let done = false;
    const command: NorthConnectorCommandDTO<NorthSettings> = {
      name: 'myNorthConnector',
      description: 'a test north connector',
      enabled: true,
      type: 'file-writer',
      settings: {} as NorthSettings,
      caching: {
        scanModeId: 'scanModeId1',
        scanModeName: null,
        retryInterval: 1000,
        retryCount: 3,
        runMinDelay: 200,
        maxSize: 30,
        oibusTimeValues: {
          groupCount: 1000,
          maxSendCount: 10000
        },
        rawFiles: {
          sendFileImmediately: true
        },
        archive: {
          enabled: false,
          retentionDuration: 0
        }
      },
      subscriptions: []
    };

    service.testConnection('id1', command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/north/id1/test-connection' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should start a North', () => {
    let done = false;

    service.startNorth('id1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/north/id1/start' });
    expect(testRequest.request.body).toEqual(null);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should stop a North', () => {
    let done = false;

    service.stopNorth('id1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/north/id1/stop' });
    expect(testRequest.request.body).toEqual(null);
    testRequest.flush(null);
    expect(done).toBe(true);
  });
});
