import { TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { Router } from '@angular/router';

import { ChooseNorthConnectorTypeModalComponent } from './choose-north-connector-type-modal.component';
import { NorthConnectorService } from '../../services/north-connector.service';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../test/vitest-create-mock';

describe('ChooseNorthConnectorTypeModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;
  let northConnectorService: MockObject<NorthConnectorService>;
  let router: MockObject<Router>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    northConnectorService = createMock(NorthConnectorService);
    router = createMock(Router);

    northConnectorService.getNorthTypes.mockReturnValue(
      of([
        { id: 'file-writer', category: 'file', name: 'File Writer', description: 'File Writer description', types: ['any'] },
        { id: 'console', category: 'debug', name: 'Console', description: 'Console description', beta: true, types: ['any'] }
      ])
    );

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: Router, useValue: router }
      ]
    });
  });

  test('should select a connector type', async () => {
    const fixture = TestBed.createComponent(ChooseNorthConnectorTypeModalComponent);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await root.getByCss('button.category-button').nth(0).click();

    expect(activeModal.close).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/north', 'create'], { queryParams: { type: 'file-writer' } });
  });

  test('should display a beta badge only for beta north types', async () => {
    const fixture = TestBed.createComponent(ChooseNorthConnectorTypeModalComponent);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    const buttons = root.getByCss('.category-button');
    await expect.element(buttons.nth(0).getByCss('.badge')).not.toBeInTheDocument();
    await expect.element(buttons.nth(1).getByCss('.badge')).toBeInTheDocument();
    await expect.element(buttons.nth(1).getByCss('.badge')).toHaveTextContent('Beta');
  });

  test('should cancel', async () => {
    const fixture = TestBed.createComponent(ChooseNorthConnectorTypeModalComponent);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await root.getByCss('#cancel-button').click();

    expect(activeModal.dismiss).toHaveBeenCalled();
  });
});
