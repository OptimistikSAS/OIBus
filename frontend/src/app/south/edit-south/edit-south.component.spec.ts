import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { EditSouthComponent } from './edit-south.component';
import { SouthConnectorService } from '../../services/south-connector.service';
import { ScanModeService } from '../../services/scan-mode.service';
import { CertificateService } from '../../services/certificate.service';
import { NotificationService } from '../../shared/notification.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { ModalService } from '../../shared/modal.service';
import { UnsavedChangesConfirmationService } from '../../shared/unsaved-changes-confirmation.service';
import { TransformerService } from '../../services/transformer.service';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { SouthConnectorDTO } from '../../../../../backend/shared/model/south-connector.model';
import { ScanModeDTO } from '../../../../../backend/shared/model/scan-mode.model';
import testData from '../../../../../backend/src/tests/utils/test-data';

const manifest = testData.south.manifest;
const southConnector = testData.south.list[0] as unknown as SouthConnectorDTO;
const scanModes = testData.scanMode.list as unknown as Array<ScanModeDTO>;

const createRouteStub = {
  paramMap: of({ get: () => null }),
  queryParamMap: of({ get: (key: string) => (key === 'type' ? 'folder-scanner' : null), getAll: () => [] as Array<string> })
};

const editRouteStub = {
  paramMap: of({ get: (key: string) => (key === 'southId' ? southConnector.id : null) }),
  queryParamMap: of({ get: () => null, getAll: () => [] as Array<string> })
};

describe('EditSouthComponent', () => {
  let southConnectorService: MockObject<SouthConnectorService>;
  let scanModeService: MockObject<ScanModeService>;
  let certificateService: MockObject<CertificateService>;

  beforeEach(() => {
    southConnectorService = createMock(SouthConnectorService);
    scanModeService = createMock(ScanModeService);
    certificateService = createMock(CertificateService);
    const notificationService = createMock(NotificationService);
    const confirmationService = createMock(ConfirmationService);
    const modalService = createMock(ModalService);
    const unsavedChangesService = createMock(UnsavedChangesConfirmationService);
    const transformerService = createMock(TransformerService);

    scanModeService.list.mockReturnValue(of(scanModes));
    certificateService.list.mockReturnValue(of([]));
    southConnectorService.list.mockReturnValue(of([]));
    southConnectorService.getSouthManifest.mockReturnValue(of(manifest));
    southConnectorService.getGroups.mockReturnValue(of([]));
    transformerService.list.mockReturnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        provideHttpClientTesting(),
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: ScanModeService, useValue: scanModeService },
        { provide: CertificateService, useValue: certificateService },
        { provide: NotificationService, useValue: notificationService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: ModalService, useValue: modalService },
        { provide: UnsavedChangesConfirmationService, useValue: unsavedChangesService },
        { provide: TransformerService, useValue: transformerService }
      ]
    });
  });

  test('should display create mode', async () => {
    TestBed.overrideProvider(ActivatedRoute, { useValue: createRouteStub });
    const fixture = TestBed.createComponent(EditSouthComponent);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('#south-name')).toBeInTheDocument();
  });

  test('should display edit mode with form populated', async () => {
    southConnectorService.findById.mockReturnValue(of(southConnector as any));
    TestBed.overrideProvider(ActivatedRoute, { useValue: editRouteStub });
    const fixture = TestBed.createComponent(EditSouthComponent);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('#south-name')).toHaveValue(southConnector.name);
  });
});
