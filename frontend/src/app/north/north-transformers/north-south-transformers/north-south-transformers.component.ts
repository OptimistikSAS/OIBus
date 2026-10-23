import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';

import {
  ItemLightDTO,
  SouthConnectorDTO,
  SouthConnectorItemDTO,
  SouthConnectorLightDTO,
  SouthItemGroupLightDTO
} from '@oibus/shared/api/south-connector.model';
import { TransformerDTOWithOptions } from '@oibus/shared/api/transformer.model';
import { createPageFromArray, Page } from '@oibus/shared/common/types';

import { LoadingSpinnerComponent } from '../../../shared/loading-spinner/loading-spinner.component';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { transformerName, transformerOptionsSummary } from '../../north-summary';
import { TransformerSourcePreset } from '../edit-north-transformer-modal/edit-north-transformer-modal.component';
import { groupLevelTransformers, ItemRouting, resolveItemRouting, southLevelTransformers, SouthTransformer } from '../transformer-routing';

const PAGE_SIZE = 20;

/** An item of the south, with the transformer its data goes through on the way to the North */
export interface ItemRow {
  item: ItemLightDTO;
  routing: ItemRouting | null;
}

/** A group of the south (or its items without group), with its own transformers and its items */
export interface GroupRow {
  /** `null` for the items without group */
  group: SouthItemGroupLightDTO | null;
  transformers: Array<SouthTransformer>;
  items: Array<ItemRow>;
  droppedCount: number;
}

/** An item and the transformer it is (or would be) routed to */
export interface ItemAction {
  transformer: TransformerDTOWithOptions;
  item: ItemLightDTO;
}

const toItemLight = (item: SouthConnectorItemDTO): ItemLightDTO => ({
  id: item.id,
  name: item.name,
  enabled: item.enabled,
  createdBy: item.createdBy,
  updatedBy: item.updatedBy,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt
});

/**
 * The groups and items of a south, each with the transformer its data goes through on the way to the North (its own one,
 * its group's or the south's) or that it is dropped, and the actions changing it. The changes themselves are made by the
 * North transformers section, through the outputs.
 */
@Component({
  selector: 'oib-north-south-transformers',
  templateUrl: './north-south-transformers.component.html',
  styleUrl: '../routing-rows.scss',
  imports: [FormsModule, TranslateDirective, TranslatePipe, NgbTooltip, LoadingSpinnerComponent, PaginationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NorthSouthTransformersComponent {
  private readonly translateService = inject(TranslateService);

  readonly south = input.required<SouthConnectorLightDTO>();
  /** The south with its groups and items, loaded by the North transformers section (`null` while it loads) */
  readonly southConnector = input<SouthConnectorDTO | null>(null);
  readonly transformers = input.required<Array<TransformerDTOWithOptions>>();
  /** The transformers the North never uses, another one applying first */
  readonly unusedTransformerIds = input<Set<string>>(new Set());
  /** Whether the audit history of the transformers can be shown (they are saved) */
  readonly canAudit = input(false);

  readonly add = output<TransformerSourcePreset>();
  readonly edit = output<TransformerDTOWithOptions>();
  readonly remove = output<TransformerDTOWithOptions>();
  readonly audit = output<TransformerDTOWithOptions>();
  /** Leaves an item out of the transformer of its group or of its south */
  readonly exclude = output<ItemAction>();
  /** Removes an item from the list of a transformer */
  readonly removeItem = output<ItemAction>();

  readonly loading = computed(() => !this.southConnector());
  readonly itemSearch = signal('');
  /** The expanded groups, by id ('' for the items without group) */
  readonly expandedGroups = signal<Set<string>>(new Set());
  private readonly pageNumbers = signal<Map<string, number>>(new Map());

  readonly southLevelTransformer = computed(() => southLevelTransformers(this.transformers(), this.south().id)[0] ?? null);

  readonly groups = computed<Array<GroupRow>>(() => {
    const southConnector = this.southConnector();
    if (!southConnector) return [];
    const transformers = this.transformers();
    const southId = this.south().id;
    const search = this.itemSearch().toLowerCase();
    const rows: Array<GroupRow> = southConnector.groups.map(group => ({
      group: { id: group.id, name: group.standardSettings.name },
      transformers: groupLevelTransformers(transformers, southId, group.id),
      items: [],
      droppedCount: 0
    }));
    const withoutGroup: GroupRow = { group: null, transformers: [], items: [], droppedCount: 0 };
    for (const item of [...southConnector.items].sort((a, b) => a.name.localeCompare(b.name))) {
      const row = rows.find(element => element.group!.id === item.group?.id) ?? withoutGroup;
      const routing = resolveItemRouting(transformers, southId, { id: item.id, groupId: item.group?.id ?? null });
      if (!routing) row.droppedCount++;
      if (item.name.toLowerCase().includes(search)) {
        row.items.push({ item: toItemLight(item), routing });
      }
    }
    return withoutGroup.items.length || withoutGroup.droppedCount ? [...rows, withoutGroup] : rows;
  });

  groupKey(row: GroupRow): string {
    return row.group?.id ?? '';
  }

  isExpanded(row: GroupRow): boolean {
    // Searching shows the matching items of every group
    return !!this.itemSearch() || this.expandedGroups().has(this.groupKey(row));
  }

  toggleGroup(row: GroupRow) {
    const expandedGroups = new Set(this.expandedGroups());
    const key = this.groupKey(row);
    if (expandedGroups.has(key)) {
      expandedGroups.delete(key);
    } else {
      expandedGroups.add(key);
    }
    this.expandedGroups.set(expandedGroups);
  }

  page(row: GroupRow): Page<ItemRow> {
    const page = createPageFromArray(row.items, PAGE_SIZE, this.pageNumbers().get(this.groupKey(row)) ?? 0);
    // The search may leave fewer pages than the displayed one
    return page.content.length || page.number === 0 ? page : createPageFromArray(row.items, PAGE_SIZE, 0);
  }

  changePage(row: GroupRow, pageNumber: number) {
    this.pageNumbers.set(new Map(this.pageNumbers()).set(this.groupKey(row), pageNumber));
  }

  search(text: string) {
    this.itemSearch.set(text);
    this.pageNumbers.set(new Map());
  }

  name(transformer: TransformerDTOWithOptions): string {
    return transformerName(transformer.transformer, this.translateService);
  }

  /** The options of a transformer shown beside its name (e.g. the time precision of the OIAnalytics payloads) */
  options(transformer: TransformerDTOWithOptions): string {
    return transformerOptionsSummary(transformer, this.translateService);
  }

  /** The number of items, other than this one, sharing an item level transformer */
  sharedWith(transformer: TransformerDTOWithOptions): number {
    return transformer.source.type === 'south' ? transformer.source.items.length - 1 : 0;
  }

  /** The number of items left out of a transformer applying to all the items (of a group or of the south) */
  excludedCount(transformer: TransformerDTOWithOptions): number {
    return transformer.source.type === 'south' ? (transformer.source.excludedItems?.length ?? 0) : 0;
  }
}
