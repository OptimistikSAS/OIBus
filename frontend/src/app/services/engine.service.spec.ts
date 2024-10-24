import { TestBed } from '@angular/core/testing';

import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EngineService } from './engine.service';
import { EngineSettingsCommandDTO, EngineSettingsDTO, OIBusInfo } from '../../../../backend/shared/model/engine.model';
import { provideHttpClient } from '@angular/common/http';
import { RegistrationSettingsCommandDTO } from '../../../../backend/shared/model/engine.model';

describe('EngineService', () => {
  let http: HttpTestingController;
  let service: EngineService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(EngineService);
  });

  afterEach(() => http.verify());

  it('should get engine settings', () => {
    let expectedSettings: EngineSettingsDTO | null = null;
    const engine = { id: 'id1' } as EngineSettingsDTO;

    service.getEngineSettings().subscribe(c => (expectedSettings = c));

    http.expectOne({ url: '/api/engine', method: 'GET' }).flush(engine);
    expect(expectedSettings!).toEqual(engine);
  });

  it('should update engine settings', () => {
    let done = false;
    const command: EngineSettingsCommandDTO = {
      name: 'my engine settings'
    } as EngineSettingsCommandDTO;

    service.updateEngineSettings(command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/engine' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should get info', () => {
    let expectedInfo: OIBusInfo | null = null;
    const engineInfo = { version: 'version' } as OIBusInfo;

    service.getInfo().subscribe(c => (expectedInfo = c));

    http.expectOne({ url: '/api/info', method: 'GET' }).flush(engineInfo);
    expect(expectedInfo!).toEqual(engineInfo);
  });

  it('should shutdown', () => {
    let done = false;

    service.shutdown().subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/shutdown' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should restart', () => {
    let done = false;

    service.restart().subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/restart' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should reset metrics', () => {
    let done = false;

    service.resetMetrics().subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/engine/reset-metrics' });
    expect(testRequest.request.body).toBeNull();
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should edit registration', () => {
    let done = false;
    const command: RegistrationSettingsCommandDTO = {
      host: 'host',
      useProxy: false,
      acceptUnauthorized: false,
      proxyUrl: null,
      proxyUsername: null,
      proxyPassword: null
    };
    service.editRegistrationSettings(command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/registration/edit' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });
});
