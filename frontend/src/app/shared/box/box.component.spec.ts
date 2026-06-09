import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { BoxComponent, BoxTitleDirective } from './box.component';

@Component({
  template: `<oib-box [boxTitle]="title">This is the content</oib-box>`,
  imports: [BoxComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestBoxWrapper {
  title = 'common.yes';
}

class BoxComponentTester {
  readonly fixture = TestBed.createComponent(TestBoxWrapper);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByCss('.oib-box-title');
  readonly content = this.root.getByCss('.box-content');

  constructor() {
    this.fixture.detectChanges();
  }
}

describe('BoxComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestBoxWrapper],
      providers: [provideI18nTesting()]
    });
  });

  describe('with string title', () => {
    test('should display string title', async () => {
      const tester = new BoxComponentTester();
      await expect.element(tester.title).toHaveTextContent('Yes');
      await expect.element(tester.content).toHaveTextContent('This is the content');
      await expect.element(tester.content).toBeVisible();
    });
  });

  describe('with template title', () => {
    beforeEach(() => {
      TestBed.overrideTemplate(
        TestBoxWrapper,
        `<oib-box [boxTitle]="title">
          <ng-template oibBoxTitle>Hello from template</ng-template>
          This is the content
        </oib-box>`
      );
      TestBed.overrideComponent(TestBoxWrapper, {
        add: { imports: [BoxTitleDirective] }
      });
    });

    test('should display template title', async () => {
      const tester = new BoxComponentTester();
      await expect.element(tester.title).toHaveTextContent('Hello from template');
      await expect.element(tester.content).toHaveTextContent('This is the content');
      await expect.element(tester.content).toBeVisible();
    });
  });
});
