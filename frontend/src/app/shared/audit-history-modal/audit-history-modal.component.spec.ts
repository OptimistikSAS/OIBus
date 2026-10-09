import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { NEVER, of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { AuditLogDTO } from '@oibus/shared/api/audit.model';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { AuditService } from '../../services/audit.service';
import { AuditHistoryModalComponent } from './audit-history-modal.component';

class AuditHistoryModalComponentTester {
  readonly fixture = TestBed.createComponent(AuditHistoryModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly rows = this.root.getByCss('.list-group-item');
  readonly closeButton = this.root.getByRole('button', { name: 'Close' });
  readonly modeDropdown = this.root.getByCss('[ngbDropdownToggle]');
  readonly expandButtons = this.root.getByRole('button', { name: 'Show details' });
  readonly collapseButton = this.root.getByRole('button', { name: 'Hide details' });
  readonly jsonDiff = this.root.getByCss('oib-audit-json-diff');
}

describe('AuditHistoryModalComponent', () => {
  let tester: AuditHistoryModalComponentTester;
  let fakeActiveModal: MockObject<NgbActiveModal>;
  let auditService: MockObject<AuditService>;

  const history: Array<AuditLogDTO> = [
    {
      id: 'id2',
      entityType: 'south_connector',
      entityId: 'entityId1',
      action: 'UPDATE',
      previousState: { name: 'old-name' },
      newState: { name: 'new-name' },
      entity: { exists: true, name: 'new-name', parentId: null },
      user: { id: 'oianalytics', friendlyName: 'OIAnalytics' },
      createdAt: '2024-02-02T09:00:00.000Z'
    },
    {
      id: 'id1',
      entityType: 'south_connector',
      entityId: 'entityId1',
      action: 'CREATE',
      previousState: null,
      newState: { name: 'old-name' },
      entity: { exists: true, name: 'new-name', parentId: null },
      user: { id: 'oianalytics', friendlyName: 'OIAnalytics' },
      createdAt: '2024-01-01T08:00:00.000Z'
    }
  ];

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);
    auditService = createMock(AuditService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: fakeActiveModal },
        { provide: AuditService, useValue: auditService }
      ]
    });
    tester = new AuditHistoryModalComponentTester();
  });

  test('should display a loading message until the history is loaded', async () => {
    auditService.getHistory.mockReturnValue(NEVER);
    tester.fixture.componentInstance.prepare('south_connector', 'entityId1');

    await expect.element(tester.root.getByText('Loading audit history…')).toBeVisible();
  });

  test('should load and display the history rows', async () => {
    auditService.getHistory.mockReturnValue(of(history));
    tester.fixture.componentInstance.prepare('south_connector', 'entityId1');

    expect(auditService.getHistory).toHaveBeenCalledWith('south_connector', 'entityId1');
    await expect.element(tester.rows).toHaveLength(2);
    await expect.element(tester.rows.nth(0).getByText('Update')).toHaveClass('bg-primary');
    await expect.element(tester.rows.nth(0).getByCss('.text-muted')).toHaveTextContent('OIAnalytics');
    await expect.element(tester.rows.nth(1).getByText('Create')).toHaveClass('bg-success');
  });

  test('should display an empty state message without mode dropdown when there is no history', async () => {
    auditService.getHistory.mockReturnValue(of([]));
    tester.fixture.componentInstance.prepare('south_connector', 'entityId1');

    await expect.element(tester.root.getByText('No history found')).toBeVisible();
    await expect.element(tester.modeDropdown).not.toBeInTheDocument();
  });

  test('should expand and collapse the diff view when the row button is clicked', async () => {
    auditService.getHistory.mockReturnValue(of(history));
    tester.fixture.componentInstance.prepare('south_connector', 'entityId1');
    await expect.element(tester.expandButtons).toHaveLength(2);
    await expect.element(tester.jsonDiff).not.toBeInTheDocument();

    await tester.expandButtons.nth(1).click();

    await expect.element(tester.rows.nth(1).getByCss('oib-audit-json-diff')).toBeInTheDocument();
    await expect.element(tester.collapseButton).toHaveAttribute('aria-expanded', 'true');

    // expanding another row collapses the first one
    await tester.expandButtons.nth(0).click();
    await expect.element(tester.rows.nth(0).getByCss('oib-audit-json-diff')).toBeInTheDocument();
    await expect.element(tester.jsonDiff).toHaveLength(1);

    await tester.collapseButton.click();
    await expect.element(tester.jsonDiff).not.toBeInTheDocument();
  });

  test('should switch the diff view mode when a mode is selected from the dropdown', async () => {
    auditService.getHistory.mockReturnValue(of(history));
    tester.fixture.componentInstance.prepare('south_connector', 'entityId1');
    await tester.expandButtons.nth(1).click();

    // JSON diff is the default mode
    await expect.element(tester.modeDropdown).toHaveTextContent('JSON diff');
    await expect.element(tester.jsonDiff).toBeInTheDocument();

    await tester.modeDropdown.click();
    await tester.root.getByRole('button', { name: 'Table' }).click();
    await expect.element(tester.root.getByCss('oib-audit-diff')).toBeInTheDocument();
    await expect.element(tester.modeDropdown).toHaveTextContent('Table');

    await tester.modeDropdown.click();
    await tester.root.getByRole('button', { name: 'JSON side by side' }).click();
    await expect.element(tester.root.getByCss('oib-audit-json-side-by-side')).toBeInTheDocument();

    await tester.modeDropdown.click();
    await tester.root.getByRole('button', { name: 'JSON diff' }).click();
    await expect.element(tester.jsonDiff).toBeInTheDocument();
  });

  test('should close the modal', async () => {
    auditService.getHistory.mockReturnValue(of([]));
    tester.fixture.componentInstance.prepare('south_connector', 'entityId1');

    await tester.closeButton.click();

    expect(fakeActiveModal.close).toHaveBeenCalled();
  });
});
