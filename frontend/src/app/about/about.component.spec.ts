import { TestBed } from '@angular/core/testing';

import { AboutComponent } from './about.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { EngineService } from '../services/engine.service';
import { EMPTY, of } from 'rxjs';
import testData from '../../../../backend/src/tests/utils/test-data';

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
      providers: [provideI18nTesting(), { provide: EngineService, useValue: engineService }]
    });
  });

  it('should have static info', async () => {
    engineService.getInfo.and.returnValue(EMPTY);
    tester = new AboutComponentTester();
    await tester.change();
    expect(tester.officialSite).toContainText('Official site');
    expect(tester.license).toContainText('License');
    expect(tester.version).toContainText('Version');
    expect(tester.versionSpinner).toBeDefined();
  });

  it('should have dynamic info', async () => {
    engineService.getInfo.and.returnValue(of(testData.engine.oIBusInfo));
    tester = new AboutComponentTester();
    await tester.change();

    expect(tester.officialSite).toContainText('Official site');
    expect(tester.license).toContainText('License');
    expect(tester.version).toContainText('Version: 3.4.9');
    expect(tester.versionSpinner).toBeNull();
    expect(tester.executable).toHaveText('Executable: binary-directory');
    expect(tester.dataFolder).toHaveText('Data folder: data-directory');
    expect(tester.processId).toHaveText('Process ID: pid');
    expect(tester.architecture).toHaveText('Architecture: x64');
    expect(tester.operatingSystem).toHaveText('Operating system: win');
    expect(tester.hostname).toHaveText('Hostname: host name');
  });
});
