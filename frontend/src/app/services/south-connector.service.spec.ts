import { TestBed } from '@angular/core/testing';

import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SouthConnectorService } from './south-connector.service';
import {
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthConnectorManifest,
  SouthType
} from '../../../../shared/model/south-connector.model';
import { Page } from '../../../../shared/model/types';
import { toPage } from '../shared/test-utils';
import { DownloadService } from './download.service';
import { provideHttpClient } from '@angular/common/http';

describe('SouthConnectorService', () => {
  let http: HttpTestingController;
  let service: SouthConnectorService;
  let downloadService: DownloadService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(SouthConnectorService);
    downloadService = TestBed.inject(DownloadService);
  });

  afterEach(() => http.verify());

  it('should get all South connector types', () => {
    let expectedSouthConnectorTypes: Array<SouthType> = [];
    service.getAvailableTypes().subscribe(types => (expectedSouthConnectorTypes = types));

    http.expectOne('/api/south-types').flush([
      { category: 'Database', type: 'SQL', description: 'SQL description' },
      { category: 'IoT', type: 'MQTT', description: 'MQTT description' }
    ]);

    expect(expectedSouthConnectorTypes.length).toBe(2);
  });

  it('should get a South connector manifest', () => {
    let expectedSouthConnectorSchema: SouthConnectorManifest | null = null;
    service.getSouthConnectorTypeManifest('SQL').subscribe(manifest => (expectedSouthConnectorSchema = manifest));

    http.expectOne('/api/south-types/SQL').flush({ name: 'mySouthConnector' });

    expect(expectedSouthConnectorSchema!).toEqual({ name: 'mySouthConnector' } as SouthConnectorManifest);
  });

  it('should get all South connectors', () => {
    let expectedSouthConnectors: Array<SouthConnectorDTO<any>> = [];
    service.list().subscribe(southConnectors => (expectedSouthConnectors = southConnectors));

    http.expectOne('/api/south').flush([{ name: 'South connector 1' }, { name: 'South connector 2' }]);

    expect(expectedSouthConnectors.length).toBe(2);
  });

  it('should get a South connector', () => {
    let expectedSouthConnector: SouthConnectorDTO<any> | null = null;
    const southConnector = { id: 'id1' } as SouthConnectorDTO<any>;

    service.get('id1').subscribe(c => (expectedSouthConnector = c));

    http.expectOne({ url: '/api/south/id1', method: 'GET' }).flush(southConnector);
    expect(expectedSouthConnector!).toEqual(southConnector);
  });

  it('should get a South connector schema', () => {
    let expectedSouthConnectorType: object | null = null;
    const southConnectorSchema = {};

    service.getSchema('SQL').subscribe(c => (expectedSouthConnectorType = c));

    http.expectOne({ url: '/api/south-type/SQL', method: 'GET' }).flush(southConnectorSchema);
    expect(expectedSouthConnectorType!).toEqual(southConnectorSchema);
  });

  it('should create a South connector', () => {
    let done = false;
    const command: SouthConnectorCommandDTO<any> = {
      name: 'mySouthConnector',
      description: 'a test south connector',
      enabled: true,
      history: {
        maxInstantPerItem: false,
        maxReadInterval: 0,
        readDelay: 200
      },
      type: 'Test',
      settings: {}
    };

    service.create(command, []).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/south' });
    expect(testRequest.request.body).toEqual({ south: command, items: [] });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should update a South connector', () => {
    let done = false;
    const command: SouthConnectorCommandDTO<any> = {
      name: 'mySouthConnector',
      description: 'a test south connector',
      enabled: true,
      history: {
        maxInstantPerItem: false,
        maxReadInterval: 0,
        readDelay: 200
      },
      type: 'Test',
      settings: {}
    };

    service.update('id1', command, []).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/south/id1' });
    expect(testRequest.request.body).toEqual({ south: command, items: [] });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should delete a South connector', () => {
    let done = false;
    service.delete('id1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'DELETE', url: '/api/south/id1' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should search South connector items', () => {
    let expectedSouthConnectorItems: Page<SouthConnectorItemDTO<any>> | null = null;
    const southConnectorItems = toPage<SouthConnectorItemDTO<any>>([
      { id: 'southItemId', name: 'MySouthItem', enabled: true, connectorId: 'id1', scanModeId: 'scanModeId', settings: {} }
    ]);

    service.searchItems('id1', { page: 0, name: null }).subscribe(c => (expectedSouthConnectorItems = c));

    http.expectOne({ url: '/api/south/id1/items?page=0', method: 'GET' }).flush(southConnectorItems);
    expect(expectedSouthConnectorItems!).toEqual(southConnectorItems);
  });

  it('should get a South connector item', () => {
    let expectedSouthConnectorItem: object | null = null;
    const southConnectorItem = { id: 'southItemId1' };

    service.getItem('id1', 'southItemId1').subscribe(c => (expectedSouthConnectorItem = c));

    http.expectOne({ url: '/api/south/id1/items/southItemId1', method: 'GET' }).flush(southConnectorItem);
    expect(expectedSouthConnectorItem!).toEqual(southConnectorItem);
  });

  it('should create a South connector item', () => {
    let done = false;
    const command: SouthConnectorItemCommandDTO<any> = {
      name: 'myPointId',
      enabled: false,
      scanModeId: 'scanModeId',
      settings: {}
    };

    service.createItem('id1', command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/south/id1/items' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should update a South connector item', () => {
    let done = false;
    const command: SouthConnectorItemCommandDTO<any> = {
      name: 'myPointId',
      enabled: true,
      scanModeId: 'scanModeId',
      settings: {}
    };

    service.updateItem('id1', 'southItemId1', command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/south/id1/items/southItemId1' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should delete a South connector item', () => {
    let done = false;
    service.deleteItem('id1', 'southItemId1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'DELETE', url: '/api/south/id1/items/southItemId1' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should enable a South connector item', () => {
    let done = false;
    service.enableItem('id1', 'southItemId1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/south/id1/items/southItemId1/enable' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should disable a South connector item', () => {
    let done = false;
    service.disableItem('id1', 'southItemId1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/south/id1/items/southItemId1/disable' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should delete all South connector items', () => {
    let done = false;
    service.deleteAllItems('id1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'DELETE', url: '/api/south/id1/items/all' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should reset South metrics', () => {
    let done = false;

    service.resetMetrics('id1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/south/id1/cache/reset-metrics' });
    expect(testRequest.request.body).toBeNull();
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should download items blob', () => {
    let downloaded = false;

    spyOn(downloadService, 'download');
    service.exportItems('id1', 'southName').subscribe(() => (downloaded = true));

    http
      .expectOne({
        method: 'GET',
        url: '/api/south/id1/items/export'
      })
      .flush(new Blob());

    expect(downloaded).toBe(true);
    expect(downloadService.download).toHaveBeenCalled();
  });

  it('should import items', () => {
    const file = new Blob() as File;
    const expectedFormData = new FormData();
    expectedFormData.set('file', file);
    let actualImportation = false;

    service.uploadItems('id1', file).subscribe(() => {
      actualImportation = true;
    });

    const testRequest = http.expectOne({ method: 'POST', url: '/api/south/id1/items/upload' });
    expect(testRequest.request.body).toEqual(expectedFormData);
    testRequest.flush(true);

    expect(actualImportation).toBe(true);
  });

  it('should test a South connector connection', () => {
    let done = false;
    const command: SouthConnectorCommandDTO<any> = {
      name: 'mySouthConnector',
      description: 'a test south connector',
      enabled: true,
      history: {
        maxInstantPerItem: false,
        maxReadInterval: 0,
        readDelay: 200
      },
      type: 'Test',
      settings: {}
    };

    service.testConnection('id1', command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/south/id1/test-connection' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should start a South', () => {
    let done = false;

    service.startSouth('id1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/south/id1/start' });
    expect(testRequest.request.body).toEqual(null);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should stop a South', () => {
    let done = false;

    service.stopSouth('id1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/south/id1/stop' });
    expect(testRequest.request.body).toEqual(null);
    testRequest.flush(null);
    expect(done).toBe(true);
  });
});
