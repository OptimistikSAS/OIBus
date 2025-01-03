import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'oib-loading-spinner',
  templateUrl: './loading-spinner.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoadingSpinnerComponent {}
