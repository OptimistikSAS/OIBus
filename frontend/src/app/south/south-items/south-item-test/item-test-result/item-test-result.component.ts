import { afterRenderEffect, Component, computed, ElementRef, OnDestroy, output, signal, viewChild } from '@angular/core';
import { OIBusContent, OIBusTimeValue } from '../../../../../../../backend/shared/model/engine.model';
import { createPageFromArray, Page } from '../../../../../../../backend/shared/model/types';
import { LoadingSpinnerComponent } from '../../../../shared/loading-spinner/loading-spinner.component';
import { PaginationComponent } from '../../../../shared/pagination/pagination.component';
import { ProgressbarComponent } from '../../../../history-query/history-query-detail/history-metrics/progressbar/progressbar.component';
import { TranslatePipe } from '@ngx-translate/core';
import { EditorView } from '@codemirror/view';
import { Compartment, EditorState } from '@codemirror/state';
import { basicSetup } from 'codemirror';
import { json } from '@codemirror/lang-json';
import Papa from 'papaparse';

export type ContentDisplayMode = 'table' | 'any' | 'json';

const PAGE_SIZE = 10;

function emptyPage<T>(): Page<T> {
  return { content: [], totalElements: 0, totalPages: 0, size: PAGE_SIZE, number: 0 };
}

@Component({
  selector: 'oib-item-test-result',
  templateUrl: './item-test-result.component.html',
  styleUrl: './item-test-result.component.scss',
  imports: [LoadingSpinnerComponent, TranslatePipe, PaginationComponent, ProgressbarComponent]
})
export class ItemTestResultComponent implements OnDestroy {
  private readonly _result = signal<OIBusContent | null>(null);
  get result() {
    return this._result();
  }

  message: { type: `${'item' | 'display-result'}-error` | 'info'; value: string } | null = null;
  isLoading = false;

  readonly currentDisplayMode = output<ContentDisplayMode | null>();
  readonly displayMode = signal<ContentDisplayMode | null>(null);

  readonly availableDisplayModes = output<Array<ContentDisplayMode>>();
  private _availableDisplayModes: Array<ContentDisplayMode> = [];

  readonly displayModeIcons: Record<ContentDisplayMode, string> = { table: 'fa-table', any: 'fa-file-text', json: 'fa-code' };

  // --- Table state ---
  tableType: 'time-values' | 'generic' = 'generic';
  tableView: Page<OIBusTimeValue> = emptyPage();
  genericTableView: Page<Array<string>> = emptyPage();
  headers: Array<string> | null = null;

  // --- Codeblock state ---
  readonly editorContainer = viewChild<ElementRef<HTMLDivElement>>('editor');
  private editorView: EditorView | null = null;
  readonly chunkedValueProgress = signal(0);
  private readonly languageCompartment = new Compartment();
  private currentWriteId = 0;

  private readonly isAnyJson = computed(() => {
    if (this.displayMode() !== 'any') return false;
    const content = this._result();
    if (!content || (content.type !== 'any' && content.type !== 'any-content')) return false;
    try {
      JSON.parse(content.content || '');
      return true;
    } catch {
      return false;
    }
  });

  constructor() {
    afterRenderEffect(() => {
      const container = this.editorContainer();
      if (!container) {
        this.editorView?.destroy();
        this.editorView = null;
        return;
      }

      if (!this.editorView) {
        const state = EditorState.create({
          doc: '',
          extensions: [basicSetup, this.languageCompartment.of([]), EditorView.editable.of(false)]
        });
        this.editorView = new EditorView({ state, parent: container.nativeElement });
      }

      const content = this._result();
      if (!content) return;

      const newContent = this.getDisplayContent(content);
      this.editorView.dispatch({ effects: this.languageCompartment.reconfigure(this.getLanguageExtension()) });

      if (newContent !== this.editorView.state.doc.toString()) {
        this.writeValueChunked(newContent);
      }
    });
  }

