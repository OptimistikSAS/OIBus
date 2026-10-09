import { DatePipe, JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';

import { SouthItemLastValueResponse } from '@oibus/shared/api/south-connector.model';
import { OIBusSouthType } from '@oibus/shared/connector/south-manifest.model';
import { SouthItemLastValue } from '@oibus/shared/domain/south-connector.model';

@Component({
  selector: 'oib-view-item-value-modal',
  templateUrl: './view-item-value-modal.component.html',
  styleUrl: './view-item-value-modal.component.scss',
  imports: [TranslateDirective, TranslatePipe, DatePipe, JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ViewItemValueModalComponent {
  private readonly modal = inject(NgbActiveModal);

  /** The item's own last cached value/instant, or null when nothing has been cached yet for it. */
  readonly itemLastValue = signal<SouthItemLastValue | null>(null);
  /** The group's last tracked value/instant when the item belongs to a group, otherwise null. */
  readonly groupLastValue = signal<SouthItemLastValue | null>(null);
  readonly itemName = signal('');
  readonly groupName = signal('');
  southType: OIBusSouthType | null = null;
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  /**
   * Call immediately after opening the modal (before the HTTP response).
   * Stores the connector type and item/group name so the header can render before data arrives.
   */
  prepare(southType: OIBusSouthType, itemName: string, groupName: string): void {
    this.southType = southType;
    this.itemName.set(itemName);
    this.groupName.set(groupName);
  }

  /** Call when the HTTP response arrives. Clears the spinner and displays the value. */
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
