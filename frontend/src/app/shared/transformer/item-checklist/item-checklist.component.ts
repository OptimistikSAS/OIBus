import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';

import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import { ItemLightDTO, SouthConnectorItemDTO, SouthItemGroupDTO } from '@oibus/shared/api/south-connector.model';

import { filterItems } from '../../item-table/item-table';

/** The items listed at most: the others are reached by searching or filtering */
export const SHOWN_ITEMS_LIMIT = 200;

/** An item of the list, with the names of its group and of its scan mode */
interface ItemRow {
  item: ItemLightDTO;
  group: string | null;
  scanMode: string | null;
}

const toItemLight = (item: ItemLightDTO): ItemLightDTO => ({
  id: item.id,
  name: item.name,
  enabled: item.enabled,
  createdBy: item.createdBy,
  updatedBy: item.updatedBy,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt
});

/**
 * The items of a south, checked to select them: searched and filtered as in the south items list, the checkbox of the
 * header selecting (or unselecting) all the matching items.
 */
@Component({
  selector: 'oib-item-checklist',
  templateUrl: './item-checklist.component.html',
  styleUrl: './item-checklist.component.scss',
  imports: [FormsModule, TranslateDirective, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ItemChecklistComponent {
  readonly items = input.required<ReadonlyArray<SouthConnectorItemDTO>>();
  readonly groups = input<ReadonlyArray<SouthItemGroupDTO>>([]);
  readonly scanModes = input<ReadonlyArray<ScanModeDTO>>([]);
  /** The translation key of the count of the selected items, given `count` and `total` */
  readonly countKey = input('configuration.oibus.manifest.transformers.selected-count');
  readonly selection = model<Array<ItemLightDTO>>([]);

  readonly searchText = signal('');
  readonly groupFilter = signal<string | null>(null);
  readonly scanModeFilter = signal<string | null>(null);
  readonly statusFilter = signal<'enabled' | 'disabled' | null>(null);
  readonly selectedOnly = signal(false);

  private readonly selectedIds = computed(() => new Set(this.selection().map(item => item.id)));
  /** The items matching the search and the filters */
  readonly matchingItems = computed<Array<ItemRow>>(() => {
    const groupFilter = this.groupFilter();
    const scanModeFilter = this.scanModeFilter();
    const selectedIds = this.selectedIds();
    return filterItems(this.items(), { name: this.searchText(), status: this.statusFilter() })
      .filter(item => {
        if (this.selectedOnly() && !selectedIds.has(item.id)) return false;
        if (groupFilter === 'none' && item.group) return false;
        if (groupFilter && groupFilter !== 'none' && item.group?.id !== groupFilter) return false;
        const scanMode = item.group ? item.group.standardSettings.scanMode : item.scanMode;
        return !scanModeFilter || scanMode?.id === scanModeFilter;
      })
      .map(item => ({
        item: toItemLight(item),
        group: item.group?.standardSettings.name ?? null,
        scanMode: (item.group ? item.group.standardSettings.scanMode : item.scanMode)?.name ?? null
      }));
  });
  readonly shownItems = computed(() => this.matchingItems().slice(0, SHOWN_ITEMS_LIMIT));
  readonly allMatchingSelected = computed(
    () => this.matchingItems().length > 0 && this.matchingItems().every(row => this.selectedIds().has(row.item.id))
  );
  readonly someMatchingSelected = computed(
    () => !this.allMatchingSelected() && this.matchingItems().some(row => this.selectedIds().has(row.item.id))
  );
  readonly shownLimit = SHOWN_ITEMS_LIMIT;

  isSelected(item: ItemLightDTO): boolean {
    return this.selectedIds().has(item.id);
  }

  toggle(item: ItemLightDTO) {
    this.selection.update(selection =>
      this.isSelected(item) ? selection.filter(selected => selected.id !== item.id) : [...selection, item]
    );
  }

  /** Selects all the matching items, or unselects them when they all are */
  toggleMatching() {
    const matching = this.matchingItems().map(row => row.item);
    if (this.allMatchingSelected()) {
      const matchingIds = new Set(matching.map(item => item.id));
      this.selection.update(selection => selection.filter(item => !matchingIds.has(item.id)));
    } else {
      this.selection.update(selection => [...selection, ...matching.filter(item => !this.isSelected(item))]);
    }
  }

  clear() {
    this.selection.set([]);
  }
}
