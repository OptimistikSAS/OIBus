import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { of } from 'rxjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { SouthConnectorLightDTO } from '@oibus/shared/api/south-connector.model';

import { provideI18nTesting } from '../../i18n/mock-i18n';
import testData from '../../test/test-data';
import { createMock, MockObject } from '../../test/vitest-create-mock';
import { SouthConnectorService } from '../services/south-connector.service';
import { AuditHistoryModalComponent } from '../shared/audit-history-modal/audit-history-modal.component';
import { ConfirmationService } from '../shared/confirmation.service';
import { MockModalService, provideModalTesting } from '../shared/mock-modal.service.testing';
import { NotificationService } from '../shared/notification.service';
import { ChooseSouthConnectorTypeModalComponent } from './choose-south-connector-type-modal/choose-south-connector-type-modal.component';
import { SouthListComponent } from './south-list.component';

// South 1 (folder-scanner, enabled), South 2 (mssql, disabled), South 3 (opcua, enabled)
const southConnectors = testData.south.listLight;

class SouthListComponentTester {
  readonly fixture = TestBed.createComponent(SouthListComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly rows = this.root.getByCss('tbody tr');
  readonly names = this.root.getByCss('tbody tr td:nth-child(2)');
  readonly createButton = this.root.getByRole('button', { name: 'Create a new south connector' });
  readonly searchName = this.root.getByLabelText('Name');
  readonly sortByName = this.root.getByRole('button', { name: 'Name' });
  readonly sortByType = this.root.getByRole('button', { name: 'Type' });
  readonly enabledChip = this.root.getByRole('button', { name: 'Enabled', exact: true });
  readonly disabledChip = this.root.getByRole('button', { name: 'Disabled', exact: true });
  readonly clearEnabledStates = this.root.getByCss('#clear-enabled-states-button');
  readonly clearTypes = this.root.getByCss('#clear-types-button');
  readonly empty = this.root.getByText('No south connector matches the search');
  readonly pagination = this.root.getByCss('oib-pagination');

  row(index: number) {
    return this.rows.nth(index);
  }

  typeChip(label: string) {
    return this.root.getByRole('button', { name: label, exact: true });
  }
}

function buildSouths(count: number): Array<SouthConnectorLightDTO> {
  return Array.from({ length: count }, (_, index) => ({
    ...southConnectors[0],
    id: `south${index}`,
    name: `South ${String(index).padStart(2, '0')}`
  }));
}

describe('SouthListComponent', () => {
  let southConnectorService: MockObject<SouthConnectorService>;
  let notificationService: MockObject<NotificationService>;
  let confirmationService: MockObject<ConfirmationService>;
  let modalService: MockModalService<AuditHistoryModalComponent | ChooseSouthConnectorTypeModalComponent>;

  beforeEach(() => {
    southConnectorService = createMock(SouthConnectorService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);

    southConnectorService.list.mockReturnValue(of(southConnectors));
    southConnectorService.start.mockReturnValue(of(undefined));
    southConnectorService.stop.mockReturnValue(of(undefined));
    southConnectorService.delete.mockReturnValue(of(undefined));
    confirmationService.confirm.mockReturnValue(of(undefined));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        provideModalTesting(),
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });
    modalService = TestBed.inject(MockModalService);
  });

  test('should display the connectors sorted by name', async () => {
    const tester = new SouthListComponentTester();

    await expect.element(tester.rows).toHaveLength(southConnectors.length);
    await expect.element(tester.row(0)).toMatchTextContent('South 1');
    await expect.element(tester.row(0)).toMatchTextContent('Folder scanner');
    await expect.element(tester.row(0)).toMatchTextContent('my folder scanner');
    await expect.element(tester.row(2)).toMatchTextContent('South 3');
    await expect.element(tester.row(0).getByRole('link', { name: 'Edit south connector' })).toHaveAttribute('href', '/southId1/edit');
    await expect.element(tester.row(0).getByRole('link', { name: 'View south connector details' })).toHaveAttribute('href', '/southId1');
    await expect
      .element(tester.row(0).getByRole('link', { name: 'Duplicate south connector' }))
      .toHaveAttribute('href', '/create?duplicate=southId1');
  });

  test('should display a caption when there is no connector', async () => {
    southConnectorService.list.mockReturnValue(of([]));
    const tester = new SouthListComponentTester();

    await expect.element(tester.empty).toBeVisible();
    await expect.element(tester.rows).toHaveLength(0);
  });

  test.each([
    { south: southConnectors[0], button: 'Stop south connector', method: 'stop', message: 'south.stopped' },
    { south: southConnectors[1], button: 'Start south connector', method: 'start', message: 'south.started' }
  ] as const)('should $method a connector and reload the list', async ({ south, button, method, message }) => {
    const tester = new SouthListComponentTester();
    const row = tester.row(southConnectors.indexOf(south));
    await expect.element(tester.rows).toHaveLength(southConnectors.length);
    southConnectorService.list.mockReturnValue(of(southConnectors.map(s => (s.id === south.id ? { ...s, enabled: !s.enabled } : s))));

    await row.getByRole('button', { name: button }).click();

    expect(southConnectorService[method]).toHaveBeenCalledWith(south.id);
    expect(notificationService.success).toHaveBeenCalledWith(message, { name: south.name });
    expect(southConnectorService.list).toHaveBeenCalledTimes(2);
    const otherButton = button === 'Stop south connector' ? 'Start south connector' : 'Stop south connector';
    await expect.element(row.getByRole('button', { name: otherButton })).toBeVisible();
  });

