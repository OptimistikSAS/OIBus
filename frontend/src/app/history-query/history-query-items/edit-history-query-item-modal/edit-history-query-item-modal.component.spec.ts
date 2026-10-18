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
    const saveButton = page.getByRole('button', { name: 'Save', exact: true });
    const saveAndAddAnotherButton = page.getByRole('button', { name: 'Save & add another' });
    const nextButton = page.getByRole('button', { name: 'Next' });
    const backButton = page.getByRole('button', { name: 'Back' });
    const step = (name: 'general' | 'settings' | 'review') => page.getByCss(`#modal-step-${name}`);

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
      await expect.element(saveButton).not.toBeInTheDocument();
      await nextButton.click();
      await expect.element(step('settings')).toHaveAttribute('aria-current', 'step');
      await nextButton.click();
      const summaryValues = page.getByCss('#item-summary').getByRole('definition');
      await expect.element(summaryValues.nth(0)).toHaveTextContent('new item');
      await expect.element(summaryValues.nth(1)).toHaveTextContent('Disabled');
      await saveButton.click();

      expect(activeModal.close).toHaveBeenCalledWith(
        expect.objectContaining({ id: expect.stringMatching(/^temp_/), name: 'new item', enabled: false })
      );
    });

    test('should not open the next step without a name', async () => {
      createModal().prepareForCreation(itemList, historyId, null, testData.south.command, testData.south.manifest);

      await nextButton.click();

      await expect.element(step('general')).toHaveAttribute('aria-current', 'step');
      await expect.element(step('general')).toHaveClass('modal-step-invalid');
      await expect.element(page.getByText('This field is required')).toBeInTheDocument();
    });

    test('should go back to the General step to show a missing name on save', async () => {
      createModal().prepareForCreation(itemList, historyId, null, testData.south.command, testData.south.manifest);
      await step('review').click();
      await expect.element(backButton).toBeInTheDocument();

      await saveButton.click();

      expect(activeModal.close).not.toHaveBeenCalled();
      await expect.element(step('general')).toHaveAttribute('aria-current', 'step');
      await expect.element(step('general')).toHaveClass('modal-step-invalid');
      await expect.element(page.getByText('This field is required')).toBeInTheDocument();

      await nameInput.fill('new item');
      await expect.element(step('general')).not.toHaveClass('modal-step-invalid');
    });

    test('should close with the edited item, keeping its id', async () => {
      createModal().prepareForEdition(itemList, savedItem, historyId, null, testData.south.command, testData.south.manifest, 0);
      await expect.element(nameInput).toHaveValue(savedItem.name);

      await nameInput.fill('renamed');
      // an edited item is saved from any step
      await saveButton.click();

      expect(activeModal.close).toHaveBeenCalledWith(expect.objectContaining({ id: savedItem.id, name: 'renamed', enabled: true }));
    });

    test('should close with a copy of the item, without id', async () => {
      createModal().prepareForCopy(itemList, savedItem, historyId, null, testData.south.command, testData.south.manifest);
      await expect.element(nameInput).toHaveValue(`${savedItem.name}-copy`);

      await saveButton.click();

      expect(activeModal.close).toHaveBeenCalledWith(expect.objectContaining({ id: '', name: `${savedItem.name}-copy` }));
      // the copied item is left untouched
      expect(savedItem.id).toBe('historyQueryItem1');
    });

    test('should label the save button OK when the item is not saved directly', async () => {
      const modal = createModal();
      modal.directSave.set(false);
      modal.prepareForCreation(itemList, historyId, null, testData.south.command, testData.south.manifest);
      await step('review').click();

      await expect.element(page.getByRole('button', { name: 'OK', exact: true })).toBeInTheDocument();
      await expect.element(saveButton).not.toBeInTheDocument();
    });

    test('should ask for confirmation before dismissing unsaved changes', async () => {
      unsavedChangesConfirmation.confirmUnsavedChanges.mockReturnValue(of(false));
      const modal = createModal();
      modal.prepareForCreation(itemList, historyId, null, testData.south.command, testData.south.manifest);
      expect(modal.canDismiss()).toBe(true);

      await nameInput.fill('new item');

      await expect(firstValueFrom(modal.canDismiss() as Observable<boolean>)).resolves.toBe(false);
    });

    describe('save and add another', () => {
      test('should only be offered on the last step of a new item', async () => {
        createModal().prepareForCreation(itemList, historyId, null, testData.south.command, testData.south.manifest);
        await expect.element(nextButton).toBeInTheDocument();
        await expect.element(saveAndAddAnotherButton).not.toBeInTheDocument();

        await step('review').click();

        await expect.element(saveAndAddAnotherButton).toBeInTheDocument();
      });

      test.each(['edit' as const, 'copy' as const])('should not be offered in %s mode', async mode => {
        const modal = createModal();
        if (mode === 'edit') {
          modal.prepareForEdition(itemList, savedItem, historyId, null, testData.south.command, testData.south.manifest, 0);
        } else {
          modal.prepareForCopy(itemList, savedItem, historyId, null, testData.south.command, testData.south.manifest);
        }
        await step('review').click();

        await expect.element(saveButton).toBeInTheDocument();
        await expect.element(saveAndAddAnotherButton).not.toBeInTheDocument();
      });

      test('should save the new item and ask for another one', async () => {
        const modal = createModal();
        modal.prepareForCreation(itemList, historyId, null, testData.south.command, testData.south.manifest);
        await nameInput.fill('new item');
        await step('review').click();

        await saveAndAddAnotherButton.click();

        expect(activeModal.close).toHaveBeenCalledWith(expect.objectContaining({ name: 'new item' }));
        expect(modal.addAnother).toBe(true);
      });

      test('should not ask for another item when saved with the main action', async () => {
        const modal = createModal();
        modal.prepareForCreation(itemList, historyId, null, testData.south.command, testData.south.manifest);
        // an invalid attempt first, without a name: the main action must not reuse it
        await step('review').click();
        await saveAndAddAnotherButton.click();
        expect(activeModal.close).not.toHaveBeenCalled();

        await nameInput.fill('new item');
        await step('review').click();
        await saveButton.click();

        expect(activeModal.close).toHaveBeenCalledWith(expect.objectContaining({ name: 'new item' }));
        expect(modal.addAnother).toBe(false);
      });

      test('should be worded like the main action when the item is added in memory', async () => {
        const modal = createModal();
        modal.directSave.set(false);
        modal.prepareForCreation(itemList, historyId, null, testData.south.command, testData.south.manifest);
        await nameInput.fill('new item');
        await step('review').click();

        await page.getByRole('button', { name: 'OK & add another' }).click();

        expect(modal.addAnother).toBe(true);
      });

      test('should start the next item enabled or not like the previous one, with its own name', async () => {
        const previousItem: HistoryQueryItemCommandDTO = { ...testData.historyQueries.itemCommand, name: 'previous item', enabled: false };
        const modal = createModal();
        modal.prepareForCreation(
          [...itemList, previousItem],
          historyId,
          null,
          testData.south.command,
          testData.south.manifest,
          previousItem
        );

        await expect.element(step('general')).toHaveAttribute('aria-current', 'step');
        await expect.element(nameInput).toHaveValue('');
        await expect.element(enabledInput).not.toBeChecked();
        // nothing typed yet: no confirmation before dismissing
        expect(modal.canDismiss()).toBe(true);

        // the name of the item just added is taken
        await nameInput.fill(previousItem.name);
        await userEvent.tab();
        await expect.element(page.getByText('Must be unique')).toBeInTheDocument();

        await nameInput.fill('next item');
        await step('review').click();
        await saveButton.click();
        expect(activeModal.close).toHaveBeenCalledWith(expect.objectContaining({ name: 'next item', enabled: false }));
      });
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
