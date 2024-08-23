import { Component, Input, TemplateRef, ViewChild } from '@angular/core';
import { BaseSingleSelectOptionComponent } from './single-select-base-option';

@Component({
  selector: 'oib-rich-single-select-option',
  template: '<ng-template><ng-content></ng-content></ng-template>',
  providers: [{ provide: BaseSingleSelectOptionComponent, useExisting: RichSingleSelectOptionComponent }],
  standalone: true
})
export class RichSingleSelectOptionComponent extends BaseSingleSelectOptionComponent {
  @ViewChild(TemplateRef, { static: true }) contentTemplateRef!: TemplateRef<any>;
  @Input() selectable: boolean = true;
}
