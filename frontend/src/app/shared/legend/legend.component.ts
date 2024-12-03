import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'oib-legend',
  templateUrl: './legend.component.html',
  styleUrl: './legend.component.scss',
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LegendComponent {
  @Input() legendList: Array<{ class: string; label: string }> = [];
}
