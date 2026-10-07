import { Clipboard } from '@angular/cdk/clipboard';
import { Directive, inject, input } from '@angular/core';

@Directive({
  selector: '[oibClipboardCopy]',
  host: {
    '(click)': 'onClick()'
  }
})
export class ClipboardCopyDirective {
  private clipboard = inject(Clipboard);

  readonly string = input.required<string | null | undefined>();
  public onClick(): void {
    this.clipboard.copy(this.string()!);
  }
}
