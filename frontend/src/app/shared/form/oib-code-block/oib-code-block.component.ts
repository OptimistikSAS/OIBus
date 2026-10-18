import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  forwardRef,
  input,
  linkedSignal,
  OnDestroy,
  signal,
  viewChild
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import type { Compartment, Extension } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

import {
  CodeMirror,
  CodeMirrorLanguages,
  loadCodeMirror,
  loadCodeMirrorLanguages,
  loadOnDemand
} from '../../code-mirror/code-mirror.loader';

@Component({
  selector: 'oib-code-block',
  templateUrl: './oib-code-block.component.html',
  styleUrl: './oib-code-block.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // height of the editor container
    '[style.--oib-code-block-height]': 'height()'
  },
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
  /** The language input, unless changed with `changeLanguage()` */
  private readonly currentLanguage = linkedSignal(() => this.language());

  /** The editor is created once CodeMirror is loaded */
  private readonly codeMirror = loadOnDemand(loadCodeMirror, loadCodeMirrorLanguages);
  private editorView: EditorView | null = null;
  /** The value written before the editor is created */
  private pendingValue: string | null = null;
  private languageCompartment: Compartment | null = null;
  private editableCompartment: Compartment | null = null;
  /** Prevents the updateListener from calling onChange during programmatic writes. */
  private suppressOnChange = false;

  onChange: (value: string) => void = () => {};
  onTouched: () => void = () => {};

  constructor() {
    afterRenderEffect(() => {
      const codeMirror = this.codeMirror();
      if (!codeMirror) {
        return;
      }
      const [core, languages] = codeMirror;
      const { basicSetup, Compartment, EditorState, EditorView } = core;
      const container = this._editorContainer().nativeElement;
      const isEditable = !this.readOnly() && !this.disabled();
      const languageExtension = this.getLanguageExtension(this.currentLanguage(), core, languages);

      if (!this.editorView || !this.languageCompartment || !this.editableCompartment) {
        this.languageCompartment = new Compartment();
        this.editableCompartment = new Compartment();
        const state = EditorState.create({
          doc: this.pendingValue ?? '',
          extensions: [
            basicSetup,
            // Make the editor fill its container height
            EditorView.theme({ '&': { height: '100%' }, '.cm-scroller': { overflow: 'auto' } }),
            this.languageCompartment.of(languageExtension),
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
            this.languageCompartment.reconfigure(languageExtension),
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
    this.currentLanguage.set(lang);
  }

  private setEditorContent(value: string): void {
    if (!this.editorView) return;
    this.suppressOnChange = true;
    this.editorView.dispatch({
      changes: { from: 0, to: this.editorView.state.doc.length, insert: value }
    });
    this.suppressOnChange = false;
  }

  private getLanguageExtension(lang: string, { json }: CodeMirror, { javascript, sql }: CodeMirrorLanguages): Extension {
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
