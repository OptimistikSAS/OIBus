import { Clipboard } from '@angular/cdk/clipboard';
import { Directive, HostListener, inject, input } from '@angular/core';

@Directive({
  selector: '[oibClipboardCopy]'
})
export class ClipboardCopyDirective {
  private clipboard = inject(Clipboard);

  readonly string = input.required<string | null | undefined>();

  @HostListener('click')
  public onClick(): void {
    this.clipboard.copy(this.string()!);
  }
}
