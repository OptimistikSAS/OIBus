import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';

import type { Compartment } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { TranslatePipe } from '@ngx-translate/core';
import Papa from 'papaparse';

import { OIBusContent } from '@oibus/shared/common/content.model';
import { createPageFromArray, Page } from '@oibus/shared/common/types';

import { ProgressbarComponent } from '../../../../history-query/history-query-detail/history-metrics/progressbar/progressbar.component';
import { CodeMirror, loadCodeMirror, loadOnDemand } from '../../../../shared/code-mirror/code-mirror.loader';
import { LoadingSpinnerComponent } from '../../../../shared/loading-spinner/loading-spinner.component';
import { PaginationComponent } from '../../../../shared/pagination/pagination.component';

export type ContentDisplayMode = 'table' | 'raw' | 'json';

const PAGE_SIZE = 10;

function emptyPage<T>(): Page<T> {
  return { content: [], totalElements: 0, totalPages: 0, size: PAGE_SIZE, number: 0 };
}

@Component({
  selector: 'oib-item-test-result',
  templateUrl: './item-test-result.component.html',
  styleUrl: './item-test-result.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LoadingSpinnerComponent, TranslatePipe, PaginationComponent, ProgressbarComponent]
})
export class ItemTestResultComponent {
  private readonly _result = signal<OIBusContent | null>(null);
  readonly result = this._result.asReadonly();

  /** Compact mode shrinks the result box (used when several are stacked, e.g. the test pipeline). */
  readonly compact = input<boolean>(false);

  readonly message = signal<{ type: `${'item' | 'display-result'}-error` | 'info'; value: string } | null>(null);
  readonly isLoading = signal(false);

  readonly currentDisplayMode = output<ContentDisplayMode | null>();
  readonly displayMode = signal<ContentDisplayMode | null>(null);

  readonly availableDisplayModes = output<Array<ContentDisplayMode>>();
  private _availableDisplayModes: Array<ContentDisplayMode> = [];

  readonly displayModeIcons: Record<ContentDisplayMode, string> = { table: 'fa-table', raw: 'fa-file-lines', json: 'fa-code' };

  // --- Table state ---
  readonly genericTableView = signal<Page<Array<string>>>(emptyPage());
  readonly headers = signal<Array<string> | null>(null);

  // --- Codeblock state ---
  readonly editorContainer = viewChild<ElementRef<HTMLDivElement>>('editor');
  /** The editor is created once CodeMirror is loaded */
  private readonly codeMirror = loadOnDemand(loadCodeMirror);
  private editorView: EditorView | null = null;
  readonly chunkedValueProgress = signal(0);
  private languageCompartment: Compartment | null = null;
  private currentWriteId = 0;

  private readonly isRawJson = computed(() => {
    if (this.displayMode() !== 'raw') return false;
    const content = this._result();
    if (!content || (content.type !== 'file' && content.type !== 'file-content')) return false;
    try {
      JSON.parse(content.content || '');
      return true;
    } catch {
      return false;
    }
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.editorView?.destroy());
    afterRenderEffect(() => {
      const container = this.editorContainer();
      const [codeMirror] = this.codeMirror() ?? [null];
      if (!container || !codeMirror) {
        this.editorView?.destroy();
        this.editorView = null;
        return;
      }

      if (!this.editorView || !this.languageCompartment) {
        const { basicSetup, Compartment, EditorState, EditorView } = codeMirror;
        this.languageCompartment = new Compartment();
        const state = EditorState.create({
          doc: '',
          extensions: [basicSetup, this.languageCompartment.of([]), EditorView.editable.of(false)]
        });
        this.editorView = new EditorView({ state, parent: container.nativeElement });
      }

      const content = this._result();
      if (!content) return;

      const newContent = this.getDisplayContent(content);
      this.editorView.dispatch({ effects: this.languageCompartment.reconfigure(this.getLanguageExtension(codeMirror)) });

      if (newContent !== this.editorView.state.doc.toString()) {
        this.writeValueChunked(newContent);
      }
    });
  }

  // kept as a getter (it reads a signal, so it is reactive) because the parent template reads it through a template reference
  get currentDisplayModeIcon() {
    const mode = this.displayMode();
    return mode ? this.displayModeIcons[mode] : '';
  }

  displayResult(result: OIBusContent | undefined = undefined) {
    this.message.set(null);
    this.isLoading.set(false);
    if (result) {
      this._result.set(result);
      // A fresh result may support different display modes than the previous one
      // (e.g. raw records -> table, transformed output -> any). Recompute the
      // available modes and fall back to the first one when the current mode no
      // longer applies, otherwise a stale 'table' mode renders nothing.
      this.updateAvailableDisplayModes(result);
      const mode = this.displayMode();
      if (!mode || !this._availableDisplayModes.includes(mode)) {
        this.changeDisplayMode(this._availableDisplayModes[0] ?? null);
      }
    }

    if (!this._result()) return;

    if (this.displayMode() === 'table') {
      this.resetPage();
    }
  }

