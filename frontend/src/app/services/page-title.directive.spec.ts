import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';

import { describe, expect, test } from 'vitest';

import { PageTitleDirective } from './page-title.directive';

@Component({
  selector: 'oib-test',
  template: '<oib-page-title [title]="title()" />',
  imports: [PageTitleDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestComponent {
  readonly title = signal<string | undefined>('OIBus name');
}

describe('PageTitleDirective', () => {
  test('should set the page title and update it when the title changes', async () => {
    const titleService = TestBed.inject(Title);
    const fixture = TestBed.createComponent(TestComponent);
    await fixture.whenStable();

    expect(titleService.getTitle()).toBe('OIBus - OIBus name');

    fixture.componentInstance.title.set('Engine');
    await fixture.whenStable();
    expect(titleService.getTitle()).toBe('OIBus - Engine');
  });

  test('should only display OIBus when there is no title', async () => {
    const titleService = TestBed.inject(Title);
    const fixture = TestBed.createComponent(TestComponent);
    fixture.componentInstance.title.set(undefined);
    await fixture.whenStable();

    expect(titleService.getTitle()).toBe('OIBus');
  });
});
