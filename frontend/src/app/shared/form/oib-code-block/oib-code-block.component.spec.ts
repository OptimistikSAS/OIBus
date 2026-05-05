import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Component } from '@angular/core';

import { OibCodeBlockComponent } from './oib-code-block.component';

/** Minimal host that wires the component as a reactive form control. */
@Component({
  template: `<oib-code-block [formControl]="control" [language]="language" [readOnly]="readOnly" />`,
  imports: [OibCodeBlockComponent, ReactiveFormsModule]
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
    // afterRenderEffect fires as part of detectChanges in the test environment
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  describe('Editor initialisation', () => {
    it('should mount a CodeMirror editor inside the container', () => {
      expect(fixture.nativeElement.querySelector('.cm-editor')).toBeTruthy();
    });

    it('should apply the default height (30rem) to the container', () => {
      const container: HTMLElement = fixture.nativeElement.querySelector('.editor-container');
      expect(container.style.height).toBe('30rem');
    });

    it('should apply a custom height when the input changes', () => {
      fixture.componentRef.setInput('height', '50rem');
      fixture.detectChanges();
      const container: HTMLElement = fixture.nativeElement.querySelector('.editor-container');
      expect(container.style.height).toBe('50rem');
    });

    it('should set the container id from the key input', () => {
      fixture.componentRef.setInput('key', 'my-key');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('#oib-code-block-input-my-key')).toBeTruthy();
    });

    it('should start with an empty key when the key input is not provided', () => {
      expect(fixture.nativeElement.querySelector('#oib-code-block-input-')).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  describe('ControlValueAccessor', () => {
    let onChangeSpy: jasmine.Spy;
    let onTouchedSpy: jasmine.Spy;

    beforeEach(() => {
      onChangeSpy = jasmine.createSpy('onChange');
      onTouchedSpy = jasmine.createSpy('onTouched');
      component.registerOnChange(onChangeSpy);
      component.registerOnTouched(onTouchedSpy);
    });

    describe('writeValue', () => {
      it('should set the editor content', () => {
        component.writeValue('hello world');
        expect(component['editorView']!.state.doc.toString()).toBe('hello world');
      });

      it('should replace existing content', () => {
        component.writeValue('first');
        component.writeValue('second');
        expect(component['editorView']!.state.doc.toString()).toBe('second');
      });

      it('should treat null as an empty string', () => {
        component.writeValue(null as any);
        expect(component['editorView']!.state.doc.toString()).toBe('');
      });

      it('should NOT call onChange — programmatic writes must not feed back into the form', () => {
        component.writeValue('programmatic content');
        expect(onChangeSpy).not.toHaveBeenCalled();
      });
    });

    describe('pending value (writeValue before the editor is ready)', () => {
      it('should queue the value and apply it once the editor initialises', () => {
        const earlyFixture = TestBed.createComponent(OibCodeBlockComponent);
        const earlyComponent = earlyFixture.componentInstance;

        // Editor not yet created — afterRenderEffect hasn't run
        earlyComponent.writeValue('queued value');
        expect(earlyComponent['editorView']).toBeNull();
        expect(earlyComponent['pendingValue']).toBe('queued value');

        // detectChanges triggers afterRenderEffect → editor created with the pending content
        earlyFixture.detectChanges();
        expect(earlyComponent['editorView']!.state.doc.toString()).toBe('queued value');
        expect(earlyComponent['pendingValue']).toBeNull();
      });

      it('should clear the pending value after initialisation', () => {
        const earlyFixture = TestBed.createComponent(OibCodeBlockComponent);
        const earlyComponent = earlyFixture.componentInstance;
        earlyComponent.writeValue('something');
        earlyFixture.detectChanges();
        expect(earlyComponent['pendingValue']).toBeNull();
      });
    });

    describe('setDisabledState', () => {
      it('should set the disabled signal to true', () => {
        component.setDisabledState(true);
        expect(component.disabled()).toBe(true);
      });

      it('should set the disabled signal back to false', () => {
        component.setDisabledState(true);
        component.setDisabledState(false);
        expect(component.disabled()).toBe(false);
      });
    });
  });

  // ---------------------------------------------------------------------------
  describe('readOnly input', () => {
    it('should make .cm-content non-editable when readOnly is true', () => {
      fixture.componentRef.setInput('readOnly', true);
      fixture.detectChanges();
      const content: HTMLElement = fixture.nativeElement.querySelector('.cm-content');
      expect(content.getAttribute('contenteditable')).toBe('false');
    });

    it('should keep .cm-content editable when readOnly is false (default)', () => {
      const content: HTMLElement = fixture.nativeElement.querySelector('.cm-content');
      expect(content.getAttribute('contenteditable')).toBe('true');
    });
  });

  // ---------------------------------------------------------------------------
  describe('changeLanguage', () => {
    it('should not throw for all supported languages', () => {
      for (const lang of ['json', 'javascript', 'typescript', 'sql']) {
        expect(() => component.changeLanguage(lang)).not.toThrow();
      }
    });

    it('should not throw for an unsupported / unknown language', () => {
      expect(() => component.changeLanguage('cobol')).not.toThrow();
    });

    it('should not throw when called before the editor is initialised', () => {
      const earlyFixture = TestBed.createComponent(OibCodeBlockComponent);
      const earlyComponent = earlyFixture.componentInstance;
      // No detectChanges → afterRenderEffect hasn't run → editorView is null
      expect(() => earlyComponent.changeLanguage('json')).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  describe('language input', () => {
    it('should apply the language when it changes', () => {
      fixture.componentRef.setInput('language', 'javascript');
      fixture.detectChanges();
      // No crash and editor still present = language reconfiguration succeeded
      expect(fixture.nativeElement.querySelector('.cm-editor')).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  describe('ngOnDestroy', () => {
    it('should destroy the CodeMirror editor view', () => {
      const editorView = component['editorView']!;
      const destroySpy = spyOn(editorView, 'destroy');
      component.ngOnDestroy();
      expect(destroySpy).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Integration with reactive forms (TestHostComponent)', () => {
    let hostFixture: ComponentFixture<TestHostComponent>;
    let hostComponent: TestHostComponent;

    beforeEach(() => {
      hostFixture = TestBed.createComponent(TestHostComponent);
      hostComponent = hostFixture.componentInstance;
      hostFixture.detectChanges();
    });

    it('should render inside a form without errors', () => {
      expect(hostFixture.nativeElement.querySelector('.cm-editor')).toBeTruthy();
    });

    it('should receive the initial form value', () => {
      const codeBlock: OibCodeBlockComponent = hostFixture.debugElement.children[0].componentInstance;
      expect(codeBlock['editorView']!.state.doc.toString()).toBe('initial');
    });

    it('should propagate a form control value change into the editor', () => {
      hostComponent.control.setValue('updated via form');
      hostFixture.detectChanges();
      const codeBlock: OibCodeBlockComponent = hostFixture.debugElement.children[0].componentInstance;
      expect(codeBlock['editorView']!.state.doc.toString()).toBe('updated via form');
    });
  });
});
