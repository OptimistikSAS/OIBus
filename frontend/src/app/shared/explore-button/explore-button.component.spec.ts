import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ExploreButtonComponent } from './explore-button.component';

@Component({
  template: `<oib-explore-button
    [synchronisations]="synchronisations()"
    (explore)="events.push('explore')"
    (manageSynchronisations)="events.push('synchronisations')"
  />`,
  imports: [ExploreButtonComponent]
})
class TestComponent {
  readonly synchronisations = signal<number | null>(null);
  readonly events: Array<string> = [];
}

class ExploreButtonComponentTester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly host = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly exploreButton = this.root.getByCss('#explore');
  readonly menu = this.root.getByCss('#explore-menu');
  readonly exploreItem = this.root.getByCss('#explore-data-source');
  readonly synchronisationsItem = this.root.getByCss('#manage-workflows-button');
}

describe('ExploreButtonComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
  });

  test('should only explore the data source of a connector without discovery', async () => {
    const tester = new ExploreButtonComponentTester();

    await tester.exploreButton.click();

    await expect.element(tester.exploreButton).toHaveTextContent('Explore');
    await expect.element(tester.menu).not.toBeInTheDocument();
    expect(tester.host.events).toEqual(['explore']);
  });

  test('should offer the items synchronisations of a connector with discovery, with their count', async () => {
    const tester = new ExploreButtonComponentTester();
    tester.host.synchronisations.set(2);

    await expect.element(tester.menu).toHaveAttribute('aria-label', 'Items synchronisations: 2');
    await expect.element(tester.menu).toHaveTextContent('2');
    await tester.menu.click();
    await expect.element(tester.synchronisationsItem).toHaveTextContent('Items synchronisations (2)…');
    await tester.synchronisationsItem.click();
    await tester.menu.click();
    await tester.exploreItem.click();
    await tester.exploreButton.click();

    expect(tester.host.events).toEqual(['synchronisations', 'explore', 'explore']);
  });

  test('should not count the items synchronisations of a connector without any', async () => {
    const tester = new ExploreButtonComponentTester();
    tester.host.synchronisations.set(0);

    await expect.element(tester.menu).toHaveAttribute('aria-label', 'Items synchronisations: 0');
    await expect.element(tester.menu.getByCss('.badge')).not.toBeInTheDocument();
  });
});
