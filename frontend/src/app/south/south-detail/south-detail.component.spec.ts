import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { SouthDetailComponent } from './south-detail.component';
import ManageGroupsModalComponent from '../south-items/manage-groups-modal/manage-groups-modal.component';
import { SouthConnectorService } from '../../services/south-connector.service';
import { ScanModeService } from '../../services/scan-mode.service';
import { CertificateService } from '../../services/certificate.service';
import { EngineService } from '../../services/engine.service';
import { WindowService } from '../../shared/window.service';
import { NotificationService } from '../../shared/notification.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { ModalService } from '../../shared/modal.service';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { SouthConnectorDTO, SouthItemGroupDTO } from '../../../../../backend/shared/model/south-connector.model';
import { ScanModeDTO } from '../../../../../backend/shared/model/scan-mode.model';
import testData from '../../../../../backend/src/tests/utils/test-data';

const southConnector = testData.south.list[0] as unknown as SouthConnectorDTO;
const manifest = testData.south.manifest;
const scanModes = testData.scanMode.list as unknown as Array<ScanModeDTO>;
const oibusInfo = testData.engine.oIBusInfo;

const buildGroup = (id: string, name: string, scanMode: ScanModeDTO): SouthItemGroupDTO => ({
  id,
  createdAt: '',
  updatedAt: '',
  createdBy: { id: '', friendlyName: '' },
  updatedBy: { id: '', friendlyName: '' },
  standardSettings: { name, scanMode },
  historySettings: { startTimeOffset: 0, endTimeOffset: 0, maxReadInterval: 3600, readDelay: 200, recoveryStrategy: 'oldest' }
});

const activatedRouteStub = {
  snapshot: { queryParamMap: { getAll: () => [], get: () => null } },
  paramMap: of({ get: (key: string) => (key === 'southId' ? southConnector.id : null) }),
  queryParamMap: of({ get: (_key: string) => null, getAll: (_key: string) => [] as Array<string> })
};

