import { Component, input } from '@angular/core';

@Component({
  selector: 'oib-help',
  templateUrl: './oib-help.component.html'
})
export class OibHelpComponent {
  readonly url = input.required<string>();
}
