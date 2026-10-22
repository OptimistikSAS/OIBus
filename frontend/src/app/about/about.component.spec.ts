import { CdkCopyToClipboard } from '@angular/cdk/clipboard';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { EMPTY, of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../i18n/mock-i18n';
import testData from '../../test/test-data';
import { createMock, MockObject } from '../../test/vitest-create-mock';
import { EngineService } from '../services/engine.service';
import { NotificationService } from '../shared/notification.service';
import { AboutComponent } from './about.component';

class AboutComponentTester {
  readonly fixture = TestBed.createComponent(AboutComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading', { level: 1 });
  readonly officialSite = this.root.getByRole('link', { name: 'Official site' });
  readonly license = this.root.getByCss('#license');
  readonly copyright = this.root.getByCss('#copyright');
  readonly spinner = this.root.getByCss('oib-loading-spinner');
  readonly copyInfo = this.root.getByRole('button', { name: 'Copy system information' });
  readonly name = this.root.getByCss('#name');
  readonly oibusId = this.root.getByCss('#oibus-id');
  readonly version = this.root.getByCss('#version');
  readonly launcherVersion = this.root.getByCss('#launcher-version');
  readonly hostname = this.root.getByCss('#hostname');
  readonly operatingSystem = this.root.getByCss('#operating-system');
  readonly architecture = this.root.getByCss('#architecture');
  readonly processId = this.root.getByCss('#process-id');
  readonly launchOptions = this.root.getByCss('#launch-options');
  readonly executable = this.root.getByCss('#executable');
  readonly dataFolder = this.root.getByCss('#data-folder');

  get copyDirective(): CdkCopyToClipboard {
    return this.fixture.debugElement.query(By.directive(CdkCopyToClipboard)).injector.get(CdkCopyToClipboard);
  }
}

describe('AboutComponent', () => {
  let tester: AboutComponentTester;
  let engineService: MockObject<EngineService>;
  let notificationService: MockObject<NotificationService>;

  beforeEach(() => {
    engineService = createMock(EngineService);
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: EngineService, useValue: engineService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });
  });

  test('should display the static information while the information of OIBus loads', async () => {
    engineService.getInfo.mockReturnValue(EMPTY);

    tester = new AboutComponentTester();

    await expect.element(tester.title).toHaveTextContent('About OIBus');
    await expect.element(tester.officialSite).toHaveAttribute('href', 'https://oibus.optimistik.com/');
    await expect.element(tester.license).toHaveTextContent('License: EUPL-1.2-or-later');
    await expect
      .element(tester.copyright)
      .toHaveTextContent(
        `Copyright (c) 2018-${new Date().getFullYear()} Optimistik SAS. This software is distributed under the terms of the EUPL-1.2 license.`
      );
    await expect.element(tester.spinner).toBeInTheDocument();
    await expect.element(tester.version).not.toBeInTheDocument();
    await expect.element(tester.copyInfo).not.toBeInTheDocument();
  });

  test('should display the information of OIBus', async () => {
    engineService.getInfo.mockReturnValue(of(testData.engine.oIBusInfo));

    tester = new AboutComponentTester();

    await expect.element(tester.spinner).not.toBeInTheDocument();
    await expect.element(tester.name).toHaveTextContent('NameOIBus');
    await expect.element(tester.oibusId).toHaveTextContent('IDoibusId1');
    await expect.element(tester.version).toHaveTextContent('Version3.4.9');
    await expect.element(tester.launcherVersion).toHaveTextContent('Launcher version3.4.9');
    await expect.element(tester.hostname).toHaveTextContent('Hostnamehost name');
    await expect.element(tester.operatingSystem).toHaveTextContent('Operating systemwin');
    await expect.element(tester.architecture).toHaveTextContent('Architecturex64');
    await expect.element(tester.processId).toHaveTextContent('Process IDpid');
    await expect.element(tester.launchOptions).not.toBeInTheDocument();
    await expect.element(tester.executable).toHaveTextContent('Executablebinary-directory');
    await expect.element(tester.dataFolder).toHaveTextContent('Data folderdata-directory');
  });

  test('should display the launch options', async () => {
    engineService.getInfo.mockReturnValue(of({ ...testData.engine.oIBusInfo, ignoreIpFilters: true, ignoreRemoteUpdate: true }));

    tester = new AboutComponentTester();

    await expect.element(tester.launchOptions).toHaveTextContent('Launch options--ignoreIpFilters --ignoreRemoteUpdate');
  });

  test('should copy the system information and notify it', async () => {
    engineService.getInfo.mockReturnValue(of({ ...testData.engine.oIBusInfo, ignoreRemoteUpdate: true }));
    tester = new AboutComponentTester();
    await expect.element(tester.copyInfo).toBeInTheDocument();

    expect(tester.copyDirective.text).toBe(
      [
        'Name: OIBus',
        'ID: oibusId1',
        'Version: 3.4.9',
        'Launcher version: 3.4.9',
        'Hostname: host name',
        'Operating system: win',
        'Architecture: x64',
        'Process ID: pid',
        'Executable: binary-directory',
        'Data folder: data-directory',
        'Launch options: --ignoreRemoteUpdate'
      ].join('\n')
    );

    const copyButton = tester.fixture.debugElement.query(By.directive(CdkCopyToClipboard));
    copyButton.triggerEventHandler('cdkCopyToClipboardCopied', true);
    expect(notificationService.success).toHaveBeenCalledWith('about.copy-info-success');

    copyButton.triggerEventHandler('cdkCopyToClipboardCopied', false);
    expect(notificationService.error).toHaveBeenCalledWith('about.copy-info-error');
  });
});
