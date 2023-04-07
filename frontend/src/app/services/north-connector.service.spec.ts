import { TestBed } from '@angular/core/testing';

import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { NorthConnectorService } from './north-connector.service';
import {
  NorthConnectorCommandDTO,
  NorthConnectorDTO,
  NorthConnectorManifest,
  NorthType
} from '../../../../shared/model/north-connector.model';
import { SubscriptionDTO } from '../../../../shared/model/subscription.model';

describe('NorthConnectorService', () => {
  let http: HttpTestingController;
  let service: NorthConnectorService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [NorthConnectorService]
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
    service.getNorthConnectors().subscribe(northConnectors => (expectedNorthConnectors = northConnectors));

    http.expectOne('/api/north').flush([{ name: 'North connector 1' }, { name: 'North connector 2' }]);

    expect(expectedNorthConnectors.length).toBe(2);
  });

  it('should get a North connector', () => {
    let expectedNorthConnector: NorthConnectorDTO | null = null;
    const northConnector = { id: 'id1' } as NorthConnectorDTO;

    service.getNorthConnector('id1').subscribe(c => (expectedNorthConnector = c));

    http.expectOne({ url: '/api/north/id1', method: 'GET' }).flush(northConnector);
    expect(expectedNorthConnector!).toEqual(northConnector);
  });

  it('should get a North connector schema', () => {
    let expectedNorthConnectorType: object | null = null;
    const northConnectorSchema = {};

    service.getNorthConnectorSchema('SQL').subscribe(c => (expectedNorthConnectorType = c));

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
        groupCount: 1000,
        maxSendCount: 10000,
        maxSize: 30
      },
      archive: {
        enabled: false,
        retentionDuration: 0
      }
    };

    service.createNorthConnector(command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/north' });
    expect(testRequest.request.body).toEqual(command);
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
        groupCount: 1000,
        maxSendCount: 10000,
        maxSize: 30
      },
      archive: {
        enabled: false,
        retentionDuration: 0
      }
    };

    service.updateNorthConnector('id1', command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/north/id1' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should delete a North connector', () => {
    let done = false;
    service.deleteNorthConnector('id1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'DELETE', url: '/api/north/id1' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should get North connector subscriptions', () => {
    let expectedNorthConnectorSubscriptions: Array<SubscriptionDTO> | null = null;
    const northConnectorSubscriptions: Array<SubscriptionDTO> = [];

    service.getNorthConnectorSubscriptions('id1').subscribe(c => (expectedNorthConnectorSubscriptions = c));

    http.expectOne({ url: '/api/north/id1/subscriptions', method: 'GET' }).flush(northConnectorSubscriptions);
    expect(expectedNorthConnectorSubscriptions!).toEqual(northConnectorSubscriptions);
  });

  it('should create a North connector subscription', () => {
    let done = false;
    service.createNorthConnectorSubscription('id1', 'southId').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/north/id1/subscriptions/southId' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should delete a North connector subscription', () => {
    let done = false;
    service.deleteNorthConnectorSubscription('id1', 'southId').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'DELETE', url: '/api/north/id1/subscriptions/southId' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });
});
