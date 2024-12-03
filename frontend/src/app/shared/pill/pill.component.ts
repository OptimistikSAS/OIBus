import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'oib-pill',
  templateUrl: './pill.component.html',
  styleUrl: './pill.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PillComponent {
  @Input() type: 'primary' | 'secondary' | 'info' = 'primary';
  @Input() removable = true;
  @Output() readonly removed = new EventEmitter<void>();

  remove() {
    this.removed.emit(undefined);
  }
}
