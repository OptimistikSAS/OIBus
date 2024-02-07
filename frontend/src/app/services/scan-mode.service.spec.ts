import { TestBed } from '@angular/core/testing';

import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ScanModeService } from './scan-mode.service';
import { ScanModeCommandDTO, ScanModeDTO, ValidatedCronExpression } from '../../../../shared/model/scan-mode.model';
import { provideHttpClient } from '@angular/common/http';

describe('ScanModeService', () => {
  let http: HttpTestingController;
  let service: ScanModeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(ScanModeService);
  });

  afterEach(() => http.verify());

  it('should get all scan modes', () => {
    let expectedScanModes: Array<ScanModeDTO> = [];
    service.list().subscribe(scanModes => (expectedScanModes = scanModes));

    http.expectOne('/api/scan-modes').flush([{ name: 'Scan Mode 1' }, { name: 'Scan Mode 2' }]);

    expect(expectedScanModes.length).toBe(2);
  });

  it('should get a scan mode', () => {
    let expectedScanMode: ScanModeDTO | null = null;
    const scanMode = { id: 'id1' } as ScanModeDTO;

    service.get('id1').subscribe(c => (expectedScanMode = c));

    http.expectOne({ url: '/api/scan-modes/id1', method: 'GET' }).flush(scanMode);
    expect(expectedScanMode!).toEqual(scanMode);
  });

  it('should create a scan mode', () => {
    let done = false;
    const command: ScanModeCommandDTO = {
      name: 'myScanMode',
      description: 'a test proxy',
      cron: '* * * * * *'
    };

    service.create(command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/scan-modes' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should update a scan mode', () => {
    let done = false;
    const command: ScanModeCommandDTO = {
      name: 'myScanMode',
      description: 'a test proxy',
      cron: '* * * * * *'
    };

    service.update('id1', command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/scan-modes/id1' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should delete a scan mode', () => {
    let done = false;
    service.delete('id1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'DELETE', url: '/api/scan-modes/id1' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should verify a cron expression', () => {
    let expectedValidatedCronExpression: ValidatedCronExpression | null = null;
    const validatedCronExpression: ValidatedCronExpression = { nextExecutions: [], humanReadableForm: '' };

    service.verifyCron('* * * * * *').subscribe(c => (expectedValidatedCronExpression = c));

    http.expectOne({ url: '/api/scan-modes/verify', method: 'POST' }).flush(validatedCronExpression);
    expect(expectedValidatedCronExpression!).toEqual(validatedCronExpression);
  });
});
