import { TestBed } from '@angular/core/testing';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { MergeView } from '@codemirror/merge';
import { AuditJsonSideBySideComponent } from './audit-json-side-by-side.component';

class AuditJsonSideBySideComponentTester {
  readonly fixture = TestBed.createComponent(AuditJsonSideBySideComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
}

describe('AuditJsonSideBySideComponent', () => {
  let tester: AuditJsonSideBySideComponentTester;

  const setInputs = (previousState: Record<string, unknown> | null, newState: Record<string, unknown> | null) => {
    tester = new AuditJsonSideBySideComponentTester();
    tester.fixture.componentRef.setInput('previousState', previousState);
    tester.fixture.componentRef.setInput('newState', newState);
    tester.fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  test('should render both editors, previous state on the left and new state on the right', async () => {
    setInputs({ name: 'old-name' }, { name: 'new-name' });

    const editors = tester.root.getByCss('.cm-editor');
    await expect.element(editors.nth(0)).toHaveTextContent('old-name');
    await expect.element(editors.nth(1)).toHaveTextContent('new-name');
  });

  test('should render an empty object on the left for CREATE (previousState is null)', async () => {
    setInputs(null, { name: 'new-name' });

    const editors = tester.root.getByCss('.cm-editor');
    await expect.element(editors.nth(1)).toHaveTextContent('new-name');
  });

  test('should render an empty object on the right for DELETE (newState is null)', async () => {
    setInputs({ name: 'old-name' }, null);

    const editors = tester.root.getByCss('.cm-editor');
    await expect.element(editors.nth(0)).toHaveTextContent('old-name');
  });

  test('should destroy the previous merge view and render the new content when inputs change on a mounted instance', async () => {
    setInputs({ name: 'alpha-value' }, { name: 'beta-value' });
    const editors = tester.root.getByCss('.cm-editor');
    await expect.element(editors.nth(1)).toHaveTextContent('beta-value');

    const destroySpy = vi.spyOn(MergeView.prototype, 'destroy');

    tester.fixture.componentRef.setInput('previousState', { name: 'gamma-value' });
    tester.fixture.componentRef.setInput('newState', { name: 'delta-value' });
    tester.fixture.detectChanges();

    expect(destroySpy).toHaveBeenCalledTimes(1);
    await expect.element(editors.nth(0)).toHaveTextContent('gamma-value');
    await expect.element(editors.nth(1)).toHaveTextContent('delta-value');
    await expect.element(editors.nth(0)).not.toHaveTextContent('alpha-value');

    destroySpy.mockRestore();
  });

  test('should destroy the merge view when the component is destroyed', () => {
    setInputs({ name: 'old-name' }, { name: 'new-name' });

    const destroySpy = vi.spyOn(MergeView.prototype, 'destroy');
    tester.fixture.destroy();

    expect(destroySpy).toHaveBeenCalledTimes(1);
    destroySpy.mockRestore();
  });
});
