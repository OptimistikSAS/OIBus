import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { firstValueFrom, Observable, of } from 'rxjs';
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
  let unsavedChangesConfirmation: MockObject<UnsavedChangesConfirmationService>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    unsavedChangesConfirmation = createMock(UnsavedChangesConfirmationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideHttpClientTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: UnsavedChangesConfirmationService, useValue: unsavedChangesConfirmation }
      ]
    });

    // registers the default validation error messages
    TestBed.createComponent(DefaultValidationErrorsComponent);
  });

  describe('save', () => {
    const historyId = testData.historyQueries.list[0].id;
    const savedItem = testData.historyQueries.list[0].items[0];
    const itemList = testData.historyQueries.list[0].items;
    const nameInput = page.getByLabelText('Name', { exact: true });
    const enabledInput = page.getByLabelText('Enable');

    function createModal() {
      return TestBed.createComponent(EditHistoryQueryItemModalComponent).componentInstance;
    }

    test('should dismiss on cancel', async () => {
      createModal().prepareForCreation(itemList, historyId, null, testData.south.command, testData.south.manifest);

      await page.getByRole('button', { name: 'Cancel' }).last().click();

      expect(activeModal.dismiss).toHaveBeenCalled();
    });

    test('should close with a new item', async () => {
      const modal = createModal();
      modal.prepareForCreation(itemList, historyId, null, testData.south.command, testData.south.manifest);
      await expect.element(page.getByRole('heading', { name: 'Add a new item to the south connector' })).toBeInTheDocument();

      await nameInput.fill('new item');
      await enabledInput.click();
      await page.getByRole('button', { name: 'Save' }).click();

      expect(activeModal.close).toHaveBeenCalledWith(
        expect.objectContaining({ id: expect.stringMatching(/^temp_/), name: 'new item', enabled: false })
      );
    });

    test('should not close without a name', async () => {
      createModal().prepareForCreation(itemList, historyId, null, testData.south.command, testData.south.manifest);

      await page.getByRole('button', { name: 'Save' }).click();

      expect(activeModal.close).not.toHaveBeenCalled();
      await expect.element(page.getByText('This field is required')).toBeInTheDocument();
    });

    test('should close with the edited item, keeping its id', async () => {
      createModal().prepareForEdition(itemList, savedItem, historyId, null, testData.south.command, testData.south.manifest, 0);
      await expect.element(nameInput).toHaveValue(savedItem.name);

      await nameInput.fill('renamed');
      await page.getByRole('button', { name: 'Save' }).click();

      expect(activeModal.close).toHaveBeenCalledWith(expect.objectContaining({ id: savedItem.id, name: 'renamed', enabled: true }));
    });

    test('should close with a copy of the item, without id', async () => {
      createModal().prepareForCopy(itemList, savedItem, historyId, null, testData.south.command, testData.south.manifest);
      await expect.element(nameInput).toHaveValue(`${savedItem.name}-copy`);

      await page.getByRole('button', { name: 'Save' }).click();

      expect(activeModal.close).toHaveBeenCalledWith(expect.objectContaining({ id: '', name: `${savedItem.name}-copy` }));
      // the copied item is left untouched
      expect(savedItem.id).toBe('historyQueryItem1');
    });

    test('should label the save button OK when the item is not saved directly', async () => {
      const modal = createModal();
      modal.directSave.set(false);
      modal.prepareForCreation(itemList, historyId, null, testData.south.command, testData.south.manifest);

      await expect.element(page.getByRole('button', { name: 'OK' })).toBeInTheDocument();
      await expect.element(page.getByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    });

    test('should ask for confirmation before dismissing unsaved changes', async () => {
      unsavedChangesConfirmation.confirmUnsavedChanges.mockReturnValue(of(false));
      const modal = createModal();
      modal.prepareForCreation(itemList, historyId, null, testData.south.command, testData.south.manifest);
      expect(modal.canDismiss()).toBe(true);

      await nameInput.fill('new item');

      await expect(firstValueFrom(modal.canDismiss() as Observable<boolean>)).resolves.toBe(false);
    });
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
    };

    test('create mode should reject the name of any existing item', async () => {
      const fixture = TestBed.createComponent(EditHistoryQueryItemModalComponent);
      fixture.componentInstance.prepareForCreation(itemList, historyId, null, southConnectorCommand, manifest);

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
