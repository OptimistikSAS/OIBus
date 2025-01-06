/* eslint-disable-next-line */
/// <reference path="../../../../../node_modules/monaco-editor/monaco.d.ts" />
import { AfterViewInit, Component, ElementRef, forwardRef, Input, ViewChild, inject } from '@angular/core';
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
export class OibCodeBlockComponent implements AfterViewInit, ControlValueAccessor {
  private monacoEditorLoader = inject(MonacoEditorLoaderService);

  @ViewChild('editorContainer') _editorContainer: ElementRef | null = null;
  @Input() key = '';
  @Input() contentType = '';
  @Input() height = '12rem';
  @Input() readOnly = false;
  disabled = false;

  onChange: (value: string) => void = () => {};
  onTouched = () => {};

  /**
   * Holds the instance of the current code editor
   */
  codeEditorInstance: monaco.editor.IStandaloneCodeEditor | null = null;
  /**
   * Value to write when the loading is complete
   */
  private pendingValueToWrite: string | null = null;

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(_isDisabled: boolean): void {}

  ngAfterViewInit() {
    this.monacoEditorLoader.loadMonacoEditor().then(() => {
      this.codeEditorInstance = monaco.editor.create(this._editorContainer!.nativeElement, {
        value: '',
        language: this.contentType,
        theme: 'vs-light',
        selectOnLineNumbers: true,
        wordWrap: 'on',
        minimap: { enabled: false },
        readOnly: this.readOnly
      });

      // we listen on changes
      this.codeEditorInstance.getModel()!.onDidChangeContent(() => {
        this.onChange(this.codeEditorInstance!.getValue());
      });
      if (this.pendingValueToWrite) {
        this.codeEditorInstance.setValue(this.pendingValueToWrite);
      }
    });
  }

  writeValue(value: string): void {
    // we can only set the value once the editor is loaded, which can take some time on first load
    if (this.codeEditorInstance) {
      this.codeEditorInstance.setValue(value);
    } else {
      // if the editor is not yet loaded, we store the value to write,
      // and it'll be set once the loading is complete
      this.pendingValueToWrite = value;
    }
  }

  changeLanguage(language: string) {
    if (this.codeEditorInstance) {
      monaco.editor.setModelLanguage(this.codeEditorInstance.getModel()!, language);
    }
  }
}
