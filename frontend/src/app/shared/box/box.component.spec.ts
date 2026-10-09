import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { BoxComponent, BoxTitleDirective } from './box.component';

@Component({
  template: `<oib-box boxTitle="common.yes">This is the content</oib-box>`,
  imports: [BoxComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestBoxWrapper {}

class BoxComponentTester {
  readonly fixture = TestBed.createComponent(TestBoxWrapper);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByCss('.oib-box-title');
  readonly content = this.root.getByCss('.box-content');
  readonly image = this.root.getByRole('img');
  readonly helpLink = this.root.getByRole('link', { name: 'Help' });
}

describe('BoxComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestBoxWrapper],
      providers: [provideI18nTesting()]
    });
  });

  test('should display string title', async () => {
    const tester = new BoxComponentTester();
    await expect.element(tester.title).toHaveTextContent('Yes');
    await expect.element(tester.content).toHaveTextContent('This is the content');
    await expect.element(tester.image).not.toBeInTheDocument();
    await expect.element(tester.helpLink).not.toBeInTheDocument();
  });

  test('should display template title', async () => {
    TestBed.overrideTemplate(
      TestBoxWrapper,
      `<oib-box boxTitle="common.yes">
        <ng-template oibBoxTitle>Hello from template</ng-template>
        This is the content
      </oib-box>`
    );
    TestBed.overrideComponent(TestBoxWrapper, { add: { imports: [BoxTitleDirective] } });

    const tester = new BoxComponentTester();
    await expect.element(tester.title).toHaveTextContent('Hello from template');
    await expect.element(tester.content).toHaveTextContent('This is the content');
  });

  test('should display an image and a help link', async () => {
    TestBed.overrideTemplate(
      TestBoxWrapper,
      `<oib-box boxTitle="common.yes" imagePath="/assets/south/mqtt.svg" helpUrl="https://oibus.dev">Content</oib-box>`
    );

    const tester = new BoxComponentTester();
    await expect.element(tester.image).toHaveAttribute('src', '/assets/south/mqtt.svg');
    await expect.element(tester.helpLink).toHaveAttribute('href', 'https://oibus.dev');
  });

  test.each([
    ['a table', '<table><tbody><tr><td>cell</td></tr></tbody></table>'],
    ['a warning', '<div class="alert-warning">Warning</div>'],
    ['only text', 'Just text'],
    ['a grey container', '<div><div class="oib-grey-container">Empty</div></div>']
  ])('should remove the padding when the content contains %s', async (_name, content) => {
    TestBed.overrideTemplate(TestBoxWrapper, `<oib-box boxTitle="common.yes">${content}</oib-box>`);

    const tester = new BoxComponentTester();
    await expect.element(tester.content).toHaveClass('p-0 box-content');
  });

  test('should keep the padding for regular content', async () => {
    TestBed.overrideTemplate(TestBoxWrapper, `<oib-box boxTitle="common.yes"><div class="row">Form</div></oib-box>`);

    const tester = new BoxComponentTester();
    await expect.element(tester.content).toHaveClass('mb-3 px-3 py-1 box-content');
  });
});
