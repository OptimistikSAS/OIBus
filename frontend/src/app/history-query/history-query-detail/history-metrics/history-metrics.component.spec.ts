import { TestBed } from '@angular/core/testing';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { HistoryQueryDTO } from '@oibus/shared/api/history-query.model';
import { HistoryQueryMetrics } from '@oibus/shared/domain/engine.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import testData from '../../../../test/test-data';
import { HistoryMetricsComponent } from './history-metrics.component';

class HistoryMetricsComponentTester {
  readonly fixture = TestBed.createComponent(HistoryMetricsComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByCss('#title');
  readonly progressbars = this.root.getByRole('progressbar');
  readonly itemStatuses = this.root.getByCss('tr.history-item-status');

  constructor(historyQuery: HistoryQueryDTO, historyMetrics: HistoryQueryMetrics) {
    this.fixture.componentRef.setInput('historyQuery', historyQuery);
    this.fixture.componentRef.setInput('historyMetrics', historyMetrics);
    this.fixture.componentRef.setInput('northManifest', testData.north.manifest);
    this.fixture.componentRef.setInput('southManifest', testData.south.manifest);
  }

  row(label: string) {
    return this.root.getByRole('row').filter({ has: page.getByRole('cell', { name: label, exact: true }) });
  }

  /** The value cell of the metrics row with the given label */
  value(label: string) {
    return this.row(label).getByRole('cell').nth(1);
  }
}

const runningQuery: HistoryQueryDTO = testData.historyQueries.list[0];
const pendingQuery: HistoryQueryDTO = { ...testData.historyQueries.list[0], status: 'PENDING' };

/** Metrics of a batched connector (no per-item progress), half-way through its intervals. */
const batchedMetrics: HistoryQueryMetrics = {
  ...testData.historyQueries.metrics,
  historyMetrics: {
    running: true,
    intervalProgress: 0.5,
    currentIntervalStart: '2020-03-15T00:00:00.000Z',
    currentIntervalEnd: '2020-03-15T01:00:00.000Z',
    currentIntervalNumber: 2,
    numberOfIntervals: 4,
    itemsStatus: []
  }
};

describe('HistoryMetricsComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('should display the per-item progress and the status of each item', async () => {
    const tester = new HistoryMetricsComponentTester(pendingQuery, testData.historyQueries.metrics);

    await expect.element(tester.title).toHaveTextContent(`${pendingQuery.name} metrics`);
    await expect.element(tester.value('Items processed')).toMatchTextContent('Current item: item1 (1 / 3)');
    await expect.element(tester.row('Current item progress')).toBeInTheDocument();
    await expect.element(tester.row('Data retrieved')).not.toBeInTheDocument();
    await expect.element(tester.row('Interval progress')).not.toBeInTheDocument();

    await expect.element(tester.itemStatuses).toHaveLength(3);
    for (const [index, [status, name]] of [
      ['Running', 'item1'],
      ['Pending', 'item2'],
      ['Pending', 'item3']
    ].entries()) {
      const cells = tester.itemStatuses.nth(index).getByRole('cell');
      await expect.element(cells.nth(0)).toHaveTextContent(status);
      await expect.element(cells.nth(1)).toHaveTextContent(name);
      await expect.element(cells.nth(3)).toHaveTextContent('0');
    }
  });

  test('should display the whole-range progress of a batched connector', async () => {
    const tester = new HistoryMetricsComponentTester(pendingQuery, batchedMetrics);

    await expect.element(tester.row('Data retrieved').getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0.5');
    await expect.element(tester.value('Interval progress')).toMatchTextContent(/2\s*\/\s*4/);
    await expect.element(tester.row('Items processed')).not.toBeInTheDocument();
    await expect.element(tester.itemStatuses).not.toBeInTheDocument();
    await expect.element(tester.root.getByText('Items status')).not.toBeInTheDocument();
  });

  test('should display the rate and the estimated time remaining while the query is running', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 100 seconds after the metrics start, half-way through the intervals: 22 values/files retrieved
    vi.setSystemTime(new Date('2020-03-15T00:01:40.000Z'));
    const tester = new HistoryMetricsComponentTester(runningQuery, batchedMetrics);

    await expect.element(tester.value('Values/files per second')).toHaveTextContent('0.22');
    await expect.element(tester.value('Estimated time remaining')).toHaveTextContent('1 min, 40 s');
  });

  test('should not display the rate nor the estimated time remaining when the query is not running', async () => {
    const tester = new HistoryMetricsComponentTester(pendingQuery, batchedMetrics);

    await expect.element(tester.value('Number of values retrieved')).toHaveTextContent('11');
    await expect.element(tester.row('Values/files per second')).not.toBeInTheDocument();
    await expect.element(tester.row('Estimated time remaining')).not.toBeInTheDocument();
  });

  test('should display the north progress once all intervals are retrieved', async () => {
    const tester = new HistoryMetricsComponentTester(runningQuery, {
      ...batchedMetrics,
      historyMetrics: { ...batchedMetrics.historyMetrics, intervalProgress: 1 }
    });

    // 11 bytes sent out of 22 cached
    const northProgressbar = tester.row('Data sent').getByRole('progressbar');
    await expect.element(northProgressbar).toHaveAttribute('aria-valuenow', '0.5');
    await expect.element(tester.row('Data sent').getByCss('.progress-bar')).toHaveClass('progress-bar-animated');
  });

  test('should not display the north progress before all intervals are retrieved', async () => {
    const tester = new HistoryMetricsComponentTester(runningQuery, batchedMetrics);

    await expect.element(tester.row('Data retrieved')).toBeInTheDocument();
    await expect.element(tester.row('Data sent')).not.toBeInTheDocument();
  });

  test('should display the last values and files retrieved and sent', async () => {
    const tester = new HistoryMetricsComponentTester(pendingQuery, {
      ...batchedMetrics,
      north: { ...batchedMetrics.north, lastContentSent: 'file.csv', lastRunDuration: 2000 },
      south: {
        ...batchedMetrics.south,
        lastFileRetrieved: 'retrieved.csv',
        lastValueRetrieved: { pointId: 'point1', timestamp: '2020-03-15T00:00:00.000Z', data: { value: 12 } }
      }
    });

    await expect.element(tester.value('Last content sent')).toHaveTextContent('file.csv');
    await expect.element(tester.value('Last run duration').first()).toHaveTextContent('2 s');
    await expect.element(tester.value('Last file retrieved')).toHaveTextContent('retrieved.csv');
    await expect.element(tester.value('Last value retrieved')).toMatchTextContent(/point1 at 2020-03-15T00:00:00.000Z with content/);
    await expect.element(tester.value('Cache size')).toHaveTextContent('Current size: 10 B / Total cached: 22 B / Total sent: 11 B');
    await expect.element(tester.value('Error size')).toHaveTextContent('Current size: 20 B / Total errored: 23 B');
    await expect.element(tester.value('Archive size')).toHaveTextContent('Current size: 30 B / Total archived: 24 B');
  });
});
