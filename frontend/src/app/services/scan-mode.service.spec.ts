import { TestBed } from '@angular/core/testing';

import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ScanModeService } from './scan-mode.service';
import { ScanModeCommandDTO, ScanModeDTO } from '../model/scan-mode.model';

describe('ScanModeService', () => {
  let http: HttpTestingController;
  let service: ScanModeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ScanModeService]
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(ScanModeService);
  });

  afterEach(() => http.verify());

  it('should get all scan modes', () => {
    let expectedScanModes: Array<ScanModeDTO> = [];
    service.getScanModes().subscribe(scanModes => (expectedScanModes = scanModes));

    http.expectOne('/api/scan-modes').flush([{ name: 'Scan Mode 1' }, { name: 'Scan Mode 2' }]);

    expect(expectedScanModes.length).toBe(2);
  });

  it('should get a scan mode', () => {
    let expectedScanMode: ScanModeDTO | null = null;
    const scanMode = { id: 'id1' } as ScanModeDTO;

    service.getScanMode('id1').subscribe(c => (expectedScanMode = c));

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

    service.createScanMode(command).subscribe(() => (done = true));
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

    service.updateScanMode('id1', command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/scan-modes/id1' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should delete a scan mode', () => {
    let done = false;
    service.deleteScanMode('id1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'DELETE', url: '/api/scan-modes/id1' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });
});
