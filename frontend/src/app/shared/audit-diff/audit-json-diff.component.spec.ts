import { TestBed } from '@angular/core/testing';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { EditorView } from '@codemirror/view';
import { AuditJsonDiffComponent } from './audit-json-diff.component';

class AuditJsonDiffComponentTester {
  readonly fixture = TestBed.createComponent(AuditJsonDiffComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
}

describe('AuditJsonDiffComponent', () => {
  let tester: AuditJsonDiffComponentTester;

  const setInputs = (previousState: Record<string, unknown> | null, newState: Record<string, unknown> | null) => {
    tester = new AuditJsonDiffComponentTester();
    tester.fixture.componentRef.setInput('previousState', previousState);
    tester.fixture.componentRef.setInput('newState', newState);
    tester.fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  test('should render both the removed and added values for an update', async () => {
    setInputs({ name: 'old-name' }, { name: 'new-name' });

    await expect.element(tester.root.getByCss('.cm-editor')).toHaveTextContent('old-name');
    await expect.element(tester.root.getByCss('.cm-editor')).toHaveTextContent('new-name');
  });

  test('should render only the new state on CREATE (previousState is null)', async () => {
    setInputs(null, { name: 'new-name' });

    await expect.element(tester.root.getByCss('.cm-editor')).toHaveTextContent('new-name');
  });

  test('should render only the previous state on DELETE (newState is null)', async () => {
    setInputs({ name: 'old-name' }, null);

    await expect.element(tester.root.getByCss('.cm-editor')).toHaveTextContent('old-name');
  });

  test('should destroy the previous editor view and render the new content when inputs change on a mounted instance', async () => {
    setInputs({ name: 'alpha-value' }, { name: 'beta-value' });
    await expect.element(tester.root.getByCss('.cm-editor')).toHaveTextContent('beta-value');

    const destroySpy = vi.spyOn(EditorView.prototype, 'destroy');

    tester.fixture.componentRef.setInput('previousState', { name: 'gamma-value' });
    tester.fixture.componentRef.setInput('newState', { name: 'delta-value' });
    tester.fixture.detectChanges();

    expect(destroySpy).toHaveBeenCalledTimes(1);
    await expect.element(tester.root.getByCss('.cm-editor')).toHaveTextContent('gamma-value');
    await expect.element(tester.root.getByCss('.cm-editor')).toHaveTextContent('delta-value');
    await expect.element(tester.root.getByCss('.cm-editor')).not.toHaveTextContent('alpha-value');

    destroySpy.mockRestore();
  });

  test('should destroy the editor view when the component is destroyed', () => {
    setInputs({ name: 'old-name' }, { name: 'new-name' });

    const destroySpy = vi.spyOn(EditorView.prototype, 'destroy');
    tester.fixture.destroy();

    expect(destroySpy).toHaveBeenCalledTimes(1);
    destroySpy.mockRestore();
  });
});
