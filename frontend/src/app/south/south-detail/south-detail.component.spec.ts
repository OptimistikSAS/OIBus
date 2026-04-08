import { TestBed } from '@angular/core/testing';

import { SouthDetailComponent } from './south-detail.component';
import { ComponentTester, createMock, stubRoute } from 'ngx-speculoos';
import { SouthConnectorService } from '../../services/south-connector.service';
import { of } from 'rxjs';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { ScanModeService } from '../../services/scan-mode.service';
import { EngineService } from '../../services/engine.service';
import testData from '../../../../../backend/src/tests/utils/test-data';
import { CertificateService } from '../../services/certificate.service';
import { SouthConnectorDTO, SouthConnectorTypedDTO, SouthItemGroupDTO } from '../../../../../backend/shared/model/south-connector.model';
import { SouthFolderScannerItemSettings, SouthFolderScannerSettings } from '../../../../../backend/shared/model/south-settings.model';
import { UserInfo } from '../../../../../backend/shared/model/types';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ScanModeDTO } from '../../../../../backend/shared/model/scan-mode.model';
import { CertificateDTO } from '../../../../../backend/shared/model/certificate.model';

class SouthDisplayComponentTester extends ComponentTester<SouthDetailComponent> {
  constructor() {
    super(SouthDetailComponent);
  }

  get title() {
    return this.element('#title');
  }

  get toggleButton() {
    return this.button('#south-enabled')!;
  }

  get southSettings() {
    return this.elements('tbody.south-settings tr');
  }

  get southItems() {
    return this.elements('tbody tr.south-item');
  }

  get southLogs() {
    return this.elements('#logs-title');
  }
}

