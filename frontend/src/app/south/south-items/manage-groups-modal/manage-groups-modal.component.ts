import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, switchMap, concatMap, from, toArray } from 'rxjs';
import {
  SouthConnectorManifest,
  SouthHistoryRecoveryStrategy,
  SouthItemGroupCommandDTO,
  SouthItemGroupDTO
} from '../../../../../../backend/shared/model/south-connector.model';
import { ScanModeDTO } from '../../../../../../backend/shared/model/scan-mode.model';
import { ModalService } from '../../../shared/modal.service';
import { EditSouthItemGroupModalComponent } from '../edit-south-item-group-modal/edit-south-item-group-modal.component';
import csv from 'papaparse';
import { DateTime } from 'luxon';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';

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

@Component({
  selector: 'oib-manage-groups-modal',
  templateUrl: './manage-groups-modal.component.html',
  styleUrl: './manage-groups-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [TranslateDirective, TranslatePipe, NgbTooltip, ReactiveFormsModule]
})
export default class ManageGroupsModalComponent {
  private modal = inject(NgbActiveModal);
  private modalService = inject(ModalService);
  private translateService = inject(TranslateService);
  private fb = inject(NonNullableFormBuilder);

  directSave = true;
  groups: Array<SouthItemGroupDTO | SouthItemGroupCommandDTO> = [];
  displayedGroups: Array<SouthItemGroupDTO | SouthItemGroupCommandDTO> = [];
  scanModes: Array<ScanModeDTO> = [];
  manifest!: SouthConnectorManifest;
  getItemCount!: (groupId: string) => number;
  addOrEditGroup!: (command: {
    mode: 'create' | 'edit';
    group: SouthItemGroupCommandDTO;
  }) => Observable<SouthItemGroupDTO | SouthItemGroupCommandDTO>;
  deleteGroup!: (group: SouthItemGroupDTO | SouthItemGroupCommandDTO) => Observable<void>;

  importing = false;
  importErrors: Array<GroupImportError> = [];
  importSuccessCount: number | null = null;

  searchControl = this.fb.control(null as string | null);
  scheduleFilterControl = this.fb.control(null as string | null);

  columnSortStates: Record<SortableColumn, ColumnSortState> = {
    name: ColumnSortState.INDETERMINATE,
    schedule: ColumnSortState.INDETERMINATE,
    itemCount: ColumnSortState.INDETERMINATE
  };
  currentColumnSort: SortableColumn | null = null;

  constructor() {
    this.searchControl.valueChanges.subscribe(() => this.refreshDisplayedGroups());
    this.scheduleFilterControl.valueChanges.subscribe(() => this.refreshDisplayedGroups());
  }

  get hasHistorianCapabilities(): boolean {
    return this.manifest?.modes?.history;
  }

  prepare(
    groups: Array<SouthItemGroupDTO | SouthItemGroupCommandDTO>,
    scanModes: Array<ScanModeDTO>,
    manifest: SouthConnectorManifest,
    directSave: boolean,
    getItemCount: (groupId: string) => number,
    addOrEditGroup: (command: {
      mode: 'create' | 'edit';
      group: SouthItemGroupCommandDTO;
    }) => Observable<SouthItemGroupDTO | SouthItemGroupCommandDTO>,
    deleteGroup: (group: SouthItemGroupDTO | SouthItemGroupCommandDTO) => Observable<void>
  ) {
    this.groups = groups;
    this.scanModes = scanModes;
    this.manifest = manifest;
    this.directSave = directSave;
    this.getItemCount = getItemCount;
    this.addOrEditGroup = addOrEditGroup;
    this.deleteGroup = deleteGroup;
    this.refreshDisplayedGroups();
  }

  close() {
    this.modal.close();
  }

  getScanModeName(group: SouthItemGroupDTO | SouthItemGroupCommandDTO): string {
    const scanModeId =
      (group as SouthItemGroupDTO).standardSettings.scanMode?.id || (group as SouthItemGroupCommandDTO).standardSettings.scanModeId;
    return this.scanModes.find(scanMode => scanMode.id === scanModeId)?.name || '';
  }

