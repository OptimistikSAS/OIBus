import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EngineService } from './engine.service';
import {
  EngineLoggerCommandDTO,
  EngineNameCommandDTO,
  EngineProxyCommandDTO,
  EngineSettingsDTO,
  EngineWebServerCommandDTO,
  OIBusInfo
} from '../../../../backend/shared/model/engine.model';
import testData from '../../../../backend/src/tests/utils/test-data';

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

  test('should get engine settings', () => {
    let expectedSettings: EngineSettingsDTO | null = null;
    const engine = { id: 'id1' } as EngineSettingsDTO;

    service.getEngineSettings().subscribe(c => (expectedSettings = c));

    http.expectOne({ url: '/api/engine', method: 'GET' }).flush(engine);
    expect(expectedSettings!).toEqual(engine);
  });

  test('should update engine settings', () => {
    let done = false;
    const command = testData.engine.command;

    service.updateEngineSettings(command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/engine' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  test('should update engine name', () => {
    let done = false;
    const command: EngineNameCommandDTO = testData.engine.nameCommand;

    service.updateEngineName(command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/engine/name' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  test('should update engine web server settings', () => {
    let done = false;
    const command: EngineWebServerCommandDTO = testData.engine.webServerCommand;

    service.updateEngineWebServer(command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/engine/web-server' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush({ needsRedirect: false, newPort: null });
    expect(done).toBe(true);
  });

  test('should return redirect info when port changes', () => {
    let result: { needsRedirect: boolean; newPort: number | null } | null = null;
    const command: EngineWebServerCommandDTO = testData.engine.webServerCommand;

    service.updateEngineWebServer(command).subscribe(r => (result = r));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/engine/web-server' });
    testRequest.flush({ needsRedirect: true, newPort: 3333 });
    expect(result).toEqual({ needsRedirect: true, newPort: 3333 });
  });

  test('should update engine proxy settings', () => {
    let done = false;
    const command: EngineProxyCommandDTO = testData.engine.proxyCommand;

    service.updateEngineProxy(command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/engine/proxy' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  test('should update engine logger settings', () => {
    let done = false;
    const command: EngineLoggerCommandDTO = testData.engine.loggerCommand;

    service.updateEngineLogger(command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/engine/logger' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  test('should get info', () => {
    let expectedInfo: OIBusInfo | null = null;
    const engineInfo = testData.engine.oIBusInfo;

    service.getInfo().subscribe(c => (expectedInfo = c));

    http.expectOne({ url: '/api/engine/info', method: 'GET' }).flush(engineInfo);
    expect(expectedInfo!).toEqual(engineInfo);
  });

  test('should restart', () => {
    let done = false;

    service.restart().subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/engine/restart' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  test('should reset metrics', () => {
    let done = false;

    service.resetEngineMetrics().subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/engine/metrics/reset' });
    expect(testRequest.request.body).toBeNull();
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  test('should register', () => {
    let done = false;
    const command = testData.oIAnalytics.registration.command;
    service.register(command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/oianalytics/register' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  test('should edit registration', () => {
    let done = false;
    const command = testData.oIAnalytics.registration.command;
    service.editRegistrationSettings(command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/oianalytics/registration' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  test('should test registration connection', () => {
    let done = false;
    const command = testData.oIAnalytics.registration.command;
    service.testOIAnalyticsConnection(command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/oianalytics/registration/test-connection' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });
});
