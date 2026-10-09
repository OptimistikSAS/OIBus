import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import testData from '../../../test/test-data';
import { provideCurrentUser } from '../current-user-testing';
import { AuditInfoComponent } from './audit-info.component';

class AuditInfoComponentTester {
  readonly fixture = TestBed.createComponent(AuditInfoComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly value = this.root.getByCss('span').first();
  readonly tooltip = page.getByRole('tooltip');
}

describe('AuditInfoComponent', () => {
  let tester: AuditInfoComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), provideCurrentUser({ ...testData.users.list[0], timezone: 'UTC' })]
    });
    tester = new AuditInfoComponentTester();
    tester.fixture.componentRef.setInput('createdAt', '2024-01-01T08:00:00.000Z');
    tester.fixture.componentRef.setInput('createdBy', 'Alice');
    tester.fixture.componentRef.setInput('updatedAt', '2024-02-02T09:00:00.000Z');
    tester.fixture.componentRef.setInput('updatedBy', 'Bob');
  });

  test('should display the updated date', async () => {
    await expect.element(tester.value).toHaveTextContent('2 Feb 2024, 09:00');
  });

  test('should display the audit trail in a tooltip with bold labels', async () => {
    await tester.value.hover();

    await expect.element(tester.tooltip).toMatchTextContent(/Created on: 1 Jan 2024, 08:00\s*Created by: Alice\s*Updated by: Bob/);
    await expect.element(tester.tooltip.getByText('Created on')).toHaveClass('fw-bold');
  });
});
