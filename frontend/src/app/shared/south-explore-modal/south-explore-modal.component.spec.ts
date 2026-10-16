import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import testData from '../../../test/test-data';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { SouthConnectorService } from '../../services/south-connector.service';
import { SouthExploreModalComponent } from './south-explore-modal.component';

class SouthExploreModalComponentTester {
  readonly fixture = TestBed.createComponent(SouthExploreModalComponent);
  readonly component = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly cancel = this.root.getByRole('button', { name: 'Close' });
  readonly tree = this.root.getByCss('#explore-tree');
  readonly title = this.root.getByRole('heading');
}

describe('SouthExploreModalComponent', () => {
  let tester: SouthExploreModalComponentTester;
  let fakeActiveModal: MockObject<NgbActiveModal>;
  let southConnectorService: MockObject<SouthConnectorService>;

  const southConnector = testData.south.list[0];

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);
    southConnectorService = createMock(SouthConnectorService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: fakeActiveModal },
        { provide: SouthConnectorService, useValue: southConnectorService }
      ]
    });

    tester = new SouthExploreModalComponentTester();
    southConnectorService.closeExplore.mockReturnValue(of(undefined));
    southConnectorService.startExplore.mockReturnValue(
      of({ sessionId: 'sessionId', entries: [{ id: 'ns=0;i=85', name: 'Objects', metadata: { type: 'Object' }, hasChildren: true }] })
    );
  });

  test('should forward prepare() to the embedded explore tree, even when called before the view is first checked', async () => {
    // Mirrors every real caller: prepare() is invoked immediately after modalService.open(), before the view child is resolved
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type);

    await expect.element(tester.tree).toBeInTheDocument();
    expect(southConnectorService.startExplore).toHaveBeenCalledWith(southConnector.id, southConnector.settings, southConnector.type);
    await expect.element(tester.title).toHaveTextContent('Explore data source');
  });

  test('should forward prepare() to the embedded explore tree when the view is already checked', async () => {
    await tester.fixture.whenStable();

    tester.component.prepare(null, southConnector.settings, southConnector.type);

    await expect.element(tester.tree).toBeInTheDocument();
    expect(southConnectorService.startExplore).toHaveBeenCalledWith('create', southConnector.settings, southConnector.type);
  });

  test('should close with the checked nodes and the action run on them', async () => {
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type, {
      checkedActions: [
        { id: 'keep-in-sync', labelKey: 'south.explore.keep-in-sync' },
        { id: 'add-items', labelKey: 'south.explore.add-as-items' }
      ]
    });
    const addButton = tester.root.getByRole('button', { name: 'Add as items' });
    const keepInSyncButton = tester.root.getByRole('button', { name: 'Keep in sync…' });
    await expect.element(addButton).toBeDisabled();
    // the last action is the main one
    await expect.element(addButton).toHaveClass('btn-primary');
    await expect.element(keepInSyncButton).toHaveClass('btn-secondary');
    await expect.element(tester.root.getByCss('#explore-checked-count')).toHaveTextContent('0 selected');

    await tester.root.getByRole('checkbox', { name: 'Select Objects' }).click();
    await expect.element(tester.root.getByCss('#explore-checked-count')).toHaveTextContent('1 selected');
    await keepInSyncButton.click();

    expect(fakeActiveModal.close).toHaveBeenCalledWith({ action: 'keep-in-sync', nodeIds: ['ns=0;i=85'] });
  });

  test('should only browse without checked actions', async () => {
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type);

    await expect.element(tester.root.getByText('Objects')).toBeInTheDocument();
    await expect.element(tester.root.getByRole('checkbox')).not.toBeInTheDocument();
    await expect.element(tester.root.getByCss('#explore-checked-count')).not.toBeInTheDocument();
  });

  test('should dismiss on cancel', async () => {
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type);

    await tester.cancel.click();

    expect(fakeActiveModal.dismiss).toHaveBeenCalled();
  });
});
