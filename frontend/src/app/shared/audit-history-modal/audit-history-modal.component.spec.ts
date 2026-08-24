import { TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { of } from 'rxjs';
import { AuditHistoryModalComponent } from './audit-history-modal.component';
import { AuditService } from '../../services/audit.service';
import { AuditLogDTO } from '../../../../../backend/shared/model/audit.model';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../test/vitest-create-mock';

class AuditHistoryModalComponentTester {
  readonly fixture = TestBed.createComponent(AuditHistoryModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly rows = this.root.getByCss('.list-group-item');
  readonly closeButton = page.getByCss('#close-button');
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
      userId: 'userId1',
      createdAt: '2024-02-02T09:00:00.000Z'
    },
    {
      id: 'id1',
      entityType: 'south_connector',
      entityId: 'entityId1',
      action: 'CREATE',
      previousState: null,
      newState: { name: 'old-name' },
      userId: 'userId1',
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

  test('should load and display the history rows', async () => {
    auditService.getHistory.mockReturnValue(of(history));
    tester.fixture.componentInstance.prepare('south_connector', 'entityId1');
    tester.fixture.detectChanges();

    expect(auditService.getHistory).toHaveBeenCalledWith('south_connector', 'entityId1');
    await expect.element(tester.rows.nth(0)).toBeInTheDocument();
    await expect.element(tester.rows.nth(1)).toBeInTheDocument();
  });

  test('should display an empty state message when there is no history', async () => {
    auditService.getHistory.mockReturnValue(of([]));
    tester.fixture.componentInstance.prepare('south_connector', 'entityId1');
    tester.fixture.detectChanges();

    await expect.element(tester.root.getByCss('.empty')).toBeInTheDocument();
  });

  test('should expand and collapse the diff view when a row is toggled', async () => {
    auditService.getHistory.mockReturnValue(of(history));
    tester.fixture.componentInstance.prepare('south_connector', 'entityId1');
    tester.fixture.detectChanges();

    expect(tester.fixture.componentInstance.expandedRowId()).toEqual(null);

    tester.fixture.componentInstance.toggleRow('id1');
    tester.fixture.detectChanges();
    expect(tester.fixture.componentInstance.expandedRowId()).toEqual('id1');
    await expect.element(tester.root.getByCss('oib-audit-diff')).toBeInTheDocument();

    tester.fixture.componentInstance.toggleRow('id1');
    tester.fixture.detectChanges();
    expect(tester.fixture.componentInstance.expandedRowId()).toEqual(null);
  });

  test('should switch the diff view mode when a mode is selected from the dropdown', async () => {
    auditService.getHistory.mockReturnValue(of(history));
    tester.fixture.componentInstance.prepare('south_connector', 'entityId1');
    tester.fixture.detectChanges();

    tester.fixture.componentInstance.toggleRow('id1');
    tester.fixture.detectChanges();
    await expect.element(tester.root.getByCss('oib-audit-diff')).toBeInTheDocument();

    tester.fixture.componentInstance.changeMode('json-diff');
    tester.fixture.detectChanges();
    await expect.element(tester.root.getByCss('oib-audit-json-diff')).toBeInTheDocument();

    tester.fixture.componentInstance.changeMode('json-side-by-side');
    tester.fixture.detectChanges();
    await expect.element(tester.root.getByCss('oib-audit-json-side-by-side')).toBeInTheDocument();
  });

  test('should not show the mode dropdown when there is no history', async () => {
    auditService.getHistory.mockReturnValue(of([]));
    tester.fixture.componentInstance.prepare('south_connector', 'entityId1');
    tester.fixture.detectChanges();

    await expect.element(tester.root.getByCss('[ngbDropdown]')).not.toBeInTheDocument();
  });

  test('should close the modal', async () => {
    auditService.getHistory.mockReturnValue(of([]));
    tester.fixture.componentInstance.prepare('south_connector', 'entityId1');
    tester.fixture.detectChanges();

    await tester.closeButton.click();
    expect(fakeActiveModal.close).toHaveBeenCalled();
  });
});
