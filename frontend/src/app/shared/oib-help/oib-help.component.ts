import { Component, input } from '@angular/core';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
@Component({
  selector: 'oib-help',
  templateUrl: './oib-help.component.html',
  imports: [NgbTooltip, TranslateModule]
})
export class OibHelpComponent {
  readonly url = input.required<string>();
}
