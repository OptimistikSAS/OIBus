import { HttpErrorResponse } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { firstValueFrom, Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { EngineSettingsDTO, HomeMetrics } from '@oibus/shared/api/engine.model';

import { expectHttp } from '../../test/http-testing';
import testData from '../../test/test-data';
import { SHOULD_IGNORE_ERROR_PREDICATE } from '../shared/error-interceptor.service';
import { EngineService } from './engine.service';

interface HttpCase {
  name: string;
  call: (service: EngineService) => Observable<unknown>;
  method: string;
  url: string;
  body: unknown;
  response: unknown;
}

/** Background requests must not notify every failure, only an expired session */
function expectErrorsIgnoredUnlessUnauthorized(request: TestRequest) {
  const shouldIgnore = request.request.context.get(SHOULD_IGNORE_ERROR_PREDICATE);
  expect(shouldIgnore(new HttpErrorResponse({ status: 500 }))).toBe(true);
  expect(shouldIgnore(new HttpErrorResponse({ status: 0 }))).toBe(true);
  expect(shouldIgnore(new HttpErrorResponse({ status: 401 }))).toBe(false);
}

const engineCommand = testData.engine.command;
const engineSettings: EngineSettingsDTO = {
  id: 'engineId1',
  createdBy: { id: 'userId1', friendlyName: 'User 1' },
  updatedBy: { id: 'userId1', friendlyName: 'User 1' },
  createdAt: testData.constants.dates.DATE_1,
  updatedAt: testData.constants.dates.DATE_2,
  version: '3.4.9',
  launcherVersion: '3.4.9',
  auditRetentionDuration: null,
  general: engineCommand.general,
  webServer: engineCommand.webServer,
  proxyServer: {
    enabled: true,
    port: 9000,
    forward: { enabled: false, url: null, username: null, password: null },
    username: null,
    password: null
  },
  logger: {
    console: { level: 'silent' },
    file: { level: 'info', maxFileSize: 50, numberOfFiles: 5 },
    database: { level: 'info', maxNumberOfLogs: 100000 },
    loki: { level: 'silent', interval: 60, address: '', username: '', password: '' },
    oia: { level: 'silent', interval: 10 },
    syslog: { level: 'silent', host: '', port: 514, protocol: 'udp4' }
  }
};
const homeMetrics: HomeMetrics = {
  norths: { northId1: testData.north.metrics },
  engine: testData.engine.metrics,
  souths: { southId1: testData.south.metrics }
};

describe('EngineService', () => {
  let http: HttpTestingController;
  let service: EngineService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(EngineService);
  });

  afterEach(() => http.verify());

  const registrationCommand = testData.oIAnalytics.registration.command;

  test.each<HttpCase>([
    {
      name: 'get the engine settings',
      call: s => s.getEngineSettings(),
      method: 'GET',
      url: '/api/engine',
      body: null,
      response: engineSettings
    },
    {
      name: 'update the engine settings',
      call: s => s.updateEngineSettings(engineCommand),
      method: 'PUT',
      url: '/api/engine',
      body: engineCommand,
      response: { needsRedirect: false, newPort: null }
    },
    {
      name: 'update the engine name',
      call: s => s.updateEngineName(testData.engine.nameCommand),
      method: 'PUT',
      url: '/api/engine/name',
      body: testData.engine.nameCommand,
      response: null
    },
    {
      name: 'update the engine web server settings and return the redirect info',
      call: s => s.updateEngineWebServer(testData.engine.webServerCommand),
      method: 'PUT',
      url: '/api/engine/web-server',
      body: testData.engine.webServerCommand,
      response: { needsRedirect: true, newPort: 3333 }
    },
    {
      name: 'update the engine proxy settings',
      call: s => s.updateEngineProxy(testData.engine.proxyCommand),
      method: 'PUT',
      url: '/api/engine/proxy',
      body: testData.engine.proxyCommand,
      response: null
    },
    {
      name: 'update the engine logger settings',
      call: s => s.updateEngineLogger(testData.engine.loggerCommand),
      method: 'PUT',
      url: '/api/engine/logger',
      body: testData.engine.loggerCommand,
      response: null
    },
    {
      name: 'reset the engine metrics',
      call: s => s.resetEngineMetrics(),
      method: 'POST',
      url: '/api/engine/metrics/reset',
      body: null,
      response: null
    },
    { name: 'restart the engine', call: s => s.restart(), method: 'POST', url: '/api/engine/restart', body: null, response: null },
    {
      name: 'dump the memory',
      call: s => s.dumpMemory(),
      method: 'POST',
      url: '/api/engine/memory-dump',
      body: null,
      response: { filename: 'oibus-memory-dump.heapsnapshot' }
    },
    {
      name: 'fetch the info',
      call: s => s.fetchInfo(),
      method: 'GET',
      url: '/api/engine/info',
      body: null,
      response: testData.engine.oIBusInfo
    },
    {
      name: 'get the registration settings',
      call: s => s.getRegistrationSettings(),
      method: 'GET',
      url: '/api/oianalytics/registration',
      body: null,
      response: testData.oIAnalytics.registration.completed
    },
    {
      name: 'register',
      call: s => s.register(registrationCommand),
      method: 'POST',
      url: '/api/oianalytics/register',
      body: registrationCommand,
      response: null
    },
    {
      name: 'edit the registration settings',
      call: s => s.editRegistrationSettings(registrationCommand),
      method: 'PUT',
      url: '/api/oianalytics/registration',
      body: registrationCommand,
      response: null
    },
    {
      name: 'test the OIAnalytics connection',
      call: s => s.testOIAnalyticsConnection(registrationCommand),
      method: 'POST',
      url: '/api/oianalytics/registration/test-connection',
      body: registrationCommand,
      response: null
    },
    { name: 'unregister', call: s => s.unregister(), method: 'POST', url: '/api/oianalytics/unregister', body: null, response: null }
  ])('should $name', async ({ call, method, url, body, response }) => {
    const result = await expectHttp(http, call(service), { method, url }, { body, response });

    expect(result).toEqual(response);
  });

  test('should get the info once and share it between subscribers', async () => {
    const info = await expectHttp(
      http,
      service.getInfo(),
      { method: 'GET', url: '/api/engine/info' },
      { response: testData.engine.oIBusInfo }
    );
    expect(info).toEqual(testData.engine.oIBusInfo);

    // no new request: http.verify() fails if one is made
    await expect(firstValueFrom(service.getInfo())).resolves.toEqual(testData.engine.oIBusInfo);
  });

  test('should fetch fresh info each time', async () => {
    await expectHttp(http, service.fetchInfo(), { method: 'GET', url: '/api/engine/info' }, { response: testData.engine.oIBusInfo });
    await expectHttp(http, service.fetchInfo(), { method: 'GET', url: '/api/engine/info' }, { response: testData.engine.oIBusInfo });
  });

  test.each<Omit<HttpCase, 'method' | 'body'>>([
    { name: 'engine metrics', call: s => s.getEngineMetrics(), url: '/api/engine/metrics', response: testData.engine.metrics },
    { name: 'home metrics', call: s => s.getHomeMetrics(), url: '/api/engine/home-metrics', response: homeMetrics }
  ])('should get the $name and only notify an expired session', async ({ call, url, response }) => {
    const result = firstValueFrom(call(service));

    const request = http.expectOne({ method: 'GET', url });
    expectErrorsIgnoredUnlessUnauthorized(request);
    request.flush(response as object);

    await expect(result).resolves.toEqual(response);
  });
});
