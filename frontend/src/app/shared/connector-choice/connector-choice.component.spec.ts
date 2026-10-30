import { Component, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NonNullableFormBuilder } from '@angular/forms';

import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { SouthType } from '@oibus/shared/connector/south-manifest.model';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { DefaultValidationErrorsComponent } from '../default-validation-errors/default-validation-errors.component';
import { ConnectorChoiceComponent, createConnectorChoiceForm } from './connector-choice.component';

const modes = { subscription: false, lastPoint: false, lastFile: false, history: true };
const southTypes: Array<SouthType> = [
  { id: 'folder-scanner', category: 'file', modes: { ...modes, lastFile: true, history: false } },
  { id: 'mssql', category: 'database', modes },
  { id: 'influxdb', category: 'database', beta: true, modes }
];

@Component({
  template: `<oib-connector-choice
    side="south"
    titleKey="common.connector-choice.south"
    [form]="form"
    [existing]="existing()"
    [types]="types"
  />`,
  imports: [ConnectorChoiceComponent]
})
class TestComponent {
  readonly form = createConnectorChoiceForm(inject(NonNullableFormBuilder), false);
  readonly existing = signal([
    { id: 'southId1', name: 'South 1', type: 'folder-scanner' },
    { id: 'southId2', name: 'South 2', type: 'mssql' }
  ]);
  readonly types = southTypes;
}

class ConnectorChoiceComponentTester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly form = this.fixture.componentInstance.form;
  readonly title = this.root.getByRole('heading', { level: 5 });
  readonly cards = this.root.getByCss('.connector-choice');

  mode(name: 'Duplicate existing' | 'New settings') {
    return this.root.getByRole('button', { name, exact: true });
  }

  card(name: string) {
    return this.root.getByRole('button', { name: new RegExp(`^${name}`) });
  }
}

describe('ConnectorChoiceComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    // registers the default validation error messages
    TestBed.createComponent(DefaultValidationErrorsComponent);
  });

  test('should choose a type, by category', async () => {
    const tester = new ConnectorChoiceComponentTester();

    await expect.element(tester.title).toHaveTextContent('South connector');
    await expect.element(tester.mode('New settings')).toHaveAttribute('aria-pressed', 'true');
    await expect.element(tester.root.getByRole('group', { name: 'File' })).toBeInTheDocument();
    await expect.element(tester.root.getByRole('group', { name: 'Database' })).toBeInTheDocument();
    await expect.element(tester.cards).toHaveLength(3);
    await expect.element(tester.card('Microsoft SQL Server™')).toMatchTextContent(/Query Microsoft SQL Server™ databases/);

    await tester.card('Microsoft SQL Server™').click();

    await expect.element(tester.card('Microsoft SQL Server™')).toHaveAttribute('aria-pressed', 'true');
    await expect.element(tester.card('Folder scanner')).toHaveAttribute('aria-pressed', 'false');
    expect(tester.form.value).toEqual({ fromExisting: false, type: 'mssql' });
    expect(tester.form.dirty).toBe(true);
  });

  test('should display a beta badge only for beta types', async () => {
    const tester = new ConnectorChoiceComponentTester();

    await expect.element(tester.card('Microsoft SQL Server™').getByText('Beta')).not.toBeInTheDocument();
    await expect.element(tester.card('InfluxDB').getByText('Beta')).toBeVisible();
  });

  test('should choose an existing connector to duplicate', async () => {
    const tester = new ConnectorChoiceComponentTester();

    await tester.mode('Duplicate existing').click();
    await expect.element(tester.mode('Duplicate existing')).toHaveAttribute('aria-pressed', 'true');
    await expect.element(tester.cards).toHaveLength(2);
    await expect.element(tester.card('South 2')).toMatchTextContent(/Microsoft SQL Server™/);

    await tester.card('South 2').click();

    await expect.element(tester.card('South 2')).toHaveAttribute('aria-pressed', 'true');
    expect(tester.form.value).toEqual({ fromExisting: true, id: 'southId2' });
  });

  test('should require the existing connector or the type of the chosen mode', async () => {
    const tester = new ConnectorChoiceComponentTester();
    await tester.card('Folder scanner').click();
    await tester.mode('Duplicate existing').click();

    tester.form.markAllAsTouched();

    await expect.element(tester.root.getByText('This field is required')).toBeVisible();
    expect(tester.form.valid).toBe(false);
    await tester.mode('New settings').click();
    await expect.element(tester.root.getByText('This field is required')).not.toBeInTheDocument();
    expect(tester.form.valid).toBe(true);
  });

  test('should not offer to duplicate without any existing connector', async () => {
    const tester = new ConnectorChoiceComponentTester();
    tester.fixture.componentInstance.existing.set([]);

    await expect.element(tester.mode('Duplicate existing')).not.toBeInTheDocument();
    await expect.element(tester.mode('New settings')).toHaveAttribute('aria-pressed', 'true');
  });
});
