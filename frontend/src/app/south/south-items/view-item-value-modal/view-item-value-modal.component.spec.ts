import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { SouthItemLastValue } from '@oibus/shared/domain/south-connector.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { ViewItemValueModalComponent } from './view-item-value-modal.component';

class ViewItemValueModalComponentTester {
  readonly fixture = TestBed.createComponent(ViewItemValueModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly spinner = this.root.getByRole('status');
  readonly error = this.root.getByRole('alert');
  readonly rows = this.root.getByCss('.container-fluid > .row');
  readonly fileRows = this.root.getByCss('tbody tr');
  readonly groupSection = this.root.getByRole('heading', { name: 'Group last tracked value' });
  readonly closeButton = this.root.getByRole('button', { name: 'Close' });

  constructor() {
    this.fixture.componentInstance.prepare('folder-scanner', 'item1', 'GroupA');
  }

  readonly itemName = this.rows.nth(0);
  readonly groupName = this.rows.nth(1);
  readonly queryTime = this.rows.nth(2);
  readonly trackedInstant = this.rows.nth(3);
  readonly value = this.rows.nth(4);
}

function buildLastValue(overrides: Partial<SouthItemLastValue> = {}): SouthItemLastValue {
  return {
    itemId: 'id1',
    itemName: 'item1',
    groupId: null,
    groupName: '',
    queryTime: '2024-01-01T12:00:00.000Z',
    value: { temperature: 21 },
    trackedInstant: '2024-01-02T12:00:00.000Z',
    ...overrides
  };
}

describe('ViewItemValueModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: activeModal }]
    });
  });

  test('should display a spinner until the data arrives', async () => {
    const tester = new ViewItemValueModalComponentTester();

    await expect.element(tester.spinner).toBeVisible();
    await expect.element(tester.rows).toHaveLength(0);
  });

  test('should display the item last value', async () => {
    const tester = new ViewItemValueModalComponentTester();

    tester.fixture.componentInstance.setData({ itemLastValue: buildLastValue(), groupLastValue: null });

    await expect.element(tester.spinner).not.toBeInTheDocument();
    await expect.element(tester.itemName).toHaveTextContent('Item Nameitem1');
    await expect.element(tester.groupName).toHaveTextContent('GroupGroupA');
    await expect.element(tester.queryTime).toMatchTextContent('Jan 1, 2024');
    await expect.element(tester.trackedInstant).toMatchTextContent('Jan 2, 2024');
    await expect.element(tester.value).toMatchTextContent('"temperature": 21');
    await expect.element(tester.fileRows).toHaveLength(0);
    await expect.element(tester.groupSection).not.toBeInTheDocument();
  });

  test('should display placeholders when nothing is cached', async () => {
    const tester = new ViewItemValueModalComponentTester();

    tester.fixture.componentInstance.setData({
      itemLastValue: buildLastValue({ queryTime: null, trackedInstant: null, value: null }),
      groupLastValue: null
    });

    await expect.element(tester.queryTime).toHaveTextContent('Last Query TimeNo cached value');
    await expect.element(tester.trackedInstant).toHaveTextContent('Tracked Instant-');
    await expect.element(tester.value).toHaveTextContent('Cached ValueNo cached value');
  });

  test('should display placeholders when the item has no last value', async () => {
    const tester = new ViewItemValueModalComponentTester();

    tester.fixture.componentInstance.setData({ itemLastValue: null, groupLastValue: null });

    await expect.element(tester.queryTime).toHaveTextContent('Last Query TimeNo cached value');
    await expect.element(tester.value).toHaveTextContent('Cached ValueNo cached value');
  });

  test('should display the tracked files in a table', async () => {
    const tester = new ViewItemValueModalComponentTester();

    tester.fixture.componentInstance.setData({
      itemLastValue: buildLastValue({
        value: [
          { filename: 'file1.csv', modifiedTime: Date.parse('2024-01-03T12:00:00.000Z') },
          { filename: 'file2.csv', modifiedTime: Date.parse('2024-01-04T12:00:00.000Z') }
        ]
      }),
      groupLastValue: null
    });

    await expect.element(tester.fileRows).toHaveLength(2);
    await expect.element(tester.fileRows.nth(0)).toMatchTextContent('file1.csv');
    await expect.element(tester.fileRows.nth(0)).toMatchTextContent('Jan 3, 2024');
    await expect.element(tester.fileRows.nth(1)).toMatchTextContent('file2.csv');
    await expect.element(tester.root.getByText('2 file(s) tracked')).toBeVisible();
    await expect.element(tester.root.getByCss('pre')).not.toBeInTheDocument();
  });

  test('should display an array of values which are not files as JSON', async () => {
    const tester = new ViewItemValueModalComponentTester();

    tester.fixture.componentInstance.setData({ itemLastValue: buildLastValue({ value: ['a', 'b'] }), groupLastValue: null });

    await expect.element(tester.root.getByCss('pre')).toMatchTextContent('"a"');
    await expect.element(tester.fileRows).toHaveLength(0);
  });

  test('should display the group section when the item belongs to a group', async () => {
    const tester = new ViewItemValueModalComponentTester();

    tester.fixture.componentInstance.setData({
      itemLastValue: buildLastValue({ groupId: 'group1', groupName: 'GroupA' }),
      groupLastValue: buildLastValue({ groupId: 'group1', groupName: 'GroupA', trackedInstant: '2024-01-05T12:00:00.000Z', value: 'group' })
    });

    await expect.element(tester.groupSection).toBeVisible();
    const groupRows = tester.root.getByCss('h6 ~ .row');
    await expect.element(groupRows.nth(0)).toMatchTextContent('Jan 5, 2024');
    await expect.element(groupRows.nth(1)).toMatchTextContent('"group"');
  });

  test('should display placeholders in the group section when the group has no value', async () => {
    const tester = new ViewItemValueModalComponentTester();

    tester.fixture.componentInstance.setData({
      itemLastValue: buildLastValue({ groupId: 'group1', groupName: 'GroupA' }),
      groupLastValue: buildLastValue({ groupId: 'group1', groupName: 'GroupA', trackedInstant: null, value: null })
    });

    const groupRows = tester.root.getByCss('h6 ~ .row');
    await expect.element(groupRows.nth(0)).toHaveTextContent('Tracked Instant-');
    await expect.element(groupRows.nth(1)).toHaveTextContent('Cached ValueNo cached value');
  });

  test('should display an error', async () => {
    const tester = new ViewItemValueModalComponentTester();

    tester.fixture.componentInstance.setError('boom');

    await expect.element(tester.error).toHaveTextContent('Could not retrieve the last cached valueboom');
    await expect.element(tester.spinner).not.toBeInTheDocument();
    await expect.element(tester.rows).toHaveLength(0);
  });

  test.each([0, 1])('should dismiss the modal with the close button %i', async index => {
    const tester = new ViewItemValueModalComponentTester();

    await tester.closeButton.nth(index).click();

    expect(activeModal.dismiss).toHaveBeenCalled();
  });
});