describe('SouthDetailComponent', () => {
  let tester: SouthDisplayComponentTester;
  let southConnectorService: jasmine.SpyObj<SouthConnectorService>;
  let scanModeService: jasmine.SpyObj<ScanModeService>;
  let certificateService: jasmine.SpyObj<CertificateService>;
  let confirmationService: jasmine.SpyObj<ConfirmationService>;
  let notificationService: jasmine.SpyObj<NotificationService>;
  let engineService: jasmine.SpyObj<EngineService>;

  const manifest = testData.south.manifest;
  const southConnector: SouthConnectorDTO = {
    ...testData.south.list[0],
    items: testData.south.list[0].items.map(item => ({ ...item, group: null }))
  } as unknown as SouthConnectorDTO;
  const engineInfo = testData.engine.oIBusInfo;

  const mockUser: UserInfo = { id: 'user1', friendlyName: 'Test User' };
  const mockGroupScanMode: ScanModeDTO = {
    id: 'scanModeId1',
    name: 'scanMode1',
    description: 'test',
    cron: '* * * * *',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    createdBy: mockUser,
    updatedBy: mockUser
  };
  const mockGroupA: SouthItemGroupDTO = {
    id: 'g1',
    name: 'GroupA',
    scanMode: mockGroupScanMode,
    overlap: null,
    maxReadInterval: null,
    readDelay: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    createdBy: mockUser,
    updatedBy: mockUser
  };
  const mockGroupZ: SouthItemGroupDTO = {
    id: 'g2',
    name: 'Zebra',
    scanMode: mockGroupScanMode,
    overlap: null,
    maxReadInterval: null,
    readDelay: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    createdBy: mockUser,
    updatedBy: mockUser
  };

  beforeEach(() => {
    southConnectorService = createMock(SouthConnectorService);
    scanModeService = createMock(ScanModeService);
    certificateService = createMock(CertificateService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);
    engineService = createMock(EngineService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: stubRoute({
            params: {
              southId: 'id1'
            }
          })
        },
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: ScanModeService, useValue: scanModeService },
        { provide: CertificateService, useValue: certificateService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: EngineService, useValue: engineService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });

    scanModeService.list.and.returnValue(of(testData.scanMode.list as unknown as Array<ScanModeDTO>));
    certificateService.list.and.returnValue(of(testData.certificates.list as unknown as Array<CertificateDTO>));
    engineService.getInfo.and.returnValue(of(engineInfo));
    (engineService as any).info$ = of(engineInfo);
    southConnectorService.findById.and.returnValue(
      of({
        ...southConnector,
        items: southConnector.items.map(element => ({ ...element, scanModeId: element.scanMode.id }))
      } as any)
    );
    southConnectorService.getGroups.and.returnValue(of([]));
    southConnectorService.getSouthManifest.and.returnValue(of(manifest));
    southConnectorService.start.and.returnValue(of(undefined));
    southConnectorService.stop.and.returnValue(of(undefined));

    tester = new SouthDisplayComponentTester();
  });

  it('should display south connector detail', async () => {
    await tester.change();
    expect(tester.title).toContainText(southConnector.name);
    const settings = tester.southSettings;
    expect(settings.length).toBe(1);
    expect(settings[0]).toContainText('Status');
    expect(settings[0]).toContainText('active');
  });

  it('should display items', async () => {
    await tester.change();
    expect(tester.southItems.length).toBe(2);
    const item = tester.southItems[0];
    expect(item.elements('td')[2]).toContainText('item1');
    expect(item.elements('td')[4]).toContainText('scanMode1');
  });

  it('should display logs', async () => {
    await tester.change();
    expect(tester.southLogs.length).toBe(1);
  });

  it('should stop south', async () => {
    await tester.change();
    await tester.toggleButton.click();
    expect(southConnectorService.stop).toHaveBeenCalledWith(southConnector.id);
    expect(notificationService.success).toHaveBeenCalledWith('south.stopped', { name: southConnector.name });
  });

  it('should start south', async () => {
    await tester.change();
    tester.componentInstance.southConnector!.enabled = false;
    await tester.toggleButton.click();
    expect(southConnectorService.start).toHaveBeenCalledWith(southConnector.id);
    expect(notificationService.success).toHaveBeenCalledWith('south.started', { name: southConnector.name });
  });

  it('should filter items by name', async () => {
    await tester.change();
    expect(tester.southItems.length).toBe(2);

    tester.componentInstance.searchControl.setValue('item2');
    await tester.change();

    expect(tester.southItems.length).toBe(1);
    expect(tester.southItems[0].elements('td')[2]).toContainText('item2');
  });

  it('should filter items by status', async () => {
    await tester.change();
    tester.componentInstance.statusFilterControl.setValue('disabled');
    await tester.change();

    expect(tester.southItems.length).toBe(0);

    tester.componentInstance.statusFilterControl.setValue('enabled');
    await tester.change();

    expect(tester.southItems.length).toBe(2);
  });

  it('should sort items by name ascending then descending', async () => {
    await tester.change();
    const names = () => tester.southItems.map(row => row.elements('td')[2].nativeElement.textContent?.trim() ?? '');

    tester.componentInstance.toggleColumnSort('name');
    await tester.change();
    expect(names()).toEqual(['item1', 'item2']);

    tester.componentInstance.toggleColumnSort('name');
    await tester.change();
    expect(names()).toEqual(['item2', 'item1']);
  });

  it('should filter items by group id', async () => {
    await tester.change();
    const connector = tester.componentInstance.southConnector as SouthConnectorTypedDTO<
      'folder-scanner',
      SouthFolderScannerSettings,
      SouthFolderScannerItemSettings
    >;
    connector.items = [
      { ...connector.items[0], group: mockGroupA },
      { ...connector.items[1], group: null }
    ];
    tester.componentInstance.resetPage();
    await tester.change();

    tester.componentInstance.groupFilterControl.setValue('g1');
    await tester.change();
    expect(tester.southItems.length).toBe(1);
    expect(tester.southItems[0].elements('td')[2]).toContainText('item1');
  });

  it('should filter items with no group using "none"', async () => {
    await tester.change();
    const connector = tester.componentInstance.southConnector as SouthConnectorTypedDTO<
      'folder-scanner',
      SouthFolderScannerSettings,
      SouthFolderScannerItemSettings
    >;
    connector.items = [
      { ...connector.items[0], group: mockGroupA },
      { ...connector.items[1], group: null }
    ];
    tester.componentInstance.resetPage();
    await tester.change();

    tester.componentInstance.groupFilterControl.setValue('none');
    await tester.change();
    expect(tester.southItems.length).toBe(1);
    expect(tester.southItems[0].elements('td')[2]).toContainText('item2');
  });

  it('should filter items by scan mode', async () => {
    await tester.change();
    // item1 uses scanModeId1, item2 uses scanModeId2 (from testData)
    tester.componentInstance.scanModeFilterControl.setValue('scanModeId1');
    await tester.change();

    expect(tester.southItems.length).toBe(1);
    expect(tester.southItems[0].elements('td')[2]).toContainText('item1');
  });

  it('should sort items by enabled status', async () => {
    await tester.change();
    const connector = tester.componentInstance.southConnector as SouthConnectorTypedDTO<
      'folder-scanner',
      SouthFolderScannerSettings,
      SouthFolderScannerItemSettings
    >;
    connector.items = [
      { ...connector.items[0], enabled: false },
      { ...connector.items[1], enabled: true }
    ];
    tester.componentInstance.resetPage();
    await tester.change();
    const names = () => tester.southItems.map(row => row.elements('td')[2].nativeElement.textContent?.trim() ?? '');

    tester.componentInstance.toggleColumnSort('enabled');
    await tester.change();
    // ascending: disabled first (0), then enabled (1)
    expect(names()).toEqual(['item1', 'item2']);

    tester.componentInstance.toggleColumnSort('enabled');
    await tester.change();
    // descending: enabled first (1), then disabled (0)
    expect(names()).toEqual(['item2', 'item1']);
  });

  it('should sort items by createdAt', async () => {
    await tester.change();
    const connector = tester.componentInstance.southConnector as SouthConnectorTypedDTO<
      'folder-scanner',
      SouthFolderScannerSettings,
      SouthFolderScannerItemSettings
    >;
    connector.items = [
      { ...connector.items[0], createdAt: '2024-02-01T00:00:00.000Z' },
      { ...connector.items[1], createdAt: '2024-01-01T00:00:00.000Z' }
    ];
    tester.componentInstance.resetPage();
    await tester.change();
    const names = () => tester.southItems.map(row => row.elements('td')[2].nativeElement.textContent?.trim() ?? '');

    tester.componentInstance.toggleColumnSort('createdAt');
    await tester.change();
    expect(names()).toEqual(['item2', 'item1']); // item2 has earlier date

    tester.componentInstance.toggleColumnSort('createdAt');
    await tester.change();
    expect(names()).toEqual(['item1', 'item2']);
  });

  it('should sort items by updatedAt', async () => {
    await tester.change();
    const connector = tester.componentInstance.southConnector as SouthConnectorTypedDTO<
      'folder-scanner',
      SouthFolderScannerSettings,
      SouthFolderScannerItemSettings
    >;
    connector.items = [
      { ...connector.items[0], updatedAt: '2024-01-01T00:00:00.000Z' },
      { ...connector.items[1], updatedAt: '2024-02-01T00:00:00.000Z' }
    ];
    tester.componentInstance.resetPage();
    await tester.change();
    const names = () => tester.southItems.map(row => row.elements('td')[2].nativeElement.textContent?.trim() ?? '');

    tester.componentInstance.toggleColumnSort('updatedAt');
    await tester.change();
    expect(names()).toEqual(['item1', 'item2']);

    tester.componentInstance.toggleColumnSort('updatedAt');
    await tester.change();
    expect(names()).toEqual(['item2', 'item1']);
  });

  it('should sort items by group name', async () => {
    await tester.change();
    const connector = tester.componentInstance.southConnector as SouthConnectorTypedDTO<
      'folder-scanner',
      SouthFolderScannerSettings,
      SouthFolderScannerItemSettings
    >;
    connector.items = [
      { ...connector.items[0], group: mockGroupZ },
      { ...connector.items[1], group: mockGroupA }
    ];
    tester.componentInstance.resetPage();
    await tester.change();
    const names = () => tester.southItems.map(row => row.elements('td')[2].nativeElement.textContent?.trim() ?? '');

    tester.componentInstance.toggleColumnSort('group');
    await tester.change();
    expect(names()).toEqual(['item2', 'item1']); // Alpha before Zebra

    tester.componentInstance.toggleColumnSort('group');
    await tester.change();
    expect(names()).toEqual(['item1', 'item2']);
  });

  it('should sort items by scan mode name', async () => {
    await tester.change();
    // item1 uses scanMode1, item2 uses scanMode2 (alphabetically item1 < item2 for scan mode names)
    const names = () => tester.southItems.map(row => row.elements('td')[2].nativeElement.textContent?.trim() ?? '');

    tester.componentInstance.toggleColumnSort('scanMode');
    await tester.change();
    expect(names()).toEqual(['item1', 'item2']); // scanMode1 < scanMode2

    tester.componentInstance.toggleColumnSort('scanMode');
    await tester.change();
    expect(names()).toEqual(['item2', 'item1']);
  });
});
