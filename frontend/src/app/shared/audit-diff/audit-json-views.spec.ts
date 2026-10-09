import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { MergeView } from '@codemirror/merge';
import { EditorView } from '@codemirror/view';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Locator, page } from 'vitest/browser';

import { AuditJsonDiffComponent } from './audit-json-diff.component';
import { AuditJsonSideBySideComponent } from './audit-json-side-by-side.component';

interface JsonViewCase {
  name: string;
  component: Type<AuditJsonDiffComponent | AuditJsonSideBySideComponent>;
  /** the prototype of the CodeMirror view created by the component */
  viewPrototype: { destroy(): void };
  /** the editor displaying the previous state */
  previousEditor: (root: Locator) => Locator;
  /** the editor displaying the new state */
  newEditor: (root: Locator) => Locator;
}

const cases: Array<JsonViewCase> = [
  {
    // a single unified diff editor
    name: 'AuditJsonDiffComponent',
    component: AuditJsonDiffComponent,
    viewPrototype: EditorView.prototype,
    previousEditor: root => root.getByCss('.cm-editor'),
    newEditor: root => root.getByCss('.cm-editor')
  },
  {
    // previous state on the left, new state on the right
    name: 'AuditJsonSideBySideComponent',
    component: AuditJsonSideBySideComponent,
    viewPrototype: MergeView.prototype,
    previousEditor: root => root.getByCss('.cm-editor').nth(0),
    newEditor: root => root.getByCss('.cm-editor').nth(1)
  }
];

describe.each(cases)('$name', ({ component, viewPrototype, previousEditor, newEditor }) => {
  let fixture: ReturnType<typeof TestBed.createComponent<AuditJsonDiffComponent | AuditJsonSideBySideComponent>>;
  let root: Locator;

  const setInputs = (previousState: Record<string, unknown> | null, newState: Record<string, unknown> | null) => {
    fixture.componentRef.setInput('previousState', previousState);
    fixture.componentRef.setInput('newState', newState);
  };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(component);
    root = page.elementLocator(fixture.nativeElement);
  });

  test('should render the previous and the new values of an update', async () => {
    setInputs({ name: 'old-name' }, { name: 'new-name' });

    await expect.element(previousEditor(root)).toMatchTextContent('old-name');
    await expect.element(newEditor(root)).toMatchTextContent('new-name');
  });

  test('should render the new state on CREATE (previousState is null)', async () => {
    setInputs(null, { name: 'new-name' });

    await expect.element(newEditor(root)).toMatchTextContent('new-name');
  });

  test('should render the previous state on DELETE (newState is null)', async () => {
    setInputs({ name: 'old-name' }, null);

    await expect.element(previousEditor(root)).toMatchTextContent('old-name');
  });

  test('should destroy the previous view and render the new content when inputs change on a mounted instance', async () => {
    setInputs({ name: 'alpha-value' }, { name: 'beta-value' });
    await expect.element(newEditor(root)).toMatchTextContent('beta-value');
    const destroySpy = vi.spyOn(viewPrototype, 'destroy');

    setInputs({ name: 'gamma-value' }, { name: 'delta-value' });

    await expect.element(previousEditor(root)).toMatchTextContent('gamma-value');
    await expect.element(newEditor(root)).toMatchTextContent('delta-value');
    await expect.element(previousEditor(root)).not.toMatchTextContent('alpha-value');
    expect(destroySpy).toHaveBeenCalledTimes(1);
  });

  test('should destroy the view when the component is destroyed', async () => {
    setInputs({ name: 'old-name' }, { name: 'new-name' });
    await expect.element(newEditor(root)).toMatchTextContent('new-name');
    const destroySpy = vi.spyOn(viewPrototype, 'destroy');

    fixture.destroy();

    expect(destroySpy).toHaveBeenCalledTimes(1);
  });
});
