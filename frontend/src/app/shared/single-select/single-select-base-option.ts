import { Component, Input } from '@angular/core';

@Component({ template: '' })
export abstract class BaseSingleSelectOptionComponent {
  @Input() value: any;
  @Input() label = '';
}
