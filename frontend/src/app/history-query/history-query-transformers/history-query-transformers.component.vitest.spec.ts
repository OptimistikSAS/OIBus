import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, test } from 'vitest';

import { HistoryQueryTransformersComponent } from './history-query-transformers.component';
import { HistoryQueryService } from '../../services/history-query.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { ModalService } from '../../shared/modal.service';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { createMock } from '../../../test/vitest-create-mock';
import testData from '../../../../../backend/src/tests/utils/test-data';
import { NorthConnectorManifest } from '../../../../../backend/shared/model/north-connector.model';
import { OIBusSouthType } from '../../../../../backend/shared/model/south-connector.model';

describe('HistoryQueryTransformersComponent', () => {
  test('should create without error', () => {
    const historyQueryService = createMock(HistoryQueryService);
    historyQueryService.list.mockReturnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: HistoryQueryService, useValue: historyQueryService },
        { provide: ConfirmationService, useValue: createMock(ConfirmationService) },
        { provide: NotificationService, useValue: createMock(NotificationService) },
        { provide: ModalService, useValue: createMock(ModalService) }
      ]
    });

    const fixture = TestBed.createComponent(HistoryQueryTransformersComponent);
    fixture.componentRef.setInput('northManifest', testData.north.manifest as unknown as NorthConnectorManifest);
    fixture.componentRef.setInput('transformers', []);
    fixture.componentRef.setInput('certificates', []);
    fixture.componentRef.setInput('scanModes', []);
    fixture.componentRef.setInput('southType', 'opcua-ha' as OIBusSouthType);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
