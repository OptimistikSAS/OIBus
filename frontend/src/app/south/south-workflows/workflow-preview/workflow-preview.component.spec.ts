import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { WorkflowPreviewEntryDTO, WorkflowPreviewResultDTO } from '@oibus/shared/api/configuration-workflow.model';
import { WorkflowRunDetailDTO } from '@oibus/shared/api/workflow-run.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { DownloadService } from '../../../services/download.service';
import { WorkflowPreviewComponent, WorkflowPreviewContext } from './workflow-preview.component';

class WorkflowPreviewComponentTester {
  readonly fixture = TestBed.createComponent(WorkflowPreviewComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly counts = this.root.getByCss('#preview-counts');
  readonly runCounts = this.root.getByCss('#run-payload-counts');
  readonly none = this.root.getByCss('#preview-none');
  readonly entriesTable = this.root.getByCss('#preview-entries-table');
  readonly recordsTable = this.root.getByCss('#preview-records-table');
  readonly headers = this.root.getByCss('thead th');
  readonly rows = this.root.getByCss('tbody tr');
  readonly changedCells = this.root.getByCss('.preview-changed-cell');
  readonly pagination = this.root.getByCss('ngb-pagination');
  readonly exportButton = this.root.getByRole('button', { name: 'Export CSV' });

  constructor(result: WorkflowPreviewResultDTO | WorkflowRunDetailDTO, context: WorkflowPreviewContext = 'preview') {
    this.fixture.componentRef.setInput('result', result);
    this.fixture.componentRef.setInput('context', context);
    this.fixture.componentRef.setInput('workflowName', 'Reactor discovery');
  }

  cell(row: number, column: number) {
    return this.rows.nth(row).getByRole('cell').nth(column);
  }
}

const entry = (key: string, overrides: Partial<WorkflowPreviewEntryDTO> = {}): WorkflowPreviewEntryDTO => ({
  key,
  status: 'new',
  record: { nodeId: key },
  previousMetadata: null,
  ...overrides
});

const result = (overrides: Partial<WorkflowPreviewResultDTO> = {}): WorkflowPreviewResultDTO => ({
  discoveredCount: 3,
  eligibleCount: 0,
  entries: [],
  records: [],
  ...overrides
});

const runDetail: WorkflowRunDetailDTO = {
  id: 'runId1',
  workflowId: 'workflowId1',
  triggerType: 'manual',
  status: 'COMPLETED',
  startedAt: '',
  completedAt: '',
  error: null,
  triggeredBy: { id: 'user1', friendlyName: 'User One' },
  discoveredCount: 3,
  eligibleCount: 2,
  createdCount: 1,
  updatedCount: 1,
  disabledCount: 0,
  pushedCount: 0,
  entries: [],
  records: []
};

describe('WorkflowPreviewComponent', () => {
  let downloadService: MockObject<DownloadService>;

  beforeEach(() => {
    downloadService = createMock(DownloadService);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: DownloadService, useValue: downloadService }]
    });
  });

  function exportedContent(): Promise<string> {
    return downloadService.downloadFile.mock.lastCall![0].blob.text();
  }

  test('should show the discovered/eligible counts and a message when there are no entries', async () => {
    const tester = new WorkflowPreviewComponentTester(result());

    await expect.element(tester.counts).toHaveTextContent('3 discovered, 0 eligible');
    await expect
      .element(tester.none)
      .toHaveTextContent('Nothing new, changed, reactivated, or missing - the next run would have nothing to do');
    await expect.element(tester.exportButton).toBeDisabled();
  });

  test('should render one row per entry with its status badge for a local workflow', async () => {
    const tester = new WorkflowPreviewComponentTester(
      result({
        discoveredCount: 2,
        eligibleCount: 2,
        entries: [entry('nodeId=a'), entry('nodeId=b', { status: 'missing', record: null, previousMetadata: { nodeId: 'b' } })]
      })
    );

    await expect.element(tester.rows).toHaveLength(2);
    await expect.element(tester.cell(0, 0)).toHaveTextContent('New');
    await expect.element(tester.cell(0, 1)).toHaveTextContent('nodeId=a');
    await expect.element(tester.cell(1, 0)).toHaveTextContent('Missing');
    // a missing entry shows the previous run's snapshot, dimmed
    await expect.element(tester.cell(1, 2)).toHaveTextContent('b');
    await expect.element(tester.rows.nth(1)).toHaveClass('text-muted');
  });

  test('should paginate a large list of entries, 20 per page', async () => {
    const tester = new WorkflowPreviewComponentTester(
      result({ discoveredCount: 25, eligibleCount: 25, entries: Array.from({ length: 25 }, (_, i) => entry(`nodeId=${i}`)) })
    );
    await expect.element(tester.rows).toHaveLength(20);

    await tester.root.getByRole('link', { name: '2' }).click();

    await expect.element(tester.rows).toHaveLength(5);
    await expect.element(tester.cell(0, 1)).toHaveTextContent('nodeId=20');
  });

  test('should go back to the first page when the result is refreshed', async () => {
    const entries = Array.from({ length: 25 }, (_, i) => entry(`nodeId=${i}`));
    const tester = new WorkflowPreviewComponentTester(result({ entries }));
    await tester.root.getByRole('link', { name: '2' }).click();
    await expect.element(tester.rows).toHaveLength(5);

    tester.fixture.componentRef.setInput('result', result({ entries: [...entries] }));

    await expect.element(tester.rows).toHaveLength(20);
    await expect.element(tester.cell(0, 1)).toHaveTextContent('nodeId=0');
  });

  test('should not show pagination controls when everything fits on one page', async () => {
    const tester = new WorkflowPreviewComponentTester(result({ entries: [entry('nodeId=a')] }));

    await expect.element(tester.rows).toHaveLength(1);
    await expect.element(tester.pagination).not.toBeInTheDocument();
  });

  test('should show the status badge and identity key as the leftmost columns, followed by one column per record field', async () => {
    const tester = new WorkflowPreviewComponentTester(result({ entries: [entry('nodeId=a', { record: { nodeId: 'a', unit: 'C' } })] }));

    await expect.element(tester.headers).toHaveLength(4);
    await expect.element(tester.headers.nth(0)).toHaveTextContent('Status');
    await expect.element(tester.headers.nth(1)).toHaveTextContent('Identity key');
    await expect.element(tester.headers.nth(2)).toHaveTextContent('nodeId');
    await expect.element(tester.headers.nth(3)).toHaveTextContent('unit');
    await expect.element(tester.cell(0, 0).getByCss('.badge')).toHaveTextContent('New');
    await expect.element(tester.cell(0, 1)).toHaveTextContent('nodeId=a');
    await expect.element(tester.cell(0, 2)).toHaveTextContent('a');
    await expect.element(tester.cell(0, 3)).toHaveTextContent('C');
  });

  test('should show a composite identity key with a readable separator', async () => {
    const tester = new WorkflowPreviewComponentTester(
      result({ entries: [entry(`ns=1${String.fromCharCode(1)}tag=a`, { record: { ns: '1', tag: 'a' } })] })
    );

    await expect.element(tester.cell(0, 1)).toHaveTextContent('ns=1, tag=a');
  });

  test('should highlight only the cells of a changed entry that differ from the previous run', async () => {
    const tester = new WorkflowPreviewComponentTester(
      result({
        entries: [
          entry('nodeId=a', { status: 'changed', record: { nodeId: 'a', unit: 'F' }, previousMetadata: { nodeId: 'a', unit: 'C' } })
        ]
      })
    );

    await expect.element(tester.changedCells).toHaveLength(1);
    await expect.element(tester.changedCells.first()).toHaveTextContent('F');
    await expect.element(tester.changedCells.first()).toHaveAttribute('title', 'Previous value: C');
  });

  test("should render the raw records for a remote (push-to-OIAnalytics) workflow, with the union of every record's fields", async () => {
    const tester = new WorkflowPreviewComponentTester(
      result({
        records: [
          { nodeId: 'a', type: 'Variable' },
          { nodeId: 'b', unit: 'C' }
        ]
      })
    );

    await expect.element(tester.recordsTable).toBeInTheDocument();
    await expect.element(tester.entriesTable).not.toBeInTheDocument();
    await expect.element(tester.headers).toHaveLength(3);
    await expect.element(tester.headers.nth(1)).toHaveTextContent('type');
    await expect.element(tester.headers.nth(2)).toHaveTextContent('unit');
    await expect.element(tester.rows).toHaveLength(2);
    await expect.element(tester.cell(1, 0)).toHaveTextContent('b');
    await expect.element(tester.cell(1, 1)).toHaveTextContent('');
    await expect.element(tester.cell(1, 2)).toHaveTextContent('C');
  });

  test('should paginate the raw records', async () => {
    const tester = new WorkflowPreviewComponentTester(result({ records: Array.from({ length: 21 }, (_, i) => ({ nodeId: `${i}` })) }));
    await expect.element(tester.rows).toHaveLength(20);

    await tester.root.getByRole('link', { name: '2' }).click();

    await expect.element(tester.rows).toHaveLength(1);
    await expect.element(tester.cell(0, 0)).toHaveTextContent('20');
  });

  test('should never show the created/updated/disabled/pushed breakdown for a live preview - it never acts on anything', async () => {
    const tester = new WorkflowPreviewComponentTester(runDetail);

    await expect.element(tester.counts).toBeInTheDocument();
    await expect.element(tester.runCounts).not.toBeInTheDocument();
  });

  test('should export a flattened CSV of the entries for a local/diffed workflow', async () => {
    const tester = new WorkflowPreviewComponentTester(result({ entries: [entry('nodeId=a', { record: { nodeId: 'a', unit: 'C' } })] }));

    await tester.exportButton.click();

    expect(downloadService.downloadFile).toHaveBeenCalledTimes(1);
    expect(downloadService.downloadFile.mock.lastCall![0].name).toMatch(
      /^preview_Reactor_discovery_\d{4}_\d{2}_\d{2}_\d{2}_\d{2}_\d{2}_\d{3}\.csv$/
    );
    expect((await exportedContent()).split('\r\n')).toEqual(['key,status,nodeId,unit', 'nodeId=a,new,a,C']);
  });

  test('should still export the full entries list to CSV even after paginating past the first page', async () => {
    const tester = new WorkflowPreviewComponentTester(result({ entries: Array.from({ length: 22 }, (_, i) => entry(`nodeId=${i}`)) }));
    await tester.root.getByRole('link', { name: '2' }).click();
    await expect.element(tester.rows).toHaveLength(2);

    await tester.exportButton.click();

    const lines = (await exportedContent()).split('\r\n');
    expect(lines).toHaveLength(23);
    expect(lines[1]).toBe('nodeId=0,new,nodeId=0');
    expect(lines[22]).toBe('nodeId=21,new,nodeId=21');
  });

  test('should export the raw records for a remote (push-to-OIAnalytics) workflow', async () => {
    const tester = new WorkflowPreviewComponentTester(
      result({
        records: [
          { nodeId: 'a', value: 1 },
          { nodeId: 'b', value: 2 }
        ]
      })
    );

    await tester.exportButton.click();

    expect((await exportedContent()).split('\r\n')).toEqual(['nodeId,value', 'a,1', 'b,2']);
  });

  describe('run payload', () => {
    test("should use the run-payload empty-state wording instead of preview's", async () => {
      const tester = new WorkflowPreviewComponentTester(runDetail, 'run-payload');

      await expect.element(tester.none).toHaveTextContent('Nothing was created, changed, reactivated, or missing in this run');
    });

    test('should show the created/updated/disabled/pushed breakdown', async () => {
      const tester = new WorkflowPreviewComponentTester({ ...runDetail, entries: [entry('nodeId=a')] }, 'run-payload');

      await expect.element(tester.runCounts).toHaveTextContent('1 created, 1 updated, 0 disabled, 0 pushed');
      await expect.element(tester.rows).toHaveLength(1);
    });

    test('should export the run payload with a run-payload file name', async () => {
      const tester = new WorkflowPreviewComponentTester({ ...runDetail, entries: [entry('nodeId=a')] }, 'run-payload');

      await tester.exportButton.click();

      expect(downloadService.downloadFile.mock.lastCall![0].name).toMatch(/^run-payload_Reactor_discovery_.*\.csv$/);
    });
  });
});
