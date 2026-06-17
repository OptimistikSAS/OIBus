import { TestBed } from '@angular/core/testing';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { By } from '@angular/platform-browser';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { AuditInfoComponent } from './audit-info.component';

class AuditInfoComponentTester {
  readonly fixture = TestBed.createComponent(AuditInfoComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly value = this.root.getByCss('span');

  openTooltip(): void {
    const tooltip = this.fixture.debugElement.query(By.directive(NgbTooltip)).injector.get(NgbTooltip);
    tooltip.open();
    this.fixture.detectChanges();
  }
}

describe('AuditInfoComponent', () => {
  let tester: AuditInfoComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });
    tester = new AuditInfoComponentTester();
    tester.fixture.componentRef.setInput('createdAt', '2024-01-01T08:00:00.000Z');
    tester.fixture.componentRef.setInput('createdBy', 'Alice');
    tester.fixture.componentRef.setInput('updatedAt', '2024-02-02T09:00:00.000Z');
    tester.fixture.componentRef.setInput('updatedBy', 'Bob');
    tester.fixture.detectChanges();
  });

  test('should display the updated date', async () => {
    await expect.element(tester.value).toHaveTextContent('2024');
  });

  test('should display the audit trail in a tooltip with bold labels', async () => {
    tester.openTooltip();

    const tooltipWindow = page.elementLocator(document.body).getByCss('ngb-tooltip-window');
    await expect.element(tooltipWindow).toHaveTextContent('Created on');
    await expect.element(tooltipWindow).toHaveTextContent('Created by');
    await expect.element(tooltipWindow).toHaveTextContent('Updated by');
    await expect.element(tooltipWindow).toHaveTextContent('Alice');
    await expect.element(tooltipWindow).toHaveTextContent('Bob');

    // Labels are rendered bold
    await expect.element(tooltipWindow.getByText('Created on')).toHaveClass('fw-bold');
  });
});
