import { TestBed } from '@angular/core/testing';

import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { NorthConnectorService } from './north-connector.service';
import {
  NorthConnectorDTO,
  NorthConnectorLightDTO,
  NorthConnectorManifest,
  NorthType
} from '../../../../backend/shared/model/north-connector.model';
import { HttpResponse } from '@angular/common/http';
import { CacheMetadata } from '../../../../backend/shared/model/engine.model';
import testData from '../../../../backend/src/tests/utils/test-data';
import { TransformerDTOWithOptions } from '../../../../backend/shared/model/transformer.model';

describe('NorthConnectorService', () => {
  let http: HttpTestingController;
  let service: NorthConnectorService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(NorthConnectorService);
  });

  afterEach(() => http.verify());

  it('should get all North connector manifests', () => {
    let expectedNorthConnectorTypes: Array<NorthType> = [];
    service.getNorthTypes().subscribe(types => (expectedNorthConnectorTypes = types));

    http.expectOne('/api/north/types').flush([
      { category: 'Database', type: 'SQL', description: 'SQL description' },
      { category: 'IoT', type: 'MQTT', description: 'MQTT description' }
    ]);

    expect(expectedNorthConnectorTypes.length).toBe(2);
  });

  it('should get a North connector manifest', () => {
    let expectedManifest: NorthConnectorManifest | null = null;
    service.getNorthManifest('console').subscribe(manifest => (expectedManifest = manifest));

    http.expectOne('/api/north/manifests/console').flush(testData.north.manifest);

    expect(expectedManifest!).toEqual(testData.north.manifest);
  });

  it('should get all North connectors', () => {
    let expectedNorthConnectors: Array<NorthConnectorLightDTO> = [];
    service.list().subscribe(northConnectors => (expectedNorthConnectors = northConnectors));

    http.expectOne('/api/north').flush([{ name: 'North connector 1' }, { name: 'North connector 2' }]);

    expect(expectedNorthConnectors.length).toBe(2);
  });

  it('should get a North connector', () => {
    let expectedNorthConnector: NorthConnectorDTO | null = null;
    const northConnector = { id: 'id1' } as NorthConnectorDTO;

    service.findById('id1').subscribe(c => (expectedNorthConnector = c));

    http.expectOne({ url: '/api/north/id1', method: 'GET' }).flush(northConnector);
    expect(expectedNorthConnector!).toEqual(northConnector);
  });

  it('should create a North connector', () => {
    let done = false;
    const command = testData.north.command;

    service.create(command, '').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/north' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should update a North connector', () => {
    let done = false;
    const command = testData.north.command;

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

  it('should add or edit a North connector transformer with options', () => {
    let done = false;
    service.addOrEditTransformer('id1', {} as TransformerDTOWithOptions).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/north/id1/transformers' });
    testRequest.flush({});
    expect(done).toBe(true);
  });

  it('should remove a North connector transformer', () => {
    let done = false;
    service.removeTransformer('id1', 'transformerId').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'DELETE', url: '/api/north/id1/transformers/transformerId' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should search cache content', () => {
    let expectedNorthCacheFiles: Array<{ metadataFilename: string; metadata: CacheMetadata }> | null = null;
    const northCacheFiles: Array<{ metadataFilename: string; metadata: CacheMetadata }> = [];

    service
      .searchCacheContent(
        'id1',
        {
          start: '2020-01-01T00:00:00.000Z',
          end: '2021-01-01T00:00:00.000Z',
          nameContains: 'file'
        },
        'cache'
      )
      .subscribe(c => (expectedNorthCacheFiles = c));

    http
      .expectOne({
        url: '/api/north/id1/cache/search?folder=cache&start=2020-01-01T00:00:00.000Z&end=2021-01-01T00:00:00.000Z&nameContains=file',
        method: 'GET'
      })
      .flush(northCacheFiles);
    expect(expectedNorthCacheFiles!).toEqual(northCacheFiles);
  });

  it('should get cache file content', () => {
    let httpResponse: HttpResponse<Blob>;
    const northCacheFileContent = new Blob(['test'], { type: 'text/plain' });
    service.getCacheFileContent('id1', 'cache', 'file1').subscribe(c => (httpResponse = c));

    http
      .expectOne({
        url: '/api/north/id1/cache/content/file1?folder=cache',
        method: 'GET'
      })
      .flush(northCacheFileContent);
    expect(httpResponse!.body).toEqual(northCacheFileContent);
  });

  it('should remove listed cache files', () => {
    let done = false;
    service.removeCacheContent('id1', 'cache', ['file1', 'file2']).subscribe(() => (done = true));
    const testRequest = http.expectOne({
      method: 'DELETE',
      url: '/api/north/id1/cache/remove?folder=cache'
    });
    testRequest.flush(['file1', 'file2']);
    expect(done).toBe(true);
  });

  it('should remove all archive files', () => {
    let done = false;
    service.removeAllCacheContent('id1', 'archive').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'DELETE', url: '/api/north/id1/cache/remove-all?folder=archive' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should move listed cache files into archive', () => {
    let done = false;
    service.moveCacheContent('id1', 'cache', 'archive', ['file1', 'file2']).subscribe(() => (done = true));
    const testRequest = http.expectOne({
      method: 'POST',
      url: '/api/north/id1/cache/move?originFolder=cache&destinationFolder=archive'
    });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should move all archive files into cache', () => {
    let done = false;
    service.moveAllCacheContent('id1', 'archive', 'cache').subscribe(() => (done = true));
    const testRequest = http.expectOne({
      method: 'POST',
      url: '/api/north/id1/cache/move-all?originFolder=archive&destinationFolder=cache'
    });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should reset North metrics', () => {
    let done = false;

    service.resetMetrics('id1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/north/id1/metrics/reset' });
    expect(testRequest.request.body).toBeNull();
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should test a North connector connection', () => {
    let done = false;
    const command = testData.north.command;

    service.testConnection('id1', command.settings, command.type).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/north/id1/test/connection?northType=file-writer' });
    expect(testRequest.request.body).toEqual(command.settings);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should start a North', () => {
    let done = false;

    service.start('id1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/north/id1/start' });
    expect(testRequest.request.body).toEqual(null);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should stop a North', () => {
    let done = false;

    service.stop('id1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/north/id1/stop' });
    expect(testRequest.request.body).toEqual(null);
    testRequest.flush(null);
    expect(done).toBe(true);
  });
});
