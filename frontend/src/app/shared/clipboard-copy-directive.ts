import { Directive, HostListener, Input } from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';

@Directive({
  selector: '[oibClipboardCopy]',
  standalone: true
})
export class ClipboardCopyDirective {
  @Input({ required: true }) string: string | null | undefined;

  constructor(private clipboard: Clipboard) {}

  @HostListener('click', ['$event'])
  public onClick(): void {
    this.clipboard.copy(this.string!);
  }
}