  displayError(message: string, type: `${'item' | 'display-result'}-error` = 'item-error') {
    this.isLoading.set(false);

    if (type === 'item-error') {
      this._result.set(null);
      this.changeAvailableDisplayModes([]);
      this.changeDisplayMode(null);
    }

    this.message.set({ value: message, type });
  }

  displayInfo(message: string) {
    this._result.set(null);
    this.isLoading.set(false);
    this.changeAvailableDisplayModes([]);
    this.changeDisplayMode(null);
    this.message.set({ value: message, type: 'info' });
  }

  displayLoading() {
    this._result.set(null);
    this.message.set(null);
    this.isLoading.set(true);
  }

  changeDisplayMode(newMode: ContentDisplayMode | null) {
    this.displayMode.set(newMode);
    this.currentDisplayMode.emit(newMode);
  }

  readonly isContentEmpty = computed(() => {
    const content = this._result();
    if (!content) return false;
    if (content.type === 'record-list') return content.content.length === 0;
    if (content.type === 'file' || content.type === 'file-content') return !content.content;
    return false;
  });

  resetPage() {
    try {
      this.changePage(0);
    } catch (error: unknown) {
      this.displayError(error instanceof Error ? error.message : String(error), 'display-result-error');
    }
  }

  changePage(pageNumber: number) {
    const content = this._result();
    if (!content) return;

    switch (content.type) {
      case 'file': {
        const contentString = content.content;
        if (!contentString) {
          this.genericTableView.set(emptyPage());
          break;
        }
        const rows = Papa.parse<Array<string>>(contentString).data;
        this.headers.set(rows.shift()!);
        this.genericTableView.set(createPageFromArray(rows, PAGE_SIZE, pageNumber));
        break;
      }
      case 'record-list': {
        // The records may not all have the same fields (e.g. a point record with or without quality)
        const headers = [...new Set(content.content.flatMap(record => Object.keys(record)))];
        this.headers.set(headers);
        const rows = content.content.map(record => headers.map(header => (record[header] == null ? '' : String(record[header]))));
        this.genericTableView.set(createPageFromArray(rows, PAGE_SIZE, pageNumber));
        break;
      }
    }
  }

  private updateAvailableDisplayModes(content: OIBusContent) {
    const modes = new Set<ContentDisplayMode>();

    switch (content.type) {
      case 'file':
        if (content.filePath.endsWith('.csv') && content.content) {
          modes.add('table');
        }
        modes.add('raw');
        break;
      case 'file-content':
        modes.add('raw');
        break;
      case 'record-list':
        modes.add('table');
        modes.add('json');
        break;
    }

    this.changeAvailableDisplayModes([...modes]);
  }

  private changeAvailableDisplayModes(modes: Array<ContentDisplayMode>) {
    this._availableDisplayModes = modes;
    this.availableDisplayModes.emit(modes);
  }

  private getLanguageExtension({ json }: CodeMirror) {
    return this.displayMode() === 'json' || this.isRawJson() ? json() : [];
  }

  private getDisplayContent(content: OIBusContent): string {
    if (content.type === 'record-list') {
      return JSON.stringify(content.content, null, 2);
    }
    if (content.type === 'file' || content.type === 'file-content') {
      if (this.isRawJson()) {
        return JSON.stringify(JSON.parse(content.content!), null, 2);
      }
      return content.content || '';
    }
    return '';
  }

  private writeValueChunked(value: string, chunkSize = 100_000): void {
    const editor = this.editorView;
    if (!editor) return;

    const writeId = ++this.currentWriteId;
    const totalLength = value.length || 1;
    const firstChunk = value.slice(0, chunkSize);

    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: firstChunk } });

    let offset = firstChunk.length;
    this.chunkedValueProgress.set(offset / totalLength);

    const applyNextChunk = () => {
      if (writeId !== this.currentWriteId) return;
      const chunk = value.slice(offset, offset + chunkSize);
      if (chunk.length === 0) {
        this.chunkedValueProgress.set(1);
        return;
      }
      editor.dispatch({ changes: { from: editor.state.doc.length, to: editor.state.doc.length, insert: chunk } });
      offset += chunk.length;
      this.chunkedValueProgress.set(offset / totalLength);
      requestAnimationFrame(applyNextChunk);
    };

    if (offset < totalLength) {
      requestAnimationFrame(applyNextChunk);
    } else {
      this.chunkedValueProgress.set(1);
    }
  }
}
