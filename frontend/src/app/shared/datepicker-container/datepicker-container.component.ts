import { Component, contentChild } from '@angular/core';
import { NgbInputDatepicker, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Component used to simplify the markup of a datepicker in a popup. It wraps the input which has the
 * ngbDatepicker directive, and prepends the toggle button to it.
 * Its model is an ISO-formatted Local Date string representing the date, such as 2019-10-02
 *
 * Example usage:
 *
 * <oi-datepicker-container class="col-sm-9">
 *   <input class="form-control" formControlName="date" ngbDatepicker />
 * </oi-datepicker-container>
 */
@Component({
  selector: 'oib-datepicker-container',
  templateUrl: './datepicker-container.component.html',
  host: {
    class: 'input-group'
  },
  imports: [NgbTooltip, TranslateModule]
})
export class DatepickerContainerComponent {
  readonly datePicker = contentChild.required(NgbInputDatepicker);

  toggle() {
    this.datePicker().toggle();
  }
}
