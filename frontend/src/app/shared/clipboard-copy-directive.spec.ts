import { Clipboard } from '@angular/cdk/clipboard';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { ClipboardCopyDirective } from './clipboard-copy-directive';

@Component({
  template: `<button type="button" oibClipboardCopy [string]="value()">Copy</button>`,
  imports: [ClipboardCopyDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestComponent {
  readonly value = signal<string | null>('secret value');
}

describe('ClipboardCopyDirective', () => {
  let clipboard: Clipboard;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    clipboard = TestBed.inject(Clipboard);
    vi.spyOn(clipboard, 'copy').mockReturnValue(true);
  });

  test('should copy the string on click', async () => {
    const fixture = TestBed.createComponent(TestComponent);

    await page.elementLocator(fixture.nativeElement).getByRole('button', { name: 'Copy' }).click();

    expect(clipboard.copy).toHaveBeenCalledWith('secret value');
  });

  test('should copy an empty string when there is nothing to copy', async () => {
    const fixture = TestBed.createComponent(TestComponent);
    fixture.componentInstance.value.set(null);

    await page.elementLocator(fixture.nativeElement).getByRole('button', { name: 'Copy' }).click();

    expect(clipboard.copy).toHaveBeenCalledWith('');
  });
});
