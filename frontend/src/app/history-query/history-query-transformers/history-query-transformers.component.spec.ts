import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { HistoryQueryTransformersComponent } from './history-query-transformers.component';
import { HistoryQueryService } from '../../services/history-query.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { ModalService } from '../../shared/modal.service';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { AuditHistoryModalComponent } from '../../shared/audit-history-modal/audit-history-modal.component';
import { HistoryQueryDTO } from '../../../../../backend/shared/model/history-query.model';
import testData from '../../../../../backend/src/tests/utils/test-data';
import { NorthConnectorManifest } from '../../../../../backend/shared/model/north-connector.model';
import { OIBusSouthType } from '../../../../../backend/shared/model/south-connector.model';

describe('HistoryQueryTransformersComponent', () => {
  let modalService: MockObject<ModalService>;

  beforeEach(() => {
    const historyQueryService = createMock(HistoryQueryService);
    historyQueryService.list.mockReturnValue(of([]));
    modalService = createMock(ModalService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: HistoryQueryService, useValue: historyQueryService },
        { provide: ConfirmationService, useValue: createMock(ConfirmationService) },
        { provide: NotificationService, useValue: createMock(NotificationService) },
        { provide: ModalService, useValue: modalService }
      ]
    });
  });

  function create(historyQuery: HistoryQueryDTO | null, saveChangesDirectly: boolean) {
    const fixture = TestBed.createComponent(HistoryQueryTransformersComponent);
    fixture.componentRef.setInput('northManifest', testData.north.manifest as unknown as NorthConnectorManifest);
    fixture.componentRef.setInput('transformers', []);
    fixture.componentRef.setInput('certificates', []);
    fixture.componentRef.setInput('scanModes', []);
    fixture.componentRef.setInput('southType', 'opcua-ha' as OIBusSouthType);
    fixture.componentRef.setInput('historyQuery', historyQuery);
    fixture.componentRef.setInput('saveChangesDirectly', saveChangesDirectly);
    fixture.detectChanges();
    return { fixture, root: page.elementLocator(fixture.nativeElement) };
  }

  test('should create without error', () => {
    const { fixture } = create(null, false);
    expect(fixture.componentInstance).toBeTruthy();
  });

  test('should open the audit history of a saved transformer', async () => {
    const prepare = vi.fn();
    modalService.open.mockReturnValue({ componentInstance: { prepare } } as any);
    const { root } = create(testData.historyQueries.list[0] as unknown as HistoryQueryDTO, true);

    await root.getByCss('.show-audit-transformer').first().click();

    expect(modalService.open).toHaveBeenCalledWith(AuditHistoryModalComponent, { size: 'xl' });
    expect(prepare).toHaveBeenCalledWith('history_query_transformer', testData.historyQueries.list[0].northTransformers[0].id);
  });

  test('should not display the audit history button when transformers are edited in memory', async () => {
    const { root } = create(testData.historyQueries.list[0] as unknown as HistoryQueryDTO, false);

    await expect.element(root.getByCss('.edit-transformer').first()).toBeInTheDocument();
    await expect.element(root.getByCss('.show-audit-transformer')).not.toBeInTheDocument();
  });
});
