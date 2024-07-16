import { TestBed } from '@angular/core/testing';

import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { NorthConnectorService } from './north-connector.service';
import {
  NorthCacheFiles,
  NorthArchiveFiles,
  NorthConnectorCommandDTO,
  NorthConnectorDTO,
  NorthConnectorManifest,
  NorthType,
  NorthValueFiles
} from '../../../../shared/model/north-connector.model';
import { SubscriptionDTO } from '../../../../shared/model/subscription.model';
import { HttpResponse, provideHttpClient } from '@angular/common/http';

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
    service.getNorthConnectorTypeManifest('SQL').subscribe(manifest => (expectedNorthConnectorSchema = manifest));

    http.expectOne('/api/north-types/SQL').flush({ name: 'myNorthConnector' });

    expect(expectedNorthConnectorSchema!).toEqual({ name: 'myNorthConnector' } as NorthConnectorManifest);
  });

  it('should get all North connectors', () => {
    let expectedNorthConnectors: Array<NorthConnectorDTO> = [];
    service.list().subscribe(northConnectors => (expectedNorthConnectors = northConnectors));

    http.expectOne('/api/north').flush([{ name: 'North connector 1' }, { name: 'North connector 2' }]);

    expect(expectedNorthConnectors.length).toBe(2);
  });

  it('should get a North connector', () => {
    let expectedNorthConnector: NorthConnectorDTO | null = null;
    const northConnector = { id: 'id1' } as NorthConnectorDTO;

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
    const command: NorthConnectorCommandDTO = {
      name: 'myNorthConnector',
      description: 'a test north connector',
      enabled: true,
      type: 'Test',
      settings: {},
      caching: {
        scanModeId: 'scanModeId1',
        retryInterval: 1000,
        retryCount: 3,
        maxSize: 30,
        oibusTimeValues: {
          groupCount: 1000,
          maxSendCount: 10000
        },
        rawFiles: {
          sendFileImmediately: true,
          archive: {
            enabled: false,
            retentionDuration: 0
          }
        }
      }
    };

    service.create(command, [], '').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/north' });
    expect(testRequest.request.body).toEqual({ north: command, subscriptions: [] });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should update a North connector', () => {
    let done = false;
    const command: NorthConnectorCommandDTO = {
      name: 'myNorthConnector',
      description: 'a test north connector',
      enabled: true,
      type: 'Test',
      settings: {},
      caching: {
        scanModeId: 'scanModeId1',
        retryInterval: 1000,
        retryCount: 3,
        maxSize: 30,
        oibusTimeValues: {
          groupCount: 1000,
          maxSendCount: 10000
        },
        rawFiles: {
          sendFileImmediately: true,
          archive: {
            enabled: false,
            retentionDuration: 0
          }
        }
      }
    };

    service.update('id1', command, [], []).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/north/id1' });
    expect(testRequest.request.body).toEqual({ north: command, subscriptions: [], subscriptionsToDelete: [] });
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
    let expectedNorthConnectorSubscriptions: Array<SubscriptionDTO> | null = null;
    const northConnectorSubscriptions: Array<SubscriptionDTO> = [];

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

  it('should get error cache files', () => {
    let expectedNorthCacheFiles: Array<NorthCacheFiles> | null = null;
    const northCacheFiles: Array<NorthCacheFiles> = [];

    service.getCacheErrorFiles('id1').subscribe(c => (expectedNorthCacheFiles = c));

    http.expectOne({ url: '/api/north/id1/cache/file-errors', method: 'GET' }).flush(northCacheFiles);
    expect(expectedNorthCacheFiles!).toEqual(northCacheFiles);
  });

  it('should get error cache file content', () => {
    let httpResponse: HttpResponse<Blob>;
    const northCacheFileContent = new Blob(['test'], { type: 'text/plain' });
    service.getCacheErrorFileContent('id1', 'file1').subscribe(c => (httpResponse = c));

    http.expectOne({ url: '/api/north/id1/cache/file-errors/file1', method: 'GET' }).flush(northCacheFileContent);
    expect(httpResponse!.body).toEqual(northCacheFileContent);
  });

  it('should remove listed error cache files', () => {
    let done = false;
    service.removeCacheErrorFiles('id1', ['file1', 'file2']).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/north/id1/cache/file-errors/remove' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should retry listed error cache files', () => {
    let done = false;
    service.retryCacheErrorFiles('id1', ['file1', 'file2']).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/north/id1/cache/file-errors/retry' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should remove all error cache files', () => {
    let done = false;
    service.removeAllCacheErrorFiles('id1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'DELETE', url: '/api/north/id1/cache/file-errors/remove-all' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should retry all error cache files', () => {
    let done = false;
    service.retryAllCacheErrorFiles('id1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'DELETE', url: '/api/north/id1/cache/file-errors/retry-all' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should get cache files', () => {
    let expectedNorthCacheFiles: Array<NorthCacheFiles> | null = null;
    const northCacheFiles: Array<NorthCacheFiles> = [];

    service.getCacheFiles('id1').subscribe(c => (expectedNorthCacheFiles = c));

    http.expectOne({ url: '/api/north/id1/cache/files', method: 'GET' }).flush(northCacheFiles);
    expect(expectedNorthCacheFiles!).toEqual(northCacheFiles);
  });

  it('should get cache file content', () => {
    let httpResponse: HttpResponse<Blob>;
    const northCacheFileContent = new Blob(['test'], { type: 'text/plain' });
    service.getCacheFileContent('id1', 'file1').subscribe(c => (httpResponse = c));

    http.expectOne({ url: '/api/north/id1/cache/files/file1', method: 'GET' }).flush(northCacheFileContent);
    expect(httpResponse!.body).toEqual(northCacheFileContent);
  });

  it('should remove listed cache files', () => {
    let done = false;
    service.removeCacheFiles('id1', ['file1', 'file2']).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/north/id1/cache/files/remove' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should archive listed cache files', () => {
    let done = false;
    service.archiveCacheFiles('id1', ['file1', 'file2']).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/north/id1/cache/files/archive' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should get archive files', () => {
    let expectedNorthArchiveFiles: Array<NorthArchiveFiles> | null = null;
    const northArchiveFiles: Array<NorthArchiveFiles> = [];

    service.getCacheArchiveFiles('id1').subscribe(c => (expectedNorthArchiveFiles = c));

    http.expectOne({ url: '/api/north/id1/cache/archive-files', method: 'GET' }).flush(northArchiveFiles);
    expect(expectedNorthArchiveFiles!).toEqual(northArchiveFiles);
  });

  it('should get archive file content', () => {
    let httpResponse: HttpResponse<Blob>;
    const northCacheFileContent = new Blob(['test'], { type: 'text/plain' });
    service.getCacheArchiveFileContent('id1', 'file1').subscribe(c => (httpResponse = c));

    http.expectOne({ url: '/api/north/id1/cache/archive-files/file1', method: 'GET' }).flush(northCacheFileContent);
    expect(httpResponse!.body).toEqual(northCacheFileContent);
  });

  it('should remove listed archive files', () => {
    let done = false;
    service.removeCacheArchiveFiles('id1', ['file1', 'file2']).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/north/id1/cache/archive-files/remove' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should retry listed archive files', () => {
    let done = false;
    service.retryCacheArchiveFiles('id1', ['file1', 'file2']).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/north/id1/cache/archive-files/retry' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should remove all archive files', () => {
    let done = false;
    service.removeAllCacheArchiveFiles('id1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'DELETE', url: '/api/north/id1/cache/archive-files/remove-all' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should retry all archive files', () => {
    let done = false;
    service.retryAllCacheArchiveFiles('id1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'DELETE', url: '/api/north/id1/cache/archive-files/retry-all' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should get cache values', () => {
    let expectedNorthValues: Array<NorthValueFiles> | null = null;
    const northValueFiles: Array<NorthValueFiles> = [];

    service.getCacheValues('id1').subscribe(c => (expectedNorthValues = c));

    http.expectOne({ url: '/api/north/id1/cache/values', method: 'GET' }).flush(northValueFiles);
    expect(expectedNorthValues!).toEqual(northValueFiles);
  });

  it('should remove listed cache values', () => {
    let done = false;
    service.removeCacheValues('id1', ['file1', 'file2']).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/north/id1/cache/values/remove' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should get cache value errors', () => {
    let expectedNorthCacheFiles: Array<NorthCacheFiles> | null = null;
    const northCacheFiles: Array<NorthCacheFiles> = [];

    service.getCacheErrorValues('id1').subscribe(c => (expectedNorthCacheFiles = c));

    http.expectOne({ url: '/api/north/id1/cache/value-errors', method: 'GET' }).flush(northCacheFiles);
    expect(expectedNorthCacheFiles!).toEqual(northCacheFiles);
  });

  it('should remove cache value errors', () => {
    let done = false;
    service.removeCacheErrorValues('id1', ['file1', 'file2']).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/north/id1/cache/value-errors/remove' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should retry cache value errors', () => {
    let done = false;
    service.retryCacheErrorValues('id1', ['file1', 'file2']).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/north/id1/cache/value-errors/retry' });
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
    const command: NorthConnectorCommandDTO = {
      name: 'myNorthConnector',
      description: 'a test north connector',
      enabled: true,
      type: 'Test',
      settings: {},
      caching: {
        scanModeId: 'scanModeId1',
        retryInterval: 1000,
        retryCount: 3,
        maxSize: 30,
        oibusTimeValues: {
          groupCount: 1000,
          maxSendCount: 10000
        },
        rawFiles: {
          sendFileImmediately: true,
          archive: {
            enabled: false,
            retentionDuration: 0
          }
        }
      }
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
