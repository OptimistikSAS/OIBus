import { TestBed } from '@angular/core/testing';

import { Component } from '@angular/core';
import { ComponentTester } from 'ngx-speculoos';
import { BoxComponent, BoxTitleDirective } from './box.component';
import { provideI18nTesting } from '../../../i18n/mock-i18n';

@Component({
  template: `<oib-box [boxTitle]="title"> This is the content </oib-box>`,
  standalone: true,
  imports: [BoxComponent, BoxTitleDirective]
})
class TestComponent {
  title = 'common.yes';
}

class TestComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get title() {
    return this.element<HTMLElement>('.oib-box-title')!;
  }

  get content() {
    return this.element('.oib-box-content');
  }
}

describe('BoxComponent', () => {
  let tester: TestComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });
  });

  describe('with string title', () => {
    it('should display string title', () => {
      tester = new TestComponentTester();
      tester.detectChanges();
      expect(tester.title).toContainText('Yes');
      expect(tester.content).toContainText('This is the content');
      expect(tester.content).toBeVisible();
      tester.title.click();
      expect(tester.content).toBeVisible();
    });
  });

  describe('with template title', () => {
    beforeEach(() => {
      TestBed.overrideTemplate(
        TestComponent,
        `
        <oib-box [boxTitle]="title">
          <ng-template oibBoxTitle>Hello from template</ng-template>
          This is the content
        </oib-box>
      `
      );
    });

    it('should display string title', () => {
      tester = new TestComponentTester();
      tester.detectChanges();

      expect(tester.title).toContainText('Hello from template');
      expect(tester.content).toContainText('This is the content');
      expect(tester.content).toBeVisible();
      tester.title.click();
      expect(tester.content).toBeVisible();
    });
  });
});
