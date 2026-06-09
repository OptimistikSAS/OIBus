import { PercentPipe } from '@angular/common';
import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { NgbProgressbarModule } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'oib-progressbar',
  imports: [NgbProgressbarModule, PercentPipe],
  templateUrl: './progressbar.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './progressbar.component.scss'
})
export class ProgressbarComponent {
  readonly value = input.required<number>();
  readonly max = input(1);
  readonly animated = input.required<boolean>();
}
