import { HttpErrorResponse } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import {
  ConfigImportEntityValidationError,
  ConfigImportPreviewDTO,
  ConfigImportResponseDTO
} from '@oibus/shared/oia/config-transfer.model';

import testData from '../../test/test-data';
import { createMock, MockObject } from '../../test/vitest-create-mock';
import { SHOULD_IGNORE_ERROR_PREDICATE } from '../shared/error-interceptor.service';
import { ConfigImportFailure, ConfigTransferService } from './config-transfer.service';
import { DownloadService } from './download.service';

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

const auditFields = {
  oIBusCreatedBy: 'userId1',
  oIBusUpdatedBy: 'userId1',
  oIBusCreatedAt: testData.constants.dates.DATE_1,
  oIBusUpdatedAt: testData.constants.dates.DATE_1
};
const registrationCommand = testData.oIAnalytics.registration.command;
const previewResponse: ConfigImportPreviewDTO = {
  fromVersion: '3.9.0',
  toVersion: '3.10.0',
  appliedUpgrades: [{ version: '3.10.0', description: 'an upgrade' }],
  config: {
    engine: {
      ...auditFields,
      oIBusInternalId: 'engine',
      name: 'OIBus',
      softwareVersion: '3.9.0',
      launcherVersion: '3.9.0',
      architecture: 'x64',
      operatingSystem: 'linux',
      dataFolder: 'data-folder',
      binaryFolder: 'binary-folder',
      ignoreIpFilters: false,
      ignoreRemoteUpdate: false,
      settings: testData.engine.command
    },
    registration: {
      ...auditFields,
      oIBusInternalId: 'registration',
      publicKey: 'public key',
      settings: {
        commandRefreshInterval: registrationCommand.commandRefreshInterval,
        commandRetryInterval: registrationCommand.commandRetryInterval,
        messageRetryInterval: registrationCommand.messageRetryInterval,
        commandPermissions: registrationCommand.commandPermissions
      }
    },
    scanModes: [],
    ipFilters: [],
    certificates: [],
    southConnectors: [],
    northConnectors: [],
    users: [],
    transformers: [],
    historyQueries: []
  }
};
const importResponse: ConfigImportResponseDTO = {
  fromVersion: '3.10.0',
  toVersion: '3.10.0',
  appliedUpgrades: [],
  warnings: [],
  newPort: null
};

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

  const configFile = new File(['{}'], 'oibus-config-export.json');

  test.each([
    { filename: 'my-export.json', expected: 'my-export.json' },
    { filename: undefined, expected: 'oibus-config-export.json' }
  ])('should export the configuration (filename: $filename)', async ({ filename, expected }) => {
    const result = firstValueFrom(service.export(filename), { defaultValue: 'no emission' });

    const request = http.expectOne({ url: '/api/config-transfer/export', method: 'GET' });
    expect(request.request.responseType).toBe('blob');
    expectBadRequestAndNotFoundIgnored(request);
    const blob = new Blob(['content']);
    request.flush(blob);

    await expect(result).resolves.toBeUndefined();
    expect(downloadService.download).toHaveBeenCalledWith(expect.objectContaining({ body: blob }), expected);
  });

  test('should surface the backend message when exporting fails with a blob error body', async () => {
    const result = firstValueFrom(service.export());

    http
      .expectOne({ url: '/api/config-transfer/export', method: 'GET' })
      .flush(new Blob([JSON.stringify({ message: 'boom' })]), { status: 400, statusText: 'Bad Request' });

    await expect(result).rejects.toBe('boom');
    expect(downloadService.download).not.toHaveBeenCalled();
  });

  test('should import a configuration', async () => {
    const result = firstValueFrom(service.import(configFile));

    const request = http.expectOne({ url: '/api/config-transfer/import', method: 'POST' });
    expect(formDataOf(request).get('file')).toBe(configFile);
    expect(request.request.headers.get('Content-Type')).toBeNull();
    expectBadRequestAndNotFoundIgnored(request);
    request.flush(importResponse);

    await expect(result).resolves.toEqual(importResponse);
  });

  test('should surface the backend message when importing fails', async () => {
    const result = firstValueFrom(service.import(configFile));

    http
      .expectOne({ url: '/api/config-transfer/import', method: 'POST' })
      .flush({ message: 'boom' }, { status: 400, statusText: 'Bad Request' });

    const error = await result.catch((err: unknown) => err);
    expect(error).toBeInstanceOf(ConfigImportFailure);
    expect(error).toMatchObject({ message: 'boom', validationErrors: [] });
  });

  test('should fall back to the HTTP error description when the import error has no message', async () => {
    const result = firstValueFrom(service.import(configFile));

    http.expectOne({ url: '/api/config-transfer/import', method: 'POST' }).flush(null, { status: 500, statusText: 'Server Error' });

    const error = await result.catch((err: unknown) => err);
    expect(error).toBeInstanceOf(ConfigImportFailure);
    expect(error).toMatchObject({
      message: '500 - Http failure response for /api/config-transfer/import: 500 Server Error',
      validationErrors: []
    });
  });

  test('should surface per-entity validation errors when importing fails validation', async () => {
    const validationErrors: Array<ConfigImportEntityValidationError> = [
      { scope: 'south:sqlite:item', entityId: 'SC1', entityName: 'All logs', message: 'must be a string' }
    ];
    const result = firstValueFrom(service.import(configFile));

    http
      .expectOne({ url: '/api/config-transfer/import', method: 'POST' })
      .flush(
        { message: 'Imported configuration failed validation after applying settings upgrades; nothing was imported', validationErrors },
        { status: 400, statusText: 'Bad Request' }
      );

    const error = await result.catch((err: unknown) => err);
    expect(error).toBeInstanceOf(ConfigImportFailure);
    expect(error).toMatchObject({
      message: 'Imported configuration failed validation after applying settings upgrades; nothing was imported',
      validationErrors
    });
  });

  test('should preview a configuration file', async () => {
    const result = firstValueFrom(service.preview(configFile));

    const request = http.expectOne({ url: '/api/config-transfer/preview', method: 'POST' });
    expect(formDataOf(request).get('file')).toBe(configFile);
    expectBadRequestAndNotFoundIgnored(request);
    request.flush(previewResponse);

    await expect(result).resolves.toEqual(previewResponse);
  });

  test('should surface per-entity validation errors when previewing fails validation', async () => {
    const validationErrors: Array<ConfigImportEntityValidationError> = [
      { scope: 'scanMode', entityName: 'every second', message: 'bad cron' }
    ];
    const result = firstValueFrom(service.preview(configFile));

    http
      .expectOne({ url: '/api/config-transfer/preview', method: 'POST' })
      .flush(
        { message: 'Imported configuration failed validation; nothing was imported', validationErrors },
        { status: 400, statusText: 'Bad Request' }
      );

    const error = await result.catch((err: unknown) => err);
    expect(error).toBeInstanceOf(ConfigImportFailure);
    expect(error).toMatchObject({ message: 'Imported configuration failed validation; nothing was imported', validationErrors });
  });
});
