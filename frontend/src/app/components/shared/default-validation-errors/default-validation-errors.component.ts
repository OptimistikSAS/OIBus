import { Component } from '@angular/core';
import { DisplayMode, ValdemortConfig, ValdemortModule } from 'ngx-valdemort';
import { TranslateModule } from '@ngx-translate/core';
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'oib-default-validation-errors',
  templateUrl: './default-validation-errors.component.html',
  styleUrls: ['./default-validation-errors.component.scss'],
  imports: [TranslateModule, ValdemortModule, DecimalPipe],
  standalone: true
})
export class DefaultValidationErrorsComponent {
  constructor(valdemortConfig: ValdemortConfig) {
    valdemortConfig.errorsClasses = 'invalid-feedback';
    valdemortConfig.displayMode = DisplayMode.ONE;
  }
}
