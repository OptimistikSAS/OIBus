import { TestBed } from '@angular/core/testing';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { AuditDiffComponent } from './audit-diff.component';

class AuditDiffComponentTester {
  readonly fixture = TestBed.createComponent(AuditDiffComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly rows = this.root.getByCss('tbody tr');
}

describe('AuditDiffComponent', () => {
  let tester: AuditDiffComponentTester;

  const setInputs = (previousState: Record<string, unknown> | null, newState: Record<string, unknown> | null) => {
    tester = new AuditDiffComponentTester();
    tester.fixture.componentRef.setInput('previousState', previousState);
    tester.fixture.componentRef.setInput('newState', newState);
    tester.fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });
  });

  test('should render a diff with one changed and one unchanged field', async () => {
    setInputs({ name: 'old-name', settings: 'same' }, { name: 'new-name', settings: 'same' });

    await expect.element(tester.rows.nth(0)).toHaveTextContent('name');
    await expect.element(tester.rows.nth(0)).toHaveTextContent('old-name');
    await expect.element(tester.rows.nth(0)).toHaveTextContent('new-name');
    await expect.element(tester.rows.nth(0)).toHaveClass('audit-diff-changed');

    await expect.element(tester.rows.nth(1)).toHaveTextContent('settings');
    await expect.element(tester.rows.nth(1)).not.toHaveClass('audit-diff-changed');
  });

  test('should render a dash for every "before" cell on CREATE (previousState is null)', async () => {
    setInputs(null, { name: 'new-name', settings: 'same' });

    await expect.element(tester.rows.nth(0)).toHaveTextContent('—');
    await expect.element(tester.rows.nth(1)).toHaveTextContent('—');
  });

  test('should render a dash for every "after" cell on DELETE (newState is null)', async () => {
    setInputs({ name: 'old-name', settings: 'same' }, null);

    const cells = tester.root.getByCss('tbody tr td:last-child');
    await expect.element(cells.nth(0)).toHaveTextContent('—');
    await expect.element(cells.nth(1)).toHaveTextContent('—');
  });
});
