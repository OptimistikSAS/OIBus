import { ChangeDetectionStrategy, Component, Input, output } from '@angular/core';

@Component({
  selector: 'oib-pill',
  templateUrl: './pill.component.html',
  styleUrl: './pill.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PillComponent {
  @Input() type: 'primary' | 'secondary' | 'info' = 'primary';
  @Input() removable = true;
  readonly removed = output<void>();

  remove() {
    this.removed.emit(undefined);
  }
}
