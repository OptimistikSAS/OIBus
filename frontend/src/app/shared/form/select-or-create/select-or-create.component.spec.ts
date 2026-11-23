import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

import { Observable, of, Subject } from 'rxjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { DefaultValidationErrorsComponent } from '../../default-validation-errors/default-validation-errors.component';
import { OptionCreator, SelectOption, SelectOrCreateComponent, withCreated } from './select-or-create.component';
import { chooseSelectOrCreateEntry, selectOrCreateEntryNames } from './select-or-create.testing';

const options: Array<SelectOption> = [
  { id: 'id1', name: 'Option 1' },
  { id: 'id2', name: 'Option 2' }
];

class TestCreator implements OptionCreator<SelectOption> {
  readonly createLabel = 'engine.certificate.create-new';
  readonly created = signal<Array<SelectOption>>([]);
  readonly creations = new Subject<SelectOption>();

  create(): Observable<SelectOption> {
    return this.creations;
  }
}

@Component({
  template: `
    <oib-default-validation-errors />
    <label for="option" translate>Option</label>
    <oib-select-or-create
      [formControl]="control"
      inputId="option"
      [options]="options"
      [bindValue]="bindValue()"
      [noneLabel]="noneLabel()"
      [placeholder]="placeholder()"
      [creator]="creator()"
    />
  `,
  imports: [ReactiveFormsModule, SelectOrCreateComponent, DefaultValidationErrorsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestComponent {
  readonly control = new FormControl<string | SelectOption | null>(null);
  readonly options = options;
  readonly bindValue = signal<'id' | 'option'>('id');
  readonly noneLabel = signal<string | null>(null);
  readonly placeholder = signal<string | null>(null);
  readonly creator = signal<TestCreator | null>(null);
}

class SelectOrCreateComponentTester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly select = this.root.getByLabelText('Option');
}

describe('SelectOrCreateComponent', () => {
  let tester: SelectOrCreateComponentTester;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    tester = new SelectOrCreateComponentTester();
    await tester.fixture.whenStable();
  });

  test('should list the options, without entry selecting none or creating one', async () => {
    expect(await selectOrCreateEntryNames(tester.select)).toEqual(['Option 1', 'Option 2']);
    await expect.element(tester.select).toHaveTextContent('');
  });

  test('should select the id of an option, and display it', async () => {
    await chooseSelectOrCreateEntry(tester.select, 'Option 2');

    expect(tester.fixture.componentInstance.control.value).toBe('id2');
    expect(tester.fixture.componentInstance.control.touched).toBe(true);
    await expect.element(tester.select).toHaveTextContent('Option 2');
  });

  test('should select an option itself', async () => {
    tester.fixture.componentInstance.bindValue.set('option');
    await tester.fixture.whenStable();

    await chooseSelectOrCreateEntry(tester.select, 'Option 1');

    expect(tester.fixture.componentInstance.control.value).toBe(options[0]);
  });

  test('should display a value written from outside, an id or an option', async () => {
    tester.fixture.componentInstance.control.setValue('id1');
    await expect.element(tester.select).toHaveTextContent('Option 1');

    tester.fixture.componentInstance.control.setValue({ id: 'id2', name: 'Another copy of Option 2' });
    await expect.element(tester.select).toHaveTextContent('Option 2');

    tester.fixture.componentInstance.control.setValue(null);
    await expect.element(tester.select).toHaveTextContent('');
  });

  test('should offer to select none', async () => {
    tester.fixture.componentInstance.noneLabel.set('engine.certificate.none');
    tester.fixture.componentInstance.control.setValue('id1');
    await tester.fixture.whenStable();

    expect(await selectOrCreateEntryNames(tester.select)).toEqual(['No certificate', 'Option 1', 'Option 2']);
    await chooseSelectOrCreateEntry(tester.select, 'No certificate');

    expect(tester.fixture.componentInstance.control.value).toBeNull();
    await expect.element(tester.select).toHaveTextContent('No certificate');
  });

  test('should display the placeholder while no option is selected', async () => {
    tester.fixture.componentInstance.placeholder.set('south.items.select-scan-mode');
    await tester.fixture.whenStable();

    await expect.element(tester.select).toHaveTextContent('Select a schedule');
    expect(await selectOrCreateEntryNames(tester.select)).toEqual(['Option 1', 'Option 2']);
  });

  test('should create an option, and select it', async () => {
    const creator = new TestCreator();
    vi.spyOn(creator, 'create');
    tester.fixture.componentInstance.creator.set(creator);
    await tester.fixture.whenStable();

    expect(await selectOrCreateEntryNames(tester.select)).toEqual(['Option 1', 'Option 2', 'Create a new certificate...']);
    await chooseSelectOrCreateEntry(tester.select, 'Create a new certificate...');
    expect(creator.create).toHaveBeenCalled();

    const created = { id: 'id3', name: 'Option 3' };
    creator.created.set([created]);
    creator.creations.next(created);

    expect(tester.fixture.componentInstance.control.value).toBe('id3');
    await expect.element(tester.select).toHaveTextContent('Option 3');
    expect(await selectOrCreateEntryNames(tester.select)).toEqual(['Option 1', 'Option 2', 'Option 3', 'Create a new certificate...']);
  });

  test('should list the options created elsewhere', async () => {
    const creator = new TestCreator();
    creator.created.set([options[1], { id: 'id3', name: 'Option 3' }]);
    tester.fixture.componentInstance.creator.set(creator);
    await tester.fixture.whenStable();

    expect(await selectOrCreateEntryNames(tester.select)).toEqual(['Option 1', 'Option 2', 'Option 3', 'Create a new certificate...']);
  });

  test('should not select anything when the creation is cancelled', async () => {
    const creator = new TestCreator();
    vi.spyOn(creator, 'create').mockReturnValue(of());
    tester.fixture.componentInstance.creator.set(creator);
    tester.fixture.componentInstance.control.setValue('id1');
    await tester.fixture.whenStable();

    await chooseSelectOrCreateEntry(tester.select, 'Create a new certificate...');

    expect(tester.fixture.componentInstance.control.value).toBe('id1');
  });

  test('should be disabled with its control', async () => {
    tester.fixture.componentInstance.control.disable();

    await expect.element(tester.select).toBeDisabled();
  });

  test('should show that its control is invalid once touched', async () => {
    const control = tester.fixture.componentInstance.control;
    control.setValidators(Validators.required);
    control.updateValueAndValidity();
    await expect.element(tester.select).not.toHaveClass('is-invalid');

    control.markAsTouched();

    await expect.element(tester.select).toHaveClass('is-invalid');
  });

  test('should add the created options missing from the options', () => {
    expect(withCreated(options, [options[0], { id: 'id3', name: 'Option 3' }])).toEqual([...options, { id: 'id3', name: 'Option 3' }]);
  });
});
