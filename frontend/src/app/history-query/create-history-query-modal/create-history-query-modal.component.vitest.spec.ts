import { TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';

import { CreateHistoryQueryModalComponent } from './create-history-query-modal.component';
import { NorthConnectorService } from '../../services/north-connector.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../test/vitest-create-mock';

describe('CreateHistoryQueryModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;
  let northConnectorService: MockObject<NorthConnectorService>;
  let southConnectorService: MockObject<SouthConnectorService>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    northConnectorService = createMock(NorthConnectorService);
    southConnectorService = createMock(SouthConnectorService);

    northConnectorService.getNorthTypes.mockReturnValue(of([]));
    northConnectorService.list.mockReturnValue(of([]));
    southConnectorService.getSouthTypes.mockReturnValue(of([]));
    southConnectorService.list.mockReturnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: SouthConnectorService, useValue: southConnectorService }
      ]
    });
  });

  test('should cancel', () => {
    const fixture = TestBed.createComponent(CreateHistoryQueryModalComponent);
    fixture.detectChanges();

    fixture.componentInstance.cancel();

    expect(activeModal.dismiss).toHaveBeenCalled();
  });

  test('should create without error', () => {
    const fixture = TestBed.createComponent(CreateHistoryQueryModalComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
