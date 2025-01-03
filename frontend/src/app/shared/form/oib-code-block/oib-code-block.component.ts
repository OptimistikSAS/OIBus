/* eslint-disable-next-line */
/// <reference path="../../../../../node_modules/monaco-editor/monaco.d.ts" />
import { Component, ElementRef, forwardRef, inject, viewChild, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MonacoEditorLoaderService } from './monaco-editor-loader.service';
import { formDirectives } from '../../form-directives';

// This component relies on the monaco editor, and needs it to load it if it is not already available.
// It delegates this task to the MonacoEditorLoaderService, that returns a Promise which resolves when the loading is done.
@Component({
  selector: 'oib-code-block',
  templateUrl: './oib-code-block.component.html',
  styleUrl: './oib-code-block.component.scss',
  imports: [...formDirectives],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => OibCodeBlockComponent),
      multi: true
    }
  ]
})
export class OibCodeBlockComponent implements ControlValueAccessor {
  private monacoEditorLoader = inject(MonacoEditorLoaderService);

  readonly _editorContainer = viewChild.required<ElementRef<HTMLDivElement>>('editorContainer');
  readonly key = input('');
  readonly contentType = input('');
  readonly height = input('12rem');
  readonly readOnly = input(false);
  readonly disabled = signal(false);

  onChange: (value: string) => void = () => {};
  onTouched = () => {};

  /**
   * Holds the instance of the current code editor
   */
  codeEditorInstance = signal<monaco.editor.IStandaloneCodeEditor | null>(null);
  /**
   * Value to write when the loading is complete
   */
  private pendingValueToWrite = signal<string | null>(null);

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  constructor() {
    this.monacoEditorLoader.loadMonacoEditor().then(() => {
      this.codeEditorInstance.set(
        monaco.editor.create(this._editorContainer().nativeElement, {
          value: '',
          language: this.contentType(),
          theme: 'vs-light',
          selectOnLineNumbers: true,
          wordWrap: 'on',
          minimap: { enabled: false },
          readOnly: this.readOnly()
        })
      );

      // we listen on changes
      const codeEditor = this.codeEditorInstance()!;
      codeEditor.getModel()!.onDidChangeContent(() => {
        this.onChange(codeEditor.getValue());
      });
      const pendingValueToWrite = this.pendingValueToWrite();
      if (pendingValueToWrite) {
        codeEditor.setValue(pendingValueToWrite);
      }
    });
  }

  writeValue(value: string): void {
    // we can only set the value once the editor is loaded, which can take some time on first load
    const codeEditor = this.codeEditorInstance();
    if (codeEditor) {
      codeEditor.setValue(value);
    } else {
      // if the editor is not yet loaded, we store the value to write,
      // and it'll be set once the loading is complete
      this.pendingValueToWrite.set(value);
    }
  }

  changeLanguage(language: string) {
    const codeEditor = this.codeEditorInstance();
    if (codeEditor) {
      monaco.editor.setModelLanguage(codeEditor.getModel()!, language);
    }
  }
}
