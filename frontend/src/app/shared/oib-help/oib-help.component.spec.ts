import { TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { beforeEach, describe, expect, test } from 'vitest';
import { OibHelpComponent } from './oib-help.component';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { page } from 'vitest/browser';

@Component({
  selector: 'oib-test-oib-help-component',
  template: `<oib-help [url]="url" />`,
  imports: [OibHelpComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestComponent {
  url = 'https://oibus.optimistik.com' as const;
}

class TestComponentTester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly helpLink = this.root.getByCss('a.help-icon');
  readonly infoCircle = this.helpLink.getByCss('.fa-question-circle');
}

describe('OibHelpComponent', () => {
  let tester: TestComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });
    tester = new TestComponentTester();
    tester.fixture.detectChanges();
  });

  test('should display a info circle', async () => {
    await expect.element(tester.helpLink).toHaveAttribute('href', 'https://oibus.optimistik.com');
    await expect.element(tester.infoCircle).toBeInTheDocument();
  });
});