  test('should delete a connector after confirmation and reload the list', async () => {
    const tester = new SouthListComponentTester();
    await expect.element(tester.rows).toHaveLength(3);
    southConnectorService.list.mockReturnValue(of(southConnectors.slice(1)));

    await tester.row(0).getByRole('button', { name: 'Delete south connector' }).click();

    expect(confirmationService.confirm).toHaveBeenCalledWith({
      messageKey: 'south.confirm-deletion',
      interpolateParams: { name: 'South 1' }
    });
    expect(southConnectorService.delete).toHaveBeenCalledWith('southId1');
    expect(notificationService.success).toHaveBeenCalledWith('south.deleted', { name: 'South 1' });
    await expect.element(tester.rows).toHaveLength(2);
    await expect.element(tester.row(0)).toMatchTextContent('South 2');
  });

  test('should not delete a connector if not confirmed', async () => {
    confirmationService.confirm.mockReturnValue(of());
    const tester = new SouthListComponentTester();

    await tester.row(0).getByRole('button', { name: 'Delete south connector' }).click();

    expect(southConnectorService.delete).not.toHaveBeenCalled();
  });

  test('should open the creation modal', async () => {
    const tester = new SouthListComponentTester();
    modalService.mockClosedModal(createMock(ChooseSouthConnectorTypeModalComponent));
    const open = vi.spyOn(modalService, 'open');

    await tester.createButton.click();

    expect(open).toHaveBeenCalledWith(ChooseSouthConnectorTypeModalComponent, { size: 'xl', backdrop: 'static' });
  });

  test('should open the audit history modal with the south connector entity type and id', async () => {
    const tester = new SouthListComponentTester();
    const fakeModalComponent = createMock(AuditHistoryModalComponent);
    modalService.mockClosedModal(fakeModalComponent);
    const open = vi.spyOn(modalService, 'open');

    await tester.row(0).getByRole('button', { name: 'View south connector audit history' }).click();

    expect(open).toHaveBeenCalledWith(AuditHistoryModalComponent, { size: 'xl' });
    expect(fakeModalComponent.prepare).toHaveBeenCalledWith('south_connector', 'southId1');
  });

  test('should sort by name and type', async () => {
    const tester = new SouthListComponentTester();
    await expect.element(tester.names.nth(0)).toMatchTextContent('South 1');

    await tester.sortByName.click();
    await expect.element(tester.names.nth(0)).toMatchTextContent('South 3');
    await expect.element(tester.names.nth(2)).toMatchTextContent('South 1');

    await tester.sortByType.click();
    // folder-scanner < mssql < opcua
    await expect.element(tester.names.nth(0)).toMatchTextContent('South 1');
    await expect.element(tester.names.nth(1)).toMatchTextContent('South 2');
    await tester.sortByType.click();
    await expect.element(tester.names.nth(0)).toMatchTextContent('South 3');
  });

  test('should filter by name', async () => {
    const tester = new SouthListComponentTester();

    await tester.searchName.fill('south 2');

    await expect.element(tester.rows).toHaveLength(1);
    await expect.element(tester.row(0)).toMatchTextContent('South 2');

    await tester.searchName.fill('unknown');
    await expect.element(tester.empty).toBeVisible();
  });

  test('should filter by status', async () => {
    const tester = new SouthListComponentTester();

    await tester.disabledChip.click();
    await expect.element(tester.rows).toHaveLength(1);
    await expect.element(tester.row(0)).toMatchTextContent('South 2');

    await tester.enabledChip.click();
    await expect.element(tester.rows).toHaveLength(3);

    await tester.disabledChip.click();
    await expect.element(tester.rows).toHaveLength(2);
    await expect.element(tester.row(0)).toMatchTextContent('South 1');

    await tester.clearEnabledStates.click();
    await expect.element(tester.rows).toHaveLength(3);
    await expect.element(tester.clearEnabledStates).not.toBeInTheDocument();
  });

  test('should filter by type', async () => {
    const tester = new SouthListComponentTester();

    await tester.typeChip('OPC UA™').click();
    await expect.element(tester.rows).toHaveLength(1);
    await expect.element(tester.row(0)).toMatchTextContent('South 3');

    await tester.typeChip('Folder scanner').click();
    await expect.element(tester.rows).toHaveLength(2);

    await tester.typeChip('OPC UA™').click();
    await expect.element(tester.rows).toHaveLength(1);
    await expect.element(tester.row(0)).toMatchTextContent('South 1');

    await tester.clearTypes.click();
    await expect.element(tester.rows).toHaveLength(3);
  });

  test('should paginate and go back to the first page when filtering', async () => {
    southConnectorService.list.mockReturnValue(of(buildSouths(20)));
    const tester = new SouthListComponentTester();

    await expect.element(tester.rows).toHaveLength(15);
    await tester.pagination.getByRole('link', { name: '2' }).click();
    await expect.element(tester.rows).toHaveLength(5);
    await expect.element(tester.row(0)).toMatchTextContent('South 15');

    await tester.sortByName.click();
    await expect.element(tester.rows).toHaveLength(15);
    await expect.element(tester.row(0)).toMatchTextContent('South 19');
  });
});
