import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { NgClass, NgForOf, NgIf } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'oib-legend',
  templateUrl: './legend.component.html',
  styleUrls: ['./legend.component.scss'],
  standalone: true,
  imports: [NgClass, NgIf, NgForOf, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LegendComponent {
  @Input() legendList: Array<{ class: string; label: string }> = [];
}
