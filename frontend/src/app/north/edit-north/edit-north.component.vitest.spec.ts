import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { describe, expect, test } from 'vitest';

import { EditNorthComponent } from './edit-north.component';
import { NorthConnectorService } from '../../services/north-connector.service';
import { ScanModeService } from '../../services/scan-mode.service';
import { CertificateService } from '../../services/certificate.service';
import { TransformerService } from '../../services/transformer.service';
import { NotificationService } from '../../shared/notification.service';
import { ModalService } from '../../shared/modal.service';
import { UnsavedChangesConfirmationService } from '../../shared/unsaved-changes-confirmation.service';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import testData from '../../../../../backend/src/tests/utils/test-data';
import { NorthConnectorDTO } from '../../../../../backend/shared/model/north-connector.model';

function configure(activatedRouteValue: object): MockObject<NorthConnectorService> {
  const northConnectorService = createMock(NorthConnectorService);
  const scanModeService = createMock(ScanModeService);
  const certificateService = createMock(CertificateService);
  const transformerService = createMock(TransformerService);

  northConnectorService.getNorthManifest.mockReturnValue(of(testData.north.manifest));
  northConnectorService.list.mockReturnValue(of([]));
  scanModeService.list.mockReturnValue(of([]));
  certificateService.list.mockReturnValue(of([]));
  transformerService.list.mockReturnValue(of([]));

  TestBed.configureTestingModule({
    providers: [
      provideI18nTesting(),
      provideRouter([]),
      provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: activatedRouteValue },
      { provide: NorthConnectorService, useValue: northConnectorService },
      { provide: ScanModeService, useValue: scanModeService },
      { provide: CertificateService, useValue: certificateService },
      { provide: TransformerService, useValue: transformerService },
      { provide: NotificationService, useValue: createMock(NotificationService) },
      { provide: ModalService, useValue: createMock(ModalService) },
      { provide: UnsavedChangesConfirmationService, useValue: createMock(UnsavedChangesConfirmationService) }
    ]
  });

  return northConnectorService;
}

describe('EditNorthComponent', () => {
  test('should create in create mode', () => {
    configure({
      paramMap: of({ get: () => null }),
      queryParamMap: of({ get: (k: string) => (k === 'type' ? 'console' : null), getAll: () => [] }),
      snapshot: { queryParamMap: { get: () => null, getAll: () => [] } }
    });

    const fixture = TestBed.createComponent(EditNorthComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  test('should create in edit mode', () => {
    const northConnectorService = configure({
      paramMap: of({ get: (k: string) => (k === 'northId' ? 'id1' : null) }),
      queryParamMap: of({ get: () => null, getAll: () => [] }),
      snapshot: { queryParamMap: { get: () => null, getAll: () => [] } }
    });

    northConnectorService.findById.mockReturnValue(of(testData.north.list[0] as unknown as NorthConnectorDTO));

    const fixture = TestBed.createComponent(EditNorthComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
