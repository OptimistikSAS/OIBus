import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, test } from 'vitest';

import { NorthTransformersComponent } from './north-transformers.component';
import { NorthConnectorService } from '../../services/north-connector.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { ModalService } from '../../shared/modal.service';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { createMock } from '../../../test/vitest-create-mock';
import testData from '../../../../../backend/src/tests/utils/test-data';
import { NorthConnectorManifest } from '../../../../../backend/shared/model/north-connector.model';

describe('NorthTransformersComponent', () => {
  beforeEach(() => {
    const southConnectorService = createMock(SouthConnectorService);
    southConnectorService.list.mockReturnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: NorthConnectorService, useValue: createMock(NorthConnectorService) },
        { provide: ConfirmationService, useValue: createMock(ConfirmationService) },
        { provide: NotificationService, useValue: createMock(NotificationService) },
        { provide: ModalService, useValue: createMock(ModalService) }
      ]
    });
  });

  test('should render with required inputs', () => {
    const fixture = TestBed.createComponent(NorthTransformersComponent);
    fixture.componentRef.setInput('northManifest', testData.north.manifest as unknown as NorthConnectorManifest);
    fixture.componentRef.setInput('transformers', []);
    fixture.componentRef.setInput('certificates', []);
    fixture.componentRef.setInput('scanModes', []);
    fixture.detectChanges();
  });
});
