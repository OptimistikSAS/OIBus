import { HttpErrorResponse } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { firstValueFrom, Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { expectHttp } from '../../test/http-testing';
import testData from '../../test/test-data';
import { createMock, MockObject } from '../../test/vitest-create-mock';
import { SHOULD_IGNORE_ERROR_PREDICATE } from '../shared/error-interceptor.service';
import { CertificateService } from './certificate.service';
import { DownloadService } from './download.service';

interface HttpCase {
  name: string;
  call: (service: CertificateService) => Observable<unknown>;
  method: string;
  url: string;
  body: unknown;
  response: unknown;
}

function formDataOf(request: TestRequest): FormData {
  const body: unknown = request.request.body;
  if (!(body instanceof FormData)) {
    throw new Error('Expected a FormData body');
  }
  return body;
}

/** The caller displays the server message itself, so the global error interceptor must skip 400 and 404 errors */
function expectBadRequestAndNotFoundIgnored(request: TestRequest) {
  const shouldIgnore = request.request.context.get(SHOULD_IGNORE_ERROR_PREDICATE);
  expect(shouldIgnore(new HttpErrorResponse({ status: 400 }))).toBe(true);
  expect(shouldIgnore(new HttpErrorResponse({ status: 404 }))).toBe(true);
  expect(shouldIgnore(new HttpErrorResponse({ status: 500 }))).toBe(false);
}

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

  const command = testData.certificates.command;
  const certificate = testData.certificates.list[0];
  const certificateFile = new File(['cert'], 'cert.pem');
  const privateKeyFile = new File(['key'], 'key.pem');

  test.each<HttpCase>([
    {
      name: 'list the certificates',
      call: s => s.list(),
      method: 'GET',
      url: '/api/certificates',
      body: null,
      response: testData.certificates.list
    },
    {
      name: 'get a certificate',
      call: s => s.findById('id1'),
      method: 'GET',
      url: '/api/certificates/id1',
      body: null,
      response: certificate
    },
    {
      name: 'create a certificate',
      call: s => s.create(command),
      method: 'POST',
      url: '/api/certificates',
      body: command,
      response: certificate
    },
    {
      name: 'update a certificate',
      call: s => s.update('id1', command),
      method: 'PUT',
      url: '/api/certificates/id1',
      body: command,
      response: null
    },
    { name: 'delete a certificate', call: s => s.delete('id1'), method: 'DELETE', url: '/api/certificates/id1', body: null, response: null }
  ])('should $name', async ({ call, method, url, body, response }) => {
    const result = await expectHttp(http, call(service), { method, url }, { body, response });

    expect(result).toEqual(response);
  });

  test('should share the certificate list between subscribers', async () => {
    const list = await expectHttp(
      http,
      service.list(),
      { method: 'GET', url: '/api/certificates' },
      { response: testData.certificates.list }
    );

    // no new request: http.verify() fails if one is made
    await expect(firstValueFrom(service.list())).resolves.toEqual(list);
  });

  test.each<Omit<HttpCase, 'body' | 'response'>>([
    { name: 'create', call: s => s.create(command), method: 'POST', url: '/api/certificates' },
    { name: 'update', call: s => s.update('id1', command), method: 'PUT', url: '/api/certificates/id1' },
    { name: 'delete', call: s => s.delete('id1'), method: 'DELETE', url: '/api/certificates/id1' },
    {
      name: 'import',
      call: s =>
        s.importCertificate(
          { name: 'my cert', description: 'desc', privateKeyPassphrase: null },
          { certificate: certificateFile, privateKey: privateKeyFile, certificateChain: null }
        ),
      method: 'POST',
      url: '/api/certificates/import'
    }
  ])('should reload the certificate list after a $name', async ({ call, method, url }) => {
    await expectHttp(http, service.list(), { method: 'GET', url: '/api/certificates' }, { response: testData.certificates.list });

    await expectHttp(http, call(service), { method, url }, { response: certificate });

    const reloadedList = [certificate];
    http.expectOne({ method: 'GET', url: '/api/certificates' }).flush(reloadedList);
    await expect(firstValueFrom(service.list())).resolves.toEqual(reloadedList);
  });

  test('should import a certificate', async () => {
    const result = firstValueFrom(
      service.importCertificate(
        { name: 'my cert', description: 'desc', privateKeyPassphrase: null },
        { certificate: certificateFile, privateKey: privateKeyFile, certificateChain: null }
      )
    );

    const request = http.expectOne({ url: '/api/certificates/import', method: 'POST' });
    const body = formDataOf(request);
    expect(body.get('certificate')).toBe(certificateFile);
    expect(body.get('privateKey')).toBe(privateKeyFile);
    expect(body.get('certificateChain')).toBeNull();
    expect(body.get('name')).toBe('my cert');
    expect(body.get('description')).toBe('desc');
    expect(body.get('privateKeyPassphrase')).toBeNull();
    expect(request.request.headers.get('Content-Type')).toBeNull();
    expectBadRequestAndNotFoundIgnored(request);
    request.flush(certificate);

    await expect(result).resolves.toEqual(certificate);
  });

  test('should import a certificate with a ca chain and passphrase', async () => {
    const certificateChainFile = new File(['chain'], 'chain.pem');

    const result = firstValueFrom(
      service.importCertificate(
        { name: 'my cert', description: 'desc', privateKeyPassphrase: 'secret' },
        { certificate: certificateFile, privateKey: privateKeyFile, certificateChain: certificateChainFile }
      )
    );

    const request = http.expectOne({ url: '/api/certificates/import', method: 'POST' });
    const body = formDataOf(request);
    expect(body.get('certificateChain')).toBe(certificateChainFile);
    expect(body.get('privateKeyPassphrase')).toBe('secret');
    request.flush(certificate);

    await expect(result).resolves.toEqual(certificate);
  });

  test('should surface the backend message when importing a certificate fails', async () => {
    const result = firstValueFrom(
      service.importCertificate(
        { name: 'my cert', description: 'desc', privateKeyPassphrase: null },
        { certificate: certificateFile, privateKey: privateKeyFile, certificateChain: null }
      )
    );

    http
      .expectOne({ url: '/api/certificates/import', method: 'POST' })
      .flush({ message: 'boom' }, { status: 400, statusText: 'Bad Request' });

    await expect(result).rejects.toBe('boom');
  });

  test('should export a certificate', async () => {
    const result = firstValueFrom(service.exportCertificate('id1', 'PEM', true, 'cert.pem'), { defaultValue: 'no emission' });

    const request = http.expectOne({ url: '/api/certificates/id1/export?format=PEM&includeChain=true', method: 'GET' });
    expect(request.request.responseType).toBe('blob');
    expectBadRequestAndNotFoundIgnored(request);
    const blob = new Blob(['content']);
    request.flush(blob);

    await expect(result).resolves.toBeUndefined();
    expect(downloadService.download).toHaveBeenCalledWith(expect.objectContaining({ body: blob }), 'cert.pem');
  });

  test('should surface the backend message when exporting a certificate fails with a blob error body', async () => {
    const result = firstValueFrom(service.exportCertificate('id1', 'PEM', false, 'cert.pem'));

    http
      .expectOne({ url: '/api/certificates/id1/export?format=PEM&includeChain=false', method: 'GET' })
      .flush(new Blob([JSON.stringify({ message: 'boom' })]), { status: 400, statusText: 'Bad Request' });

    await expect(result).rejects.toBe('boom');
    expect(downloadService.download).not.toHaveBeenCalled();
  });

  test('should export a private key', async () => {
    const result = firstValueFrom(service.exportPrivateKey('id1', 'passphrase', 'key.pem'), { defaultValue: 'no emission' });

    const request = http.expectOne({ url: '/api/certificates/id1/export/private-key', method: 'POST' });
    expect(request.request.body).toEqual({ passphrase: 'passphrase' });
    expect(request.request.responseType).toBe('blob');
    expectBadRequestAndNotFoundIgnored(request);
    const blob = new Blob(['content']);
    request.flush(blob);

    await expect(result).resolves.toBeUndefined();
    expect(downloadService.download).toHaveBeenCalledWith(expect.objectContaining({ body: blob }), 'key.pem');
  });

  test('should surface the backend message when exporting a private key fails', async () => {
    const result = firstValueFrom(service.exportPrivateKey('id1', 'passphrase', 'key.pem'));

    http
      .expectOne({ url: '/api/certificates/id1/export/private-key', method: 'POST' })
      .flush(new Blob([JSON.stringify({ message: 'wrong passphrase' })]), { status: 400, statusText: 'Bad Request' });

    await expect(result).rejects.toBe('wrong passphrase');
  });
});
