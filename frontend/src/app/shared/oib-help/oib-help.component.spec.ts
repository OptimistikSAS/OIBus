import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { OibHelpComponent } from './oib-help.component';

@Component({
  selector: 'oib-test-oib-help-component',
  template: `<oib-help url="/documentation/guide/x" />`,
  imports: [OibHelpComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestComponent {}

class TestComponentTester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly helpLink = this.root.getByRole('link', { name: 'Help' });
}

describe('OibHelpComponent', () => {
  let tester: TestComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });
    tester = new TestComponentTester();
  });

  test('should display a help link opening in a new tab', async () => {
    await expect.element(tester.helpLink).toHaveAttribute('href', '/documentation/guide/x');
    await expect.element(tester.helpLink).toHaveAttribute('target', '_blank');
  });

  test('should display a tooltip on hover', async () => {
    await tester.helpLink.hover();
    await expect.element(page.getByRole('tooltip')).toHaveTextContent('Help');
  });
});
