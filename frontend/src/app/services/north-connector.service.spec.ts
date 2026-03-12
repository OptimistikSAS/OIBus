import { TestBed } from '@angular/core/testing';

import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { NorthConnectorService } from './north-connector.service';
import {
  NorthConnectorDTO,
  NorthConnectorLightDTO,
  NorthConnectorManifest,
  NorthType
} from '../../../../backend/shared/model/north-connector.model';
import { CacheContentUpdateCommand, CacheSearchResult, FileCacheContent } from '../../../../backend/shared/model/engine.model';
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
    let result: CacheSearchResult | null = null;
    const northCacheFiles: CacheSearchResult = {} as CacheSearchResult;

    service
      .searchCacheContent('id1', {
        start: '2020-01-01T00:00:00.000Z',
        end: '2021-01-01T00:00:00.000Z',
        nameContains: 'file',
        maxNumberOfFilesReturned: 1000
      })
      .subscribe(c => (result = c));

    http
      .expectOne({
        url: '/api/north/id1/cache/search?maxNumberOfFilesReturned=1000&start=2020-01-01T00:00:00.000Z&end=2021-01-01T00:00:00.000Z&nameContains=file',
        method: 'GET'
      })
      .flush(northCacheFiles);
    expect(result!).toEqual(northCacheFiles);
  });

  it('should get cache file content', () => {
    let result: FileCacheContent | null = null;
    const northCacheFileContent: FileCacheContent = {} as FileCacheContent;
    service.getCacheFileContent('id1', 'cache', 'file1').subscribe(c => (result = c));

    http
      .expectOne({
        url: '/api/north/id1/cache/content/file1?folder=cache',
        method: 'GET'
      })
      .flush(northCacheFileContent);
    expect(result!).toEqual(northCacheFileContent);
  });

  it('should update cache', () => {
    let done = false;
    const updateCommand = {} as CacheContentUpdateCommand;
    service.updateCacheContent('id1', updateCommand).subscribe(() => (done = true));
    const testRequest = http.expectOne({
      method: 'POST',
      url: '/api/north/id1/cache/update'
    });
    testRequest.flush(updateCommand);
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
