import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslateDirective } from '@ngx-translate/core';

@Component({
  selector: 'oib-legend',
  templateUrl: './legend.component.html',
  styleUrl: './legend.component.scss',
  imports: [TranslateDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LegendComponent {
  readonly legendList = input<
    Array<{
      class: string;
      label: string;
    }>
  >([]);
}
