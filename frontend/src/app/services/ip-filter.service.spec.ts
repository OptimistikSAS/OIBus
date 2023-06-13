import { TestBed } from '@angular/core/testing';

import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { IpFilterService } from './ip-filter.service';
import { IpFilterCommandDTO, IpFilterDTO } from '../../../../shared/model/ip-filter.model';
import { provideHttpClient } from '@angular/common/http';

describe('IpFilterService', () => {
  let http: HttpTestingController;
  let service: IpFilterService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(IpFilterService);
  });

  afterEach(() => http.verify());

  it('should get all IP filters', () => {
    let expectedIpFilters: Array<IpFilterDTO> = [];
    service.list().subscribe(ipFilters => (expectedIpFilters = ipFilters));

    http.expectOne('/api/ip-filters').flush([{ name: 'IP filter 1' }, { name: 'IP filter 2' }]);

    expect(expectedIpFilters.length).toBe(2);
  });

  it('should get an IP filter', () => {
    let expectedIpFilter: IpFilterDTO | null = null;
    const ipFilter = { id: 'id1' } as IpFilterDTO;

    service.get('id1').subscribe(c => (expectedIpFilter = c));

    http.expectOne({ url: '/api/ip-filters/id1', method: 'GET' }).flush(ipFilter);
    expect(expectedIpFilter!).toEqual(ipFilter);
  });

  it('should create an IP filter', () => {
    let done = false;
    const command: IpFilterCommandDTO = {
      address: '127.0.0.1',
      description: 'a test ip filter'
    };

    service.create(command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/ip-filters' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should update an IP filter', () => {
    let done = false;
    const command: IpFilterCommandDTO = {
      address: '127.0.0.1',
      description: 'a test ip filter'
    };

    service.update('id1', command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/ip-filters/id1' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should delete an IP filter', () => {
    let done = false;
    service.delete('id1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'DELETE', url: '/api/ip-filters/id1' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });
});
