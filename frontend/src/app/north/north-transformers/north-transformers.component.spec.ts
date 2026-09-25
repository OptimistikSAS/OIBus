import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { NorthTransformersComponent } from './north-transformers.component';
import { NorthConnectorService } from '../../services/north-connector.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { ModalService } from '../../shared/modal.service';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { AuditHistoryModalComponent } from '../../shared/audit-history-modal/audit-history-modal.component';
import testData from '../../../../../backend/src/tests/utils/test-data';
import { NorthConnectorDTO, NorthConnectorManifest } from '../../../../../backend/shared/model/north-connector.model';

describe('NorthTransformersComponent', () => {
  let modalService: MockObject<ModalService>;

  beforeEach(() => {
    modalService = createMock(ModalService);
    const southConnectorService = createMock(SouthConnectorService);
    southConnectorService.list.mockReturnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: NorthConnectorService, useValue: createMock(NorthConnectorService) },
        { provide: ConfirmationService, useValue: createMock(ConfirmationService) },
        { provide: NotificationService, useValue: createMock(NotificationService) },
        { provide: ModalService, useValue: modalService }
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

  function createWithTransformers(saveChangesDirectly: boolean) {
    const fixture = TestBed.createComponent(NorthTransformersComponent);
    fixture.componentRef.setInput('northManifest', testData.north.manifest as unknown as NorthConnectorManifest);
    fixture.componentRef.setInput('transformers', []);
    fixture.componentRef.setInput('certificates', []);
    fixture.componentRef.setInput('scanModes', []);
    fixture.componentRef.setInput('northConnector', testData.north.list[0] as unknown as NorthConnectorDTO);
    fixture.componentRef.setInput('saveChangesDirectly', saveChangesDirectly);
    fixture.detectChanges();
    return { fixture, root: page.elementLocator(fixture.nativeElement) };
  }

  test('should open the audit history of a saved transformer', async () => {
    const prepare = vi.fn();
    modalService.open.mockReturnValue({ componentInstance: { prepare } } as any);
    const { root } = createWithTransformers(true);

    await root.getByCss('.show-audit-transformer').first().click();

    expect(modalService.open).toHaveBeenCalledWith(AuditHistoryModalComponent, { size: 'xl' });
    expect(prepare).toHaveBeenCalledWith('north_transformer', testData.north.list[0].transformers[0].id);
  });

  test('should not display the audit history button when transformers are edited in memory', async () => {
    const { root } = createWithTransformers(false);

    await expect.element(root.getByCss('.edit-transformer').first()).toBeInTheDocument();
    await expect.element(root.getByCss('.show-audit-transformer')).not.toBeInTheDocument();
  });
});
