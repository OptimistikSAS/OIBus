import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ExploreButtonComponent } from './explore-button.component';

@Component({
  template: `<oib-explore-button [sync]="sync()" (explore)="events.push('explore')" />`,
  imports: [ExploreButtonComponent]
})
class TestComponent {
  readonly sync = signal(false);
  readonly events: Array<string> = [];
}

class ExploreButtonComponentTester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly host = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly exploreButton = this.root.getByCss('#explore');
}

describe('ExploreButtonComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
  });

  test('should only explore the data source of a connector without discovery', async () => {
    const tester = new ExploreButtonComponentTester();

    await expect.element(tester.exploreButton).toHaveTextContent('Explore');
    await expect.element(tester.exploreButton).not.toHaveTextContent('sync');
    await tester.exploreButton.click();

    expect(tester.host.events).toEqual(['explore']);
  });

  test('should explore and sync the data source of a connector with discovery', async () => {
    const tester = new ExploreButtonComponentTester();
    tester.host.sync.set(true);

    await expect.element(tester.exploreButton).toHaveTextContent('Explore and sync');
    await tester.exploreButton.click();

    expect(tester.host.events).toEqual(['explore']);
  });
});
