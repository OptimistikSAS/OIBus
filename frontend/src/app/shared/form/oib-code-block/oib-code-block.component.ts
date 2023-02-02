/* eslint-disable-next-line */
/// <reference path="../../../../../node_modules/monaco-editor/monaco.d.ts" />
import { AfterViewInit, Component, ElementRef, forwardRef, Input, ViewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, NonNullableFormBuilder } from '@angular/forms';
import { MonacoEditorLoaderService } from './monaco-editor-loader.service';
import { formDirectives } from '../../form-directives';
import { NgIf } from '@angular/common';

// This component relies on the monaco editor, and needs it to load it if it is not already available.
// It delegates this task to the MonacoEditorLoaderService, that returns a Promise which resolves when the loading is done.
@Component({
  selector: 'oib-code-block',
  templateUrl: './oib-code-block.component.html',
  styleUrls: ['./oib-code-block.component.scss'],
  imports: [...formDirectives, NgIf],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => OibCodeBlockComponent),
      multi: true
    }
  ],
  standalone: true
})
export class OibCodeBlockComponent implements AfterViewInit, ControlValueAccessor {
  @ViewChild('editorContainer') _editorContainer: ElementRef | null = null;
  @Input() key = '';
  @Input() contentType = '';
  codeBlockInputCtrl = this.fb.control(null as string | null);
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

  constructor(private fb: NonNullableFormBuilder, private monacoEditorLoader: MonacoEditorLoaderService) {
    this.codeBlockInputCtrl.valueChanges.subscribe(newValue => {
      this.onChange(newValue!);
    });
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    if (this.disabled) {
      this.codeBlockInputCtrl.disable();
    } else {
      this.codeBlockInputCtrl.enable();
    }
  }

  ngAfterViewInit() {
    this.monacoEditorLoader.loadMonacoEditor().then(() => {
      this.codeEditorInstance = monaco.editor.create(this._editorContainer!.nativeElement, {
        value: '',
        language: this.contentType,
        theme: 'vs-light',
        selectOnLineNumbers: true,
        minimap: { enabled: false }
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
    if (value) {
      // we can only set the value once the editor is loaded, which can take some time on first load
      if (this.codeEditorInstance) {
        this.codeEditorInstance.setValue(value);
      } else {
        // if the editor is not yet loaded, we store the value to write,
        // and it'll be set once the loading is complete
        this.pendingValueToWrite = value;
      }
    }
  }
}
