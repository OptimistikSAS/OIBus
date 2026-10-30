import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { DescribedNameComponent } from './described-name.component';

class DescribedNameComponentTester {
  readonly fixture = TestBed.createComponent(DescribedNameComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly name = this.root.getByCss('span').first();
  readonly tooltip = page.getByRole('tooltip');
}

describe('DescribedNameComponent', () => {
  let tester: DescribedNameComponentTester;

  beforeEach(() => {
    tester = new DescribedNameComponentTester();
    tester.fixture.componentRef.setInput('name', 'Reactor inlet');
  });

  test('should display the name', async () => {
    await expect.element(tester.name).toHaveTextContent('Reactor inlet');
  });

  test('should display the full name in bold, then the description, in a tooltip', async () => {
    tester.fixture.componentRef.setInput('description', 'Temperature of the reactor inlet');
    await tester.name.hover();

    await expect.element(tester.tooltip).toMatchTextContent(/Reactor inlet\s*Temperature of the reactor inlet/);
    await expect.element(tester.tooltip.getByText('Reactor inlet', { exact: true })).toHaveClass('fw-bold');
  });

  test('should only display the full name in bold in the tooltip without description', async () => {
    tester.fixture.componentRef.setInput('description', '  ');
    await tester.name.hover();

    await expect.element(tester.tooltip).toMatchTextContent(/^\s*Reactor inlet\s*$/);
    await expect.element(tester.tooltip.getByText('Reactor inlet')).toHaveClass('fw-bold');
  });
});
