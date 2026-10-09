import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { NEVER, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { SouthConnectorExploreEntry, SouthConnectorExploreFieldKind } from '@oibus/shared/domain/south-connector.model';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import testData from '../../../test/test-data';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { SouthConnectorService } from '../../services/south-connector.service';
import { provideCurrentUser } from '../current-user-testing';
import { ExploreTreeComponent, SouthExploreApi } from './explore-tree.component';

class ExploreTreeComponentTester {
  readonly fixture = TestBed.createComponent(ExploreTreeComponent);
  readonly component = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly spinner = this.root.getByRole('status');
  readonly error = this.root.getByCss('#explore-error');
  readonly empty = this.root.getByCss('#explore-empty');
  readonly tree = this.root.getByCss('#explore-tree');
  readonly nodes = this.root.getByCss('.explore-node');
  readonly metadataValues = this.root.getByCss('.explore-metadata-value');
  readonly selectButtons = this.root.getByRole('button', { name: 'Select' });
  readonly nodeErrors = this.root.getByCss('.explore-node-error');

  toggleButton(name: string) {
    return this.root.getByRole('button', { name: new RegExp(`^${name}`) });
  }

  node(name: string) {
    return this.nodes.filter({ hasText: name });
  }
}

function entry(
  id: string,
  hasChildren: boolean,
  metadata: SouthConnectorExploreEntry['metadata'] = { type: 'Object' }
): SouthConnectorExploreEntry {
  return { id, name: id, metadata, hasChildren };
}

describe('ExploreTreeComponent', () => {
  let tester: ExploreTreeComponentTester;
  let southConnectorService: MockObject<SouthConnectorService>;

  const southConnector = testData.south.list[0];

  beforeEach(() => {
    southConnectorService = createMock(SouthConnectorService);
    southConnectorService.closeExplore.mockReturnValue(of(undefined));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideCurrentUser({ ...testData.users.list[0], timezone: 'UTC' }),
        { provide: SouthConnectorService, useValue: southConnectorService }
      ]
    });

    tester = new ExploreTreeComponentTester();
  });

  function prepareWith(entries: Array<SouthConnectorExploreEntry>, selectable = false) {
    southConnectorService.startExplore.mockReturnValue(of({ sessionId: 'sessionId', entries }));
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type, undefined, selectable);
  }

  test('should be loading', async () => {
    southConnectorService.startExplore.mockReturnValue(NEVER);
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type);
    await expect.element(tester.spinner).toBeInTheDocument();
  });

  test('should size the tree with the max height', async () => {
    tester.fixture.componentRef.setInput('maxHeight', '150px');
    prepareWith([entry('Objects', true)]);

    await expect.element(tester.tree).toHaveStyle('max-height: 150px');
  });

  test('should display the root entries', async () => {
    prepareWith([entry('Objects', true), entry('Server', false)]);

    expect(southConnectorService.startExplore).toHaveBeenCalledWith(southConnector.id, southConnector.settings, southConnector.type);
    await expect.element(tester.nodes).toHaveLength(2);
    await expect.element(tester.toggleButton('Objects')).toBeVisible();
    // a leaf can't be expanded
    await expect.element(tester.toggleButton('Server')).not.toBeInTheDocument();
    await expect.element(tester.node('Server')).toHaveTextContent('Servertype Object');
  });

  test('should always show the type badge, including for folder/file entries', async () => {
    prepareWith([entry('a-folder', true, { type: 'folder' }), entry('b-file', false, { type: 'file' })]);

    await expect.element(tester.metadataValues).toHaveLength(2);
    await expect.element(tester.metadataValues.nth(0)).toHaveTextContent('folder');
    await expect.element(tester.metadataValues.nth(1)).toHaveTextContent('file');
  });

  test.each<{ kind: SouthConnectorExploreFieldKind | undefined; value: string | number; expected: string }>([
    { kind: 'size', value: 512, expected: '512 B' },
    { kind: 'instant', value: '2021-01-12T13:35:07.123Z', expected: '12 Jan 2021, 13:35:07.123' },
    { kind: undefined, value: 3, expected: '3' }
  ])('should format a metadata field of kind $kind', async ({ kind, value, expected }) => {
    prepareWith([
      {
        id: 'file1.csv',
        name: 'file1.csv',
        metadata: { field: value },
        metadataKinds: kind ? { field: kind } : undefined,
        hasChildren: false
      }
    ]);

    await expect.element(tester.metadataValues).toHaveTextContent(expected);
  });

  test('should default the connector id to create', () => {
    southConnectorService.startExplore.mockReturnValue(of({ sessionId: 'sessionId', entries: [] }));

    tester.component.prepare(null, southConnector.settings, southConnector.type);

    expect(southConnectorService.startExplore).toHaveBeenCalledWith('create', southConnector.settings, southConnector.type);
  });

  test('should display an empty message when there is nothing to explore', async () => {
    prepareWith([]);
    await expect.element(tester.empty).toHaveTextContent('Nothing to explore');
  });

  test('should display an error', async () => {
    southConnectorService.startExplore.mockReturnValue(throwError(() => new HttpErrorResponse({ error: { message: 'boom' } })));
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type);
    await expect.element(tester.error).toMatchTextContent(/boom$/);
  });

  describe('when a node is clicked', () => {
    beforeEach(() => {
      prepareWith([entry('Objects', true), entry('Types', true)]);
    });

    test('should display a spinner while loading the children', async () => {
      southConnectorService.browseExplore.mockReturnValue(NEVER);

      await tester.toggleButton('Objects').click();

      await expect.element(tester.node('Objects').getByCss('.spinner-border')).toBeInTheDocument();
    });

    test('should expand a node and load its children', async () => {
      southConnectorService.browseExplore.mockReturnValue(of({ entries: [entry('Server', false)] }));

      await tester.toggleButton('Objects').click();

      expect(southConnectorService.browseExplore).toHaveBeenCalledWith(southConnector.id, 'sessionId', 'Objects');
      await expect.element(tester.nodes).toHaveLength(3);
      await expect.element(tester.nodes.nth(1)).toHaveTextContent('Servertype Object');
      await expect.element(tester.nodes.nth(1).getByCss('.explore-indent')).toHaveLength(1);
      await expect.element(tester.node('Objects').getByCss('.fa-caret-down')).toBeInTheDocument();
    });

    test('should load the children of a child node', async () => {
      southConnectorService.browseExplore.mockReturnValueOnce(of({ entries: [entry('Server', true)] }));
      southConnectorService.browseExplore.mockReturnValueOnce(of({ entries: [entry('Status', false)] }));

      await tester.toggleButton('Objects').click();
      await tester.toggleButton('Server').click();

      expect(southConnectorService.browseExplore).toHaveBeenLastCalledWith(southConnector.id, 'sessionId', 'Server');
      await expect.element(tester.nodes).toHaveLength(4);
      await expect.element(tester.nodes.nth(2)).toHaveTextContent('Statustype Object');
      await expect.element(tester.nodes.nth(2).getByCss('.explore-indent')).toHaveLength(2);
    });

    test('should collapse an expanded node, and re-expand it without browsing again', async () => {
      southConnectorService.browseExplore.mockReturnValue(of({ entries: [entry('Server', false)] }));
      await tester.toggleButton('Objects').click();
      await expect.element(tester.nodes).toHaveLength(3);

      await tester.toggleButton('Objects').click();
      await expect.element(tester.nodes).toHaveLength(2);
      await expect.element(tester.node('Objects').getByCss('.fa-caret-right')).toBeInTheDocument();

      await tester.toggleButton('Objects').click();
      await expect.element(tester.nodes).toHaveLength(3);
      expect(southConnectorService.browseExplore).toHaveBeenCalledTimes(1);
    });

    test('should surface an error when browsing fails, and allow to retry', async () => {
      southConnectorService.browseExplore.mockReturnValueOnce(
        throwError(() => new HttpErrorResponse({ error: { message: 'browse failed' } }))
      );

      await tester.toggleButton('Objects').click();

      await expect.element(tester.nodeErrors).toHaveTextContent('browse failed');
      await expect.element(tester.nodeErrors.getByCss('.explore-indent')).toHaveLength(1);
      await expect.element(tester.nodes).toHaveLength(2);

      southConnectorService.browseExplore.mockReturnValue(of({ entries: [entry('Server', false)] }));
      await tester.toggleButton('Objects').click();

      await expect.element(tester.nodeErrors).not.toBeInTheDocument();
      await expect.element(tester.nodes).toHaveLength(3);
    });

    test('should drop the caret but keep the type when an expandable node has no children', async () => {
      southConnectorService.browseExplore.mockReturnValue(of({ entries: [] }));

      await tester.toggleButton('Objects').click();

      await expect.element(tester.toggleButton('Objects')).not.toBeInTheDocument();
      await expect.element(tester.node('Objects')).toHaveTextContent('Objectstype Object');
      await expect.element(tester.toggleButton('Types')).toBeVisible();
    });
  });

  test('should not render a Select action by default (read-only browsing)', async () => {
    prepareWith([entry('Objects', true), entry('Server', false)]);

    await expect.element(tester.nodes).toHaveLength(2);
    await expect.element(tester.selectButtons).toHaveLength(0);
  });

  test('should render a Select action on expandable nodes only, and emit the selected entry when clicked', async () => {
    const selected: Array<SouthConnectorExploreEntry> = [];
    tester.component.nodeSelected.subscribe(selectedEntry => selected.push(selectedEntry));
    prepareWith([entry('Objects', true), entry('Server', false)], true);

    await expect.element(tester.selectButtons).toHaveLength(1);
    await tester.node('Objects').getByRole('button', { name: 'Select' }).click();

    expect(selected).toEqual([entry('Objects', true)]);
    expect(southConnectorService.browseExplore).not.toHaveBeenCalled();
  });

  test('should close the session when the component is destroyed', async () => {
    prepareWith([entry('Objects', true)]);
    await expect.element(tester.nodes).toHaveLength(1);

    tester.fixture.destroy();

    expect(southConnectorService.closeExplore).toHaveBeenCalledWith(southConnector.id, 'sessionId');
  });

  test('should not close anything when destroyed without a session', () => {
    tester.fixture.destroy();

    expect(southConnectorService.closeExplore).not.toHaveBeenCalled();
  });

  test('should use a custom api instead of the south connector service when provided', async () => {
    const api: SouthExploreApi = {
      start: vi.fn().mockReturnValue(of({ sessionId: 'customSession', entries: [entry('Objects', true)] })),
      browse: vi.fn().mockReturnValue(of({ entries: [entry('Server', false)] })),
      close: vi.fn().mockReturnValue(of(undefined))
    };

    tester.component.prepare(null, southConnector.settings, southConnector.type, api);
    await tester.toggleButton('Objects').click();
    await expect.element(tester.nodes).toHaveLength(2);
    tester.fixture.destroy();

    expect(api.start).toHaveBeenCalledWith(southConnector.settings, southConnector.type);
    expect(api.browse).toHaveBeenCalledWith('customSession', 'Objects');
    expect(api.close).toHaveBeenCalledWith('customSession');
    expect(southConnectorService.startExplore).not.toHaveBeenCalled();
  });
});
