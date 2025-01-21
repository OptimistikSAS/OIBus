import { PercentPipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { NgbProgressbarModule } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'oib-progressbar',
  imports: [NgbProgressbarModule, PercentPipe],
  templateUrl: './progressbar.component.html',
  styleUrl: './progressbar.component.scss'
})
export class ProgressbarComponent {
  readonly value = input.required<number>();
  readonly max = input(1);
  readonly animated = input.required<boolean>();
}
