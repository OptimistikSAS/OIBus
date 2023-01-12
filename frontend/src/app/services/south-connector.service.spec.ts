import { TestBed } from '@angular/core/testing';

import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { SouthConnectorService } from './south-connector.service';
import {
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthConnectorManifest,
  SouthItemCommandDTO,
  SouthItemDTO,
  SouthType
} from '../model/south-connector.model';
import { Page } from '../shared/types';
import { toPage } from '../shared/test-utils';

describe('SouthConnectorService', () => {
  let http: HttpTestingController;
  let service: SouthConnectorService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [SouthConnectorService]
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(SouthConnectorService);
  });

  afterEach(() => http.verify());

  it('should get all South connector types', () => {
    let expectedSouthConnectorTypes: Array<SouthType> = [];
    service.getSouthConnectorTypes().subscribe(types => (expectedSouthConnectorTypes = types));

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
    let expectedSouthConnectors: Array<SouthConnectorDTO> = [];
    service.getSouthConnectors().subscribe(southConnectors => (expectedSouthConnectors = southConnectors));

    http.expectOne('/api/south').flush([{ name: 'South connector 1' }, { name: 'South connector 2' }]);

    expect(expectedSouthConnectors.length).toBe(2);
  });

  it('should get a South connector', () => {
    let expectedSouthConnector: SouthConnectorDTO | null = null;
    const southConnector = { id: 'id1' } as SouthConnectorDTO;

    service.getSouthConnector('id1').subscribe(c => (expectedSouthConnector = c));

    http.expectOne({ url: '/api/south/id1', method: 'GET' }).flush(southConnector);
    expect(expectedSouthConnector!).toEqual(southConnector);
  });

  it('should get a South connector schema', () => {
    let expectedSouthConnectorType: object | null = null;
    const southConnectorSchema = {};

    service.getSouthConnectorSchema('SQL').subscribe(c => (expectedSouthConnectorType = c));

    http.expectOne({ url: '/api/south-type/SQL', method: 'GET' }).flush(southConnectorSchema);
    expect(expectedSouthConnectorType!).toEqual(southConnectorSchema);
  });

  it('should create a South connector', () => {
    let done = false;
    const command: SouthConnectorCommandDTO = {
      name: 'mySouthConnector',
      description: 'a test south connector',
      enabled: true,
      type: 'Test',
      settings: {}
    };

    service.createSouthConnector(command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/south' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should update a South connector', () => {
    let done = false;
    const command: SouthConnectorCommandDTO = {
      name: 'mySouthConnector',
      description: 'a test south connector',
      enabled: true,
      type: 'Test',
      settings: {}
    };

    service.updateSouthConnector('id1', command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/south/id1' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should delete a South connector', () => {
    let done = false;
    service.deleteSouthConnector('id1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'DELETE', url: '/api/south/id1' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should search South connector items', () => {
    let expectedSouthConnectorItems: Page<SouthItemDTO> | null = null;
    const southConnectorItems = toPage<SouthItemDTO>([
      { id: 'southItemId', name: 'MySouthItem', southId: 'id1', scanModeId: 'scanModeId', settings: {} }
    ]);

    service.searchSouthItems('id1', { page: 0, name: null }).subscribe(c => (expectedSouthConnectorItems = c));

    http.expectOne({ url: '/api/south/id1/items?page=0', method: 'GET' }).flush(southConnectorItems);
    expect(expectedSouthConnectorItems!).toEqual(southConnectorItems);
  });

  it('should get a South connector item', () => {
    let expectedSouthConnectorItem: object | null = null;
    const southConnectorItem = { id: 'southItemId1' };

    service.getSouthConnectorItem('id1', 'southItemId1').subscribe(c => (expectedSouthConnectorItem = c));

    http.expectOne({ url: '/api/south/id1/items/southItemId1', method: 'GET' }).flush(southConnectorItem);
    expect(expectedSouthConnectorItem!).toEqual(southConnectorItem);
  });

  it('should create a South connector item', () => {
    let done = false;
    const command: SouthItemCommandDTO = {
      name: 'myPointId',
      scanModeId: 'scanModeId',
      settings: {}
    };

    service.createSouthItem('id1', command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/south/id1/items' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should update a South connector item', () => {
    let done = false;
    const command: SouthItemCommandDTO = {
      name: 'myPointId',
      scanModeId: 'scanModeId',
      settings: {}
    };

    service.updateSouthItem('id1', 'southItemId1', command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/south/id1/items/southItemId1' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should delete a South connector item', () => {
    let done = false;
    service.deleteSouthItem('id1', 'southItemId1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'DELETE', url: '/api/south/id1/items/southItemId1' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });
});
