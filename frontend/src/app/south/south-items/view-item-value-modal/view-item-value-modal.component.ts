import { Component, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { DatePipe, JsonPipe } from '@angular/common';

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
  standalone: true
})
export class ViewItemValueModalComponent {
  private modal = inject(NgbActiveModal);

  itemLastValue: SouthItemLastValueDTO | null = null;

  prepareForDisplay(itemLastValue: SouthItemLastValueDTO, groupName: string) {
    this.itemLastValue = { ...itemLastValue, groupName };
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
