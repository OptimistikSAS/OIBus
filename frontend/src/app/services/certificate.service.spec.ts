import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { CertificateService } from './certificate.service';
import { CertificateDTO } from '../../../../backend/shared/model/certificate.model';
import testData from '../../../../backend/src/tests/utils/test-data';
import { DownloadService } from './download.service';
import { createMock, MockObject } from '../../test/vitest-create-mock';

describe('CertificateService', () => {
  let http: HttpTestingController;
  let service: CertificateService;
  let downloadService: MockObject<DownloadService>;

  beforeEach(() => {
    downloadService = createMock(DownloadService);
    TestBed.configureTestingModule({
      providers: [provideHttpClientTesting(), { provide: DownloadService, useValue: downloadService }]
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(CertificateService);
  });

  afterEach(() => http.verify());

  test('should find all', () => {
    let expectedCertificates: Array<CertificateDTO> = [];
    service.list().subscribe(certificates => (expectedCertificates = certificates));

    http.expectOne('/api/certificates').flush([{ name: 'Cert 1' }, { name: 'Cert 2' }]);

    expect(expectedCertificates.length).toBe(2);
  });

  test('should get a certificate', () => {
    let expectedCertificate: CertificateDTO | null = null;
    const externalSource = { id: 'id1' } as CertificateDTO;

    service.findById('id1').subscribe(c => (expectedCertificate = c));

    http.expectOne({ url: '/api/certificates/id1', method: 'GET' }).flush(externalSource);
    expect(expectedCertificate!).toEqual(externalSource);
  });

  test('should create a certificate', () => {
    let done = false;
    const command = testData.certificates.command;

    service.create(command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/certificates' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  test('should update a certificate', () => {
    let done = false;
    const command = testData.certificates.command;

    service.update('id1', command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/certificates/id1' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  test('should delete a certificate', () => {
    let done = false;
    service.delete('id1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'DELETE', url: '/api/certificates/id1' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  test('should import a certificate', () => {
    let importedCertificate: CertificateDTO | null = null;
    const certificateFile = new File(['cert'], 'cert.pem');
    const privateKeyFile = new File(['key'], 'key.pem');
    const expectedCertificate = { id: 'id1' } as CertificateDTO;

    service
      .importCertificate(
        { name: 'my cert', description: 'desc', privateKeyPassphrase: null },
        { certificate: certificateFile, privateKey: privateKeyFile, certificateChain: null }
      )
      .subscribe(certificate => (importedCertificate = certificate));

    const testRequest = http.expectOne({ url: '/api/certificates/import', method: 'POST' });
    expect(testRequest.request.body).toBeInstanceOf(FormData);
    const body = testRequest.request.body as FormData;
    expect(body.get('certificate')).toBe(certificateFile);
    expect(body.get('privateKey')).toBe(privateKeyFile);
    expect(body.get('certificateChain')).toBeNull();
    expect(body.get('name')).toBe('my cert');
    expect(body.get('description')).toBe('desc');
    expect(body.get('privateKeyPassphrase')).toBeNull();
    expect(testRequest.request.headers.get('Content-Type')).toBeNull();

    testRequest.flush(expectedCertificate);
    expect(importedCertificate!).toEqual(expectedCertificate);
  });

  test('should import a certificate with a ca chain and passphrase', () => {
    const certificateFile = new File(['cert'], 'cert.pem');
    const privateKeyFile = new File(['key'], 'key.pem');
    const certificateChainFile = new File(['chain'], 'chain.pem');

    service
      .importCertificate(
        { name: 'my cert', description: 'desc', privateKeyPassphrase: 'secret' },
        { certificate: certificateFile, privateKey: privateKeyFile, certificateChain: certificateChainFile }
      )
      .subscribe();

    const testRequest = http.expectOne({ url: '/api/certificates/import', method: 'POST' });
    const body = testRequest.request.body as FormData;
    expect(body.get('certificateChain')).toBe(certificateChainFile);
    expect(body.get('privateKeyPassphrase')).toBe('secret');

    testRequest.flush({ id: 'id1' });
  });

  test('should export a certificate', () => {
    let done = false;
    service.exportCertificate('id1', 'PEM', true, 'cert.pem').subscribe(() => (done = true));

    const testRequest = http.expectOne(
      req => req.url === '/api/certificates/id1/export' && req.params.get('format') === 'PEM' && req.params.get('includeChain') === 'true'
    );
    expect(testRequest.request.method).toBe('GET');
    expect(testRequest.request.responseType).toBe('blob');
    const blob = new Blob(['content']);
    testRequest.flush(blob);

    expect(downloadService.download).toHaveBeenCalledWith(expect.anything(), 'cert.pem');
    expect(done).toBe(true);
  });

  test('should export a private key', () => {
    let done = false;
    service.exportPrivateKey('id1', 'passphrase', 'key.pem').subscribe(() => (done = true));

    const testRequest = http.expectOne({ url: '/api/certificates/id1/export/private-key', method: 'POST' });
    expect(testRequest.request.body).toEqual({ passphrase: 'passphrase' });
    expect(testRequest.request.responseType).toBe('blob');
    const blob = new Blob(['content']);
    testRequest.flush(blob);

    expect(downloadService.download).toHaveBeenCalledWith(expect.anything(), 'key.pem');
    expect(done).toBe(true);
  });
});
