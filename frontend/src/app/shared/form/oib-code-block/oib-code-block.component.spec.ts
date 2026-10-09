import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';

import { beforeEach, describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { OibCodeBlockComponent } from './oib-code-block.component';

@Component({
  template: `<oib-code-block [formControl]="control" [language]="language()" [readOnly]="readOnly()" [height]="height()" [key]="key()" />`,
  imports: [OibCodeBlockComponent, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestHostComponent {
  readonly control = new FormControl<string | null>('initial');
  readonly language = signal('json');
  readonly readOnly = signal(false);
  readonly height = signal('30rem');
  readonly key = signal('');
}

class TestHostComponentTester {
  readonly fixture = TestBed.createComponent(TestHostComponent);
  readonly host = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly editor = this.root.getByRole('textbox');
  readonly codeBlock = this.root.getByCss('oib-code-block');
  readonly container = this.root.getByCss('.editor-container');
}

describe('OibCodeBlockComponent', () => {
  let tester: TestHostComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    tester = new TestHostComponentTester();
  });

  test('should display the value of the control in an editable editor', async () => {
    await expect.element(tester.editor).toHaveTextContent('initial');
    await expect.element(tester.editor).toHaveAttribute('contenteditable', 'true');
    await expect.element(tester.codeBlock).toHaveStyle('--oib-code-block-height: 30rem');
    await expect.element(tester.container).toHaveAttribute('id', 'oib-code-block-input-');
  });

  test('should display a value written from outside, without marking the control as dirty', async () => {
    tester.host.control.setValue('{"updated": true}');

    await expect.element(tester.editor).toHaveTextContent('{"updated": true}');
    expect(tester.host.control.dirty).toBe(false);

    tester.host.control.setValue(null);
    await expect.element(tester.editor).toHaveTextContent('');
  });

  test('should update the control when typing', async () => {
    await tester.editor.fill('{"typed": 1}');

    expect(tester.host.control.value).toBe('{"typed": 1}');
    expect(tester.host.control.dirty).toBe(true);
  });

  test('should mark the control as touched on blur', async () => {
    await tester.editor.click();
    expect(tester.host.control.touched).toBe(false);

    await userEvent.tab();

    expect(tester.host.control.touched).toBe(true);
  });

  test('should not be editable when disabled', async () => {
    tester.host.control.disable();
    await expect.element(tester.editor).toHaveAttribute('contenteditable', 'false');

    tester.host.control.enable();
    await expect.element(tester.editor).toHaveAttribute('contenteditable', 'true');
  });

  test('should not be editable when read only', async () => {
    tester.host.readOnly.set(true);

    await expect.element(tester.editor).toHaveAttribute('contenteditable', 'false');
  });

  test('should apply the height, the key and the language inputs', async () => {
    tester.host.height.set('10rem');
    tester.host.key.set('my-key');
    tester.host.language.set('sql');

    await expect.element(tester.codeBlock).toHaveStyle('--oib-code-block-height: 10rem');
    await expect.element(tester.container).toHaveAttribute('id', 'oib-code-block-input-my-key');
    await expect.element(tester.editor).toHaveTextContent('initial');
  });

  test.each(['javascript', 'typescript', 'sql', 'json', 'cobol'])('should change the language to %s', async language => {
    await expect.element(tester.editor).toBeInTheDocument();
    const codeBlock = tester.fixture.debugElement.query(By.directive(OibCodeBlockComponent)).injector.get(OibCodeBlockComponent);

    expect(() => codeBlock.changeLanguage(language)).not.toThrow();
    await expect.element(tester.editor).toHaveTextContent('initial');
  });

  test('should destroy the editor with the component', async () => {
    await expect.element(tester.editor).toBeInTheDocument();

    tester.fixture.destroy();

    await expect.element(tester.root.getByCss('.cm-editor')).not.toBeInTheDocument();
  });
});
