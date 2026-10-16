import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { NEVER, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { SouthConnectorItemCommandDTO } from '@oibus/shared/api/south-connector.model';
import { SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';
import { SouthFolderScannerItemSettings } from '@oibus/shared/connector/south-settings.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { buildSouthItemGroup } from '../../../../test/builders';
import testData from '../../../../test/test-data';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { fakeSouthItemGroups } from '../south-item-groups.testing';
import { AddDiscoveredItemsModalComponent, AddDiscoveredItemsOptions } from './add-discovered-items-modal.component';

class AddDiscoveredItemsModalComponentTester {
  readonly fixture = TestBed.createComponent(AddDiscoveredItemsModalComponent);
  readonly component = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly spinner = this.root.getByRole('status');
  readonly error = this.root.getByCss('#discovered-items-error');
  readonly empty = this.root.getByCss('#discovered-items-empty');
  readonly rows = this.root.getByCss('#discovered-items-table tbody tr');
  readonly headers = this.root.getByCss('#discovered-items-table thead th');
  readonly names = this.root.getByCss('.discovered-item-name');
  readonly included = this.root.getByCss('.discovered-item-included');
  readonly selectAll = this.root.getByCss('#discovered-items-all');
  readonly group = this.root.getByCss('#discovered-items-group');
  readonly scanMode = this.root.getByCss('#discovered-items-scan-mode');
  readonly enabled = this.root.getByCss('#discovered-items-enabled');
  readonly count = this.root.getByCss('#discovered-items-count');
  readonly addButton = this.root.getByCss('#add-discovered-items');
}

const scanModes = testData.scanMode.list;
const manifest: SouthConnectorManifest = {
  ...testData.south.manifest,
  discovery: { kind: 'tree', defaults: { identityKeyFields: ['id'], itemFieldMapping: { name: '{{path}}', 'settings.regex': '{{id}}' } } }
};

function discovered(name: string, regex: string): SouthConnectorItemCommandDTO {
  const command = testData.south.itemCommand;
  return { ...command, id: null, name, scanModeId: null, settings: { ...(command.settings as SouthFolderScannerItemSettings), regex } };
}

describe('AddDiscoveredItemsModalComponent', () => {
  let tester: AddDiscoveredItemsModalComponentTester;
  let activeModal: MockObject<NgbActiveModal>;
  let southConnectorService: MockObject<SouthConnectorService>;
  const groups = fakeSouthItemGroups([buildSouthItemGroup('group1', 'Group 1')]);

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    southConnectorService = createMock(SouthConnectorService);
    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: SouthConnectorService, useValue: southConnectorService }
      ]
    });
    tester = new AddDiscoveredItemsModalComponentTester();
  });

  function prepare(options: Partial<AddDiscoveredItemsOptions> = {}) {
    tester.component.prepare({
      southId: 'southId1',
      southSettings: testData.south.list[0].settings,
      manifest,
      scanModes,
      groups,
      existingItems: [],
      nodeIds: ['folder'],
      ...options
    });
  }

  function addedCommands(): Array<SouthConnectorItemCommandDTO> {
    return activeModal.close.mock.lastCall![0];
  }

  test('should discover the checked nodes with the connector discovery defaults', async () => {
    southConnectorService.discoverItems.mockReturnValue(NEVER);

    prepare();

    await expect.element(tester.spinner).toBeInTheDocument();
    expect(southConnectorService.discoverItems).toHaveBeenCalledWith(
      'southId1',
      manifest.id,
      testData.south.list[0].settings,
      { nodeIds: ['folder'] },
      { name: '{{path}}', 'settings.regex': '{{id}}' }
    );
  });

  test('should show why the discovery failed', async () => {
    southConnectorService.discoverItems.mockReturnValue(throwError(() => new HttpErrorResponse({ error: { message: 'unreachable' } })));

    prepare();

    await expect.element(tester.error).toMatchTextContent(/unreachable$/);
  });

  test('should say when there is nothing to add', async () => {
    southConnectorService.discoverItems.mockReturnValue(of([]));

    prepare();

    await expect.element(tester.empty).toMatchTextContent(/^Nothing to add/);
  });

  test('should list the items with the settings that tell them apart, all included', async () => {
    southConnectorService.discoverItems.mockReturnValue(of([discovered('folder/a', 'a.csv'), discovered('folder/b', 'b.csv')]));

    prepare();

    await expect.element(tester.rows).toHaveLength(2);
    await expect.element(tester.names.nth(0)).toHaveValue('folder/a');
    // the include checkbox, the name, the regex - the only setting that differs - and the status column
    await expect.element(tester.headers).toHaveLength(4);
    await expect.element(tester.rows.nth(1)).toMatchTextContent('b.csv');
    await expect.element(tester.count).toHaveTextContent('Selected items: 2 of 2');
  });

  test('should skip by default what an item already reads, and refuse a name an item already has', async () => {
    southConnectorService.discoverItems.mockReturnValue(of([discovered('folder/a', 'a.csv'), discovered('folder/b', 'b.csv')]));

    prepare({
      existingItems: [
        { name: 'existing', settings: discovered('', 'a.csv').settings },
        { name: 'folder/b', settings: discovered('', 'other').settings }
      ]
    });
    await tester.scanMode.selectOptions(scanModes[0].name);

    await expect.element(tester.included.nth(0)).not.toBeChecked();
    await expect.element(tester.rows.nth(0)).toMatchTextContent('Already read by existing');
    await expect.element(tester.rows.nth(1)).toMatchTextContent('Name already used');
    await expect.element(tester.addButton).toBeDisabled();

    await tester.names.nth(1).fill('folder/b2');

    await expect.element(tester.addButton).toHaveTextContent('Add items (1)');
    await tester.addButton.click();
    expect(addedCommands().map(command => command.name)).toEqual(['folder/b2']);
  });

  test('should refuse the same name twice among the added items', async () => {
    southConnectorService.discoverItems.mockReturnValue(of([discovered('same', 'a.csv'), discovered('same', 'b.csv')]));

    prepare();
    await tester.scanMode.selectOptions(scanModes[0].name);

    await expect.element(tester.root.getByText('Name already used')).toHaveLength(2);
    await expect.element(tester.addButton).toBeDisabled();
    await tester.included.nth(1).click();
    await expect.element(tester.addButton).toBeEnabled();
  });

  test('should add the included items with the schedule picked, enabled or not', async () => {
    southConnectorService.discoverItems.mockReturnValue(of([discovered('folder/a', 'a.csv'), discovered('folder/b', 'b.csv')]));
    prepare();
    await expect.element(tester.addButton).toBeDisabled();

    await tester.scanMode.selectOptions(scanModes[0].name);
    await tester.enabled.click();
    await tester.included.nth(0).click();
    await tester.addButton.click();

    expect(addedCommands()).toEqual([
      {
        ...discovered('folder/b', 'b.csv'),
        enabled: false,
        scanModeId: scanModes[0].id,
        scanModeName: scanModes[0].name,
        groupId: null,
        groupName: null,
        syncWithGroup: false
      }
    ]);
  });

  test('should add the items to the group picked, following its schedule', async () => {
    southConnectorService.discoverItems.mockReturnValue(of([discovered('folder/a', 'a.csv')]));
    prepare();

    await tester.group.selectOptions('Group 1');
    await expect.element(tester.scanMode).toHaveTextContent('From the group');
    await tester.addButton.click();

    expect(addedCommands()[0]).toEqual(
      expect.objectContaining({ groupId: 'group1', groupName: 'Group 1', syncWithGroup: true, scanModeId: null, scanModeName: null })
    );
  });

  test('should include or exclude every item at once', async () => {
    southConnectorService.discoverItems.mockReturnValue(of([discovered('folder/a', 'a.csv'), discovered('folder/b', 'b.csv')]));
    prepare();
    await expect.element(tester.selectAll).toBeChecked();

    await tester.selectAll.click();

    await expect.element(tester.count).toHaveTextContent('Selected items: 0 of 2');
    await tester.selectAll.click();
    await expect.element(tester.count).toHaveTextContent('Selected items: 2 of 2');
  });

  test('should dismiss on cancel', async () => {
    southConnectorService.discoverItems.mockReturnValue(of([]));
    prepare();

    await tester.root.getByCss('#cancel-button').click();

    expect(activeModal.dismiss).toHaveBeenCalled();
  });
});
