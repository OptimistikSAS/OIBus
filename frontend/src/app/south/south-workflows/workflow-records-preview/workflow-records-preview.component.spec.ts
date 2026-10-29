import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { OIBusRecord } from '@oibus/shared/common/content.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { WorkflowRecordsPreviewComponent } from './workflow-records-preview.component';

class WorkflowRecordsPreviewComponentTester {
  readonly fixture = TestBed.createComponent(WorkflowRecordsPreviewComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly search = this.root.getByCss('.records-search');
  readonly count = this.root.getByCss('.records-count');
  readonly none = this.root.getByCss('.records-none');
  readonly headers = this.root.getByCss('thead th');
  readonly rows = this.root.getByCss('tbody tr');
  readonly pagination = this.root.getByCss('oib-pagination');

  show(records: Array<OIBusRecord>, pageSize?: number) {
    this.fixture.componentRef.setInput('records', records);
    if (pageSize) {
      this.fixture.componentRef.setInput('pageSize', pageSize);
    }
    this.fixture.detectChanges();
  }
}

function sensors(count: number): Array<OIBusRecord> {
  return Array.from({ length: count }, (_, index) => ({
    id: `ns=1;s=Sensor${index}`,
    path: `Plant/${index % 2 === 0 ? 'Reactor' : 'Boiler'}/Sensor${index}`,
    unit: index % 2 === 0 ? '°C' : 'bar'
  }));
}

describe('WorkflowRecordsPreviewComponent', () => {
  let tester: WorkflowRecordsPreviewComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    tester = new WorkflowRecordsPreviewComponentTester();
  });

  test('should show the fields of the records as columns, with their values', async () => {
    tester.show(sensors(3));

    await expect.element(tester.headers).toHaveLength(3);
    await expect.element(tester.headers.nth(1)).toHaveTextContent('path');
    await expect.element(tester.rows).toHaveLength(3);
    await expect.element(tester.rows.nth(1)).toMatchTextContent('Plant/Boiler/Sensor1');
    await expect.element(tester.count).toHaveTextContent('Records shown: 3 of 3');
    await expect.element(tester.pagination).not.toBeInTheDocument();
  });

  test('should paginate the records', async () => {
    tester.show(sensors(25), 10);

    await expect.element(tester.rows).toHaveLength(10);
    await expect.element(tester.rows.nth(0)).toMatchTextContent('Sensor0');
    await expect.element(tester.pagination).toBeInTheDocument();

    await tester.root.getByRole('link', { name: '3' }).click();

    await expect.element(tester.rows).toHaveLength(5);
    await expect.element(tester.rows.nth(0)).toMatchTextContent('Sensor20');
  });

  test('should search the values of every field, back to the first page', async () => {
    tester.show(sensors(25), 10);
    await tester.root.getByRole('link', { name: '2' }).click();

    await tester.search.fill('boiler');

    // the odd ones are in the Boiler: 12 of 25
    await expect.element(tester.count).toHaveTextContent('Records shown: 12 of 25');
    await expect.element(tester.rows).toHaveLength(10);
    await expect.element(tester.rows.nth(0)).toMatchTextContent('Sensor1');

    await tester.search.fill('BAR');
    await expect.element(tester.count).toHaveTextContent('Records shown: 12 of 25');
    await tester.search.fill('Sensor24');
    await expect.element(tester.rows).toHaveLength(1);
    await expect.element(tester.pagination).not.toBeInTheDocument();
  });

  test('should say when no record matches the search, and show them all again when it is cleared', async () => {
    tester.show(sensors(3));

    await tester.search.fill('nothing like this');

    await expect.element(tester.none).toHaveTextContent('No record matches the search');
    await expect.element(tester.rows).not.toBeInTheDocument();

    await tester.search.fill('');
    await expect.element(tester.rows).toHaveLength(3);
  });

  test('should search a record with an empty value without failing', async () => {
    tester.show([
      { id: 'a', unit: null },
      { id: 'b', unit: 'bar' }
    ]);

    await tester.search.fill('bar');

    await expect.element(tester.rows).toHaveLength(1);
  });
});
