import { afterRenderEffect, Component, ElementRef, forwardRef, input, OnDestroy, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { EditorView } from '@codemirror/view';
import { Compartment, EditorState } from '@codemirror/state';
import { basicSetup } from 'codemirror';
import { json } from '@codemirror/lang-json';
import { javascript } from '@codemirror/lang-javascript';
import { sql } from '@codemirror/lang-sql';

@Component({
  selector: 'oib-code-block',
  templateUrl: './oib-code-block.component.html',
  styleUrl: './oib-code-block.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => OibCodeBlockComponent),
      multi: true
    }
  ]
})
export class OibCodeBlockComponent implements OnDestroy, ControlValueAccessor {
  readonly _editorContainer = viewChild.required<ElementRef<HTMLDivElement>>('editorContainer');
  readonly key = input('');
  readonly language = input('');
  readonly height = input('30rem');
  readonly readOnly = input(false);
  readonly disabled = signal(false);
  readonly chunkedValueProgress = signal(0);

  private editorView: EditorView | null = null;
  private pendingValue: string | null = null;
  private readonly languageCompartment = new Compartment();
  private readonly editableCompartment = new Compartment();
  /** Prevents the updateListener from calling onChange during programmatic writes. */
  private suppressOnChange = false;

  onChange: (value: string) => void = () => {};
  onTouched: () => void = () => {};

  constructor() {
    afterRenderEffect(() => {
      const container = this._editorContainer().nativeElement;
      const isEditable = !this.readOnly() && !this.disabled();
      const lang = this.language();

      if (!this.editorView) {
        const state = EditorState.create({
          doc: this.pendingValue ?? '',
          extensions: [
            basicSetup,
            // Make the editor fill its container height
            EditorView.theme({ '&': { height: '100%' }, '.cm-scroller': { overflow: 'auto' } }),
            this.languageCompartment.of(this.getLanguageExtension(lang)),
            this.editableCompartment.of(EditorView.editable.of(isEditable)),
            EditorView.updateListener.of(update => {
              if (update.docChanged && !this.suppressOnChange) {
                this.onChange(update.state.doc.toString());
              }
            }),
            EditorView.domEventHandlers({ blur: () => this.onTouched() })
          ]
        });
        this.editorView = new EditorView({ state, parent: container });
        this.pendingValue = null;
      } else {
        // Reactively update language and editable state when their signals change
        this.editorView.dispatch({
          effects: [
            this.languageCompartment.reconfigure(this.getLanguageExtension(lang)),
            this.editableCompartment.reconfigure(EditorView.editable.of(isEditable))
          ]
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.editorView?.destroy();
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  writeValue(value: string): void {
    const content = value ?? '';
    if (this.editorView) {
      this.setEditorContent(content);
    } else {
      this.pendingValue = content;
    }
  }

  /**
   * Imperatively change the editor language. Useful when the language is not
   * bound as an input (e.g. set after an async operation).
   */
  changeLanguage(lang: string): void {
    this.editorView?.dispatch({
      effects: this.languageCompartment.reconfigure(this.getLanguageExtension(lang))
    });
  }

  private setEditorContent(value: string): void {
    if (!this.editorView) return;
    this.suppressOnChange = true;
    this.editorView.dispatch({
      changes: { from: 0, to: this.editorView.state.doc.length, insert: value }
    });
    this.suppressOnChange = false;
  }

  private getLanguageExtension(lang: string) {
    switch (lang) {
      case 'json':
        return json();
      case 'javascript':
        return javascript();
      case 'typescript':
        return javascript({ typescript: true });
      case 'sql':
        return sql();
      default:
        return [];
    }
  }
}
