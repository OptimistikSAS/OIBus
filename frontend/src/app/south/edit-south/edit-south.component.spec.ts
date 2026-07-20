import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { EditSouthComponent } from './edit-south.component';
import ManageGroupsModalComponent from '../south-items/manage-groups-modal/manage-groups-modal.component';
import { SouthConnectorService } from '../../services/south-connector.service';
import { ScanModeService } from '../../services/scan-mode.service';
import { CertificateService } from '../../services/certificate.service';
import { NotificationService } from '../../shared/notification.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { ModalService } from '../../shared/modal.service';
import { UnsavedChangesConfirmationService } from '../../shared/unsaved-changes-confirmation.service';
import { TransformerService } from '../../services/transformer.service';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { SouthConnectorDTO, SouthItemGroupDTO } from '../../../../../backend/shared/model/south-connector.model';
import { ScanModeDTO } from '../../../../../backend/shared/model/scan-mode.model';
import testData from '../../../../../backend/src/tests/utils/test-data';

const manifest = testData.south.manifest;
const southConnector = testData.south.list[0] as unknown as SouthConnectorDTO;
const scanModes = testData.scanMode.list as unknown as Array<ScanModeDTO>;

const buildGroup = (id: string, name: string, scanMode: ScanModeDTO): SouthItemGroupDTO => ({
  id,
  createdAt: '',
  updatedAt: '',
  createdBy: { id: '', friendlyName: '' },
  updatedBy: { id: '', friendlyName: '' },
  standardSettings: { name, scanMode },
  historySettings: { overlap: 0, maxReadInterval: 3600, readDelay: 200 }
});

const createRouteStub = {
  paramMap: of({ get: () => null }),
  queryParamMap: of({ get: (key: string) => (key === 'type' ? 'folder-scanner' : null), getAll: () => [] as Array<string> })
};

const editRouteStub = {
  paramMap: of({ get: (key: string) => (key === 'southId' ? southConnector.id : null) }),
  queryParamMap: of({ get: () => null, getAll: () => [] as Array<string> })
};

