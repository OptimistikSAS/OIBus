import { PercentPipe } from '@angular/common';
import { Component, Input } from '@angular/core';
import { NgbProgressbarModule } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'oib-progressbar',
  standalone: true,
  imports: [NgbProgressbarModule, PercentPipe],
  templateUrl: './progressbar.component.html',
  styleUrl: './progressbar.component.scss'
})
export class ProgressbarComponent {
  @Input({ required: true }) value!: number;
  @Input() max = 1;
  @Input({ required: true }) animated!: boolean;
}
