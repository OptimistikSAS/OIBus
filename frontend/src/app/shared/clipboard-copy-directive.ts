import { Directive, HostListener, inject, input } from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';

@Directive({
  selector: '[oibClipboardCopy]'
})
export class ClipboardCopyDirective {
  private clipboard = inject(Clipboard);

  readonly string = input.required<string | null | undefined>();

  @HostListener('click', ['$event'])
  public onClick(): void {
    this.clipboard.copy(this.string()!);
  }
}
