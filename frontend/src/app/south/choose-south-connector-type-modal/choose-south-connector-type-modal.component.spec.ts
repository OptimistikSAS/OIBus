import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, Routes } from '@angular/router';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { SouthType } from '@oibus/shared/connector/south-manifest.model';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { EmptyRouteComponent } from '../../../test/empty-route.component';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { SouthConnectorService } from '../../services/south-connector.service';
import { ChooseSouthConnectorTypeModalComponent } from './choose-south-connector-type-modal.component';

const routes: Routes = [{ path: 'south/create', component: EmptyRouteComponent }];

class ChooseSouthConnectorTypeModalComponentTester {
  readonly fixture = TestBed.createComponent(ChooseSouthConnectorTypeModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly categories = this.root.getByRole('heading', { level: 1 });
  readonly types = this.root.getByCss('.category-button');
  readonly cancelButton = this.root.getByRole('button', { name: 'Cancel' });
}

const southTypes: Array<SouthType> = [
  {
    id: 'folder-scanner',
    category: 'file',
    modes: { subscription: false, lastPoint: false, lastFile: true, history: false }
  },
  {
    id: 'mssql',
    category: 'database',
    beta: true,
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

  test('should display the south types grouped by category', async () => {
    const tester = new ChooseSouthConnectorTypeModalComponentTester();

    await expect.element(tester.categories).toHaveLength(2);
    await expect.element(tester.categories.nth(0)).toHaveTextContent('File');
    await expect.element(tester.categories.nth(1)).toHaveTextContent('Database');
    await expect.element(tester.types).toHaveLength(2);
    await expect.element(tester.types.nth(0)).toMatchTextContent('Folder scanner');
    await expect.element(tester.types.nth(0)).toMatchTextContent('Read files from a local or remote folder');
    await expect.element(tester.types.nth(1)).toMatchTextContent('Query Microsoft SQL Server™ databases');
  });

  test('should display a beta badge only for beta south types', async () => {
    const tester = new ChooseSouthConnectorTypeModalComponentTester();

    await expect.element(tester.types.nth(0).getByText('Beta')).not.toBeInTheDocument();
    await expect.element(tester.types.nth(1).getByText('Beta')).toBeVisible();
  });

  test('should close the modal and navigate to the creation page on type selection', async () => {
    const tester = new ChooseSouthConnectorTypeModalComponentTester();

    await tester.types.nth(0).click();

    expect(activeModal.close).toHaveBeenCalled();
    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/south/create?type=folder-scanner'));
  });

  test('should dismiss the modal on cancel', async () => {
    const tester = new ChooseSouthConnectorTypeModalComponentTester();

    await tester.cancelButton.click();

    expect(activeModal.dismiss).toHaveBeenCalled();
  });
});
