import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { SectionAnchorDirective } from './section-anchor.directive';
import { SectionLinkComponent } from './section-link.component';

@Component({
  template: `
    <section oibSectionAnchor="items">
      <h5>Items <oib-section-link fragment="items" /></h5>
    </section>
    <section oibSectionAnchor="logs">
      <h5>Logs <oib-section-link fragment="logs" /></h5>
    </section>
  `,
  imports: [SectionAnchorDirective, SectionLinkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class HostComponent {}

describe('SectionAnchorDirective and SectionLinkComponent', () => {
  let scrolled: Array<string | null>;

  beforeEach(() => {
    scrolled = [];
    vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(function (this: HTMLElement) {
      scrolled.push(this.getAttribute('data-section'));
    });
    TestBed.configureTestingModule({ providers: [provideI18nTesting(), provideRouter([])] });
  });

  afterEach(() => vi.restoreAllMocks());

  test('should scroll to the section of the fragment of the URL', async () => {
    await TestBed.inject(Router).navigateByUrl('/?itemsSearch=temp#logs');

    TestBed.createComponent(HostComponent);

    await vi.waitFor(() => expect(scrolled).toEqual(['logs']));
  });

  test('should link to a section, keeping the query params, and scroll to it on each click', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/?itemsSearch=temp');
    const fixture = TestBed.createComponent(HostComponent);
    const root = page.elementLocator(fixture.nativeElement);
    const logsLink = root.getByRole('link', { name: 'Link to this section' }).nth(1);
    await expect.element(logsLink).toHaveAttribute('href', '/?itemsSearch=temp#logs');

    await logsLink.click();
    await vi.waitFor(() => expect(router.url).toBe('/?itemsSearch=temp#logs'));
    expect(scrolled).toContain('logs');

    // the URL does not change anymore, the section is scrolled to anyway
    scrolled = [];
    await logsLink.click();
    expect(scrolled).toEqual(['logs']);
    expect(scrolled).not.toContain('items');
  });
});
