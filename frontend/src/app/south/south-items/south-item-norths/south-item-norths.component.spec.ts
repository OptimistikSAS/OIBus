import { TestBed } from '@angular/core/testing';

import { of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { NorthConnectorDTO } from '@oibus/shared/api/north-connector.model';
import { SouthConnectorItemCommandDTO, SouthItemNorthTransformerCommandDTO } from '@oibus/shared/api/south-connector.model';
import { SourceOriginSouthDTO, TransformerDTOWithOptions } from '@oibus/shared/api/transformer.model';
import { OIBusNorthType } from '@oibus/shared/connector/north-manifest.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import testData from '../../../../test/test-data';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { EngineService } from '../../../services/engine.service';
import { HistoryQueryService } from '../../../services/history-query.service';
import { NorthConnectorService } from '../../../services/north-connector.service';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { TransformerService } from '../../../services/transformer.service';
import { provideCurrentUser } from '../../../shared/current-user-testing';
import { RoutedSouthItem, SouthItemNorthsComponent } from './south-item-norths.component';

const southId = testData.south.list[0].id;
const [north1, north2] = testData.north.list;
const fileTransformer = testData.transformers.customList[1];
// North 1 sends item1 through "my transformer 1", attached to it
const southSource = north1.transformers[0].source as SourceOriginSouthDTO;
const item1: RoutedSouthItem = {
  id: 'southItemId1',
  name: 'item1',
  settings: testData.south.itemCommand.settings,
  groupId: null,
  groupName: null
};
const item2: RoutedSouthItem = { ...item1, id: 'southItemId2', name: 'item2', groupId: 'group1', groupName: 'GroupA' };
const otherItems: Array<SouthConnectorItemCommandDTO> = [
  { ...testData.south.itemCommand, id: 'southItemId3', name: 'item3', groupId: 'group1', groupName: 'GroupA' },
  { ...testData.south.itemCommand, id: 'southItemId4', name: 'item4', groupId: null, groupName: null }
];

/** A transformer of a North applying to all the items of the tested south, or of a group of it */
const southTransformer = (id: string, groupId?: string): TransformerDTOWithOptions => ({
  id,
  transformer: fileTransformer,
  options: {},
  source: { ...southSource, items: [], group: groupId ? { id: groupId, name: 'GroupA' } : undefined }
});

class SouthItemNorthsComponentTester {
  readonly fixture = TestBed.createComponent(SouthItemNorthsComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly norths = this.root.getByRole('listitem');
  readonly detail = this.root.getByCss('#north-detail');
  readonly noNorth = this.root.getByCss('#no-north');
  readonly attachButton = this.root.getByRole('button', { name: 'Attach a transformer' });
  readonly attachOtherButton = this.root.getByRole('button', { name: 'Send through another transformer' });
  readonly addButton = this.root.getByRole('button', { name: 'Attach', exact: true });
  readonly updateButton = this.root.getByRole('button', { name: 'Update', exact: true });
  readonly cancelButton = this.root.getByCss('#attachment-form').getByRole('button', { name: 'Cancel' });
  readonly editButton = this.root.getByRole('button', { name: 'Edit', exact: true });
  readonly removeButton = this.root.getByRole('button', { name: 'Delete', exact: true });
  readonly itemScope = this.root.getByRole('radio', { name: 'This item' });
  readonly groupScope = this.root.getByRole('radio', { name: 'Its group (GroupA)' });
  readonly southScope = this.root.getByRole('radio', { name: 'All the items of the south' });
  readonly impact = this.root.getByCss('#attachment-impact');
  readonly takesOver = this.root.getByCss('#attachment-takes-over');
  readonly test = this.root.getByCss('#north-test');

  constructor(options: { item?: RoutedSouthItem; editable?: boolean; attachments?: Array<SouthItemNorthTransformerCommandDTO> } = {}) {
    this.fixture.componentRef.setInput('southId', southId);
    this.fixture.componentRef.setInput('item', options.item ?? item1);
    this.fixture.componentRef.setInput('connectorCommand', testData.south.command);
    this.fixture.componentRef.setInput('manifest', testData.south.manifest);
    this.fixture.componentRef.setInput('items', [options.item ?? item1, ...otherItems]);
    this.fixture.componentRef.setInput('editable', options.editable ?? true);
    this.fixture.componentRef.setInput('attachments', options.attachments ?? []);
  }

  north(name: string) {
    return this.norths.filter({ hasText: name });
  }

  transformerCard(name: string) {
    return this.root.getByRole('radio', { name: new RegExp(`^${name}`) });
  }

  get attachments() {
    return this.fixture.componentInstance.attachments();
  }
}

describe('SouthItemNorthsComponent', () => {
  let northConnectorService: MockObject<NorthConnectorService>;
  let norths: Array<NorthConnectorDTO>;

  beforeEach(() => {
    norths = [north1, north2];
    northConnectorService = createMock(NorthConnectorService);
    northConnectorService.list.mockImplementation(() =>
      of(testData.north.listLight.filter(light => norths.some(north => north.id === light.id)))
    );
    northConnectorService.findById.mockImplementation((northId: string) => of(norths.find(north => north.id === northId)!));
    northConnectorService.getNorthManifest.mockImplementation((type: OIBusNorthType) => of({ ...testData.north.manifest, id: type }));
    const transformerService = createMock(TransformerService);
    transformerService.list.mockReturnValue(of(testData.transformers.customList));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideCurrentUser(),
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: TransformerService, useValue: transformerService },
        { provide: SouthConnectorService, useValue: createMock(SouthConnectorService) },
        { provide: HistoryQueryService, useValue: createMock(HistoryQueryService) },
        { provide: EngineService, useValue: createMock(EngineService, { getInfo: () => of(testData.engine.oIBusInfo) }) }
      ]
    });
  });

  test('should list the norths with the transformer the item is sent through', async () => {
    const tester = new SouthItemNorthsComponentTester();

    await expect.element(tester.norths).toHaveLength(2);
    await expect.element(tester.north('North 1')).toMatchTextContent(/my transformer 1this item/);
    await expect.element(tester.north('North 2')).toMatchTextContent(/North 2DisabledNot sent/);
    await expect.element(tester.north('North 1')).toHaveAttribute('aria-current', 'true');
  });

  test('should show the transformer of the item, and test the item through it', async () => {
    const tester = new SouthItemNorthsComponentTester();

    await expect.element(tester.detail).toMatchTextContent(/Sent through\s*my transformer 1/);
    await expect.element(tester.detail).toMatchTextContent(/Attached to this item/);
    // a transformer attached to the item is changed from the North
    await expect.element(tester.root.getByCss('#routed-by-item')).toBeVisible();
    await expect.element(tester.attachButton).not.toBeInTheDocument();
    await expect.element(tester.test.getByCss('.pipeline-transformer')).toHaveTextContent('my transformer 1');
  });

  test('should show a north the item is not sent to, without testing it', async () => {
    const tester = new SouthItemNorthsComponentTester();

    await tester.north('North 2').click();

    await expect.element(tester.root.getByCss('#route-not-sent')).toMatchTextContent(/The data of this item is not sent to this north/);
    await expect.element(tester.test).not.toBeInTheDocument();
  });

  test('should attach a transformer to the item, tested before it is added', async () => {
    const tester = new SouthItemNorthsComponentTester();
    await tester.north('North 2').click();

    await tester.attachButton.click();
    // the item has no group: its transformer applies to it, or to all the items of the south
    await expect.element(tester.itemScope).toBeChecked();
    await expect.element(tester.southScope).toBeInTheDocument();
    await expect.element(tester.groupScope).not.toBeInTheDocument();
    // the transformers taking the files of the south and giving a type the North accepts
    await expect.element(tester.transformerCard('my transformer 2')).toBeInTheDocument();
    await expect.element(tester.transformerCard('my transformer 1')).not.toBeInTheDocument();

    await tester.addButton.click();
    await expect.element(tester.root.getByText('Choose a transformer')).toBeVisible();
    expect(tester.attachments).toEqual([]);

    await tester.transformerCard('my transformer 2').click();
    await expect.element(tester.test.getByCss('.pipeline-transformer')).toHaveTextContent('my transformer 2');
    await tester.addButton.click();

    expect(tester.attachments).toEqual([{ northId: 'northId2', scope: 'item', transformerId: 'transformerId2', options: {} }]);
    await expect.element(tester.north('North 2')).toMatchTextContent(/my transformer 2New/);
    await expect.element(tester.detail).toMatchTextContent(/Attached to this item/);
    await expect.element(tester.detail).toMatchTextContent(/Attached when the item is saved/);
  });

  test('should tell how many other items a transformer of the whole south also sends', async () => {
    const tester = new SouthItemNorthsComponentTester();
    await tester.north('North 2').click();
    await tester.attachButton.click();

    await tester.southScope.click();

    await expect.element(tester.impact).toMatchTextContent(/Also sends 2 other item\(s\) not sent to this north yet/);
  });

  test('should attach a transformer to the group of the item', async () => {
    const tester = new SouthItemNorthsComponentTester({ item: item2 });
    await tester.north('North 2').click();
    await tester.attachButton.click();

    await tester.groupScope.click();
    await expect.element(tester.impact).toMatchTextContent(/Also sends 1 other item\(s\) not sent to this north yet/);
    await tester.transformerCard('my transformer 2').click();
    await tester.addButton.click();

    expect(tester.attachments).toEqual([{ northId: 'northId2', scope: 'group', transformerId: 'transformerId2', options: {} }]);
    await expect.element(tester.detail).toMatchTextContent(/Attached to its group \(GroupA\)/);
  });

  test('should only offer the scopes taking over the transformer of the item', async () => {
    norths = [{ ...north1, transformers: [southTransformer('south')] }];
    const tester = new SouthItemNorthsComponentTester({ item: item2 });
    await expect.element(tester.detail).toMatchTextContent(/Attached to all the items of the south/);

    await tester.attachOtherButton.click();

    await expect.element(tester.itemScope).toBeInTheDocument();
    await expect.element(tester.groupScope).toBeInTheDocument();
    await expect.element(tester.southScope).not.toBeInTheDocument();
    await expect.element(tester.takesOver).toMatchTextContent(/It takes over the current transformer of this item\./);
  });

  test('should only offer the item scope over a transformer of its group', async () => {
    norths = [{ ...north1, transformers: [southTransformer('group', 'group1')] }];
    const tester = new SouthItemNorthsComponentTester({ item: item2 });
    await expect.element(tester.north('North 1')).toMatchTextContent(/my transformer 2group/);

    await tester.attachOtherButton.click();

    await expect.element(tester.itemScope).toBeInTheDocument();
    await expect.element(tester.groupScope).not.toBeInTheDocument();
  });

  test('should edit and remove a transformer to attach', async () => {
    const tester = new SouthItemNorthsComponentTester({
      attachments: [{ northId: 'northId2', scope: 'south', transformerId: 'transformerId2', options: {} }]
    });
    await tester.north('North 2').click();
    await expect.element(tester.detail).toMatchTextContent(/Attached to all the items of the south/);

    await tester.editButton.click();
    await expect.element(tester.southScope).toBeChecked();
    await expect.element(tester.transformerCard('my transformer 2')).toHaveAttribute('aria-checked', 'true');
    await tester.itemScope.click();
    await tester.updateButton.click();
    expect(tester.attachments).toEqual([{ northId: 'northId2', scope: 'item', transformerId: 'transformerId2', options: {} }]);

    await tester.editButton.click();
    await tester.cancelButton.click();
    await tester.removeButton.click();

    expect(tester.attachments).toEqual([]);
    await expect.element(tester.north('North 2')).toMatchTextContent(/Not sent/);
  });

  test('should cancel the transformer being attached when another north is selected', async () => {
    const tester = new SouthItemNorthsComponentTester();
    await tester.north('North 2').click();
    await tester.attachButton.click();

    await tester.north('North 1').click();
    await tester.north('North 2').click();

    await expect.element(tester.root.getByCss('#attachment-form')).not.toBeInTheDocument();
    await expect.element(tester.attachButton).toBeVisible();
  });

  test('should only show where the data goes when not editable', async () => {
    const tester = new SouthItemNorthsComponentTester({ editable: false });

    await tester.north('North 2').click();

    await expect.element(tester.root.getByCss('#route-not-sent')).toBeVisible();
    await expect.element(tester.attachButton).not.toBeInTheDocument();
  });

  test('should tell when there is no north', async () => {
    norths = [];
    const tester = new SouthItemNorthsComponentTester();

    await expect.element(tester.noNorth).toHaveTextContent('There is no north connector to send the data of this item to.');
  });

  test('should sum the transformers to attach up', async () => {
    const tester = new SouthItemNorthsComponentTester({
      attachments: [{ northId: 'northId2', scope: 'item', transformerId: 'transformerId2', options: {} }]
    });
    await expect.element(tester.north('North 2')).toMatchTextContent(/my transformer 2New/);

    expect(tester.fixture.componentInstance.attachmentSummaries()).toEqual([
      { northId: 'northId2', northName: 'North 2', transformerName: 'my transformer 2', scope: 'this item' }
    ]);
  });
});
