import { Component, Input } from '@angular/core';

@Component({
  selector: 'oib-help',
  standalone: true,
  templateUrl: './oib-help.component.html'
})
export class OibHelpComponent {
  @Input({ required: true }) url!: string;
}
