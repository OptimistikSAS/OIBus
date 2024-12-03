import { Component, Input } from '@angular/core';

@Component({
  selector: 'oib-help',
  templateUrl: './oib-help.component.html'
})
export class OibHelpComponent {
  @Input({ required: true }) url!: string;
}
