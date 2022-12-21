import { TestBed } from '@angular/core/testing';

import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { EngineService } from './engine.service';
import { EngineSettingsCommandDTO, EngineSettingsDTO } from '../model/engine.model';

describe('EngineService', () => {
  let http: HttpTestingController;
  let service: EngineService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [EngineService]
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
});
