import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { provideRouter, Routes } from '@angular/router';
import { ChangeDetectionStrategy, Component } from '@angular/core';

import { ChooseSouthConnectorTypeModalComponent } from './choose-south-connector-type-modal.component';
import { SouthConnectorService } from '../../services/south-connector.service';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { SouthType } from '../../../../../backend/shared/model/south-connector.model';

@Component({ template: '', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush })
class DummyComponent {}
const routes: Routes = [{ path: 'south/create', component: DummyComponent }];

const southTypes: Array<SouthType> = [
  {
    id: 'folder-scanner',
    category: 'file',
    modes: { subscription: false, lastPoint: false, lastFile: true, history: false }
  },
  {
    id: 'mssql',
    category: 'database',
    modes: { subscription: false, lastPoint: false, lastFile: false, history: true }
  }
];

describe('ChooseSouthConnectorTypeModalComponent', () => {
  let southConnectorService: MockObject<SouthConnectorService>;
  let activeModal: MockObject<NgbActiveModal>;

  beforeEach(() => {
    southConnectorService = createMock(SouthConnectorService);
    activeModal = createMock(NgbActiveModal);

    southConnectorService.getSouthTypes.mockReturnValue(of(southTypes));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter(routes),
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: NgbActiveModal, useValue: activeModal }
      ]
    });
  });

  test('should display grouped south types', async () => {
    const fixture = TestBed.createComponent(ChooseSouthConnectorTypeModalComponent);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('.category-button').nth(0)).toBeInTheDocument();
  });

  test('should close modal on type selection', () => {
    const fixture = TestBed.createComponent(ChooseSouthConnectorTypeModalComponent);
    fixture.detectChanges();

    fixture.componentInstance.selectType('folder-scanner');

    expect(activeModal.close).toHaveBeenCalled();
  });
});
