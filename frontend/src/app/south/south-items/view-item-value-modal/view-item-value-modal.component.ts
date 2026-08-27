import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { DatePipe, JsonPipe } from '@angular/common';
import {
  OIBusSouthType,
  SouthItemLastValue,
  SouthItemLastValueResponse
} from '../../../../../../backend/shared/model/south-connector.model';

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

  /** The item's own last cached value/instant, or null when nothing has been cached yet for it. */
  itemLastValue: SouthItemLastValue | null = null;
  /** The group's last tracked value/instant when the item belongs to a group, otherwise null. */
  groupLastValue: SouthItemLastValue | null = null;
  itemName = '';
  groupName = '';
  southType: OIBusSouthType | null = null;
  loading = true;
  error: string | null = null;

  /**
   * Call immediately after opening the modal (before the HTTP response).
   * Stores the connector type and item/group name so the header can render before data arrives.
   */
  prepare(southType: OIBusSouthType, itemName: string, groupName: string): void {
    this.southType = southType;
    this.itemName = itemName;
    this.groupName = groupName;
  }

  /** Call when the HTTP response arrives. Clears the spinner and displays the value. */
  setData(response: SouthItemLastValueResponse): void {
    this.itemLastValue = response.itemLastValue;
    this.groupLastValue = response.groupLastValue;
    this.loading = false;
  }

  /** Call when the HTTP request fails. Shows an inline error message instead of closing. */
  setError(message: string): void {
    this.error = message;
    this.loading = false;
  }

  close() {
    this.modal.dismiss();
  }

  get hasValue(): boolean {
    return this.itemLastValue !== null && this.itemLastValue.value !== null;
  }

  get groupHasValue(): boolean {
    return this.groupLastValue !== null && this.groupLastValue.value !== null;
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
