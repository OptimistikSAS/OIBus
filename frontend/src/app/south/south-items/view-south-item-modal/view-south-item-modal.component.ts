import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CertificateDTO } from '@oibus/shared/api/certificate.model';
import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import { SouthConnectorDTO, SouthConnectorItemDTO, SouthItemLastValueResponse } from '@oibus/shared/api/south-connector.model';
import { SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';
import { SouthItemLastValue } from '@oibus/shared/domain/south-connector.model';

import { DatetimePipe } from '../../../shared/datetime.pipe';
import { OIBusSettingsSummaryComponent } from '../../../shared/form/oibus-settings-summary/oibus-settings-summary.component';
import { getItemSettingsAttribute, summarizeSouthItem, toSouthItemSummaryValues } from '../south-item-summary';
import SouthItemTestComponent from '../south-item-test/south-item-test.component';

/**
 * Displays a south item like the connector page displays its connector: what its cache holds, then its settings, and lets the
 * user test it. Closes when the user chooses to edit the item, so that the opener opens the edit modal.
 */
@Component({
  selector: 'oib-view-south-item-modal',
  templateUrl: './view-south-item-modal.component.html',
  styleUrl: './view-south-item-modal.component.scss',
  imports: [TranslateDirective, TranslatePipe, DatetimePipe, JsonPipe, OIBusSettingsSummaryComponent, SouthItemTestComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ViewSouthItemModalComponent {
  private readonly modal = inject(NgbActiveModal);
  private readonly translateService = inject(TranslateService);

  readonly item = signal<SouthConnectorItemDTO | null>(null);
  readonly southConnector = signal<SouthConnectorDTO | null>(null);
  readonly manifest = signal<SouthConnectorManifest | null>(null);
  private scanModes: Array<ScanModeDTO> = [];
  private certificates: Array<CertificateDTO> = [];
  /** The item's own last cached value/instant, or null when nothing has been cached yet for it. */
  readonly itemLastValue = signal<SouthItemLastValue | null>(null);
  /** The group's last tracked value/instant when the item belongs to a group, otherwise null. */
  readonly groupLastValue = signal<SouthItemLastValue | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly itemSettingsAttribute = computed(() => {
    const manifest = this.manifest();
    return manifest ? getItemSettingsAttribute(manifest) : null;
  });

  readonly summary = computed(() => {
    const item = this.item();
    const manifest = this.manifest();
    if (!item || !manifest) {
      return null;
    }
    return summarizeSouthItem(toSouthItemSummaryValues(item), manifest, {
      translateService: this.translateService,
      scanModes: this.scanModes,
      certificates: this.certificates,
      applyEnablingConditions: true
    });
  });

  /**
   * Call immediately after opening the modal (before the HTTP response): the item and its settings display while its cache
   * is fetched.
   */
  prepare(
    item: SouthConnectorItemDTO,
    southConnector: SouthConnectorDTO,
    manifest: SouthConnectorManifest,
    scanModes: Array<ScanModeDTO>,
    certificates: Array<CertificateDTO>
  ) {
    this.scanModes = scanModes;
    this.certificates = certificates;
    this.southConnector.set(southConnector);
    this.manifest.set(manifest);
    this.item.set(item);
  }

  /** Call when the HTTP response arrives. Clears the spinner and displays the cache. */
  setData(response: SouthItemLastValueResponse): void {
    this.itemLastValue.set(response.itemLastValue);
    this.groupLastValue.set(response.groupLastValue);
    this.loading.set(false);
  }

  /** Call when the HTTP request fails. Shows an inline error message instead of closing. */
  setError(message: string): void {
    this.error.set(message);
    this.loading.set(false);
  }

  edit() {
    this.modal.close();
  }

  close() {
    this.modal.dismiss();
  }

  readonly hasValue = computed(() => {
    const itemLastValue = this.itemLastValue();
    return itemLastValue !== null && itemLastValue.value !== null;
  });

  readonly groupHasValue = computed(() => {
    const groupLastValue = this.groupLastValue();
    return groupLastValue !== null && groupLastValue.value !== null;
  });

  readonly isFileArray = computed(() => {
    if (!this.hasValue()) return false;
    const value = this.itemLastValue()!.value;
    return Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && 'filename' in value[0];
  });

  readonly fileArray = computed(() => {
    if (!this.isFileArray()) return [];
    return this.itemLastValue()!.value as Array<{ filename: string; modifiedTime: number }>;
  });
}
