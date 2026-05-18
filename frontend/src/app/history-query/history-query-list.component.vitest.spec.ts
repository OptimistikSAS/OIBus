import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { provideRouter } from '@angular/router';

import { HistoryQueryListComponent } from './history-query-list.component';
import { HistoryQueryService } from '../services/history-query.service';
import { NotificationService } from '../shared/notification.service';
import { ConfirmationService } from '../shared/confirmation.service';
import { ModalService } from '../shared/modal.service';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { createMock, MockObject } from '../../test/vitest-create-mock';
import { provideModalTesting } from '../shared/mock-modal.service.spec';
import testData from '../../../../backend/src/tests/utils/test-data';
import { HistoryQueryLightDTO } from '../../../../backend/shared/model/history-query.model';

describe('HistoryQueryListComponent', () => {
  let historyQueryService: MockObject<HistoryQueryService>;

  beforeEach(() => {
    historyQueryService = createMock(HistoryQueryService);

    historyQueryService.list.mockReturnValue(of(testData.historyQueries.listLight as unknown as Array<HistoryQueryLightDTO>));
    historyQueryService.start.mockReturnValue(of(undefined));
    historyQueryService.pause.mockReturnValue(of(undefined));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        provideHttpClientTesting(),
        provideModalTesting(),
        { provide: HistoryQueryService, useValue: historyQueryService },
        { provide: NotificationService, useValue: createMock(NotificationService) },
        { provide: ConfirmationService, useValue: createMock(ConfirmationService) },
        { provide: ModalService, useValue: createMock(ModalService) }
      ]
    });
  });

  test('should display the history query list', async () => {
    const fixture = TestBed.createComponent(HistoryQueryListComponent);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    const rows = root.getByCss('tbody tr');
    await expect.element(rows).toHaveLength(testData.historyQueries.listLight.length);

    const firstRowCells = rows.nth(0).getByCss('td');
    await expect
      .element(firstRowCells.nth(1))
      .toHaveTextContent((testData.historyQueries.listLight[0] as unknown as HistoryQueryLightDTO).name);
  });

  test('should create without error', () => {
    const fixture = TestBed.createComponent(HistoryQueryListComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
