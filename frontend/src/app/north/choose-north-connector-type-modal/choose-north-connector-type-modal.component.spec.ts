import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { NorthConnectorService } from '../../services/north-connector.service';
import { ChooseNorthConnectorTypeModalComponent } from './choose-north-connector-type-modal.component';

class ChooseNorthConnectorTypeModalComponentTester {
  readonly fixture = TestBed.createComponent(ChooseNorthConnectorTypeModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly categories = this.root.getByRole('heading', { level: 1 });
  readonly typeButtons = this.root.getByCss('button.category-button');
  readonly fileWriterButton = this.root.getByRole('button', { name: /File writer/ });
  readonly consoleButton = this.root.getByRole('button', { name: /Console/ });
  readonly cancelButton = this.root.getByRole('button', { name: 'Cancel' });
}

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
        { id: 'console', category: 'debug', name: 'Console', description: 'Console description', beta: true, types: ['any'] },
        { id: 'sftp', category: 'file', name: 'SFTP', description: 'SFTP description', types: ['any'] }
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

  test('should group the connector types by category', async () => {
    const tester = new ChooseNorthConnectorTypeModalComponentTester();

    await expect.element(tester.categories).toHaveLength(2);
    await expect.element(tester.categories.nth(0)).toHaveTextContent('File');
    await expect.element(tester.categories.nth(1)).toHaveTextContent('Debug');
    await expect.element(tester.typeButtons).toHaveLength(3);
    await expect.element(tester.typeButtons.nth(1)).toMatchTextContent(/^SFTP/);
  });

  test('should select a connector type', async () => {
    const tester = new ChooseNorthConnectorTypeModalComponentTester();

    await tester.fileWriterButton.click();

    expect(activeModal.close).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/north', 'create'], { queryParams: { type: 'file-writer' } });
  });

  test('should display a beta badge only for beta north types', async () => {
    const tester = new ChooseNorthConnectorTypeModalComponentTester();

    await expect.element(tester.fileWriterButton.getByCss('.beta-badge')).not.toBeInTheDocument();
    const betaBadge = tester.consoleButton.getByCss('.beta-badge');
    await expect.element(betaBadge).toHaveTextContent('Beta');
    await expect.element(betaBadge).toHaveClass('bg-secondary');
  });

  test('should cancel', async () => {
    const tester = new ChooseNorthConnectorTypeModalComponentTester();

    await tester.cancelButton.click();

    expect(activeModal.dismiss).toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