  toggleColumnSort(columnName: SortableColumn) {
    this.currentColumnSort = columnName;
    this.columnSortStates[this.currentColumnSort] = ((this.columnSortStates[this.currentColumnSort] + 1) % 3) as ColumnSortState;

    Object.keys(this.columnSortStates).forEach(key => {
      if (this.currentColumnSort !== key) {
        this.columnSortStates[key as SortableColumn] = ColumnSortState.INDETERMINATE;
      }
    });

    this.refreshDisplayedGroups();
  }

  private refreshDisplayedGroups() {
    const searchText = (this.searchControl.value || '').toLowerCase();
    const scheduleFilter = this.scheduleFilterControl.value;

    let result = this.groups.filter(group => {
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

    if (this.currentColumnSort && this.columnSortStates[this.currentColumnSort] !== ColumnSortState.INDETERMINATE) {
      const ascending = this.columnSortStates[this.currentColumnSort] === ColumnSortState.ASCENDING;
      result = [...result].sort((a, b) => {
        switch (this.currentColumnSort) {
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
          default:
            return 0;
        }
      });
    }

    this.displayedGroups = result;
  }

  onAddGroup() {
    const modalRef = this.modalService.open(EditSouthItemGroupModalComponent, { backdrop: 'static' });
    const component: EditSouthItemGroupModalComponent = modalRef.componentInstance;
    component.directSave = this.directSave;
    component.prepareForCreation(this.scanModes, this.groups, this.manifest);
    modalRef.result.pipe(switchMap(result => this.addOrEditGroup(result))).subscribe(groupResult => {
      this.groups.push(groupResult);
      this.refreshDisplayedGroups();
    });
  }

  onEditGroup(group: SouthItemGroupDTO | SouthItemGroupCommandDTO) {
    const modalRef = this.modalService.open(EditSouthItemGroupModalComponent, { backdrop: 'static' });
    const component: EditSouthItemGroupModalComponent = modalRef.componentInstance;
    component.directSave = this.directSave;
    component.prepareForEdition(this.scanModes, this.groups, this.manifest, group);
    modalRef.result.pipe(switchMap(result => this.addOrEditGroup(result))).subscribe(groupResult => {
      const index = this.groups.findIndex(g => g.id === groupResult.id);
      if (index >= 0) {
        this.groups[index] = groupResult;
      } else {
        this.groups.push(groupResult);
      }
      this.refreshDisplayedGroups();
    });
  }

  onDeleteGroup(group: SouthItemGroupDTO | SouthItemGroupCommandDTO) {
    this.deleteGroup(group).subscribe(() => {
      const index = this.groups.findIndex(g => g.id === group.id);
      if (index >= 0) {
        this.groups.splice(index, 1);
      }
      this.refreshDisplayedGroups();
    });
  }

  exportGroups() {
    const rows = this.groups.map(group => ({
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
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `groups_${DateTime.now().toUTC().toFormat('yyyy_MM_dd_HH_mm_ss_SSS')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async onImportFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    this.importErrors = [];
    this.importSuccessCount = null;

    const content = await file.text();
    const parsed = csv.parse(content, { header: true, skipEmptyLines: true });

    const existingNames = new Set(this.groups.map(group => group.standardSettings.name.toLowerCase()));
    const seenNames = new Set<string>();
    const commands: Array<SouthItemGroupCommandDTO> = [];
    const errors: Array<GroupImportError> = [];

    (parsed.data as Array<Record<string, string>>).forEach((row, index) => {
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
      const scanMode = this.scanModes.find(sm => sm.name.toLowerCase() === scanModeName.toLowerCase());
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
          recoveryStrategy
        }
      } as SouthItemGroupCommandDTO);
    });

    this.importErrors = errors;

    if (commands.length === 0) {
      return;
    }

    this.importing = true;
    from(commands)
      .pipe(
        concatMap(command => this.addOrEditGroup({ mode: 'create', group: command })),
        toArray()
      )
      .subscribe(results => {
        results.forEach(result => this.groups.push(result));
        this.importing = false;
        this.importSuccessCount = results.length;
        this.refreshDisplayedGroups();
      });
  }
}
