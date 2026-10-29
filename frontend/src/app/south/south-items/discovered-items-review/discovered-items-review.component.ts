import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';

import { SouthConnectorItemCommandDTO } from '@oibus/shared/api/south-connector.model';
import { OIBusObjectAttribute } from '@oibus/shared/connector/form.model';
import { SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';
import { SouthItemSettings } from '@oibus/shared/connector/south-settings.model';

/** One discovered item, as reviewed before it is added. */
interface DiscoveredItemRow {
  readonly command: SouthConnectorItemCommandDTO;
  readonly included: boolean;
  readonly name: string;
  /** Name of an item of the connector with the same settings - it already reads what this one would */
  readonly existingItemName: string | null;
}

/** The settings without their unset values, keys sorted: two items read the same thing when these are equal. */
function settingsKey(settings: SouthItemSettings): string {
  const entries = Object.entries(settingsRecord(settings))
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

/**
 * The settings of an item as a plain record of their values, whatever its connector type: a nested setting by its
 * path (`trackingInstant.fieldName`), like its own column in the review table.
 */
function settingsRecord(settings: object, prefix = ''): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(settings).flatMap(([key, value]) =>
      typeof value === 'object' && value !== null && !Array.isArray(value)
        ? Object.entries(settingsRecord(value, `${prefix}${key}.`))
        : [[`${prefix}${key}`, value]]
    )
  );
}

/** How an item setting is shown in the review table. */
interface SettingDisplay {
  labelKey: string;
  /** The translation key of a value of the setting, for the ones whose values are translated */
  valueKey: ((value: string) => string) | null;
}

/**
 * How every item setting is shown, by its path (see settingsRecord). The translation of a select setting holds its
 * label as `title` and each of its values under their own key; a boolean reads as yes or no.
 */
function settingDisplays(objectAttribute: OIBusObjectAttribute, prefix = '', displays = new Map<string, SettingDisplay>()) {
  for (const attribute of objectAttribute.attributes) {
    const path = `${prefix}${attribute.key}`;
    if (attribute.type === 'object') {
      settingDisplays(attribute, `${path}.`, displays);
    } else if (attribute.type === 'string-select') {
      displays.set(path, { labelKey: `${attribute.translationKey}.title`, valueKey: value => `${attribute.translationKey}.${value}` });
    } else if (attribute.type === 'boolean') {
      displays.set(path, { labelKey: attribute.translationKey, valueKey: value => `enums.boolean.${value}` });
    } else {
      displays.set(path, { labelKey: attribute.translationKey, valueKey: null });
    }
  }
  return displays;
}

/** A setting value as shown in the review table. */
function displayValue(value: unknown): string {
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/**
 * The items discovered from the nodes checked in the Explore step, listed for review - name, which ones to add - before
 * they are added as plain items. A new list of commands replaces the rows, and what was edited in them.
 */
@Component({
  selector: 'oib-discovered-items-review',
  templateUrl: './discovered-items-review.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslateDirective, TranslatePipe]
})
export class DiscoveredItemsReviewComponent {
  /** The items the discovery gives, one per discovered record */
  readonly commands = input.required<ReadonlyArray<SouthConnectorItemCommandDTO>>();
  /** The connector manifest: its item settings give the columns of the table */
  readonly manifest = input.required<SouthConnectorManifest>();
  /** The items of the connector: a new one can't take their names, and one with the same settings is skipped by default */
  readonly existingItems = input.required<ReadonlyArray<{ name: string; settings: SouthItemSettings }>>();

  private readonly existingNames = computed(() => new Set(this.existingItems().map(item => item.name)));
  /** How each item setting is shown in the review table, by its path */
  private readonly settingDisplays = computed(() => {
    const settingsAttribute = this.manifest().items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    ) as OIBusObjectAttribute;
    return settingDisplays(settingsAttribute);
  });

  readonly rows = linkedSignal<ReadonlyArray<DiscoveredItemRow>>(() => {
    const existingBySettings = new Map(this.existingItems().map(item => [settingsKey(item.settings), item.name]));
    return this.commands().map(command => {
      const existingItemName = existingBySettings.get(settingsKey(command.settings)) ?? null;
      return { command, name: command.name, included: existingItemName === null, existingItemName };
    });
  });

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
      return this.existingNames().has(name) || includedNames.get(name)! > 1 ? 'south.add-discovered-items.name-taken' : null;
    });
  });

  /** The settings worth a column: the ones that differ between the items (all of them for a single item) */
  readonly settingColumns = computed(() => {
    const rows = this.rows();
    const keys = new Set(rows.flatMap(row => Object.keys(settingsRecord(row.command.settings))));
    return Array.from(keys)
      .filter(key => {
        const values = new Set(rows.map(row => displayValue(settingsRecord(row.command.settings)[key] ?? '')));
        return rows.length === 1 ? !values.has('') : values.size > 1;
      })
      .map(key => ({ key, labelKey: this.settingDisplays().get(key)?.labelKey ?? null }));
  });

  /** Whether the included items can be added: there is one at least, and none has a name that can't be used */
  readonly valid = computed(() => this.includedCount() > 0 && this.nameErrors().every(error => error === null));

  /** The items to add: the included ones, under the name given in the table */
  readonly includedCommands = computed(() =>
    this.rows()
      .filter(row => row.included)
      .map(row => ({ ...row.command, name: row.name.trim() }))
  );

  settingValue(row: DiscoveredItemRow, key: string): string {
    const value = settingsRecord(row.command.settings)[key];
    return value === null || value === undefined ? '' : displayValue(value);
  }

  /** The translation key of the value of a setting, when its values are translated (a select, a boolean) */
  settingValueKey(row: DiscoveredItemRow, key: string): string | null {
    const value = this.settingValue(row, key);
    const valueKey = this.settingDisplays().get(key)?.valueKey;
    return value && valueKey ? valueKey(value) : null;
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
}
