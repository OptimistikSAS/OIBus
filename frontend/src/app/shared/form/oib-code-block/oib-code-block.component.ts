/* eslint-disable-next-line */
/// <reference path="../../../../../node_modules/monaco-editor/monaco.d.ts" />
import { Component, ElementRef, forwardRef, inject, viewChild, input, effect, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { MonacoEditorLoaderService } from './monaco-editor-loader.service';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../form-validation-directives';

// This component relies on the monaco editor and needs it to load it if it is not already available.
// It delegates this task to the MonacoEditorLoaderService, which returns a Promise which resolves when the loading is done.
@Component({
  selector: 'oib-code-block',
  templateUrl: './oib-code-block.component.html',
  styleUrl: './oib-code-block.component.scss',
  imports: [ReactiveFormsModule, OI_FORM_VALIDATION_DIRECTIVES],
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
  readonly language = input('');
  readonly height = input('30rem');
  readonly readOnly = input(false);
  readonly disabled = signal(false);
  readonly chunkedValueProgress = signal(0);

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
  /**
   * Track the current language to detect changes
   */
  private currentLanguage = signal<string | null>(null);

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
          language: this.language(),
          theme: 'vs-light',
          selectOnLineNumbers: true,
          wordWrap: 'on',
          minimap: { enabled: false },
          readOnly: this.readOnly(),
          automaticLayout: true,
          stickyScroll: {
            enabled: false
          }
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

    // Effect to handle language changes
    effect(() => {
      const lang = this.language();
      const editor = this.codeEditorInstance();
      if (editor && lang !== this.currentLanguage()) {
        this.changeLanguage(lang);
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

  writeValueChunked(value: string, chunkSize = 100_000): Promise<void> {
    // we can only set the value once the editor is loaded, which can take some time on first load
    const codeEditor = this.codeEditorInstance();
    if (!codeEditor) {
      // if the editor is not yet loaded, we store the value to write,
      // and it'll be set once the loading is complete
      this.pendingValueToWrite.set(value);
      return Promise.resolve();
    }

    return new Promise(resolve => {
      const model = codeEditor.getModel();
      if (!model) return resolve();

      let offset = 0;
      const totalLength = value.length;

      // First chunk needs to replace any existing content
      const firstChunk = value.slice(0, chunkSize);
      model.pushEditOperations(
        [],
        [
          {
            range: model.getFullModelRange(),
            text: firstChunk
          }
        ],
        () => null
      );

      offset = firstChunk.length;
      this.chunkedValueProgress.update(() => offset / totalLength);

      const applyNextChunk = () => {
        const chunk = value.slice(offset, offset + chunkSize);

        if (chunk.length === 0) {
          this.chunkedValueProgress.update(() => 1);
          return resolve();
        }

        // Get the current last position in the model
        const lastLine = model!.getLineCount();
        const lastLineContent = model!.getLineContent(lastLine);

        // Apply the chunk at the end of the current content
        model?.pushEditOperations(
          [],
          [
            {
              range: {
                startLineNumber: lastLine,
                startColumn: lastLineContent.length + 1,
                endLineNumber: lastLine,
                endColumn: lastLineContent.length + 1
              },
              text: chunk
            }
          ],
          () => null
        );

        offset += chunk.length;

        // Calculate and log progress
        this.chunkedValueProgress.update(() => offset / totalLength);

        // Schedule next chunk
        requestAnimationFrame(applyNextChunk);
      };

      // Start processing remaining chunks
      requestAnimationFrame(applyNextChunk);
    });
  }

  changeLanguage(language: string) {
    const codeEditor = this.codeEditorInstance();
    if (codeEditor) {
      monaco.editor.setModelLanguage(codeEditor.getModel()!, language);
    }
  }
}
