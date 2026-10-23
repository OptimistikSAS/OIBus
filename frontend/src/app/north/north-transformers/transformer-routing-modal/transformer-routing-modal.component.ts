import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';

import { SouthConnectorItemDTO, SouthConnectorLightDTO } from '@oibus/shared/api/south-connector.model';
import { TransformerDTOWithOptions } from '@oibus/shared/api/transformer.model';
import { createPageFromArray } from '@oibus/shared/common/types';

import { SouthConnectorService } from '../../../services/south-connector.service';
import { LoadingSpinnerComponent } from '../../../shared/loading-spinner/loading-spinner.component';
import { OIBusSouthTypeEnumPipe } from '../../../shared/oibus-south-type-enum.pipe';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { transformerName } from '../../north-summary';
import { resolveItemRouting, RoutingLevel, southCoverage } from '../transformer-routing';

const PAGE_SIZE = 20;

/** An item of the south, with the transformer the North routes it to (`null` when its data is dropped) */
export interface RoutedItem {
  id: string;
  name: string;
  enabled: boolean;
  group: string | null;
  transformer: string | null;
  level: RoutingLevel | null;
}

/**
 * Shows, for each item of a south, the transformer its data goes through on the way to the North (item, group or south
 * level), or that it is dropped. Closed with the south when the user chooses to send the dropped items.
 */
@Component({
  selector: 'oib-transformer-routing-modal',
  templateUrl: './transformer-routing-modal.component.html',
  imports: [FormsModule, TranslateDirective, TranslatePipe, LoadingSpinnerComponent, OIBusSouthTypeEnumPipe, PaginationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TransformerRoutingModalComponent {
  private readonly modal = inject(NgbActiveModal);
  private readonly southConnectorService = inject(SouthConnectorService);
  private readonly translateService = inject(TranslateService);

  readonly southConnectors = signal<Array<SouthConnectorLightDTO>>([]);
  readonly transformers = signal<Array<TransformerDTOWithOptions>>([]);
  readonly south = signal<SouthConnectorLightDTO | null>(null);
  readonly loading = signal(false);
  readonly items = signal<Array<RoutedItem>>([]);
  readonly search = signal('');
  readonly onlyDropped = signal(false);
  readonly pageNumber = signal(0);

  readonly droppedCount = computed(() => this.items().filter(item => !item.transformer).length);
  /** The dropped items can be sent through a transformer applying to all the items: there is none yet */
  readonly canSendDropped = computed(() => {
    const south = this.south();
    return !!south && this.droppedCount() > 0 && southCoverage(this.transformers(), south.id) !== 'all';
  });
  private readonly filteredItems = computed(() => {
    const search = this.search().toLowerCase();
    return this.items().filter(item => (!this.onlyDropped() || !item.transformer) && item.name.toLowerCase().includes(search));
  });
  readonly page = computed(() => createPageFromArray(this.filteredItems(), PAGE_SIZE, this.pageNumber()));

  prepare(
    southConnectors: Array<SouthConnectorLightDTO>,
    transformers: Array<TransformerDTOWithOptions>,
    south: SouthConnectorLightDTO | null
  ) {
    this.southConnectors.set(southConnectors);
    this.transformers.set(transformers);
    if (south) {
      this.selectSouth(south);
    }
  }

  selectSouth(south: SouthConnectorLightDTO | null) {
    this.south.set(south);
    this.items.set([]);
    this.pageNumber.set(0);
    if (!south) return;
    this.loading.set(true);
    this.southConnectorService.findById(south.id).subscribe(southConnector => {
      this.items.set(
        [...southConnector.items]
          .sort(
            (a, b) =>
              (a.group?.standardSettings.name ?? '').localeCompare(b.group?.standardSettings.name ?? '') || a.name.localeCompare(b.name)
          )
          .map(item => this.routeItem(south.id, item))
      );
      this.loading.set(false);
    });
  }

  filter(search: string, onlyDropped: boolean) {
    this.search.set(search);
    this.onlyDropped.set(onlyDropped);
    this.pageNumber.set(0);
  }

  /** Whether an item starts a new group in the displayed page */
  startsGroup(index: number): boolean {
    const content = this.page().content;
    return index === 0 || content[index - 1].group !== content[index].group;
  }

  compareSouths(s1: SouthConnectorLightDTO | null, s2: SouthConnectorLightDTO | null): boolean {
    return s1 && s2 ? s1.id === s2.id : s1 === s2;
  }

  sendDropped() {
    this.modal.close(this.south());
  }

  close() {
    this.modal.dismiss();
  }

  private routeItem(southId: string, item: SouthConnectorItemDTO): RoutedItem {
    const routing = resolveItemRouting(this.transformers(), southId, { id: item.id, groupId: item.group?.id ?? null });
    return {
      id: item.id,
      name: item.name,
      enabled: item.enabled,
      group: item.group?.standardSettings.name ?? null,
      transformer: routing ? transformerName(routing.transformer.transformer, this.translateService) : null,
      level: routing?.level ?? null
    };
  }
}
