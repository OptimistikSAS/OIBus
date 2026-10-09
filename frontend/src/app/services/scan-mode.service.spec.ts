import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { firstValueFrom, Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { ValidatedCronExpression } from '@oibus/shared/api/scan-mode.model';

import { expectHttp } from '../../test/http-testing';
import testData from '../../test/test-data';
import { ScanModeService } from './scan-mode.service';

interface HttpCase {
  name: string;
  call: (service: ScanModeService) => Observable<unknown>;
  method: string;
  url: string;
  body: unknown;
  response: unknown;
}

describe('ScanModeService', () => {
  let http: HttpTestingController;
  let service: ScanModeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(ScanModeService);
  });

  afterEach(() => http.verify());

  const command = testData.scanMode.command;
  const scanMode = testData.scanMode.list[0];
  const validatedCronExpression: ValidatedCronExpression = {
    isValid: true,
    errorMessage: '',
    nextExecutions: ['2020-03-15T00:00:00.000Z'],
    humanReadableForm: 'Every second'
  };

  test.each<HttpCase>([
    {
      name: 'list the scan modes',
      call: s => s.list(),
      method: 'GET',
      url: '/api/scan-modes',
      body: null,
      response: testData.scanMode.list
    },
    { name: 'get a scan mode', call: s => s.findById('id1'), method: 'GET', url: '/api/scan-modes/id1', body: null, response: scanMode },
    { name: 'create a scan mode', call: s => s.create(command), method: 'POST', url: '/api/scan-modes', body: command, response: scanMode },
    {
      name: 'update a scan mode',
      call: s => s.update('id1', command),
      method: 'PUT',
      url: '/api/scan-modes/id1',
      body: command,
      response: null
    },
    { name: 'delete a scan mode', call: s => s.delete('id1'), method: 'DELETE', url: '/api/scan-modes/id1', body: null, response: null },
    {
      name: 'verify a cron expression',
      call: s => s.verifyCron('* * * * * *'),
      method: 'POST',
      url: '/api/scan-modes/verify',
      body: { cron: '* * * * * *' },
      response: validatedCronExpression
    }
  ])('should $name', async ({ call, method, url, body, response }) => {
    const result = await expectHttp(http, call(service), { method, url }, { body, response });

    expect(result).toEqual(response);
  });

  test('should share the scan mode list between subscribers', async () => {
    const list = await expectHttp(http, service.list(), { method: 'GET', url: '/api/scan-modes' }, { response: testData.scanMode.list });

    // no new request: http.verify() fails if one is made
    await expect(firstValueFrom(service.list())).resolves.toEqual(list);
  });

  test.each<Omit<HttpCase, 'body' | 'response'>>([
    { name: 'create', call: s => s.create(command), method: 'POST', url: '/api/scan-modes' },
    { name: 'update', call: s => s.update('id1', command), method: 'PUT', url: '/api/scan-modes/id1' },
    { name: 'delete', call: s => s.delete('id1'), method: 'DELETE', url: '/api/scan-modes/id1' }
  ])('should reload the scan mode list after a $name', async ({ call, method, url }) => {
    await expectHttp(http, service.list(), { method: 'GET', url: '/api/scan-modes' }, { response: testData.scanMode.list });

    await expectHttp(http, call(service), { method, url });

    const reloadedList = [scanMode];
    http.expectOne({ method: 'GET', url: '/api/scan-modes' }).flush(reloadedList);
    await expect(firstValueFrom(service.list())).resolves.toEqual(reloadedList);
  });
});
