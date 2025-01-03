import { ChangeDetectionStrategy, Component, output, input } from '@angular/core';

@Component({
  selector: 'oib-pill',
  templateUrl: './pill.component.html',
  styleUrl: './pill.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PillComponent {
  readonly type = input<'primary' | 'secondary' | 'info'>('primary');
  readonly removable = input(true);
  readonly removed = output<void>();

  remove() {
    this.removed.emit(undefined);
  }
}
