import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { ConfigTransferService } from './config-transfer.service';
import { ConfigImportResponseDTO } from '../../../../backend/shared/model/config-transfer.model';
import { DownloadService } from './download.service';
import { createMock, MockObject } from '../../test/vitest-create-mock';

describe('ConfigTransferService', () => {
  let http: HttpTestingController;
  let service: ConfigTransferService;
  let downloadService: MockObject<DownloadService>;

  beforeEach(() => {
    downloadService = createMock(DownloadService);
    TestBed.configureTestingModule({
      providers: [provideHttpClientTesting(), { provide: DownloadService, useValue: downloadService }]
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(ConfigTransferService);
  });

  afterEach(() => http.verify());

  test('should export the configuration', () => {
    let done = false;
    service.export('oibus-config-export.json').subscribe(() => (done = true));

    const testRequest = http.expectOne({ url: '/api/config-transfer/export', method: 'GET' });
    expect(testRequest.request.responseType).toBe('blob');
    const blob = new Blob(['content']);
    testRequest.flush(blob);

    expect(downloadService.download).toHaveBeenCalledWith(expect.anything(), 'oibus-config-export.json');
    expect(done).toBe(true);
  });

  test('should export the configuration with the default filename', () => {
    service.export().subscribe();

    const testRequest = http.expectOne({ url: '/api/config-transfer/export', method: 'GET' });
    const blob = new Blob(['content']);
    testRequest.flush(blob);

    expect(downloadService.download).toHaveBeenCalledWith(expect.anything(), 'oibus-config-export.json');
  });

  test('should surface the backend message when exporting fails with a blob error body', async () => {
    let receivedMessage: string | null = null;

    service.export('oibus-config-export.json').subscribe({ error: message => (receivedMessage = message) });

    const testRequest = http.expectOne({ url: '/api/config-transfer/export', method: 'GET' });
    const blob = new Blob([JSON.stringify({ message: 'boom' })]);
    testRequest.flush(blob, { status: 400, statusText: 'Bad Request' });

    await vi.waitFor(() => expect(receivedMessage).toBe('boom'));
  });

  test('should import a configuration', () => {
    let importResponse: ConfigImportResponseDTO | null = null;
    const configFile = new File(['{}'], 'oibus-config-export.json');
    const expectedResponse: ConfigImportResponseDTO = { appliedUpgrades: [], warnings: [] };

    service.import(configFile).subscribe(response => (importResponse = response));

    const testRequest = http.expectOne({ url: '/api/config-transfer/import', method: 'POST' });
    expect(testRequest.request.body).toBeInstanceOf(FormData);
    const body = testRequest.request.body as FormData;
    expect(body.get('file')).toBe(configFile);
    expect(testRequest.request.headers.get('Content-Type')).toBeNull();

    testRequest.flush(expectedResponse);
    expect(importResponse!).toEqual(expectedResponse);
  });

  test('should surface the backend message when importing fails', () => {
    let receivedMessage: string | null = null;
    const configFile = new File(['{}'], 'oibus-config-export.json');

    service.import(configFile).subscribe({ error: message => (receivedMessage = message) });

    const testRequest = http.expectOne({ url: '/api/config-transfer/import', method: 'POST' });
    testRequest.flush({ message: 'boom' }, { status: 400, statusText: 'Bad Request' });

    expect(receivedMessage!).toBe('boom');
  });
});
