import { TestBed } from '@angular/core/testing';

import { AboutComponent } from './about.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { provideTestingI18n } from '../../i18n/mock-i18n';
import { EngineService } from '../services/engine.service';
import { of } from 'rxjs';

class AboutComponentTester extends ComponentTester<AboutComponent> {
  constructor() {
    super(AboutComponent);
  }

  get officialSite() {
    return this.element('#official-site');
  }

  get version() {
    return this.element('#version');
  }

  get versionSpinner() {
    return this.element('#version-spinner');
  }

  get executable() {
    return this.element('#executable');
  }

  get dataFolder() {
    return this.element('#data-folder');
  }

  get operatingSystem() {
    return this.element('#operating-system');
  }

  get architecture() {
    return this.element('#architecture');
  }

  get processId() {
    return this.element('#process-id');
  }

  get hostname() {
    return this.element('#hostname');
  }

  get license() {
    return this.element('#license');
  }
}
describe('AboutComponent', () => {
  let tester: AboutComponentTester;
  let engineService: jasmine.SpyObj<EngineService>;

  beforeEach(() => {
    engineService = createMock(EngineService);

    TestBed.configureTestingModule({
      imports: [AboutComponent],
      providers: [provideTestingI18n(), { provide: EngineService, useValue: engineService }]
    });

    tester = new AboutComponentTester();
  });

  it('should have static info', () => {
    expect(tester.officialSite).toContainText('Official site');
    expect(tester.license).toContainText('License');
    expect(tester.version).toContainText('Version');
    expect(tester.versionSpinner).toBeDefined();
  });

  it('should have dynamic info', () => {
    engineService.getInfo.and.returnValue(
      of({
        version: '3.0',
        dataDirectory: 'data-folder',
        processId: '1234',
        architecture: 'x64',
        hostname: 'hostname',
        binaryDirectory: 'bin-directory',
        operatingSystem: 'Windows'
      })
    );
    tester.detectChanges();

    expect(tester.officialSite).toContainText('Official site');
    expect(tester.license).toContainText('License');
    expect(tester.version).toContainText('Version: 3.0');
    expect(tester.versionSpinner).toBeNull();
    expect(tester.executable).toHaveText('Executable: bin-directory');
    expect(tester.dataFolder).toHaveText('Data folder: data-folder');
    expect(tester.processId).toHaveText('Process ID: 1234');
    expect(tester.architecture).toHaveText('Architecture: x64');
    expect(tester.operatingSystem).toHaveText('Operating system: Windows');
    expect(tester.hostname).toHaveText('Hostname: hostname');
  });
});
