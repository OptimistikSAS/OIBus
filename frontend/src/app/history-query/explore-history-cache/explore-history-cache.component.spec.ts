import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';

import { of } from 'rxjs';
import { describe, expect, test } from 'vitest';

import { HistoryQueryDTO } from '@oibus/shared/api/history-query.model';

import testData from '../../../../../backend/src/tests/utils/test-data';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { createMock } from '../../../test/vitest-create-mock';
import { HistoryQueryService } from '../../services/history-query.service';
import { ModalService } from '../../shared/modal.service';
import { NotificationService } from '../../shared/notification.service';
import { ExploreHistoryCacheComponent } from './explore-history-cache.component';

describe('ExploreHistoryCacheComponent', () => {
  test('should create without error', () => {
    const historyQueryService = createMock(HistoryQueryService);
    historyQueryService.findById.mockReturnValue(of(testData.historyQueries.list[0] as unknown as HistoryQueryDTO));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of({ get: (key: string) => (key === 'historyQueryId' ? 'id1' : null) }),
            queryParamMap: of({ get: () => null, getAll: () => [] }),
            snapshot: { queryParamMap: { get: () => null, getAll: () => [] } }
          }
        },
        { provide: HistoryQueryService, useValue: historyQueryService },
        { provide: NotificationService, useValue: createMock(NotificationService) },
        { provide: ModalService, useValue: createMock(ModalService) }
      ]
    });

    const fixture = TestBed.createComponent(ExploreHistoryCacheComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
