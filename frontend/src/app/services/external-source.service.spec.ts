import { TestBed } from '@angular/core/testing';

import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ExternalSourceService } from './external-source.service';
import { ExternalSourceCommandDTO, ExternalSourceDTO } from '../model/external-sources.model';

describe('ExternalSourceService', () => {
  let http: HttpTestingController;
  let service: ExternalSourceService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ExternalSourceService]
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(ExternalSourceService);
  });

  afterEach(() => http.verify());

  it('should get all external sources', () => {
    let expectedExternalSources: Array<ExternalSourceDTO> = [];
    service.getExternalSources().subscribe(externalSources => (expectedExternalSources = externalSources));

    http.expectOne('/api/external-sources').flush([{ name: 'Proxy 1' }, { name: 'Proxy 2' }]);

    expect(expectedExternalSources.length).toBe(2);
  });

  it('should get an external source', () => {
    let expectedExternalSource: ExternalSourceDTO | null = null;
    const externalSource = { id: 'id1' } as ExternalSourceDTO;

    service.getExternalSource('id1').subscribe(c => (expectedExternalSource = c));

    http.expectOne({ url: '/api/external-sources/id1', method: 'GET' }).flush(externalSource);
    expect(expectedExternalSource!).toEqual(externalSource);
  });

  it('should create an external source', () => {
    let done = false;
    const command: ExternalSourceCommandDTO = {
      reference: 'OIBus:OIA',
      description: 'a test external source'
    };

    service.createExternalSource(command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/external-sources' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should update an external source', () => {
    let done = false;
    const command: ExternalSourceCommandDTO = {
      reference: 'OIBus:OIA',
      description: 'a test external source'
    };

    service.updateExternalSource('id1', command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/external-sources/id1' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should delete an external source', () => {
    let done = false;
    service.deleteExternalSource('id1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'DELETE', url: '/api/external-sources/id1' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });
});
