import { TestBed } from '@angular/core/testing';

import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CertificateService } from './certificate.service';
import { CertificateCommandDTO, CertificateDTO } from '../../../../backend/shared/model/certificate.model';
import { provideHttpClient } from '@angular/common/http';

describe('CertificateService', () => {
  let http: HttpTestingController;
  let service: CertificateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(CertificateService);
  });

  afterEach(() => http.verify());

  it('should find all', () => {
    let expectedCertificates: Array<CertificateDTO> = [];
    service.list().subscribe(certificates => (expectedCertificates = certificates));

    http.expectOne('/api/certificates').flush([{ name: 'Cert 1' }, { name: 'Cert 2' }]);

    expect(expectedCertificates.length).toBe(2);
  });

  it('should get an certificate', () => {
    let expectedCertificate: CertificateDTO | null = null;
    const externalSource = { id: 'id1' } as CertificateDTO;

    service.findById('id1').subscribe(c => (expectedCertificate = c));

    http.expectOne({ url: '/api/certificates/id1', method: 'GET' }).flush(externalSource);
    expect(expectedCertificate!).toEqual(externalSource);
  });

  it('should create an certificate', () => {
    let done = false;
    const command: CertificateCommandDTO = {
      name: 'Cert1',
      description: 'a test certificate'
    } as CertificateCommandDTO;

    service.create(command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/certificates' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should update an certificate', () => {
    let done = false;
    const command: CertificateCommandDTO = {
      name: 'cert',
      description: 'a test certificate'
    } as CertificateCommandDTO;

    service.update('id1', command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/certificates/id1' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should delete an certificate', () => {
    let done = false;
    service.delete('id1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'DELETE', url: '/api/certificates/id1' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });
});