  ngOnDestroy(): void {
    this.editorView?.destroy();
  }

  get currentDisplayModeIcon() {
    const mode = this.displayMode();
    return mode ? this.displayModeIcons[mode] : '';
  }

  displayResult(result: OIBusContent | undefined = undefined) {
    this.message = null;
    this.isLoading = false;
    if (result) {
      this._result.set(result);
    }

    if (!this.result) return;

    if (!this.displayMode()) {
      this.updateAvailableDisplayModes(this.result);
      this.changeDisplayMode(this._availableDisplayModes[0]);
    }

    if (this.displayMode() === 'table') {
      this.resetPage();
    }
  }

  displayError(message: string, type: `${'item' | 'display-result'}-error` = 'item-error') {
    this.isLoading = false;

    if (type === 'item-error') {
      this._result.set(null);
      this.changeAvailableDisplayModes([]);
      this.changeDisplayMode(null);
    }

    this.message = { value: message, type };
  }

  displayInfo(message: string) {
    this._result.set(null);
    this.isLoading = false;
    this.changeAvailableDisplayModes([]);
    this.changeDisplayMode(null);
    this.message = { value: message, type: 'info' };
  }

  displayLoading() {
    this._result.set(null);
    this.message = null;
    this.isLoading = true;
  }

  changeDisplayMode(newMode: ContentDisplayMode | null) {
    this.displayMode.set(newMode);
    this.currentDisplayMode.emit(newMode);
  }

  get activePage(): Page<any> {
    return this.tableType === 'time-values' ? this.tableView : this.genericTableView;
  }

  get isContentEmpty(): boolean {
    const content = this._result();
    if (!content) return false;
    if (content.type === 'time-values') return content.content.length === 0;
    if (content.type === 'any' || content.type === 'any-content') return !content.content;
    return false;
  }

  convertDataToString(data: OIBusTimeValue['data']) {
    const { value, ...rest } = data;
    return { value, other: JSON.stringify(rest, null, 2) };
  }

  resetPage() {
    try {
      this.tableType = this._result()?.type === 'time-values' ? 'time-values' : 'generic';
      this.changePage(0);
    } catch (error: any) {
      this.displayError(error.message, 'display-result-error');
    }
  }

  changePage(pageNumber: number) {
    const content = this._result();
    if (!content) return;

    switch (content.type) {
      case 'time-values':
        this.tableView = createPageFromArray(content.content, PAGE_SIZE, pageNumber);
        break;
      case 'any': {
        const contentString = content.content;
        if (!contentString) {
          this.genericTableView = emptyPage();
          break;
        }
        const rows = Papa.parse<Array<string>>(contentString).data;
        this.headers = rows.shift()!;
        this.genericTableView = createPageFromArray(rows, PAGE_SIZE, pageNumber);
        break;
      }
    }
  }

  private updateAvailableDisplayModes(content: OIBusContent) {
    const modes = new Set<ContentDisplayMode>();

    switch (content.type) {
      case 'time-values':
        modes.add('table');
        modes.add('json');
        modes.add('any');
        break;
      case 'any':
        if (content.filePath.endsWith('.csv') && content.content) {
          modes.add('table');
        }
        modes.add('any');
        break;
      case 'any-content':
        modes.add('any');
        break;
    }

    this.changeAvailableDisplayModes([...modes]);
  }

  private changeAvailableDisplayModes(modes: Array<ContentDisplayMode>) {
    this._availableDisplayModes = modes;
    this.availableDisplayModes.emit(modes);
  }

  private getLanguageExtension() {
    return this.displayMode() === 'json' || this.isAnyJson() ? json() : [];
  }

  private getDisplayContent(content: OIBusContent): string {
    if (content.type === 'time-values') {
      return JSON.stringify(content.content, null, 2);
    }
    if (content.type === 'any' || content.type === 'any-content') {
      if (this.isAnyJson()) {
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
