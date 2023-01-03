import { TestBed } from '@angular/core/testing';

import { ScanModeListComponent } from './scan-mode-list.component';
import { provideTestingI18n } from '../../../i18n/mock-i18n';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { of } from 'rxjs';
import { ScanModeService } from '../../services/scan-mode.service';
import { ScanModeDTO } from '../../model/scan-mode.model';

class ScanModeListComponentTester extends ComponentTester<ScanModeListComponent> {
  constructor() {
    super(ScanModeListComponent);
  }

  get title() {
    return this.element('h2')!;
  }

  get addScanMode() {
    return this.button('#add-scan-mode')!;
  }

  get noScanMode() {
    return this.element('#no-scan-mode');
  }
  get scanModes() {
    return this.elements('tbody tr');
  }
}

describe('ScanModeListComponent', () => {
  let tester: ScanModeListComponentTester;
  let scanModeService: jasmine.SpyObj<ScanModeService>;

  beforeEach(() => {
    scanModeService = createMock(ScanModeService);

    TestBed.configureTestingModule({
      imports: [ScanModeListComponent],
      providers: [provideTestingI18n(), { provide: ScanModeService, useValue: scanModeService }]
    });

    tester = new ScanModeListComponentTester();
  });

  it('should display a list of scan modes', () => {
    const scanModes: Array<ScanModeDTO> = [
      {
        id: 'id1',
        name: 'scanMode1',
        description: 'My Scan Mode 1',
        cron: '* * * * * *'
      },
      {
        id: 'id2',
        name: 'scanMode2',
        description: 'My Scan Mode 2',
        cron: '* * * * * *'
      }
    ];

    scanModeService.getScanModes.and.returnValue(of(scanModes));
    tester.detectChanges();

    expect(tester.title).toContainText('Scan mode list');
    expect(tester.scanModes.length).toEqual(2);
    expect(tester.scanModes[0].elements('td').length).toEqual(4);
    expect(tester.scanModes[1].elements('td')[0]).toContainText('scanMode2');
    expect(tester.scanModes[1].elements('td')[1]).toContainText('My Scan Mode 2');
    expect(tester.scanModes[1].elements('td')[2]).toContainText('* * * * * *');
  });

  it('should display an empty list', () => {
    scanModeService.getScanModes.and.returnValue(of([]));
    tester.detectChanges();

    expect(tester.title).toContainText('Scan mode list');
    expect(tester.noScanMode).toContainText('No scan mode');
  });
});
