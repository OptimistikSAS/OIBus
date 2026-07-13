import { SouthExploreModalComponent } from './south-explore-modal.component';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { SouthConnectorService } from '../../services/south-connector.service';
import { NEVER, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import testData from '../../../../../backend/src/tests/utils/test-data';
import { beforeEach, describe, expect, test } from 'vitest';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { page } from 'vitest/browser';

class SouthExploreModalComponentTester {
  readonly fixture = TestBed.createComponent(SouthExploreModalComponent);
  readonly component = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly spinner = this.root.getByCss('#spinner');
  readonly error = this.root.getByCss('#explore-error');
  readonly empty = this.root.getByCss('#explore-empty');
  readonly tree = this.root.getByCss('#explore-tree');
  readonly cancel = this.root.getByRole('button', { name: 'Close' });
  readonly typeBadges = this.root.getByCss('.explore-type');
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
  });

  test('should be loading', async () => {
    southConnectorService.startExplore.mockReturnValue(NEVER);
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type);
    tester.fixture.detectChanges();
    await expect.element(tester.spinner).toBeInTheDocument();
  });

  test('should display the root entries', async () => {
    southConnectorService.startExplore.mockReturnValue(
      of({ sessionId: 'sessionId', entries: [{ id: 'ns=0;i=85', name: 'Objects', type: 'Object', hasChildren: true }] })
    );
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type);
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
          { id: 'a', name: 'a-folder', type: 'folder', hasChildren: true },
          { id: 'b', name: 'b-file', type: 'file', hasChildren: false }
        ]
      })
    );
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type);
    tester.fixture.detectChanges();
    await expect.element(tester.tree).toBeInTheDocument();

    expect(tester.typeBadges.elements().length).toBe(2);
  });

  test('should keep the entry type unchanged when a node optimistically marked expandable turns out to have no children', () => {
    // Reproduces browsing a "Variable" node (e.g. Float, GUID): the backend optimistically marks
    // it hasChildren:true, and browsing it back with zero entries flips hasChildren to false.
    // The type badge must still read "Variable" — hasChildren is a separate, corrected flag.
    southConnectorService.startExplore.mockReturnValue(
      of({ sessionId: 'sessionId', entries: [{ id: 'ns=1;s=Temperature', name: 'Temperature', type: 'Variable', hasChildren: true }] })
    );
    southConnectorService.browseExplore.mockReturnValue(of({ entries: [] }));
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type);

    tester.component.toggle(tester.component.nodes[0]);

    expect(tester.component.nodes[0].entry.type).toBe('Variable');
    expect(tester.component.nodes[0].entry.hasChildren).toBe(false);
  });

  test('should default the connector id to create', () => {
    southConnectorService.startExplore.mockReturnValue(of({ sessionId: 'sessionId', entries: [] }));
    tester.component.prepare(null, southConnector.settings, southConnector.type);
    tester.fixture.detectChanges();

    expect(southConnectorService.startExplore).toHaveBeenCalledWith('create', southConnector.settings, southConnector.type);
  });

  test('should display an empty message when there is nothing to explore', async () => {
    southConnectorService.startExplore.mockReturnValue(of({ sessionId: 'sessionId', entries: [] }));
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type);
    tester.fixture.detectChanges();

    await expect.element(tester.empty).toBeInTheDocument();
  });

  test('should display an error', async () => {
    southConnectorService.startExplore.mockReturnValue(throwError(() => new HttpErrorResponse({ error: { message: 'boom' } })));
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type);
    tester.fixture.detectChanges();

    await expect.element(tester.error).toHaveTextContent('boom');
  });

  test('should expand a node and load its children', () => {
    southConnectorService.startExplore.mockReturnValue(
      of({ sessionId: 'sessionId', entries: [{ id: 'parent', name: 'Parent', type: 'Object', hasChildren: true }] })
    );
    southConnectorService.browseExplore.mockReturnValue(
      of({ entries: [{ id: 'child', name: 'Child', type: 'file', hasChildren: false }] })
    );
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type);

    tester.component.toggle(tester.component.nodes[0]);

    expect(southConnectorService.browseExplore).toHaveBeenCalledWith(southConnector.id, 'sessionId', 'parent');
    expect(tester.component.nodes[0].expanded).toBe(true);
    expect(tester.component.nodes[0].children.length).toBe(1);
  });

  test('should collapse an already expanded node', () => {
    southConnectorService.startExplore.mockReturnValue(
      of({ sessionId: 'sessionId', entries: [{ id: 'parent', name: 'Parent', type: 'Object', hasChildren: true }] })
    );
    southConnectorService.browseExplore.mockReturnValue(
      of({ entries: [{ id: 'child', name: 'Child', type: 'file', hasChildren: false }] })
    );
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type);

    tester.component.toggle(tester.component.nodes[0]);
    tester.component.toggle(tester.component.nodes[0]);

    expect(tester.component.nodes[0].expanded).toBe(false);
    // browse only called once — the children were cached
    expect(southConnectorService.browseExplore).toHaveBeenCalledTimes(1);
  });

  test('should re-expand a cached node without browsing again', () => {
    southConnectorService.startExplore.mockReturnValue(
      of({ sessionId: 'sessionId', entries: [{ id: 'parent', name: 'Parent', type: 'Object', hasChildren: true }] })
    );
    southConnectorService.browseExplore.mockReturnValue(
      of({ entries: [{ id: 'child', name: 'Child', type: 'file', hasChildren: false }] })
    );
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type);

    tester.component.toggle(tester.component.nodes[0]);
    tester.component.toggle(tester.component.nodes[0]);
    tester.component.toggle(tester.component.nodes[0]);

    expect(tester.component.nodes[0].expanded).toBe(true);
    expect(southConnectorService.browseExplore).toHaveBeenCalledTimes(1);
  });

  test('should not browse a leaf node', () => {
    southConnectorService.startExplore.mockReturnValue(
      of({ sessionId: 'sessionId', entries: [{ id: 'leaf', name: 'Leaf', type: 'file', hasChildren: false }] })
    );
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type);

    tester.component.toggle(tester.component.nodes[0]);

    expect(southConnectorService.browseExplore).not.toHaveBeenCalled();
  });

  test('should surface an error when browsing fails', () => {
    southConnectorService.startExplore.mockReturnValue(
      of({ sessionId: 'sessionId', entries: [{ id: 'parent', name: 'Parent', type: 'Object', hasChildren: true }] })
    );
    southConnectorService.browseExplore.mockReturnValue(throwError(() => new HttpErrorResponse({ error: { message: 'nope' } })));
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type);

    tester.component.toggle(tester.component.nodes[0]);

    expect(tester.component.nodes[0].error).toBe('nope');
    expect(tester.component.nodes[0].expanded).toBe(false);
  });

  test('should drop the caret when an expanded node has no children', () => {
    southConnectorService.startExplore.mockReturnValue(
      of({ sessionId: 'sessionId', entries: [{ id: 'parent', name: 'Parent', type: 'Object', hasChildren: true }] })
    );
    southConnectorService.browseExplore.mockReturnValue(of({ entries: [] }));
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type);

    tester.component.toggle(tester.component.nodes[0]);

    expect(tester.component.nodes[0].entry.hasChildren).toBe(false);
  });

  test('should dismiss on cancel', async () => {
    southConnectorService.startExplore.mockReturnValue(of({ sessionId: 'sessionId', entries: [] }));
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type);
    tester.fixture.detectChanges();

    await tester.cancel.click();

    expect(fakeActiveModal.dismiss).toHaveBeenCalled();
  });

  test('should close the session when the modal is destroyed (ESC/backdrop/close)', () => {
    southConnectorService.startExplore.mockReturnValue(of({ sessionId: 'sessionId', entries: [] }));
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type);
    tester.fixture.detectChanges();

    tester.fixture.destroy();

    expect(southConnectorService.closeExplore).toHaveBeenCalledWith(southConnector.id, 'sessionId');
  });

  test('should not close anything when destroyed without a session', () => {
    tester.fixture.destroy();

    expect(southConnectorService.closeExplore).not.toHaveBeenCalled();
  });
});
