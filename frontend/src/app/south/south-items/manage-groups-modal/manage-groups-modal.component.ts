import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';

import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DateTime } from 'luxon';
import csv from 'papaparse';
import { concatMap, from, toArray } from 'rxjs';

import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import { SouthItemGroupCommandDTO, SouthItemGroupDTO } from '@oibus/shared/api/south-connector.model';
import { SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';
import { SouthHistoryRecoveryStrategy } from '@oibus/shared/domain/south-connector.model';

import { DownloadService } from '../../../services/download.service';
import { ModalService } from '../../../shared/modal.service';
import { openGroupModal, SouthItemGroup, SouthItemGroups } from '../south-item-groups';

interface GroupImportError {
  row: number;
  message: string;
}

const enum ColumnSortState {
  INDETERMINATE = 0,
  ASCENDING = 1,
  DESCENDING = 2
}

type SortableColumn = 'name' | 'schedule' | 'itemCount';

const SORT_ICONS: Record<ColumnSortState, string> = {
  [ColumnSortState.INDETERMINATE]: 'fa-sort',
  [ColumnSortState.ASCENDING]: 'fa-sort-up',
  [ColumnSortState.DESCENDING]: 'fa-sort-down'
};

@Component({
  selector: 'oib-manage-groups-modal',
  templateUrl: './manage-groups-modal.component.html',
  styleUrl: './manage-groups-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, TranslatePipe, NgbTooltip, ReactiveFormsModule]
})
export default class ManageGroupsModalComponent {
  private modal = inject(NgbActiveModal);
  private modalService = inject(ModalService);
  private translateService = inject(TranslateService);
  private fb = inject(NonNullableFormBuilder);
  private downloadService = inject(DownloadService);

  readonly directSave = signal(true);
  /** The groups of the page, changed through it only */
  private readonly groupStore = signal<SouthItemGroups | null>(null);
  readonly groups = computed(() => this.groupStore()?.list() ?? []);
  readonly scanModes = signal<Array<ScanModeDTO>>([]);
  private readonly manifest = signal<SouthConnectorManifest | null>(null);
  private getItemCountFn: (groupId: string) => number = () => 0;

  readonly importing = signal(false);
  readonly importErrors = signal<Array<GroupImportError>>([]);
  readonly importSuccessCount = signal<number | null>(null);

  readonly searchControl = this.fb.control(null as string | null);
  readonly scheduleFilterControl = this.fb.control(null as string | null);
  private readonly searchText = toSignal(this.searchControl.valueChanges, { initialValue: this.searchControl.value });
  private readonly scheduleFilter = toSignal(this.scheduleFilterControl.valueChanges, { initialValue: this.scheduleFilterControl.value });

  /** The column the groups are sorted by, and in which order. */
  private readonly columnSort = signal<{ column: SortableColumn | null; state: ColumnSortState }>({
    column: null,
    state: ColumnSortState.INDETERMINATE
  });

  readonly hasHistorianCapabilities = computed(() => this.manifest()?.modes.history ?? false);

  readonly displayedGroups = computed(() => {
    const searchText = (this.searchText() || '').toLowerCase();
    const scheduleFilter = this.scheduleFilter();

    let result = this.groups().filter(group => {
      if (searchText && !group.standardSettings.name.toLowerCase().includes(searchText)) {
        return false;
      }
      if (scheduleFilter) {
        const scanModeId =
          (group as SouthItemGroupDTO).standardSettings.scanMode?.id || (group as SouthItemGroupCommandDTO).standardSettings.scanModeId;
        if (scanModeId !== scheduleFilter) {
          return false;
        }
      }
      return true;
    });

    const { column, state } = this.columnSort();
    if (column && state !== ColumnSortState.INDETERMINATE) {
      const ascending = state === ColumnSortState.ASCENDING;
      result = [...result].sort((a, b) => {
        switch (column) {
          case 'name':
            return ascending
              ? a.standardSettings.name.localeCompare(b.standardSettings.name)
              : b.standardSettings.name.localeCompare(a.standardSettings.name);
          case 'schedule':
            return ascending
              ? this.getScanModeName(a).localeCompare(this.getScanModeName(b))
              : this.getScanModeName(b).localeCompare(this.getScanModeName(a));
          case 'itemCount': {
            const diff = this.getItemCount(a.id!) - this.getItemCount(b.id!);
            return ascending ? diff : -diff;
          }
        }
      });
    }

    return result;
  });

  prepare(
    groups: SouthItemGroups,
    scanModes: Array<ScanModeDTO>,
    manifest: SouthConnectorManifest,
    directSave: boolean,
    getItemCount: (groupId: string) => number
  ) {
    this.groupStore.set(groups);
    this.scanModes.set(scanModes);
    this.manifest.set(manifest);
    this.directSave.set(directSave);
    this.getItemCountFn = getItemCount;
  }

  close() {
    this.modal.close();
  }

  getItemCount(groupId: string): number {
    return this.getItemCountFn(groupId);
  }

  getScanModeName(group: SouthItemGroupDTO | SouthItemGroupCommandDTO): string {
    const scanModeId =
      (group as SouthItemGroupDTO).standardSettings.scanMode?.id || (group as SouthItemGroupCommandDTO).standardSettings.scanModeId;
    return this.scanModes().find(scanMode => scanMode.id === scanModeId)?.name || '';
  }

  /** The Font Awesome icon showing how the groups are sorted by this column. */
  sortIcon(column: SortableColumn): string {
    const { column: sortedColumn, state } = this.columnSort();
    return SORT_ICONS[sortedColumn === column ? state : ColumnSortState.INDETERMINATE];
  }

  toggleColumnSort(column: SortableColumn) {
    // a newly sorted column starts from INDETERMINATE (the other columns are reset), then cycles ascending, descending
    this.columnSort.update(sort => ({
      column,
      state: (((sort.column === column ? sort.state : ColumnSortState.INDETERMINATE) + 1) % 3) as ColumnSortState
    }));
  }

  onAddGroup() {
    this.openGroupModal().subscribe();
  }

  onEditGroup(group: SouthItemGroup) {
    this.openGroupModal(group).subscribe();
  }

  private openGroupModal(group?: SouthItemGroup) {
    return openGroupModal(this.modalService, this.groupStore()!, {
      scanModes: this.scanModes(),
      manifest: this.manifest()!,
      directSave: this.directSave(),
      group
    });
  }

  onDeleteGroup(group: SouthItemGroup) {
    this.groupStore()!.delete(group).subscribe();
  }

  exportGroups() {
    const rows = this.groups().map(group => ({
      name: group.standardSettings.name,
      scanMode: this.getScanModeName(group),
      startTimeOffset: group.historySettings.startTimeOffset,
      endTimeOffset: group.historySettings.endTimeOffset,
      maxReadInterval: group.historySettings.maxReadInterval,
      readDelay: group.historySettings.readDelay,
      recoveryStrategy: group.historySettings.recoveryStrategy
    }));
    const content = csv.unparse(rows, { header: true, delimiter: ',' });
    const blob = new Blob([content], { type: 'text/csv' });
    this.downloadService.downloadFile({ blob, name: `groups_${DateTime.now().toUTC().toFormat('yyyy_MM_dd_HH_mm_ss_SSS')}.csv` });
  }

  async onImportFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    this.importErrors.set([]);
    this.importSuccessCount.set(null);

    const content = await file.text();
    const parsed = csv.parse<Record<string, string>>(content, { header: true, skipEmptyLines: true });

    const existingNames = new Set(this.groups().map(group => group.standardSettings.name.toLowerCase()));
    const seenNames = new Set<string>();
    const commands: Array<SouthItemGroupCommandDTO> = [];
    const errors: Array<GroupImportError> = [];

    parsed.data.forEach((row, index) => {
      const rowNumber = index + 1;
      const name = (row['name'] || '').trim();
      const scanModeName = (row['scanMode'] || '').trim();

      if (!name) {
        errors.push({ row: rowNumber, message: this.translateService.instant('south.groups.import.errors.missing-name') });
        return;
      }
      if (existingNames.has(name.toLowerCase()) || seenNames.has(name.toLowerCase())) {
        errors.push({ row: rowNumber, message: this.translateService.instant('south.groups.import.errors.duplicate-name', { name }) });
        return;
      }
      const scanMode = this.scanModes().find(sm => sm.name.toLowerCase() === scanModeName.toLowerCase());
      if (!scanMode) {
        errors.push({
          row: rowNumber,
          message: this.translateService.instant('south.groups.import.errors.unknown-scan-mode', { scanMode: scanModeName })
        });
        return;
      }

      seenNames.add(name.toLowerCase());
      const recoveryStrategy: SouthHistoryRecoveryStrategy = (row['recoveryStrategy'] || '').trim() === 'newest' ? 'newest' : 'oldest';
      commands.push({
        id: null,
        standardSettings: { name, scanModeId: scanMode.id },
        historySettings: {
          startTimeOffset: row['startTimeOffset'] ? Number(row['startTimeOffset']) : null,
          endTimeOffset: row['endTimeOffset'] ? Number(row['endTimeOffset']) : null,
          maxReadInterval: Number(row['maxReadInterval']) || 3600,
          readDelay: Number(row['readDelay']) || 200,
          recoveryStrategy,
          cachingStrategy: null
        }
      });
    });

    this.importErrors.set(errors);

    if (commands.length === 0) {
      return;
    }

    this.importing.set(true);
    from(commands)
      .pipe(
        concatMap(command => this.groupStore()!.save({ mode: 'create', group: command })),
        toArray()
      )
      .subscribe(results => {
        this.importing.set(false);
        this.importSuccessCount.set(results.length);
      });
  }
}
