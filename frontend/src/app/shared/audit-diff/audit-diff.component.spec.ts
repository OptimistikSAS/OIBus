import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { AuditDiffComponent } from './audit-diff.component';

class AuditDiffComponentTester {
  readonly fixture = TestBed.createComponent(AuditDiffComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly headers = this.root.getByCss('thead th');
  readonly rows = this.root.getByCss('tbody tr');

  cell(row: number, column: number) {
    return this.rows.nth(row).getByRole('cell').nth(column);
  }
}

describe('AuditDiffComponent', () => {
  let tester: AuditDiffComponentTester;

  const setInputs = (previousState: Record<string, unknown> | null, newState: Record<string, unknown> | null) => {
    tester = new AuditDiffComponentTester();
    tester.fixture.componentRef.setInput('previousState', previousState);
    tester.fixture.componentRef.setInput('newState', newState);
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });
  });

  test('should render a diff sorted by field, highlighting the changed fields', async () => {
    setInputs({ settings: 'same', name: 'old-name' }, { name: 'new-name', settings: 'same' });

    await expect.element(tester.headers).toHaveLength(3);
    await expect.element(tester.headers.nth(1)).toHaveTextContent('Before');
    await expect.element(tester.rows).toHaveLength(2);
    await expect.element(tester.cell(0, 0)).toHaveTextContent('name');
    await expect.element(tester.cell(0, 1)).toHaveTextContent('old-name');
    await expect.element(tester.cell(0, 2)).toHaveTextContent('new-name');
    await expect.element(tester.rows.nth(0)).toHaveClass('table-warning');
    await expect.element(tester.cell(1, 0)).toHaveTextContent('settings');
    await expect.element(tester.rows.nth(1)).not.toHaveClass('table-warning');
  });

  test('should render a dash for every "before" cell on CREATE (previousState is null)', async () => {
    setInputs(null, { name: 'new-name', settings: 'same' });

    await expect.element(tester.cell(0, 1)).toHaveTextContent('—');
    await expect.element(tester.cell(1, 1)).toHaveTextContent('—');
    await expect.element(tester.rows.nth(1)).toHaveClass('table-warning');
  });

  test('should render a dash for every "after" cell on DELETE (newState is null)', async () => {
    setInputs({ name: 'old-name', settings: 'same' }, null);

    await expect.element(tester.cell(0, 2)).toHaveTextContent('—');
    await expect.element(tester.cell(1, 2)).toHaveTextContent('—');
  });

  test('should format objects as JSON and null values as null', async () => {
    setInputs({ caching: { enabled: true }, description: null, count: 3 }, { caching: { enabled: false }, description: 'text', count: 3 });

    await expect.element(tester.cell(0, 0)).toHaveTextContent('caching');
    await expect.element(tester.cell(0, 1)).toHaveTextContent('{"enabled":true}');
    await expect.element(tester.cell(0, 2)).toHaveTextContent('{"enabled":false}');
    await expect.element(tester.cell(1, 1)).toHaveTextContent('3');
    await expect.element(tester.rows.nth(1)).not.toHaveClass('table-warning');
    await expect.element(tester.cell(2, 1)).toHaveTextContent('null');
    await expect.element(tester.cell(2, 2)).toHaveTextContent('text');
  });
});