describe('EditSouthComponent', () => {
  let southConnectorService: MockObject<SouthConnectorService>;
  let scanModeService: MockObject<ScanModeService>;
  let certificateService: MockObject<CertificateService>;
  let confirmationService: MockObject<ConfirmationService>;
  let modalService: MockObject<ModalService>;

  beforeEach(() => {
    southConnectorService = createMock(SouthConnectorService);
    scanModeService = createMock(ScanModeService);
    certificateService = createMock(CertificateService);
    const notificationService = createMock(NotificationService);
    confirmationService = createMock(ConfirmationService);
    modalService = createMock(ModalService);
    const unsavedChangesService = createMock(UnsavedChangesConfirmationService);
    const transformerService = createMock(TransformerService);

    scanModeService.list.mockReturnValue(of(scanModes));
    certificateService.list.mockReturnValue(of([]));
    southConnectorService.list.mockReturnValue(of([]));
    southConnectorService.getSouthManifest.mockReturnValue(of(manifest));
    southConnectorService.getGroups.mockReturnValue(of([]));
    transformerService.list.mockReturnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        provideHttpClientTesting(),
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: ScanModeService, useValue: scanModeService },
        { provide: CertificateService, useValue: certificateService },
        { provide: NotificationService, useValue: notificationService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: ModalService, useValue: modalService },
        { provide: UnsavedChangesConfirmationService, useValue: unsavedChangesService },
        { provide: TransformerService, useValue: transformerService }
      ]
    });
  });

  test('should display create mode', async () => {
    TestBed.overrideProvider(ActivatedRoute, { useValue: createRouteStub });
    const fixture = TestBed.createComponent(EditSouthComponent);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('#south-name')).toBeInTheDocument();
  });

  test('should display edit mode with form populated', async () => {
    southConnectorService.findById.mockReturnValue(of(southConnector as any));
    TestBed.overrideProvider(ActivatedRoute, { useValue: editRouteStub });
    const fixture = TestBed.createComponent(EditSouthComponent);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('#south-name')).toHaveValue(southConnector.name);
  });

  test('deleteGroup should confirm, unassign items referencing the group, and refresh the item list', () => {
    const groupA = buildGroup('group1', 'GroupA', scanModes[0]);
    const itemWithGroup = { ...southConnector.items[0], group: groupA, syncWithGroup: true };
    const southConnectorWithGroup = { ...southConnector, groups: [groupA], items: [itemWithGroup, southConnector.items[1]] };
    southConnectorService.findById.mockReturnValue(of(southConnectorWithGroup as any));
    confirmationService.confirm.mockReturnValue(of(undefined));
    TestBed.overrideProvider(ActivatedRoute, { useValue: editRouteStub });

    const fixture = TestBed.createComponent(EditSouthComponent);
    fixture.detectChanges();

    const inMemoryGroup = fixture.componentInstance.inMemoryGroups.find(group => group.id === 'group1')!;
    fixture.componentInstance.deleteGroup(inMemoryGroup).subscribe();

    expect(confirmationService.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ messageKey: 'south.groups.confirm-deletion', interpolateParams: { name: 'GroupA' } })
    );
    const unassignedItem = fixture.componentInstance.inMemoryItems.find(item => item.id === itemWithGroup.id)!;
    expect(unassignedItem.groupId).toBeNull();
    expect(unassignedItem.groupName).toBeNull();
    expect(unassignedItem.syncWithGroup).toBe(false);
    expect(fixture.componentInstance.filteredItems.find(item => item.id === itemWithGroup.id)?.groupId).toBeNull();
  });

  test('deleteGroup should fill empty scan mode and history fields on items that were inheriting from the group', () => {
    const groupA = buildGroup('group1', 'GroupA', scanModes[0]);
    const itemWithEmptyFields = {
      ...southConnector.items[0],
      group: groupA,
      syncWithGroup: true,
      scanMode: null,
      maxReadInterval: null,
      readDelay: null,
      overlap: null
    };
    const southConnectorWithGroup = { ...southConnector, groups: [groupA], items: [itemWithEmptyFields, southConnector.items[1]] };
    southConnectorService.findById.mockReturnValue(of(southConnectorWithGroup as any));
    confirmationService.confirm.mockReturnValue(of(undefined));
    TestBed.overrideProvider(ActivatedRoute, { useValue: editRouteStub });

    const fixture = TestBed.createComponent(EditSouthComponent);
    fixture.detectChanges();

    const inMemoryGroup = fixture.componentInstance.inMemoryGroups.find(group => group.id === 'group1')!;
    fixture.componentInstance.deleteGroup(inMemoryGroup).subscribe();

    const unassignedItem = fixture.componentInstance.inMemoryItems.find(item => item.id === itemWithEmptyFields.id)!;
    expect(unassignedItem.scanModeId).toBe(scanModes[0].id);
    expect(unassignedItem.overlap).toBe(0);
    expect(unassignedItem.maxReadInterval).toBe(3600);
    expect(unassignedItem.readDelay).toBe(200);
  });

  test('deleteGroup should not overwrite an item own scan mode and history fields', () => {
    const groupA = buildGroup('group1', 'GroupA', scanModes[0]);
    const itemWithOwnFields = {
      ...southConnector.items[0],
      group: groupA,
      syncWithGroup: false,
      scanMode: scanModes[1],
      maxReadInterval: 60,
      readDelay: 50,
      overlap: 10
    };
    const southConnectorWithGroup = { ...southConnector, groups: [groupA], items: [itemWithOwnFields, southConnector.items[1]] };
    southConnectorService.findById.mockReturnValue(of(southConnectorWithGroup as any));
    confirmationService.confirm.mockReturnValue(of(undefined));
    TestBed.overrideProvider(ActivatedRoute, { useValue: editRouteStub });

    const fixture = TestBed.createComponent(EditSouthComponent);
    fixture.detectChanges();

    const inMemoryGroup = fixture.componentInstance.inMemoryGroups.find(group => group.id === 'group1')!;
    fixture.componentInstance.deleteGroup(inMemoryGroup).subscribe();

    const unassignedItem = fixture.componentInstance.inMemoryItems.find(item => item.id === itemWithOwnFields.id)!;
    expect(unassignedItem.scanModeId).toBe(scanModes[1].id);
    expect(unassignedItem.overlap).toBe(10);
    expect(unassignedItem.maxReadInterval).toBe(60);
    expect(unassignedItem.readDelay).toBe(50);
  });

  test('manageGroups should open the manage groups modal with in-memory groups and items', () => {
    const groupA = buildGroup('group1', 'GroupA', scanModes[0]);
    const itemWithGroup = { ...southConnector.items[0], group: groupA };
    const southConnectorWithGroup = { ...southConnector, groups: [groupA], items: [itemWithGroup, southConnector.items[1]] };
    southConnectorService.findById.mockReturnValue(of(southConnectorWithGroup as any));
    TestBed.overrideProvider(ActivatedRoute, { useValue: editRouteStub });

    const prepare = vi.fn();
    modalService.open.mockReturnValue({ componentInstance: { prepare }, result: of(undefined) } as any);

    const fixture = TestBed.createComponent(EditSouthComponent);
    fixture.detectChanges();

    fixture.componentInstance.manageGroups();

    expect(modalService.open).toHaveBeenCalledWith(ManageGroupsModalComponent, expect.anything());
    expect(prepare).toHaveBeenCalledWith(
      fixture.componentInstance.inMemoryGroups,
      scanModes,
      manifest,
      false,
      expect.any(Function),
      expect.any(Function),
      expect.any(Function)
    );
    const getItemCount = prepare.mock.calls[0][4];
    expect(getItemCount('group1')).toBe(1);
  });
});
