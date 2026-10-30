import { ChangeDetectionStrategy, Component, computed, input, model, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';

import { TranslateDirective } from '@ngx-translate/core';
import { debounceTime, filter, Observable } from 'rxjs';

import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import { SouthConnectorItemCommandDTO } from '@oibus/shared/api/south-connector.model';
import { SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';
import { SouthItemSettings } from '@oibus/shared/connector/south-settings.model';

import { extractErrorMessage } from '../../../shared/extract-error-message';
import { DiscoveredItemsReviewComponent } from '../../south-items/discovered-items-review/discovered-items-review.component';
import { SouthItemGroups } from '../../south-items/south-item-groups';
import { itemFieldMappingToSend, itemMappingProblem, MappableField } from '../item-field-mapping-form/item-field-mapping';
import { ItemFieldMappingFormComponent } from '../item-field-mapping-form/item-field-mapping-form.component';

/** How long the mapping has to stay as it is, in ms, before the items to add are discovered again. */
const ITEMS_DISCOVERY_DEBOUNCE = 400;

/** The state of the discovery of the items to add. */
interface ItemsDiscoveryState {
  readonly loading: boolean;
  readonly error: string | null;
  readonly commands: ReadonlyArray<SouthConnectorItemCommandDTO> | null;
}

/**
 * The Add as items step of the explore wizard: how the nodes checked in the Explore step are mapped to items, and the items
 * they give, reviewed before they are added. The items follow the mapping: they are discovered when the step opens, and
 * again a moment after the mapping stops changing.
 */
@Component({
  selector: 'oib-add-items-step',
  templateUrl: './add-items-step.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, ItemFieldMappingFormComponent, DiscoveredItemsReviewComponent]
})
export class AddItemsStepComponent {
  /** Whether the step is the one shown: the items are only discovered then */
  readonly active = input(false);
  /** The nodes checked in the Explore step */
  readonly nodeIds = input<ReadonlyArray<string>>([]);
  /** The synchronisations that already keep in sync the items of the checked nodes */
  readonly coveringWorkflowNames = input<ReadonlyArray<string>>([]);
  /** Discovers the items of a scope, mapped as told */
  readonly discover =
    input.required<(scope: Record<string, unknown>, mapping: Record<string, string>) => Observable<Array<SouthConnectorItemCommandDTO>>>();
  /** The items of the connector: a new one can't take their names, and one with the same settings is skipped by default */
  readonly existingItems = input<ReadonlyArray<{ name: string; settings: SouthItemSettings }>>([]);
  /** The item fields to map (see `ItemFieldMappingFormComponent`) */
  readonly fields = input.required<ReadonlyArray<MappableField>>();
  /** The item mapping, kept by the wizard */
  readonly values = model.required<Record<string, string>>();
  readonly manifest = input.required<SouthConnectorManifest>();
  readonly recordFields = input<ReadonlyArray<string>>([]);
  readonly scanModes = input<Array<ScanModeDTO>>([]);
  readonly itemScanModes = input<ReadonlyArray<ScanModeDTO>>([]);
  readonly groupStore = input<SouthItemGroups | null>(null);
  readonly directSave = input(false);
  /** The items of a connector that only subscribes follow the subscription */
  readonly subscriptionOnly = input(false);

  private readonly review = viewChild(DiscoveredItemsReviewComponent);

  /** The items the checked nodes give, mapped as in the mapping form */
  readonly discovery = signal<ItemsDiscoveryState | null>(null);
  /** Why the items can't be discovered yet: the mapping form is not complete - a translation key */
  readonly mappingError = computed(() => itemMappingProblem(this.fields(), this.values()));
  private readonly mapping = computed(() => itemFieldMappingToSend(this.fields(), this.values(), this.subscriptionOnly()));
  /** What was discovered last: the checked nodes and the mapping */
  private readonly discoveryKey = signal<string | null>(null);
  private readonly currentDiscoveryKey = computed(() => JSON.stringify([this.nodeIds(), this.mapping()]));
  /** Whether the mapping changed since the items were discovered: they are to be discovered again before they are added */
  readonly stale = computed(() => this.discoveryKey() !== null && this.discoveryKey() !== this.currentDiscoveryKey());

  /** Whether the items reviewed can be added */
  readonly canAdd = computed(
    () => !this.mappingError() && !this.stale() && !this.discovery()?.loading && (this.review()?.valid() ?? false)
  );
  /** How many of the items reviewed are to be added */
  readonly includedCount = computed(() => this.review()?.includedCount() ?? 0);

  constructor() {
    toObservable(this.active)
      .pipe(filter(Boolean), takeUntilDestroyed())
      .subscribe(() => this.discoverItems());
    toObservable(this.currentDiscoveryKey)
      .pipe(
        debounceTime(ITEMS_DISCOVERY_DEBOUNCE),
        filter(() => this.active()),
        takeUntilDestroyed()
      )
      .subscribe(() => this.discoverItems());
  }

  /** The items to add, as reviewed */
  includedCommands(): Array<SouthConnectorItemCommandDTO> {
    return this.review()?.includedCommands() ?? [];
  }

  /**
   * The items the checked nodes give, mapped as in the mapping form: unless forced, nothing happens when it is what was
   * discovered last, so that coming back to the step keeps what was reviewed in it.
   */
  discoverItems(force = false) {
    const key = this.currentDiscoveryKey();
    if (!force && key === this.discoveryKey() && !this.discovery()?.error) {
      return;
    }
    this.discoveryKey.set(key);
    if (this.nodeIds().length === 0 || this.mappingError()) {
      this.discovery.set(null);
      return;
    }
    this.discovery.set({ loading: true, error: null, commands: null });
    this.discover()({ nodeIds: [...this.nodeIds()] }, this.mapping()).subscribe({
      next: commands => {
        if (this.discoveryKey() === key) {
          this.discovery.set({ loading: false, error: null, commands: commands.map(command => this.withScheduleNames(command)) });
        }
      },
      error: error => {
        if (this.discoveryKey() === key) {
          this.discovery.set({ loading: false, error: extractErrorMessage(error), commands: null });
        }
      }
    });
  }

  /**
   * The item as the item form would give it: an item of a group has the schedule of its group, not one of its own, and the
   * names of its group and schedule come with their ids.
   */
  private withScheduleNames(command: SouthConnectorItemCommandDTO): SouthConnectorItemCommandDTO {
    const group =
      this.groupStore()
        ?.list()
        .find(candidate => candidate.id === command.groupId) ?? null;
    const syncWithGroup = !!group && command.syncWithGroup;
    const scanMode = group ? null : (this.scanModes().find(candidate => candidate.id === command.scanModeId) ?? null);
    return {
      ...command,
      description: command.description ?? null,
      groupId: group?.id ?? null,
      groupName: group?.standardSettings.name ?? null,
      syncWithGroup,
      scanModeId: scanMode?.id ?? null,
      scanModeName: scanMode?.name ?? null
    };
  }
}
