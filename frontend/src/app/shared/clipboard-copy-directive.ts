import { Clipboard } from '@angular/cdk/clipboard';
import { Directive, inject, input } from '@angular/core';

@Directive({
  selector: '[oibClipboardCopy]',
  host: {
    '(click)': 'onClick()'
  }
})
export class ClipboardCopyDirective {
  private readonly clipboard = inject(Clipboard);

  readonly string = input.required<string | null | undefined>();

  onClick(): void {
    this.clipboard.copy(this.string() ?? '');
  }
}
