import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { DatePipe, JsonPipe } from '@angular/common';
import { OIBusSouthType, SOUTH_SINGLE_ITEMS } from '../../../../../../backend/shared/model/south-connector.model';

interface SouthItemLastValueDTO {
  itemId: string;
  itemName: string;
  groupName?: string;
  queryTime: string | null;
  value: unknown;
  trackedInstant: string | null;
}

@Component({
  selector: 'oib-view-item-value-modal',
  templateUrl: './view-item-value-modal.component.html',
  styleUrl: './view-item-value-modal.component.scss',
  imports: [TranslateDirective, DatePipe, JsonPipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true
})
export class ViewItemValueModalComponent {
  private modal = inject(NgbActiveModal);

  itemLastValue: SouthItemLastValueDTO | null = null;
  southType: OIBusSouthType | null = null;
  loading = true;
  error: string | null = null;

  /**
   * Call immediately after opening the modal (before the HTTP response).
   * Stores the connector type so the group-value notice can be shown once data arrives.
   */
  prepare(southType: OIBusSouthType): void {
    this.southType = southType;
  }

  /** Call when the HTTP response arrives. Clears the spinner and displays the value. */
  setData(itemLastValue: SouthItemLastValueDTO, groupName: string): void {
    this.itemLastValue = { ...itemLastValue, groupName };
    this.loading = false;
  }

  /** Call when the HTTP request fails. Shows an inline error message instead of closing. */
  setError(message: string): void {
    this.error = message;
    this.loading = false;
  }

  /** True when the connector groups items — meaning the displayed value may come from any item in the group. */
  get isGroupedConnector(): boolean {
    return this.southType !== null && !SOUTH_SINGLE_ITEMS.includes(this.southType);
  }

  close() {
    this.modal.dismiss();
  }

  get hasValue(): boolean {
    return this.itemLastValue !== null && this.itemLastValue.value !== null;
  }

  get isFileArray(): boolean {
    if (!this.hasValue) return false;
    return (
      Array.isArray(this.itemLastValue!.value) &&
      this.itemLastValue!.value.length > 0 &&
      typeof this.itemLastValue!.value[0] === 'object' &&
      'filename' in this.itemLastValue!.value[0]
    );
  }

  get fileArray(): Array<{ filename: string; modifiedTime: number }> {
    if (!this.isFileArray) return [];
    return this.itemLastValue!.value as Array<{ filename: string; modifiedTime: number }>;
  }
}
