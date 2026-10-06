import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { ConfigImportFailure, ConfigTransferService } from './config-transfer.service';
import { ConfigImportEntityValidationError, ConfigImportPreviewDTO, ConfigImportResponseDTO } from '@oibus/shared/config-transfer.model';
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
    const expectedResponse: ConfigImportResponseDTO = {
      fromVersion: '3.10.0',
      toVersion: '3.10.0',
      appliedUpgrades: [],
      warnings: [],
      newPort: null
    };

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
    let receivedError: ConfigImportFailure | null = null;
    const configFile = new File(['{}'], 'oibus-config-export.json');

    service.import(configFile).subscribe({ error: (err: ConfigImportFailure) => (receivedError = err) });

    const testRequest = http.expectOne({ url: '/api/config-transfer/import', method: 'POST' });
    testRequest.flush({ message: 'boom' }, { status: 400, statusText: 'Bad Request' });

    expect(receivedError!).toBeInstanceOf(ConfigImportFailure);
    expect(receivedError!.message).toBe('boom');
    expect(receivedError!.validationErrors).toEqual([]);
  });

  test('should surface per-entity validation errors when importing fails validation', () => {
    let receivedError: ConfigImportFailure | null = null;
    const configFile = new File(['{}'], 'oibus-config-export.json');
    const validationErrors: Array<ConfigImportEntityValidationError> = [
      { scope: 'south:sqlite:item', entityId: 'SC1', entityName: 'All logs', message: 'must be a string' }
    ];

    service.import(configFile).subscribe({ error: (err: ConfigImportFailure) => (receivedError = err) });

    const testRequest = http.expectOne({ url: '/api/config-transfer/import', method: 'POST' });
    testRequest.flush(
      { message: 'Imported configuration failed validation after applying settings upgrades; nothing was imported', validationErrors },
      { status: 400, statusText: 'Bad Request' }
    );

    expect(receivedError!).toBeInstanceOf(ConfigImportFailure);
    expect(receivedError!.validationErrors).toEqual(validationErrors);
  });

  test('should preview a configuration file', () => {
    let previewResponse: ConfigImportPreviewDTO | null = null;
    const configFile = new File(['{}'], 'oibus-config-export.json');
    const expectedResponse = {
      fromVersion: '3.9.0',
      toVersion: '3.10.0',
      appliedUpgrades: [{ version: '3.10.0', description: 'an upgrade' }],
      config: {}
    } as ConfigImportPreviewDTO;

    service.preview(configFile).subscribe(response => (previewResponse = response));

    const testRequest = http.expectOne({ url: '/api/config-transfer/preview', method: 'POST' });
    expect((testRequest.request.body as FormData).get('file')).toBe(configFile);
    testRequest.flush(expectedResponse);
    expect(previewResponse!).toEqual(expectedResponse);
  });

  test('should surface per-entity validation errors when previewing fails validation', () => {
    let receivedError: ConfigImportFailure | null = null;
    const validationErrors: Array<ConfigImportEntityValidationError> = [
      { scope: 'scanMode', entityName: 'every second', message: 'bad cron' }
    ];

    service.preview(new File(['{}'], 'oibus-config-export.json')).subscribe({ error: (err: ConfigImportFailure) => (receivedError = err) });

    const testRequest = http.expectOne({ url: '/api/config-transfer/preview', method: 'POST' });
    testRequest.flush(
      { message: 'Imported configuration failed validation; nothing was imported', validationErrors },
      { status: 400, statusText: 'Bad Request' }
    );

    expect(receivedError!).toBeInstanceOf(ConfigImportFailure);
    expect(receivedError!.message).toBe('Imported configuration failed validation; nothing was imported');
    expect(receivedError!.validationErrors).toEqual(validationErrors);
  });
});
