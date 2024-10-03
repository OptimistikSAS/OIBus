import { Component, Input, TemplateRef, ViewChild } from '@angular/core';

@Component({
  selector: 'oib-rich-select-option',
  template: '<ng-template><ng-content /></ng-template>',
  standalone: true
})
export class RichSelectOptionComponent {
  @ViewChild(TemplateRef, { static: true }) contentTemplateRef!: TemplateRef<any>;
  @Input() selectable = true;

  @Input() value: any;
  @Input() label = '';
}