describe('SouthDetailComponent', () => {
  let southConnectorService: MockObject<SouthConnectorService>;
  let notificationService: MockObject<NotificationService>;
  let confirmationService: MockObject<ConfirmationService>;
  let modalService: MockObject<ModalService>;

  beforeEach(() => {
    southConnectorService = createMock(SouthConnectorService);
    const scanModeService = createMock(ScanModeService);
    const certificateService = createMock(CertificateService);
    const engineService = createMock(EngineService);
    const windowService = createMock(WindowService);
    notificationService = createMock(NotificationService);
    confirmationService = createMock(ConfirmationService);
    modalService = createMock(ModalService);

    scanModeService.list.mockReturnValue(of(scanModes));
    certificateService.list.mockReturnValue(of([]));
    (engineService as any).info$ = of(oibusInfo);
    southConnectorService.findById.mockReturnValue(of(southConnector as any));
    southConnectorService.getSouthManifest.mockReturnValue(of(manifest));
    southConnectorService.getGroups.mockReturnValue(of([]));
    southConnectorService.start.mockReturnValue(of(undefined));
    southConnectorService.stop.mockReturnValue(of(undefined));
    windowService.getStorageItem.mockReturnValue('token');

    function MockEventSource(this: { addEventListener: () => void; close: () => void }) {
      this.addEventListener = vi.fn();
      this.close = vi.fn();
    }
    Object.defineProperty(window, 'EventSource', {
      value: MockEventSource,
      writable: true,
      configurable: true
    });

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: activatedRouteStub },
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: ScanModeService, useValue: scanModeService },
        { provide: CertificateService, useValue: certificateService },
        { provide: EngineService, useValue: engineService },
        { provide: WindowService, useValue: windowService },
        { provide: NotificationService, useValue: notificationService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: ModalService, useValue: modalService }
      ]
    });
  });

  test('should display south connector title', async () => {
    const fixture = TestBed.createComponent(SouthDetailComponent);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('#title')).toHaveTextContent(southConnector.name);
  });

  test('should toggle connector on', () => {
    const fixture = TestBed.createComponent(SouthDetailComponent);
    fixture.detectChanges();

    fixture.componentInstance.toggleConnector(true);

    expect(southConnectorService.start).toHaveBeenCalledWith(southConnector.id);
  });

  test('should toggle connector off', () => {
    const fixture = TestBed.createComponent(SouthDetailComponent);
    fixture.detectChanges();

    fixture.componentInstance.toggleConnector(false);

    expect(southConnectorService.stop).toHaveBeenCalledWith(southConnector.id);
  });

  test('addOrEditGroup (edit) should refresh the item list with the server state', () => {
    const groupA = buildGroup('group1', 'GroupA', scanModes[0]);
    const itemWithGroup = { ...southConnector.items[0], group: groupA };
    const southConnectorWithGroup = { ...southConnector, groups: [groupA], items: [itemWithGroup, southConnector.items[1]] };
    southConnectorService.findById.mockReturnValue(of(southConnectorWithGroup as any));

    const fixture = TestBed.createComponent(SouthDetailComponent);
    fixture.detectChanges();

    const renamedGroup = buildGroup('group1', 'GroupA renamed', scanModes[0]);
    const southConnectorAfterRename = {
      ...southConnectorWithGroup,
      groups: [renamedGroup],
      items: [{ ...itemWithGroup, group: renamedGroup }, southConnector.items[1]]
    };
    southConnectorService.updateGroup.mockReturnValue(of(undefined));
    southConnectorService.findById.mockReturnValueOnce(of(southConnectorAfterRename as any));
    southConnectorService.getGroup.mockReturnValue(of(renamedGroup));

    fixture.componentInstance
      .addOrEditGroup({
        mode: 'edit',
        group: {
          id: 'group1',
          standardSettings: { name: 'GroupA renamed', scanModeId: scanModes[0].id },
          historySettings: renamedGroup.historySettings
        }
      })
      .subscribe();

    expect(fixture.componentInstance.filteredItems.find(item => item.id === itemWithGroup.id)?.group?.standardSettings.name).toBe(
      'GroupA renamed'
    );
  });

  test('addOrEditGroup (create) should refresh the item list with the server state', () => {
    const fixture = TestBed.createComponent(SouthDetailComponent);
    fixture.detectChanges();

    const createdGroup = buildGroup('group1', 'GroupA', scanModes[0]);
    const southConnectorAfterCreate = { ...southConnector, groups: [createdGroup] };
    southConnectorService.createGroup.mockReturnValue(of(createdGroup));
    southConnectorService.findById.mockReturnValueOnce(of(southConnectorAfterCreate as any));

    fixture.componentInstance
      .addOrEditGroup({
        mode: 'create',
        group: {
          id: null as any,
          standardSettings: { name: 'GroupA', scanModeId: scanModes[0].id },
          historySettings: createdGroup.historySettings
        }
      })
      .subscribe();

    expect(fixture.componentInstance.southConnector!.groups).toEqual([createdGroup]);
  });

  test('deleteGroup should delete on the server before refetching, and refresh the item list', () => {
    const groupA = buildGroup('group1', 'GroupA', scanModes[0]);
    const itemWithGroup = { ...southConnector.items[0], group: groupA };
    const southConnectorWithGroup = { ...southConnector, groups: [groupA], items: [itemWithGroup, southConnector.items[1]] };
    southConnectorService.findById.mockReturnValue(of(southConnectorWithGroup as any));

    const fixture = TestBed.createComponent(SouthDetailComponent);
    fixture.detectChanges();

    confirmationService.confirm.mockReturnValue(of(undefined));
    const callOrder: Array<string> = [];
    southConnectorService.deleteGroup.mockImplementation(() => {
      callOrder.push('delete');
      return of(undefined);
    });
    const southConnectorAfterDelete = {
      ...southConnectorWithGroup,
      groups: [],
      items: [{ ...itemWithGroup, group: null }, southConnector.items[1]]
    };
    southConnectorService.findById.mockImplementationOnce(() => {
      callOrder.push('findById');
      return of(southConnectorAfterDelete as any);
    });

    fixture.componentInstance.deleteGroup(groupA).subscribe();

    expect(callOrder).toEqual(['delete', 'findById']);
    expect(fixture.componentInstance.filteredItems.find(item => item.id === itemWithGroup.id)?.group).toBeNull();
    expect(notificationService.success).toHaveBeenCalledWith('south.groups.deleted');
  });

  test('manageGroups should open the manage groups modal with the current groups and items', () => {
    const groupA = buildGroup('group1', 'GroupA', scanModes[0]);
    const itemWithGroup = { ...southConnector.items[0], group: groupA };
    const southConnectorWithGroup = { ...southConnector, groups: [groupA], items: [itemWithGroup, southConnector.items[1]] };
    southConnectorService.findById.mockReturnValue(of(southConnectorWithGroup as any));

    const prepare = vi.fn();
    modalService.open.mockReturnValue({ componentInstance: { prepare }, result: of(undefined) } as any);

    const fixture = TestBed.createComponent(SouthDetailComponent);
    fixture.detectChanges();

    fixture.componentInstance.manageGroups();

    expect(modalService.open).toHaveBeenCalledWith(ManageGroupsModalComponent, expect.anything());
    expect(prepare).toHaveBeenCalledWith(
      [groupA],
      scanModes,
      manifest,
      true,
      expect.any(Function),
      expect.any(Function),
      expect.any(Function)
    );
    const getItemCount = prepare.mock.calls[0][4];
    expect(getItemCount('group1')).toBe(1);
  });
});
