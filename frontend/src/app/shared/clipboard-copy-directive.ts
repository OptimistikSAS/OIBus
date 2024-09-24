import { Directive, HostListener, Input, inject } from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';

@Directive({
  selector: '[oibClipboardCopy]',
  standalone: true
})
export class ClipboardCopyDirective {
  private clipboard = inject(Clipboard);

  @Input({ required: true }) string: string | null | undefined;

  @HostListener('click', ['$event'])
  public onClick(): void {
    this.clipboard.copy(this.string!);
  }
}
