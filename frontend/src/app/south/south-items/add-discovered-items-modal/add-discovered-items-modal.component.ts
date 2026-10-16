import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';

import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import { SouthConnectorItemCommandDTO } from '@oibus/shared/api/south-connector.model';
import { OIBusObjectAttribute, OIBusScanModeAttribute } from '@oibus/shared/connector/form.model';
import { SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';
import { SouthItemSettings, SouthSettings } from '@oibus/shared/connector/south-settings.model';

import { SouthConnectorService } from '../../../services/south-connector.service';
import { extractErrorMessage } from '../../../shared/extract-error-message';
import { SouthItemGroups } from '../south-item-groups';

/** One discovered item, as reviewed before it is added. */
interface DiscoveredItemRow {
  readonly command: SouthConnectorItemCommandDTO;
  readonly included: boolean;
  readonly name: string;
  /** Name of an item of the connector with the same settings - it already reads what this one would */
  readonly existingItemName: string | null;
}

export interface AddDiscoveredItemsOptions {
  /** The connector id, or `create` for a connector being created */
  southId: string;
  /** The connector settings, as currently edited */
  southSettings: SouthSettings;
  /** Its manifest: the discovery defaults map each discovered record to an item */
  manifest: SouthConnectorManifest;
  scanModes: Array<ScanModeDTO>;
  groups: SouthItemGroups;
  /** The items of the connector: a new one can't take their names, and one with the same settings is skipped by default */
  existingItems: ReadonlyArray<{ name: string; settings: SouthItemSettings }>;
  /** The nodes checked in the Explore modal: a point stands for itself, any other node for everything under it */
  nodeIds: Array<string>;
}

/** The settings without their unset values, keys sorted: two items read the same thing when these are equal. */
function settingsKey(settings: SouthItemSettings): string {
  const entries = Object.entries(settings)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

/** The settings of an item as a plain record, whatever its connector type. */
function settingsRecord(settings: SouthItemSettings): Record<string, unknown> {
  return Object.fromEntries(Object.entries(settings));
}

/** A setting value as shown in the review table. */
function displayValue(value: unknown): string {
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/**
 * "Add as items" of the Explore modal: the checked nodes are discovered, each record mapped to a new item by the
 * connector's discovery defaults (the same mapping a new Configuration Workflow starts from), and listed for review
 * - name, schedule or group, which ones to add - before they are added as plain items. No workflow is created.
 *
 * Closes with the item commands to add; the page saves them (through the API from south-detail, in memory from
 * edit-south).
 */
@Component({
  selector: 'oib-add-discovered-items-modal',
  templateUrl: './add-discovered-items-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslateDirective, TranslatePipe]
})
export class AddDiscoveredItemsModalComponent {
  private readonly modal = inject(NgbActiveModal);
  private readonly southConnectorService = inject(SouthConnectorService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly rows = signal<ReadonlyArray<DiscoveredItemRow>>([]);
  readonly scanModes = signal<Array<ScanModeDTO>>([]);
  /** A fixed subscription schedule (subscription-only connectors): there is nothing to pick */
  readonly subscriptionOnly = signal(false);
  private readonly groupStore = signal<SouthItemGroups | null>(null);
  readonly groups = computed(() => this.groupStore()?.list() ?? []);
  readonly groupId = signal<string | null>(null);
  readonly scanModeId = signal<string | null>(null);
  readonly enabled = signal(true);
  private existingNames = new Set<string>();
  /** Item settings key to its label translation key, for the review table */
  private readonly settingLabelKeys = signal<Map<string, string>>(new Map());

  readonly includedCount = computed(() => this.rows().filter(row => row.included).length);
  readonly allIncluded = computed(() => this.rows().length > 0 && this.rows().every(row => row.included));

  /** Why each row's name can't be used, if it can't: blank, or the name of another item */
  readonly nameErrors = computed(() => {
    const rows = this.rows();
    const includedNames = new Map<string, number>();
    for (const row of rows) {
      if (row.included) {
        includedNames.set(row.name.trim(), (includedNames.get(row.name.trim()) ?? 0) + 1);
      }
    }
    return rows.map(row => {
      const name = row.name.trim();
      if (!row.included) {
        return null;
      }
      if (!name) {
        return 'south.add-discovered-items.name-required';
      }
      return this.existingNames.has(name) || includedNames.get(name)! > 1 ? 'south.add-discovered-items.name-taken' : null;
    });
  });

  /** The settings worth a column: the ones that differ between the items (all of them for a single item) */
  readonly settingColumns = computed(() => {
    const rows = this.rows();
    const keys = new Set(rows.flatMap(row => Object.keys(row.command.settings)));
    return Array.from(keys)
      .filter(key => {
        const values = new Set(rows.map(row => displayValue(settingsRecord(row.command.settings)[key] ?? '')));
        return rows.length === 1 ? !values.has('') : values.size > 1;
      })
      .map(key => ({ key, labelKey: this.settingLabelKeys().get(key) ?? null }));
  });

  readonly canAdd = computed(
    () =>
      this.includedCount() > 0 &&
      this.nameErrors().every(error => error === null) &&
      (!!this.groupId() || !!this.scanModeId() || this.subscriptionOnly() || !this.enabled())
  );

  prepare(options: AddDiscoveredItemsOptions) {
    const scanModeAttribute = options.manifest.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'scanMode'
    ) as OIBusScanModeAttribute;
    this.subscriptionOnly.set(scanModeAttribute.acceptableType === 'SUBSCRIPTION');
    this.scanModes.set(
      scanModeAttribute.acceptableType === 'POLL' ? options.scanModes.filter(scanMode => scanMode.id !== 'subscription') : options.scanModes
    );
    const settingsAttribute = options.manifest.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    ) as OIBusObjectAttribute;
    this.settingLabelKeys.set(new Map(settingsAttribute.attributes.map(attribute => [attribute.key, attribute.translationKey])));
    this.groupStore.set(options.groups);
    this.existingNames = new Set(options.existingItems.map(item => item.name));
    const existingBySettings = new Map(options.existingItems.map(item => [settingsKey(item.settings), item.name]));

    this.loading.set(true);
    this.southConnectorService
      .discoverItems(
        options.southId,
        options.manifest.id,
        options.southSettings,
        { nodeIds: options.nodeIds },
        options.manifest.discovery!.defaults!.itemFieldMapping
      )
      .subscribe({
        next: commands => {
          this.rows.set(
            commands.map(command => {
              const existingItemName = existingBySettings.get(settingsKey(command.settings)) ?? null;
              return { command, name: command.name, included: existingItemName === null, existingItemName };
            })
          );
          this.loading.set(false);
        },
        error: error => {
          this.error.set(extractErrorMessage(error));
          this.loading.set(false);
        }
      });
  }

  settingValue(row: DiscoveredItemRow, key: string): string {
    const value = settingsRecord(row.command.settings)[key];
    return value === null || value === undefined ? '' : displayValue(value);
  }

  toggleRow(index: number) {
    this.rows.update(rows => rows.map((row, rowIndex) => (rowIndex === index ? { ...row, included: !row.included } : row)));
  }

  toggleAll() {
    const included = !this.allIncluded();
    this.rows.update(rows => rows.map(row => ({ ...row, included })));
  }

  setName(index: number, name: string) {
    this.rows.update(rows => rows.map((row, rowIndex) => (rowIndex === index ? { ...row, name } : row)));
  }

  add() {
    if (!this.canAdd()) {
      return;
    }
    const group = this.groups().find(candidate => candidate.id === this.groupId()) ?? null;
    const scanModeId = this.subscriptionOnly() ? 'subscription' : this.scanModeId();
    const scanMode = this.scanModes().find(candidate => candidate.id === scanModeId) ?? null;
    const commands: Array<SouthConnectorItemCommandDTO> = this.rows()
      .filter(row => row.included)
      .map(row => ({
        ...row.command,
        name: row.name.trim(),
        enabled: this.enabled(),
        // In a group, the item follows the group schedule, as when picked in the item form
        groupId: group?.id ?? null,
        groupName: group?.standardSettings.name ?? null,
        syncWithGroup: !!group,
        scanModeId: group ? null : scanModeId,
        scanModeName: group ? null : (scanMode?.name ?? null)
      }));
    this.modal.close(commands);
  }

  cancel() {
    this.modal.dismiss();
  }
}
