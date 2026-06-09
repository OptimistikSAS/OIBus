import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ChangeDetectionStrategy, Component } from '@angular/core';

import { OibCodeBlockComponent } from './oib-code-block.component';
import { beforeEach, describe, expect, test, vi } from 'vitest';

/** Minimal host that wires the component as a reactive form control. */
@Component({
  template: `<oib-code-block [formControl]="control" [language]="language" [readOnly]="readOnly" />`,
  imports: [OibCodeBlockComponent, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestHostComponent {
  control = new FormControl('initial');
  language = 'json';
  readOnly = false;
}

describe('OibCodeBlockComponent', () => {
  let component: OibCodeBlockComponent;
  let fixture: ComponentFixture<OibCodeBlockComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OibCodeBlockComponent, TestHostComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(OibCodeBlockComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  test('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Editor initialisation', () => {
    test('should mount a CodeMirror editor inside the container', () => {
      expect(fixture.nativeElement.querySelector('.cm-editor')).toBeTruthy();
    });

    test('should apply the default height (30rem) to the container', () => {
      const container: HTMLElement = fixture.nativeElement.querySelector('.editor-container');
      expect(container.style.height).toBe('30rem');
    });

    test('should apply a custom height when the input changes', () => {
      fixture.componentRef.setInput('height', '50rem');
      fixture.detectChanges();
      const container: HTMLElement = fixture.nativeElement.querySelector('.editor-container');
      expect(container.style.height).toBe('50rem');
    });

    test('should set the container id from the key input', () => {
      fixture.componentRef.setInput('key', 'my-key');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('#oib-code-block-input-my-key')).toBeTruthy();
    });

    test('should start with an empty key when the key input is not provided', () => {
      expect(fixture.nativeElement.querySelector('#oib-code-block-input-')).toBeTruthy();
    });
  });

  describe('ControlValueAccessor', () => {
    let onChangeSpy: ReturnType<typeof vi.fn>;
    let onTouchedSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      onChangeSpy = vi.fn();
      onTouchedSpy = vi.fn();
      component.registerOnChange(onChangeSpy as unknown as (value: string) => void);
      component.registerOnTouched(onTouchedSpy as unknown as () => void);
    });

    describe('writeValue', () => {
      test('should set the editor content', () => {
        component.writeValue('hello world');
        expect(component['editorView']!.state.doc.toString()).toBe('hello world');
      });

      test('should replace existing content', () => {
        component.writeValue('first');
        component.writeValue('second');
        expect(component['editorView']!.state.doc.toString()).toBe('second');
      });

      test('should treat null as an empty string', () => {
        component.writeValue(null as any);
        expect(component['editorView']!.state.doc.toString()).toBe('');
      });

      test('should NOT call onChange — programmatic writes must not feed back into the form', () => {
        component.writeValue('programmatic content');
        expect(onChangeSpy).not.toHaveBeenCalled();
      });
    });

    describe('pending value (writeValue before the editor is ready)', () => {
      test('should queue the value and apply it once the editor initialises', () => {
        const earlyFixture = TestBed.createComponent(OibCodeBlockComponent);
        const earlyComponent = earlyFixture.componentInstance;

        earlyComponent.writeValue('queued value');
        expect(earlyComponent['editorView']).toBeNull();
        expect(earlyComponent['pendingValue']).toBe('queued value');

        earlyFixture.detectChanges();
        expect(earlyComponent['editorView']!.state.doc.toString()).toBe('queued value');
        expect(earlyComponent['pendingValue']).toBeNull();
      });

      test('should clear the pending value after initialisation', () => {
        const earlyFixture = TestBed.createComponent(OibCodeBlockComponent);
        const earlyComponent = earlyFixture.componentInstance;
        earlyComponent.writeValue('something');
        earlyFixture.detectChanges();
        expect(earlyComponent['pendingValue']).toBeNull();
      });
    });

    describe('setDisabledState', () => {
      test('should set the disabled signal to true', () => {
        component.setDisabledState(true);
        expect(component.disabled()).toBe(true);
      });

      test('should set the disabled signal back to false', () => {
        component.setDisabledState(true);
        component.setDisabledState(false);
        expect(component.disabled()).toBe(false);
      });
    });
  });

  describe('readOnly input', () => {
    test('should make .cm-content non-editable when readOnly is true', () => {
      fixture.componentRef.setInput('readOnly', true);
      fixture.detectChanges();
      const content: HTMLElement = fixture.nativeElement.querySelector('.cm-content');
      expect(content.getAttribute('contenteditable')).toBe('false');
    });

    test('should keep .cm-content editable when readOnly is false (default)', () => {
      const content: HTMLElement = fixture.nativeElement.querySelector('.cm-content');
      expect(content.getAttribute('contenteditable')).toBe('true');
    });
  });

  describe('changeLanguage', () => {
    test('should not throw for all supported languages', () => {
      for (const lang of ['json', 'javascript', 'typescript', 'sql']) {
        expect(() => component.changeLanguage(lang)).not.toThrow();
      }
    });

    test('should not throw for an unsupported / unknown language', () => {
      expect(() => component.changeLanguage('cobol')).not.toThrow();
    });

    test('should not throw when called before the editor is initialised', () => {
      const earlyFixture = TestBed.createComponent(OibCodeBlockComponent);
      const earlyComponent = earlyFixture.componentInstance;
      expect(() => earlyComponent.changeLanguage('json')).not.toThrow();
    });
  });

  describe('language input', () => {
    test('should apply the language when it changes', () => {
      fixture.componentRef.setInput('language', 'javascript');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.cm-editor')).toBeTruthy();
    });
  });

  describe('ngOnDestroy', () => {
    test('should destroy the CodeMirror editor view', () => {
      const editorView = component['editorView']!;
      const destroySpy = vi.spyOn(editorView, 'destroy');
      component.ngOnDestroy();
      expect(destroySpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Integration with reactive forms (TestHostComponent)', () => {
    let hostFixture: ComponentFixture<TestHostComponent>;
    let hostComponent: TestHostComponent;

    beforeEach(() => {
      hostFixture = TestBed.createComponent(TestHostComponent);
      hostComponent = hostFixture.componentInstance;
      hostFixture.detectChanges();
    });

    test('should render inside a form without errors', () => {
      expect(hostFixture.nativeElement.querySelector('.cm-editor')).toBeTruthy();
    });

    test('should receive the initial form value', () => {
      const codeBlock: OibCodeBlockComponent = hostFixture.debugElement.children[0].componentInstance;
      expect(codeBlock['editorView']!.state.doc.toString()).toBe('initial');
    });

    test('should propagate a form control value change into the editor', () => {
      hostComponent.control.setValue('updated via form');
      hostFixture.detectChanges();
      const codeBlock: OibCodeBlockComponent = hostFixture.debugElement.children[0].componentInstance;
      expect(codeBlock['editorView']!.state.doc.toString()).toBe('updated via form');
    });
  });
});
