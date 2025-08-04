import { ChangeDetectionStrategy, Component, output, input } from '@angular/core';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'oib-pill',
  templateUrl: './pill.component.html',
  styleUrl: './pill.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgbTooltip, TranslateModule]
})
export class PillComponent {
  readonly type = input<'primary' | 'secondary' | 'info'>('primary');
  readonly removable = input(true);
  readonly removed = output<void>();

  remove() {
    this.removed.emit(undefined);
  }
}
