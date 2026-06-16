import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
@Component({
  selector: 'oib-help',
  templateUrl: './oib-help.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [NgbTooltip, TranslatePipe]
})
export class OibHelpComponent {
  readonly url = input.required<string>();
}
