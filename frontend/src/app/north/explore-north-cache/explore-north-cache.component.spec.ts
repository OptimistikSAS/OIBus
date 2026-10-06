import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';

import { of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import testData from '../../../test/test-data';
import { createMock } from '../../../test/vitest-create-mock';
import { NorthConnectorService } from '../../services/north-connector.service';
import { ModalService } from '../../shared/modal.service';
import { NotificationService } from '../../shared/notification.service';
import { ExploreNorthCacheComponent } from './explore-north-cache.component';

describe('ExploreNorthCacheComponent', () => {
  beforeEach(() => {
    const northConnectorService = createMock(NorthConnectorService);
    northConnectorService.findById.mockReturnValue(of(testData.north.list[0]));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of({ get: (key: string) => (key === 'northId' ? 'id1' : null) }),
            queryParamMap: of({ get: () => null, getAll: () => [] }),
            snapshot: { queryParamMap: { get: () => null, getAll: () => [] } }
          }
        },
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: NotificationService, useValue: createMock(NotificationService) },
        { provide: ModalService, useValue: createMock(ModalService) }
      ]
    });
  });

  test('should create without error', () => {
    const fixture = TestBed.createComponent(ExploreNorthCacheComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
