import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { beforeEach, describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { HistoryQueryItemCommandDTO, HistoryQueryItemDTO } from '@oibus/shared/api/history-query.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import testData from '../../../../test/test-data';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { EditHistoryQueryItemModalComponent } from './edit-history-query-item-modal.component';

describe('EditHistoryQueryItemModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideHttpClientTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: UnsavedChangesConfirmationService, useValue: createMock(UnsavedChangesConfirmationService) }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();
  });

  test('should cancel', () => {
    const fixture = TestBed.createComponent(EditHistoryQueryItemModalComponent);
    fixture.detectChanges();

    fixture.componentInstance.cancel();

    expect(activeModal.dismiss).toHaveBeenCalled();
  });

  test('should create without error', () => {
    const fixture = TestBed.createComponent(EditHistoryQueryItemModalComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  describe('name uniqueness', () => {
    const historyId = testData.historyQueries.list[0].id;
    const manifest = testData.south.manifest;
    const southConnectorCommand = testData.south.command;
    const [savedItem1, savedItem2] = testData.historyQueries.list[0].items;
    const unsavedItem1: HistoryQueryItemCommandDTO = { ...testData.historyQueries.itemCommand, id: '', name: 'unsaved1' };
    const unsavedItem2: HistoryQueryItemCommandDTO = { ...testData.historyQueries.itemCommand, id: '', name: 'unsaved2' };
    const itemList: Array<HistoryQueryItemDTO | HistoryQueryItemCommandDTO> = [savedItem1, savedItem2, unsavedItem1, unsavedItem2];
    const nameInput = page.getByLabelText('Name', { exact: true });
    const mustBeUnique = page.getByText('Must be unique');

    const typeName = async (name: string) => {
      await nameInput.fill(name);
      await userEvent.tab();
    };

    const openForEdition = (item: HistoryQueryItemDTO | HistoryQueryItemCommandDTO, tableIndex: number) => {
      const fixture = TestBed.createComponent(EditHistoryQueryItemModalComponent);
      fixture.componentInstance.prepareForEdition(itemList, item, historyId, null, southConnectorCommand, manifest, tableIndex);
      fixture.autoDetectChanges();
    };

    test('create mode should reject the name of any existing item', async () => {
      const fixture = TestBed.createComponent(EditHistoryQueryItemModalComponent);
      fixture.componentInstance.prepareForCreation(itemList, historyId, null, southConnectorCommand, manifest);
      fixture.autoDetectChanges();

      await typeName('brand new');
      await expect.element(mustBeUnique).not.toBeInTheDocument();

      await typeName(savedItem2.name);
      await expect.element(mustBeUnique).toBeInTheDocument();

      await typeName(unsavedItem1.name);
      await expect.element(mustBeUnique).toBeInTheDocument();
    });

    test('copy mode should reject the name of the copied item', async () => {
      const fixture = TestBed.createComponent(EditHistoryQueryItemModalComponent);
      fixture.componentInstance.prepareForCopy(itemList, savedItem1, historyId, null, southConnectorCommand, manifest);
      fixture.autoDetectChanges();

      await typeName(`${savedItem1.name}-copy`);
      await expect.element(mustBeUnique).not.toBeInTheDocument();

      await typeName(savedItem1.name);
      await expect.element(mustBeUnique).toBeInTheDocument();
    });

    test('edit mode should identify a saved item by its id rather than its table index', async () => {
      // the table index points to another item: only the id must be used to exclude the edited item
      openForEdition(savedItem2, 0);

      await typeName(savedItem2.name);
      await expect.element(mustBeUnique).not.toBeInTheDocument();

      await typeName(savedItem1.name);
      await expect.element(mustBeUnique).toBeInTheDocument();
    });

    test('edit mode should reject the name of an unsaved item when editing a saved item', async () => {
      openForEdition(savedItem1, 0);

      await typeName(unsavedItem1.name);
      await expect.element(mustBeUnique).toBeInTheDocument();
    });

    test('edit mode should identify an unsaved item by its table index', async () => {
      openForEdition(unsavedItem2, 3);

      await typeName(unsavedItem2.name);
      await expect.element(mustBeUnique).not.toBeInTheDocument();

      await typeName(unsavedItem1.name);
      await expect.element(mustBeUnique).toBeInTheDocument();

      await typeName(savedItem1.name);
      await expect.element(mustBeUnique).toBeInTheDocument();
    });
  });
});
