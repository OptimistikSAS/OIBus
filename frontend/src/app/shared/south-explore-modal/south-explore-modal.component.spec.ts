import { SouthExploreModalComponent, CreateItemsApi } from './south-explore-modal.component';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { SouthConnectorService } from '../../services/south-connector.service';
import { ModalService } from '../modal.service';
import { NEVER, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import testData from '../../../../../backend/src/tests/utils/test-data';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { page } from 'vitest/browser';

function createItemsApi(): MockObject<CreateItemsApi> & CreateItemsApi {
  return {
    expectedHeaders: ['name', 'enabled'],
    optionalHeaders: [],
    checkFn: vi.fn().mockReturnValue(of({ items: [], errors: [] })),
    importFn: vi.fn().mockReturnValue(of(undefined))
  } as unknown as MockObject<CreateItemsApi> & CreateItemsApi;
}

class SouthExploreModalComponentTester {
  readonly fixture = TestBed.createComponent(SouthExploreModalComponent);
  readonly component = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly spinner = this.root.getByCss('#spinner');
  readonly error = this.root.getByCss('#explore-error');
  readonly empty = this.root.getByCss('#explore-empty');
  readonly tree = this.root.getByCss('#explore-tree');
  readonly cancel = this.root.getByRole('button', { name: 'Close' });
  readonly typeBadges = this.root.getByCss('.explore-metadata');
  readonly metadataValues = this.root.getByCss('.explore-metadata-value');
  readonly createFromSelectionButton = this.root.getByCss('#create-from-selection-button');
  readonly selectAllButton = this.root.getByCss('#select-all-button');
  readonly unselectAllButton = this.root.getByCss('#unselect-all-button');

  checkbox(index: number) {
    return this.root.getByCss(`.explore-checkbox`).nth(index);
  }
}

describe('SouthExploreModalComponent', () => {
  let tester: SouthExploreModalComponentTester;
  let fakeActiveModal: MockObject<NgbActiveModal>;
  let southConnectorService: MockObject<SouthConnectorService>;
  let modalService: MockObject<ModalService>;

  const southConnector = testData.south.list[0];
  const manifest = testData.south.manifest;

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);
    southConnectorService = createMock(SouthConnectorService);
    modalService = createMock(ModalService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: fakeActiveModal },
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: ModalService, useValue: modalService }
      ]
    });

    tester = new SouthExploreModalComponentTester();
    southConnectorService.closeExplore.mockReturnValue(of(undefined));
  });

  test('should be loading', async () => {
    southConnectorService.startExplore.mockReturnValue(NEVER);
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type, manifest);
    tester.fixture.detectChanges();
    await expect.element(tester.spinner).toBeInTheDocument();
  });

  test('should display the root entries', async () => {
    southConnectorService.startExplore.mockReturnValue(
      of({ sessionId: 'sessionId', entries: [{ id: 'ns=0;i=85', name: 'Objects', metadata: { type: 'Object' }, hasChildren: true }] })
    );
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type, manifest);
    tester.fixture.detectChanges();

    expect(southConnectorService.startExplore).toHaveBeenCalledWith(southConnector.id, southConnector.settings, southConnector.type);
    expect(tester.component.sessionId).toBe('sessionId');
    expect(tester.component.nodes.length).toBe(1);
    await expect.element(tester.tree).toBeInTheDocument();
  });

  test('should always show the type badge, including for folder/file entries', async () => {
    southConnectorService.startExplore.mockReturnValue(
      of({
        sessionId: 'sessionId',
        entries: [
          { id: 'a', name: 'a-folder', metadata: { type: 'folder' }, hasChildren: true },
          { id: 'b', name: 'b-file', metadata: { type: 'file' }, hasChildren: false }
        ]
      })
    );
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type, manifest);
    tester.fixture.detectChanges();
    await expect.element(tester.tree).toBeInTheDocument();

    expect(tester.typeBadges.elements().length).toBe(2);
  });

  test('should keep the entry type unchanged when a node optimistically marked expandable turns out to have no children', () => {
    // Reproduces browsing a "Variable" node (e.g. Float, GUID): the backend optimistically marks
    // it hasChildren:true, and browsing it back with zero entries flips hasChildren to false.
    // The type badge must still read "Variable" — hasChildren is a separate, corrected flag.
    southConnectorService.startExplore.mockReturnValue(
      of({
        sessionId: 'sessionId',
        entries: [{ id: 'ns=1;s=Temperature', name: 'Temperature', metadata: { type: 'Variable' }, hasChildren: true }]
      })
    );
    southConnectorService.browseExplore.mockReturnValue(of({ entries: [] }));
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type, manifest);

    tester.component.toggle(tester.component.nodes[0]);

    expect(tester.component.nodes[0].entry.metadata['type']).toBe('Variable');
    expect(tester.component.nodes[0].entry.hasChildren).toBe(false);
  });

  test('should format a metadata field tagged "size" with the file-size pipe', async () => {
    southConnectorService.startExplore.mockReturnValue(
      of({
        sessionId: 'sessionId',
        entries: [
          {
            id: 'file1.csv',
            name: 'file1.csv',
            metadata: { type: 'file', size: 512 },
            metadataKinds: { size: 'size' },
            hasChildren: false
          }
        ]
      })
    );
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type, manifest);
    tester.fixture.detectChanges();
    await expect.element(tester.tree).toBeInTheDocument();

    const values = tester.metadataValues.elements().map(el => el.textContent?.trim());
    expect(values).toContain('512 B');
  });

  test('should format a metadata field tagged "instant" with the datetime pipe rather than showing the raw ISO string', async () => {
    const rawCtime = '2021-01-12T13:35:07.123Z';
    southConnectorService.startExplore.mockReturnValue(
      of({
        sessionId: 'sessionId',
        entries: [
          {
            id: 'file1.csv',
            name: 'file1.csv',
            metadata: { type: 'file', ctime: rawCtime },
            metadataKinds: { ctime: 'instant' },
            hasChildren: false
          }
        ]
      })
    );
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type, manifest);
    tester.fixture.detectChanges();
    await expect.element(tester.tree).toBeInTheDocument();

    const values = tester.metadataValues.elements().map(el => el.textContent?.trim());
    expect(values.some(value => value !== rawCtime && value !== '' && !value?.includes('undefined'))).toBe(true);
  });

  test('should show a metadata field with no kind as plain text', async () => {
    southConnectorService.startExplore.mockReturnValue(
      of({
        sessionId: 'sessionId',
        entries: [{ id: 'a', name: 'a-folder', metadata: { type: 'folder', files: 3 }, hasChildren: true }]
      })
    );
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type, manifest);
    tester.fixture.detectChanges();
    await expect.element(tester.tree).toBeInTheDocument();

    const values = tester.metadataValues.elements().map(el => el.textContent?.trim());
    expect(values).toContain('3');
  });

  test('should default the connector id to create', () => {
    southConnectorService.startExplore.mockReturnValue(of({ sessionId: 'sessionId', entries: [] }));
    tester.component.prepare(null, southConnector.settings, southConnector.type, manifest);
    tester.fixture.detectChanges();

    expect(southConnectorService.startExplore).toHaveBeenCalledWith('create', southConnector.settings, southConnector.type);
  });

  test('should display an empty message when there is nothing to explore', async () => {
    southConnectorService.startExplore.mockReturnValue(of({ sessionId: 'sessionId', entries: [] }));
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type, manifest);
    tester.fixture.detectChanges();

    await expect.element(tester.empty).toBeInTheDocument();
  });

  test('should display an error', async () => {
    southConnectorService.startExplore.mockReturnValue(throwError(() => new HttpErrorResponse({ error: { message: 'boom' } })));
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type, manifest);
    tester.fixture.detectChanges();

    await expect.element(tester.error).toHaveTextContent('boom');
  });

  test('should expand a node and load its children', () => {
    southConnectorService.startExplore.mockReturnValue(
      of({ sessionId: 'sessionId', entries: [{ id: 'parent', name: 'Parent', metadata: { type: 'Object' }, hasChildren: true }] })
    );
    southConnectorService.browseExplore.mockReturnValue(
      of({ entries: [{ id: 'child', name: 'Child', metadata: { type: 'file' }, hasChildren: false }] })
    );
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type, manifest);

    tester.component.toggle(tester.component.nodes[0]);

    expect(southConnectorService.browseExplore).toHaveBeenCalledWith(southConnector.id, 'sessionId', 'parent');
    expect(tester.component.nodes[0].expanded).toBe(true);
    expect(tester.component.nodes[0].children.length).toBe(1);
  });

  test('should collapse an already expanded node', () => {
    southConnectorService.startExplore.mockReturnValue(
      of({ sessionId: 'sessionId', entries: [{ id: 'parent', name: 'Parent', metadata: { type: 'Object' }, hasChildren: true }] })
    );
    southConnectorService.browseExplore.mockReturnValue(
      of({ entries: [{ id: 'child', name: 'Child', metadata: { type: 'file' }, hasChildren: false }] })
    );
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type, manifest);

    tester.component.toggle(tester.component.nodes[0]);
    tester.component.toggle(tester.component.nodes[0]);

    expect(tester.component.nodes[0].expanded).toBe(false);
    // browse only called once — the children were cached
    expect(southConnectorService.browseExplore).toHaveBeenCalledTimes(1);
  });

  test('should re-expand a cached node without browsing again', () => {
    southConnectorService.startExplore.mockReturnValue(
      of({ sessionId: 'sessionId', entries: [{ id: 'parent', name: 'Parent', metadata: { type: 'Object' }, hasChildren: true }] })
    );
    southConnectorService.browseExplore.mockReturnValue(
      of({ entries: [{ id: 'child', name: 'Child', metadata: { type: 'file' }, hasChildren: false }] })
    );
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type, manifest);

    tester.component.toggle(tester.component.nodes[0]);
    tester.component.toggle(tester.component.nodes[0]);
    tester.component.toggle(tester.component.nodes[0]);

    expect(tester.component.nodes[0].expanded).toBe(true);
    expect(southConnectorService.browseExplore).toHaveBeenCalledTimes(1);
  });

  test('should not browse a leaf node', () => {
    southConnectorService.startExplore.mockReturnValue(
      of({ sessionId: 'sessionId', entries: [{ id: 'leaf', name: 'Leaf', metadata: { type: 'file' }, hasChildren: false }] })
    );
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type, manifest);

    tester.component.toggle(tester.component.nodes[0]);

    expect(southConnectorService.browseExplore).not.toHaveBeenCalled();
  });

  test('should surface an error when browsing fails', () => {
    southConnectorService.startExplore.mockReturnValue(
      of({ sessionId: 'sessionId', entries: [{ id: 'parent', name: 'Parent', metadata: { type: 'Object' }, hasChildren: true }] })
    );
    southConnectorService.browseExplore.mockReturnValue(throwError(() => new HttpErrorResponse({ error: { message: 'nope' } })));
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type, manifest);

    tester.component.toggle(tester.component.nodes[0]);

    expect(tester.component.nodes[0].error).toBe('nope');
    expect(tester.component.nodes[0].expanded).toBe(false);
  });

  test('should drop the caret when an expanded node has no children', () => {
    southConnectorService.startExplore.mockReturnValue(
      of({ sessionId: 'sessionId', entries: [{ id: 'parent', name: 'Parent', metadata: { type: 'Object' }, hasChildren: true }] })
    );
    southConnectorService.browseExplore.mockReturnValue(of({ entries: [] }));
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type, manifest);

    tester.component.toggle(tester.component.nodes[0]);

    expect(tester.component.nodes[0].entry.hasChildren).toBe(false);
  });

  test('should dismiss on cancel', async () => {
    southConnectorService.startExplore.mockReturnValue(of({ sessionId: 'sessionId', entries: [] }));
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type, manifest);
    tester.fixture.detectChanges();

    await tester.cancel.click();

    expect(fakeActiveModal.dismiss).toHaveBeenCalled();
  });

  test('should close the session when the modal is destroyed (ESC/backdrop/close)', () => {
    southConnectorService.startExplore.mockReturnValue(of({ sessionId: 'sessionId', entries: [] }));
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type, manifest);
    tester.fixture.detectChanges();

    tester.fixture.destroy();

    expect(southConnectorService.closeExplore).toHaveBeenCalledWith(southConnector.id, 'sessionId');
  });

  test('should not close anything when destroyed without a session', () => {
    tester.fixture.destroy();

    expect(southConnectorService.closeExplore).not.toHaveBeenCalled();
  });

  test('should use a custom api instead of the south connector service when provided', () => {
    const customApi = {
      start: vi.fn().mockReturnValue(of({ sessionId: 'sessionId', entries: [{ id: 'a', name: 'A', metadata: {}, hasChildren: false }] })),
      browse: vi.fn().mockReturnValue(of({ entries: [] })),
      close: vi.fn().mockReturnValue(of(undefined))
    };

    tester.component.prepare('historyId', southConnector.settings, southConnector.type, manifest, customApi);
    tester.fixture.detectChanges();

    expect(customApi.start).toHaveBeenCalledWith(southConnector.settings, southConnector.type);
    expect(southConnectorService.startExplore).not.toHaveBeenCalled();

    tester.fixture.destroy();
    expect(customApi.close).toHaveBeenCalledWith('sessionId');
    expect(southConnectorService.closeExplore).not.toHaveBeenCalled();
  });

  test('toggleSelection should flip a node selected flag', () => {
    southConnectorService.startExplore.mockReturnValue(
      of({ sessionId: 'sessionId', entries: [{ id: 'a', name: 'A', metadata: {}, hasChildren: false }] })
    );
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type, manifest);

    const node = tester.component.nodes[0];
    expect(node.selected).toBe(false);

    tester.component.toggleSelection(node);
    expect(node.selected).toBe(true);

    tester.component.toggleSelection(node);
    expect(node.selected).toBe(false);
  });

  test('selectedNodes should be empty when nothing is selected', () => {
    southConnectorService.startExplore.mockReturnValue(
      of({ sessionId: 'sessionId', entries: [{ id: 'a', name: 'A', metadata: {}, hasChildren: false }] })
    );
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type, manifest);

    expect(tester.component.selectedNodes).toEqual([]);
  });

  test('selectedNodes should aggregate selected entries across a nested tree', () => {
    southConnectorService.startExplore.mockReturnValue(
      of({
        sessionId: 'sessionId',
        entries: [{ id: 'root', name: 'Root', metadata: {}, hasChildren: true }]
      })
    );
    southConnectorService.browseExplore.mockReturnValue(
      of({
        entries: [
          { id: 'child-1', name: 'Child1', metadata: {}, hasChildren: true },
          { id: 'child-2', name: 'Child2', metadata: {}, hasChildren: false }
        ]
      })
    );
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type, manifest);

    const root = tester.component.nodes[0];
    tester.component.toggle(root); // expands and loads child-1, child-2
    const [child1, child2] = root.children;
    child1.children = [
      {
        entry: { id: 'grandchild', name: 'Grandchild', metadata: {}, hasChildren: false },
        depth: 2,
        expanded: false,
        loading: false,
        loaded: false,
        error: null,
        selected: true,
        children: []
      }
    ];

    // Select the root, child-2, and leave child-1 unselected but with a selected grandchild.
    tester.component.toggleSelection(root);
    tester.component.toggleSelection(child2);

    const selectedIds = tester.component.selectedNodes.map(entry => entry.id);
    expect(selectedIds).toEqual(['root', 'grandchild', 'child-2']);
  });

  test('selectAll should select every node across nested levels, and totalLoadedNodeCount should reflect the total', () => {
    southConnectorService.startExplore.mockReturnValue(
      of({
        sessionId: 'sessionId',
        entries: [{ id: 'root', name: 'Root', metadata: {}, hasChildren: true }]
      })
    );
    southConnectorService.browseExplore.mockReturnValue(
      of({
        entries: [
          { id: 'child-1', name: 'Child1', metadata: {}, hasChildren: false },
          { id: 'child-2', name: 'Child2', metadata: {}, hasChildren: false }
        ]
      })
    );
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type, manifest);

    const root = tester.component.nodes[0];
    tester.component.toggle(root); // expands and loads child-1, child-2

    expect(tester.component.totalLoadedNodeCount).toBe(3);

    tester.component.selectAll();

    const selectedIds = tester.component.selectedNodes.map(entry => entry.id).sort();
    expect(selectedIds).toEqual(['child-1', 'child-2', 'root']);
  });

  test('unselectAll should clear every selection across nested levels', () => {
    southConnectorService.startExplore.mockReturnValue(
      of({
        sessionId: 'sessionId',
        entries: [{ id: 'root', name: 'Root', metadata: {}, hasChildren: true }]
      })
    );
    southConnectorService.browseExplore.mockReturnValue(
      of({
        entries: [{ id: 'child-1', name: 'Child1', metadata: {}, hasChildren: false }]
      })
    );
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type, manifest);

    const root = tester.component.nodes[0];
    tester.component.toggle(root);
    tester.component.selectAll();
    expect(tester.component.selectedNodes.length).toBe(2);

    tester.component.unselectAll();

    expect(tester.component.selectedNodes).toEqual([]);
  });

  test('clicking select-all/unselect-all buttons updates the selection through the template', async () => {
    southConnectorService.startExplore.mockReturnValue(
      of({
        sessionId: 'sessionId',
        entries: [
          { id: 'a', name: 'A', metadata: {}, hasChildren: false },
          { id: 'b', name: 'B', metadata: {}, hasChildren: false }
        ]
      })
    );
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type, manifest);
    tester.fixture.detectChanges();

    await tester.selectAllButton.click();
    tester.fixture.detectChanges();

    expect(tester.component.selectedNodes.length).toBe(2);

    await tester.unselectAllButton.click();
    tester.fixture.detectChanges();

    expect(tester.component.selectedNodes.length).toBe(0);
  });

  test('createItemsFromSelection should do nothing when no create-items api was provided', () => {
    southConnectorService.startExplore.mockReturnValue(of({ sessionId: 'sessionId', entries: [] }));
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type, manifest);

    expect(() => tester.component.createItemsFromSelection()).not.toThrow();
    expect(modalService.open).not.toHaveBeenCalled();
  });

  test('the create-from-selection button should be disabled until a node is selected', async () => {
    southConnectorService.startExplore.mockReturnValue(
      of({
        sessionId: 'sessionId',
        entries: [
          { id: 'a', name: 'A', metadata: {}, hasChildren: false },
          { id: 'b', name: 'B', metadata: {}, hasChildren: false }
        ]
      })
    );
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type, manifest, undefined, [], createItemsApi());
    tester.fixture.detectChanges();

    await expect.element(tester.createFromSelectionButton).toBeDisabled();

    await tester.checkbox(0).click();
    tester.fixture.detectChanges();

    await expect.element(tester.createFromSelectionButton).not.toBeDisabled();
    expect(tester.component.selectedNodes.length).toBe(1);
  });

  test('the create-from-selection button should stay disabled without a create-items api, even with a selection', async () => {
    southConnectorService.startExplore.mockReturnValue(
      of({ sessionId: 'sessionId', entries: [{ id: 'a', name: 'A', metadata: {}, hasChildren: false }] })
    );
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type, manifest);
    tester.fixture.detectChanges();

    await tester.checkbox(0).click();
    tester.fixture.detectChanges();

    await expect.element(tester.createFromSelectionButton).toBeDisabled();
  });

  test('createItemsFromSelection opens the item-import wizard with the selection, manifest, and existing items', () => {
    const api = createItemsApi();
    const existingItems = [{ id: 'existing-1', name: 'Existing', settings: {} }];
    const wizardPrepare = vi.fn();
    modalService.open.mockReturnValue({ componentInstance: { prepare: wizardPrepare }, result: of(undefined) } as any);
    southConnectorService.startExplore.mockReturnValue(
      of({ sessionId: 'sessionId', entries: [{ id: 'a', name: 'A', metadata: {}, hasChildren: false }] })
    );
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type, manifest, undefined, existingItems, api);
    tester.component.toggleSelection(tester.component.nodes[0]);

    tester.component.createItemsFromSelection();

    expect(wizardPrepare).toHaveBeenCalledWith(
      manifest,
      api.expectedHeaders,
      api.optionalHeaders,
      tester.component.selectedNodes,
      existingItems,
      api.checkFn
    );
  });

  test('createItemsFromSelection imports the wizard result and closes the explore modal on success', () => {
    const api = createItemsApi();
    const wizardResult = { items: [{ id: '', name: 'New' }], matchKey: 'name' };
    modalService.open.mockReturnValue({ componentInstance: { prepare: vi.fn() }, result: of(wizardResult) } as any);
    southConnectorService.startExplore.mockReturnValue(of({ sessionId: 'sessionId', entries: [] }));
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type, manifest, undefined, [], api);

    tester.component.createItemsFromSelection();

    expect(api.importFn).toHaveBeenCalledWith(wizardResult.items, wizardResult.matchKey);
    expect(fakeActiveModal.close).toHaveBeenCalledWith(wizardResult);
  });
});
