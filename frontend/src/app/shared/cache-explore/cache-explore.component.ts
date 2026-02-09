import { Component, computed, input, linkedSignal, output } from '@angular/core';

import { TranslateDirective } from '@ngx-translate/core';
import { CacheContentComponent } from './cache-content/cache-content.component';
import { AsyncPipe } from '@angular/common';
import { DatetimePipe } from '../datetime.pipe';
import { ObservableState } from '../save-button/save-button.component';
import {
  CacheContentUpdateCommand,
  CacheOperation,
  CacheSearchResult,
  DataFolderType
} from '../../../../../backend/shared/model/engine.model';

@Component({
  selector: 'oib-cache-explore',
  templateUrl: './cache-explore.component.html',
  styleUrl: './cache-explore.component.scss',
  imports: [TranslateDirective, CacheContentComponent, AsyncPipe, DatetimePipe]
})
export class CacheExploreComponent {
  readonly entity = input.required<{ id: string; type: 'north' | 'history' }>();
  readonly state = input.required<ObservableState>();
  readonly cacheContent = input.required<CacheSearchResult>();
  readonly viewCommand = output<{
    type: 'north' | 'history';
    id: string;
    fileToRetrieve: {
      folder: DataFolderType;
      filename: string;
    };
  }>();
  readonly updateCommand = output<{
    type: 'north' | 'history';
    id: string;
    updateCommand: CacheContentUpdateCommand;
  }>();

  readonly localResult = linkedSignal<CacheSearchResult>(() => this.cacheContent());

  readonly isDirty = computed(() => {
    const initial = this.cacheContent();
    const current = this.localResult();

    return (
      !this.areFileListsEqual(initial.cache, current.cache) ||
      !this.areFileListsEqual(initial.error, current.error) ||
      !this.areFileListsEqual(initial.archive, current.archive)
    );
  });

  handleOperation(op: CacheOperation) {
    if (op.action === 'view') {
      this.viewCommand.emit({
        type: this.entity().type,
        id: this.entity().id,
        fileToRetrieve: {
          folder: op.folder,
          filename: op.filename
        }
      });
      return;
    }
    this.localResult.update(current => {
      const state = structuredClone(current);
      if (op.action === 'remove') {
        state[op.folder] = state[op.folder].filter(f => !op.filenames.includes(f.filename));
      }

      if (op.action === 'move') {
        const filesToProcess = state[op.source].filter(f => op.filenames.includes(f.filename));
        state[op.source] = state[op.source].filter(f => !op.filenames.includes(f.filename));
        state[op.destination].push(...filesToProcess);
      }

      state.metrics.currentCacheSize = this.calculateSize(state.cache);
      state.metrics.currentErrorSize = this.calculateSize(state.error);
      state.metrics.currentArchiveSize = this.calculateSize(state.archive);
      return state;
    });
  }

  saveModifications() {
    if (!this.isDirty()) return;

    const initial = this.cacheContent(); // Origin
    const current = this.localResult(); // New (Modified)

    const newCacheSet = new Set(current.cache.map(f => f.filename));
    const newErrorSet = new Set(current.error.map(f => f.filename));
    const newArchiveSet = new Set(current.archive.map(f => f.filename));

    const allNewFilesSet = new Set([...newCacheSet, ...newErrorSet, ...newArchiveSet]);
    const calculateOps = (
      originList: Array<{ filename: string }>,
      currentFolder: DataFolderType
    ): {
      remove: Array<string>;
      move: Array<{ filename: string; to: DataFolderType }>;
    } => {
      const remove: Array<string> = [];
      const move: Array<{ filename: string; to: DataFolderType }> = [];

      for (const file of originList) {
        const filename = file.filename;

        // Case A: Deletion (File is nowhere in the new state)
        if (!allNewFilesSet.has(filename)) {
          remove.push(filename);
          continue;
        }

        // Case B: Move (File is in a different list than before)
        if (currentFolder !== 'cache' && newCacheSet.has(filename)) {
          move.push({ filename, to: 'cache' });
        } else if (currentFolder !== 'error' && newErrorSet.has(filename)) {
          move.push({ filename, to: 'error' });
        } else if (currentFolder !== 'archive' && newArchiveSet.has(filename)) {
          move.push({ filename, to: 'archive' });
        }
      }
      return { remove, move };
    };

    const updateCommand = {
      type: this.entity().type,
      id: this.entity().id,
      updateCommand: {
        cache: calculateOps(initial.cache, 'cache'),
        error: calculateOps(initial.error, 'error'),
        archive: calculateOps(initial.archive, 'archive')
      }
    };
    this.updateCommand.emit(updateCommand);
  }

  private areFileListsEqual(listA: Array<{ filename: string }>, listB: Array<{ filename: string }>): boolean {
    if (listA.length !== listB.length) return false;

    const sortedA = listA.map(f => f.filename).sort();
    const sortedB = listB.map(f => f.filename).sort();

    return JSON.stringify(sortedA) === JSON.stringify(sortedB);
  }

  private calculateSize(files: Array<{ metadata: { contentSize: number } }>): number {
    return files.reduce((acc, curr) => acc + curr.metadata.contentSize, 0);
  }
}
