import { TestBed } from '@angular/core/testing';

import { of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { CustomTransformerDTO, StandardTransformerDTO, TransformerDTO } from '@oibus/shared/api/transformer.model';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import testData from '../../../test/test-data';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { TransformerService } from '../../services/transformer.service';
import { AuditHistoryModalComponent } from '../../shared/audit-history-modal/audit-history-modal.component';
import { ConfirmationService } from '../../shared/confirmation.service';
import { MockModalService, provideModalTesting } from '../../shared/mock-modal.service.testing';
import { NotificationService } from '../../shared/notification.service';
import { EditTransformerModalComponent } from './edit-transformer-modal/edit-transformer-modal.component';
import { TransformerListComponent } from './transformer-list.component';

class TransformerListComponentTester {
  readonly fixture = TestBed.createComponent(TransformerListComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly rows = this.root.getByCss('tbody tr');
  readonly addButton = this.root.getByRole('button', { name: 'Add a Custom Transformer' });
  readonly noTransformer = this.root.getByText('No Custom Transformer');
  readonly pagination = this.root.getByCss('oib-pagination');
  readonly nameSort = this.root.getByRole('button', { name: 'Name' });
  readonly updatedAtSort = this.root.getByRole('button', { name: 'Updated on' });

  cell(row: number, column: number) {
    return this.rows.nth(row).getByCss('td').nth(column);
  }

  button(
    row: number,
    name: 'Edit this Custom Transformer' | 'Delete this Custom Transformer' | "View this Custom Transformer's audit history"
  ) {
    return this.rows.nth(row).getByRole('button', { name });
  }
}

function buildTransformer(index: number, overrides: Partial<CustomTransformerDTO> = {}): CustomTransformerDTO {
  return {
    ...testData.transformers.customList[0],
    id: `transformer${index}`,
    name: `transformer ${String(index).padStart(2, '0')}`,
    ...overrides
  };
}

const standardTransformer: StandardTransformerDTO = {
  id: 'iso',
  type: 'standard',
  functionName: 'iso',
  inputType: 'any',
  outputType: 'any',
  manifest: testData.transformers.customList[0].manifest
};

describe('TransformerListComponent', () => {
  let transformerService: MockObject<TransformerService>;
  let confirmationService: MockObject<ConfirmationService>;
  let notificationService: MockObject<NotificationService>;
  let modalService: MockModalService<EditTransformerModalComponent | AuditHistoryModalComponent>;
  let transformers: Array<TransformerDTO>;

  beforeEach(() => {
    transformerService = createMock(TransformerService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);
    transformers = [
      buildTransformer(2, { updatedAt: '2024-01-01T00:00:00.000Z' }),
      standardTransformer,
      buildTransformer(1, { updatedAt: '2024-01-02T00:00:00.000Z' })
    ];
    transformerService.list.mockReturnValue(of(transformers));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideModalTesting(),
        { provide: TransformerService, useValue: transformerService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });
    modalService = TestBed.inject(MockModalService);
  });

  test('should display the custom transformers only', async () => {
    const tester = new TransformerListComponentTester();

    await expect.element(tester.rows).toHaveLength(2);
    await expect.element(tester.root.getByText('(2)')).toBeInTheDocument();
    await expect.element(tester.cell(0, 0)).toHaveTextContent('transformer 02');
    await expect.element(tester.cell(0, 2)).toHaveTextContent('time-values');
    await expect.element(tester.cell(0, 3)).toHaveTextContent('any');
    await expect.element(tester.pagination).not.toBeInTheDocument();
  });

  test('should display an empty list', async () => {
    transformerService.list.mockReturnValue(of([standardTransformer]));
    const tester = new TransformerListComponentTester();

    await expect.element(tester.noTransformer).toBeInTheDocument();
  });

  test('should sort by name and update date', async () => {
    const tester = new TransformerListComponentTester();
    await expect.element(tester.nameSort.getByCss('.fa-sort')).toBeInTheDocument();

    await tester.nameSort.click();
    await expect.element(tester.cell(0, 0)).toHaveTextContent('transformer 01');
    await expect.element(tester.nameSort.getByCss('.fa-sort-up')).toBeInTheDocument();

    await tester.nameSort.click();
    await expect.element(tester.cell(0, 0)).toHaveTextContent('transformer 02');
    await expect.element(tester.nameSort.getByCss('.fa-sort-down')).toBeInTheDocument();

    await tester.updatedAtSort.click();
    await expect.element(tester.cell(0, 0)).toHaveTextContent('transformer 02');
    await expect.element(tester.nameSort.getByCss('.fa-sort')).toBeInTheDocument();
    await expect.element(tester.updatedAtSort.getByCss('.fa-sort-up')).toBeInTheDocument();
  });

  test('should paginate the list', async () => {
    transformerService.list.mockReturnValue(of(Array.from({ length: 25 }, (_, index) => buildTransformer(index + 1))));
    const tester = new TransformerListComponentTester();
    await tester.nameSort.click();
    await expect.element(tester.rows).toHaveLength(20);

    await tester.pagination.getByRole('link', { name: '2' }).click();

    await expect.element(tester.rows).toHaveLength(5);
    await expect.element(tester.cell(0, 0)).toHaveTextContent('transformer 21');
  });

  test('should delete a transformer and refresh the list', async () => {
    confirmationService.confirm.mockReturnValue(of(undefined));
    transformerService.delete.mockReturnValue(of(undefined));
    const tester = new TransformerListComponentTester();
    await expect.element(tester.rows).toHaveLength(2);
    transformerService.list.mockReturnValue(of([transformers[2]]));

    await tester.button(0, 'Delete this Custom Transformer').click();

    expect(confirmationService.confirm).toHaveBeenCalledWith({
      messageKey: 'configuration.oibus.manifest.transformers.confirm-deletion',
      interpolateParams: { name: 'transformer 02' }
    });
    expect(transformerService.delete).toHaveBeenCalledWith('transformer2');
    expect(notificationService.success).toHaveBeenCalledWith('configuration.oibus.manifest.transformers.deleted', {
      name: 'transformer 02'
    });
    await expect.element(tester.rows).toHaveLength(1);
    await expect.element(tester.cell(0, 0)).toHaveTextContent('transformer 01');
  });

  test('should not delete a transformer without confirmation', async () => {
    confirmationService.confirm.mockReturnValue(of());
    const tester = new TransformerListComponentTester();

    await tester.button(0, 'Delete this Custom Transformer').click();

    expect(transformerService.delete).not.toHaveBeenCalled();
  });

  test('should create a transformer and refresh the list', async () => {
    const fakeEditComponent = createMock(EditTransformerModalComponent);
    const newTransformer = buildTransformer(3);
    modalService.mockClosedModal(fakeEditComponent, newTransformer);
    const tester = new TransformerListComponentTester();
    await expect.element(tester.rows).toHaveLength(2);
    transformerService.list.mockReturnValue(of([...transformers, newTransformer]));

    await tester.addButton.click();

    expect(fakeEditComponent.prepareForCreation).toHaveBeenCalled();
    expect(notificationService.success).toHaveBeenCalledWith('configuration.oibus.manifest.transformers.created', {
      name: 'transformer 03'
    });
    await expect.element(tester.rows).toHaveLength(3);
  });

  test('should edit a transformer', async () => {
    const fakeEditComponent = createMock(EditTransformerModalComponent);
    const editedTransformer = buildTransformer(2, { name: 'edited' });
    modalService.mockClosedModal(fakeEditComponent, editedTransformer);
    const tester = new TransformerListComponentTester();
    await expect.element(tester.rows).toHaveLength(2);
    transformerService.list.mockReturnValue(of([editedTransformer]));

    await tester.button(0, 'Edit this Custom Transformer').click();

    expect(fakeEditComponent.prepareForEdition).toHaveBeenCalledWith(transformers[0]);
    expect(notificationService.success).toHaveBeenCalledWith('configuration.oibus.manifest.transformers.updated', { name: 'edited' });
    await expect.element(tester.cell(0, 0)).toHaveTextContent('edited');
  });

  test('should not refresh the list when the edition is cancelled', async () => {
    modalService.mockDismissedModal(createMock(EditTransformerModalComponent));
    const tester = new TransformerListComponentTester();

    await tester.button(0, 'Edit this Custom Transformer').click();

    expect(transformerService.list).toHaveBeenCalledTimes(1);
    expect(notificationService.success).not.toHaveBeenCalled();
  });

  test('should open the audit history modal with the transformer entity type and id', async () => {
    const fakeAuditComponent = createMock(AuditHistoryModalComponent);
    modalService.mockClosedModal(fakeAuditComponent);
    const tester = new TransformerListComponentTester();

    await tester.button(1, "View this Custom Transformer's audit history").click();

    expect(fakeAuditComponent.prepare).toHaveBeenCalledWith('transformer', 'transformer1');
  });
});
