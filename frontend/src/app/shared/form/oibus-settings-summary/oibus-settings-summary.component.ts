import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { TranslateDirective, TranslateService } from '@ngx-translate/core';

import { CertificateDTO } from '@oibus/shared/api/certificate.model';
import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import { OIBusAttribute, OIBusObjectAttribute } from '@oibus/shared/connector/form.model';

import { FormUtils } from '../form-utils';

/** A setting as summed up: its label (a translation key) and how its value shows */
export type SettingSummary =
  | { kind: 'text'; labelKey: string; text: string | null }
  | { kind: 'boolean'; labelKey: string; value: boolean }
  | { kind: 'code'; labelKey: string; code: string | null }
  | { kind: 'table'; labelKey: string; columnKeys: Array<string>; rows: Array<Array<string>> }
  | { kind: 'group'; labelKey: string; settings: Array<SettingSummary> };

/** Shown in place of a secret, so that it is never displayed */
const SECRET_MASK = '••••••••';

/**
 * Read-only view of settings edited with `oib-oibus-object-form-control`, from their manifest: the settings that the form leaves out
 * of its value (disabled by an enabling condition) are left out here too.
 */
@Component({
  selector: 'oib-oibus-settings-summary',
  templateUrl: './oibus-settings-summary.component.html',
  imports: [NgTemplateOutlet, TranslateDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OIBusSettingsSummaryComponent {
  private readonly translateService = inject(TranslateService);

  readonly objectAttribute = input.required<OIBusObjectAttribute>();
  /** The settings value, as the form gives it: an object keyed by the attribute keys */
  readonly value = input.required<object | null | undefined>();
  readonly scanModes = input<Array<ScanModeDTO>>([]);
  readonly certificates = input<Array<CertificateDTO>>([]);

  readonly settings = computed(() => this.summarize(this.objectAttribute(), (this.value() ?? {}) as Record<string, unknown>));

  /** Types the settings of the recursive list template, whose context is untyped */
  asSettings(settings: Array<SettingSummary>): Array<SettingSummary> {
    return settings;
  }

  private summarize(objectAttribute: OIBusObjectAttribute, value: Record<string, unknown>): Array<SettingSummary> {
    return objectAttribute.attributes
      .filter(attribute => attribute.key in value)
      .map(attribute => this.summarizeAttribute(attribute, value[attribute.key]))
      .filter((setting): setting is SettingSummary => setting !== null);
  }

  private summarizeAttribute(attribute: OIBusAttribute, value: unknown): SettingSummary | null {
    const empty = value === null || value === undefined || value === '';
    switch (attribute.type) {
      case 'object':
        if (!attribute.displayProperties.visible || empty) {
          return null;
        }
        return { kind: 'group', labelKey: attribute.translationKey, settings: this.summarize(attribute, value as Record<string, unknown>) };
      case 'array': {
        const columns = FormUtils.buildColumn(attribute.rootAttribute.attributes, []);
        const elements = (value as Array<Record<string, unknown>> | null) ?? [];
        return {
          kind: 'table',
          labelKey: attribute.rootAttribute.translationKey,
          columnKeys: columns.map(column => (column.type === 'string-select' ? `${column.translationKey}.title` : column.translationKey)),
          rows: elements.map(element =>
            columns.map(column =>
              String(
                FormUtils.formatValue(element, column.path, column.type, column.translationKey, this.translateService, this.scanModes()) ??
                  ''
              )
            )
          )
        };
      }
      case 'boolean':
        return { kind: 'boolean', labelKey: attribute.translationKey, value: !!value };
      case 'code':
        return { kind: 'code', labelKey: attribute.translationKey, code: empty ? null : String(value) };
      case 'string-select':
        return {
          kind: 'text',
          labelKey: `${attribute.translationKey}.title`,
          text: empty ? null : this.translateService.instant(`${attribute.translationKey}.${value}`)
        };
      case 'number':
        return {
          kind: 'text',
          labelKey: attribute.translationKey,
          text: empty ? null : attribute.unit ? `${value} ${attribute.unit}` : String(value)
        };
      case 'secret':
        return { kind: 'text', labelKey: attribute.translationKey, text: empty ? null : SECRET_MASK };
      case 'scan-mode':
        return {
          kind: 'text',
          labelKey: attribute.translationKey,
          text: empty ? null : (this.scanModes().find(scanMode => scanMode.id === value)?.name ?? String(value))
        };
      case 'certificate':
        return {
          kind: 'text',
          labelKey: attribute.translationKey,
          text: empty ? null : (this.certificates().find(certificate => certificate.id === value)?.name ?? String(value))
        };
      case 'string':
      case 'instant':
      case 'timezone':
        return { kind: 'text', labelKey: attribute.translationKey, text: empty ? null : String(value) };
    }
  }
}
