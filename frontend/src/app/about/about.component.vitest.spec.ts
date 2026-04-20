import { TestBed } from '@angular/core/testing';
import { EMPTY, of } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';

import { provideI18nTesting } from '../../i18n/mock-i18n';
import testData from '../../../../backend/src/tests/utils/test-data';
import { AboutComponent } from './about.component';
import { EngineService } from '../services/engine.service';
import { MockObject, createMock } from '../../test/vitest-create-mock';

class AboutComponentTester {
  readonly fixture = TestBed.createComponent(AboutComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly officialSite = this.root.getByCss('#official-site');
  readonly version = this.root.getByCss('#version');
  readonly versionSpinner = this.root.getByCss('#version-spinner');
  readonly launcherVersion = this.root.getByCss('#launcher-version');
  readonly launcherVersionSpinner = this.root.getByCss('#launcher-version-spinner');
  readonly executable = this.root.getByCss('#executable');
  readonly dataFolder = this.root.getByCss('#data-folder');
  readonly operatingSystem = this.root.getByCss('#operating-system');
  readonly architecture = this.root.getByCss('#architecture');
  readonly processId = this.root.getByCss('#process-id');
  readonly hostname = this.root.getByCss('#hostname');
  readonly license = this.root.getByCss('#license');
}

describe('AboutComponent', () => {
  let tester: AboutComponentTester;
  let engineService: MockObject<EngineService>;

  beforeEach(() => {
    engineService = createMock(EngineService);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: EngineService, useValue: engineService }]
    });
  });

  test('should have static info', async () => {
    engineService.getInfo.mockReturnValue(EMPTY);

    tester = new AboutComponentTester();

    await expect.element(tester.officialSite).toHaveTextContent('Official site');
    await expect.element(tester.license).toHaveTextContent('License');
    await expect.element(tester.version).toHaveTextContent('Version');
    await expect.element(tester.versionSpinner).toBeInTheDocument();
    await expect.element(tester.launcherVersion).toHaveTextContent('Launcher version');
    await expect.element(tester.launcherVersionSpinner).toBeInTheDocument();
  });

  test('should have dynamic info', async () => {
    engineService.getInfo.mockReturnValue(of(testData.engine.oIBusInfo));

    tester = new AboutComponentTester();

    await expect.element(tester.officialSite).toHaveTextContent('Official site');
    await expect.element(tester.license).toHaveTextContent('License');
    await expect.element(tester.version).toHaveTextContent('Version: 3.4.9');
    await expect.element(tester.versionSpinner).not.toBeInTheDocument();
    await expect.element(tester.launcherVersion).toHaveTextContent('Launcher version: 3.4.9');
    await expect.element(tester.launcherVersionSpinner).not.toBeInTheDocument();
    await expect.element(tester.executable).toHaveTextContent('Executable: binary-directory');
    await expect.element(tester.dataFolder).toHaveTextContent('Data folder: data-directory');
    await expect.element(tester.processId).toHaveTextContent('Process ID: pid');
    await expect.element(tester.architecture).toHaveTextContent('Architecture: x64');
    await expect.element(tester.operatingSystem).toHaveTextContent('Operating system: win');
    await expect.element(tester.hostname).toHaveTextContent('Hostname: host name');
  });
});
