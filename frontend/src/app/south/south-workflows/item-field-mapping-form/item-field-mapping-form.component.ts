import { Clipboard } from '@angular/cdk/clipboard';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';

import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import { OIBusRecord } from '@oibus/shared/common/content.model';
import { SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';

import { ModalService } from '../../../shared/modal.service';
import { NotificationService } from '../../../shared/notification.service';
import { openGroupModal, SouthItemGroup, SouthItemGroups } from '../../south-items/south-item-groups';
import {
  allowsVariable,
  isItemFieldVisible,
  isMandatoryFieldMissing,
  MappableField,
  resolveTemplate,
  SCHEDULE_ITEM_PATH_ORDER,
  VARIABLE_SENTINEL
} from './item-field-mapping';

/** How many discovered records give an example item name */
const EXAMPLE_ITEM_COUNT = 3;

/**
 * How the discovered records are mapped to items - a constant or a `{{field}}` expression per item field - in the sections
 * of the item modal: Name & schedule, with the history settings that come and go with the group, then the settings of the
 * connector. Used by the Items step of a synchronisation, and by the Add as items step of the explore wizard.
 */
@Component({
  selector: 'oib-item-field-mapping-form',
  templateUrl: './item-field-mapping-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, FormsModule, TranslateDirective, TranslatePipe, NgbDropdownModule]
})
export class ItemFieldMappingFormComponent {
  private modalService = inject(ModalService);
  private clipboard = inject(Clipboard);
  private notificationService = inject(NotificationService);

  /** The item fields to map, read from the manifest of the connector (see `buildItemMappableFields`) */
  readonly fields = input.required<ReadonlyArray<MappableField>>();
  /** One expression per field, by its path - blank means "not mapped" */
  readonly values = model.required<Record<string, string>>();
  readonly manifest = input.required<SouthConnectorManifest>();
  /** The fields of the discovered records the mapping can use as `{{field}}` */
  readonly recordFields = input<ReadonlyArray<string>>([]);
  /** The discovered records: the first ones give example item names */
  readonly records = input<ReadonlyArray<OIBusRecord>>([]);
  /** Every schedule, for the groups */
  readonly scanModes = input<Array<ScanModeDTO>>([]);
  /** The schedules an item of the connector can follow */
  readonly itemScanModes = input<ReadonlyArray<ScanModeDTO>>([]);
  /** The groups of the page (south-detail saves them through the API, edit-south in memory) - none without a schedule */
  readonly groupStore = input<SouthItemGroups | null>(null);
  /** Whether a group created or edited here is saved through the API - only changes the wording of its modal */
  readonly directSave = input(false);

  readonly variableSentinel = VARIABLE_SENTINEL;
  readonly groups = computed(() => this.groupStore()?.list() ?? []);

  /** The mapping input the user was typing in last, where a field goes when picked in the list */
  private lastMappingFocus: { path: string; start: number; end: number } | null = null;

  /** The title of the settings of the items of the connector, as in the item modal */
  private readonly itemSettingsTitleKey = computed(
    () =>
      this.manifest().items.rootAttribute.attributes.find(attribute => attribute.key === 'settings')?.translationKey ??
      'south.edit-item-modal.step.settings'
  );

  /** The fields shown, in their sections: Name & schedule, in the order of the item modal, then the settings of the connector */
  readonly itemMappingSections = computed(() => {
    const values = this.values();
    const fields = this.fields().filter(field => isItemFieldVisible(field, values));
    const settingsFields = fields.filter(field => field.path.startsWith('settings.'));
    const rank = (field: MappableField) => {
      const index = SCHEDULE_ITEM_PATH_ORDER.indexOf(field.path);
      return index === -1 ? SCHEDULE_ITEM_PATH_ORDER.length : index;
    };
    const scheduleFields = fields.filter(field => !settingsFields.includes(field)).sort((a, b) => rank(a) - rank(b));
    const sections = [
      { id: 'general', titleKey: 'south.edit-item-modal.step.general', fields: scheduleFields },
      { id: 'settings', titleKey: this.itemSettingsTitleKey(), fields: settingsFields }
    ];
    return sections.filter(section => section.fields.length > 0);
  });

  /** The names the first discovered records would give their items, from the name mapping */
  readonly exampleItemNames = computed(() => {
    const template = this.values()['name'] ?? '';
    if (!template.trim()) {
      return [];
    }
    return this.records()
      .slice(0, EXAMPLE_ITEM_COUNT)
      .map(record => resolveTemplate(template, record));
  });

  /** The schedule of the group the items are mapped into, which they follow: none while they have no group */
  readonly groupScanModeName = computed(() => {
    const groupId = this.values()['groupId'];
    const group = groupId ? this.groups().find(candidate => candidate.id === groupId) : null;
    if (!group) {
      return null;
    }
    // A group kept in memory only has the id of its schedule
    const settings = group.standardSettings;
    return 'scanMode' in settings
      ? settings.scanMode.name
      : (this.scanModes().find(scanMode => scanMode.id === settings.scanModeId)?.name ?? null);
  });

  /** Name of the group currently mapped as a constant for the 'groupId' field, or '' when none is. */
  readonly selectedGroupName = computed(() => {
    const groupId = this.values()['groupId'];
    if (!groupId) {
      return '';
    }
    return this.groups().find(group => group.id === groupId)?.standardSettings.name ?? groupId;
  });

  /** A field of the discovered records as the mapping expression that gets its value. */
  fieldToken(field: string): string {
    return `{{${field}}}`;
  }

  /** Remembers where the user was typing in the mapping, as the focus leaves it for the list of fields */
  rememberMappingFocus(event: FocusEvent) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    const match = /^item-field-mapping-field-(.+?)(-expression)?$/.exec(input.id);
    const field = match ? this.fields().find(candidate => candidate.path === match[1]) : undefined;
    // Only an input that takes an expression: not a constant-only field, nor a select unless it is on an expression
    this.lastMappingFocus =
      field && allowsVariable(field) && (!this.isSelectType(field) || !!match![2])
        ? { path: field.path, start: input.selectionStart ?? input.value.length, end: input.selectionEnd ?? input.value.length }
        : null;
  }

  /** Puts a field of the discovered records where the user was typing in the mapping, or copies it when there is no such place. */
  useRecordField(field: string) {
    const token = this.fieldToken(field);
    const target = this.lastMappingFocus;
    if (!target) {
      this.clipboard.copy(token);
      this.notificationService.success('south.explore.copied');
      return;
    }
    const value = this.values()[target.path] ?? '';
    this.setMappingValue(target.path, `${value.slice(0, target.start)}${token}${value.slice(target.end)}`);
    // The next field goes after this one
    const end = target.start + token.length;
    this.lastMappingFocus = { path: target.path, start: end, end };
  }

  /** Maps (or unmaps, with a blank value) an item field. */
  setMappingValue(path: string, value: string) {
    this.values.update(values => ({ ...values, [path]: value }));
  }

  /** Whether this field's constant value should be picked from a fixed list (checkbox/select) rather than typed freely. */
  isSelectType(field: MappableField): boolean {
    return (
      field.attributeType === 'boolean' ||
      field.attributeType === 'string-select' ||
      field.attributeType === 'scan-mode' ||
      field.attributeType === 'group-select'
    );
  }

  /** The translation key for this field's row label. A manifest-driven 'string-select' attribute's translationKey is a
   *  namespace object ({ title, <value>: ... } - see e.g. security-mode in the OPC-UA manifest translations), not a
   *  flat string, so its label needs the same `.title` suffix the real manifest form uses for that control. Every
   *  other field type (including the two hardcoded string-select fields, whose keys are already flat strings) uses
   *  its translationKey directly. */
  fieldLabelKey(field: MappableField): string {
    if (field.attributeType === 'string-select' && field.path !== 'recoveryStrategy' && field.path !== 'resamplingMethod') {
      return `${field.translationKey}.title`;
    }
    return field.translationKey;
  }

  /** The fixed set of valid constant values for a select-type field - used both to render its options and to tell a
   *  constant value apart from a {{...}} expression (anything not in this list is treated as a variable). */
  private fieldConcreteValues(field: MappableField): Array<string> {
    switch (field.attributeType) {
      case 'boolean':
        return ['true', 'false'];
      case 'string-select':
        return field.selectableValues ?? [];
      case 'scan-mode':
        return this.itemScanModes().map(scanMode => scanMode.id);
      case 'group-select':
        return this.groups()
          .map(group => group.id)
          .filter((id): id is string => id != null);
      default:
        return [];
    }
  }

  /** Translated option label for a 'string-select' field's value - mirrors the manifest form's own `translationKey.value`
   *  convention, except for the hardcoded historian recoveryStrategy field, whose keys already exist under a different shape. */
  stringSelectOptionLabel(field: MappableField, value: string): string {
    if (field.path === 'recoveryStrategy') {
      return `south.items.recovery-strategy-${value}`;
    }
    if (field.path === 'resamplingMethod') {
      return `south.workflows.resampling-values.${value}`;
    }
    return `${field.translationKey}.${value}`;
  }

  /** True once the field's mapped value is set but isn't one of its fixed constant options - i.e. it's a {{...}} expression. */
  isVariableMode(field: MappableField): boolean {
    const value = this.values()[field.path] ?? '';
    if (!value) {
      return false;
    }
    return !this.fieldConcreteValues(field).includes(value);
  }

  /** What the <select> itself should show: the sentinel option while in variable mode, the raw constant value otherwise. */
  selectDisplayValue(field: MappableField): string {
    return this.isVariableMode(field) ? VARIABLE_SENTINEL : (this.values()[field.path] ?? '');
  }

  /** Handles a change on a select-type field's constant dropdown - switches into variable mode with a starter
   *  expression when the sentinel is chosen, otherwise stores the picked constant value directly. */
  onSelectChange(field: MappableField, newValue: string) {
    this.setMappingValue(field.path, newValue === VARIABLE_SENTINEL ? '{{}}' : newValue);
  }

  allowsVariable(field: MappableField): boolean {
    return allowsVariable(field);
  }

  /** Placeholder for a plain-text item field's input - a constant-only field (e.g. maxReadInterval) gets
   *  a hint that it can't take a {{ }} expression, instead of the generic "constant or {{field}}" one. */
  itemFieldPlaceholderKey(field: MappableField): string {
    return allowsVariable(field)
      ? 'south.workflows.item-field-mapping-expression-placeholder'
      : 'south.workflows.mapping-constant-placeholder';
  }

  isMandatoryFieldMissing(field: MappableField): boolean {
    return isMandatoryFieldMissing(field, this.values());
  }

  onSelectGroup(groupId: string | null) {
    const grouped = !!this.values()['groupId'];
    this.setMappingValue('groupId', groupId ?? '');
    // As in the item modal, an item that gets a group follows it, until the mapping says otherwise
    if (!grouped && groupId) {
      this.setMappingValue('syncWithGroup', 'true');
    } else if (!groupId) {
      this.setMappingValue('syncWithGroup', '');
    }
  }

  /** Mirrors EditSouthItemModalComponent's own onAddGroup - creates the group through the groups of the page, then maps
   *  the newly created group as this field's constant. */
  onAddGroup() {
    this.openGroupModal().subscribe(groupResult => this.onSelectGroup(groupResult.id!));
  }

  onEditGroup(group: SouthItemGroup, event: Event) {
    event.stopPropagation();
    this.openGroupModal(group).subscribe();
  }

  private openGroupModal(group?: SouthItemGroup) {
    return openGroupModal(this.modalService, this.groupStore()!, {
      scanModes: this.scanModes(),
      manifest: this.manifest(),
      directSave: this.directSave(),
      group
    });
  }

  onDeleteGroup(group: SouthItemGroup, event: Event) {
    event.stopPropagation();
    this.groupStore()!
      .delete(group)
      .subscribe(() => {
        if (this.values()['groupId'] === group.id) {
          this.onSelectGroup(null);
        }
      });
  }
}
