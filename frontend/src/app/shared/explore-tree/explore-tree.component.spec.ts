import { Clipboard } from '@angular/cdk/clipboard';
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
import { NotificationService } from '../notification.service';
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
  readonly nodeErrors = this.root.getByCss('.explore-node-error');
  readonly details = this.root.getByCss('#explore-details');
  readonly detailsName = this.root.getByCss('.explore-details-name');
  readonly detailLabels = this.root.getByCss('.explore-details-fields dt');
  readonly detailValues = this.root.getByCss('.explore-details-value');

  /** The row of the node, which shows its details (its accessible name starts with the node name) */
  row(name: string) {
    return this.root.getByRole('button', { name: new RegExp(`^${name}`) });
  }

  expandButton(name: string) {
    return this.root.getByRole('button', { name: `Expand ${name}` });
  }

  collapseButton(name: string) {
    return this.root.getByRole('button', { name: `Collapse ${name}` });
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
  let notificationService: MockObject<NotificationService>;
  let clipboard: MockObject<Clipboard>;

  const southConnector = testData.south.list[0];

  beforeEach(() => {
    southConnectorService = createMock(SouthConnectorService);
    southConnectorService.closeExplore.mockReturnValue(of(undefined));
    notificationService = createMock(NotificationService);
    clipboard = createMock(Clipboard);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideCurrentUser({ ...testData.users.list[0], timezone: 'UTC' }),
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: NotificationService, useValue: notificationService },
        { provide: Clipboard, useValue: clipboard }
      ]
    });

    tester = new ExploreTreeComponentTester();
  });

  function prepareWith(entries: Array<SouthConnectorExploreEntry>) {
    southConnectorService.startExplore.mockReturnValue(of({ sessionId: 'sessionId', entries }));
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type);
  }

  test('should be loading', async () => {
    southConnectorService.startExplore.mockReturnValue(NEVER);
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type);
    await expect.element(tester.spinner).toBeInTheDocument();
  });

  test('should size the tree and the details panel with the max height', async () => {
    tester.fixture.componentRef.setInput('maxHeight', '150px');
    prepareWith([entry('Objects', true)]);

    await expect.element(tester.tree).toHaveStyle({ maxHeight: '150px' });
    await expect.element(tester.details).toHaveStyle({ maxHeight: '150px' });
  });

  test('should display the root entries with their type', async () => {
    prepareWith([entry('Objects', true), entry('Server', false)]);

    expect(southConnectorService.startExplore).toHaveBeenCalledWith(southConnector.id, southConnector.settings, southConnector.type);
    await expect.element(tester.nodes).toHaveLength(2);
    await expect.element(tester.expandButton('Objects')).toBeVisible();
    // a leaf can't be expanded
    await expect.element(tester.expandButton('Server')).not.toBeInTheDocument();
    await expect.element(tester.node('Server')).toHaveTextContent('ServerObject');
    await expect.element(tester.details).toHaveTextContent('Select a node to see its details');
  });

  test('should show the BACnet object type as the type, and nothing when there is no type', async () => {
    prepareWith([entry('Analog input 1', false, { objectType: 'analog-input', objectInstance: 1 }), entry('Table', false, { rows: 3 })]);

    await expect.element(tester.node('Analog input 1')).toHaveTextContent('Analog input 1analog-input');
    await expect.element(tester.node('Table')).toMatchTextContent(/^Table$/);
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

  describe('details', () => {
    test('should list the metadata of the selected node, in the order sent, with readable labels', async () => {
      prepareWith([
        entry('Temperature', false, { nodeId: 'ns=3;i=1001', type: 'Variable', description: 'Simulated sensor', customField: 'x' }),
        entry('Pressure', false)
      ]);

      await tester.row('Temperature').click();

      await expect.element(tester.detailsName).toHaveTextContent('Temperature');
      await expect.element(tester.detailLabels).toHaveLength(4);
      expect(tester.detailLabels.elements().map(element => element.textContent)).toEqual([
        'Node ID',
        'Type',
        'Description',
        'Custom field'
      ]);
      expect(tester.detailValues.elements().map(element => element.textContent!.trim())).toEqual([
        'ns=3;i=1001',
        'Variable',
        'Simulated sensor',
        'x'
      ]);
      await expect.element(tester.row('Temperature')).toHaveAttribute('aria-current', 'true');
      await expect.element(tester.row('Pressure')).not.toHaveAttribute('aria-current');
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

      await tester.row('file1.csv').click();

      await expect.element(tester.detailValues).toHaveTextContent(expected);
    });

    test('should copy a field value, and notify the result', async () => {
      clipboard.copy.mockReturnValueOnce(true).mockReturnValueOnce(false);
      prepareWith([entry('Temperature', false, { nodeId: 'ns=3;i=1001' })]);
      await tester.row('Temperature').click();

      await tester.root.getByRole('button', { name: 'Copy Node ID' }).click();
      expect(clipboard.copy).toHaveBeenCalledWith('ns=3;i=1001');
      expect(notificationService.success).toHaveBeenCalledWith('south.explore.copied');

      await tester.root.getByRole('button', { name: 'Copy Node ID' }).click();
      expect(notificationService.error).toHaveBeenCalledWith('south.explore.copy-error');
    });
  });

  describe('browsing', () => {
    beforeEach(() => {
      prepareWith([entry('Objects', true), entry('Types', true)]);
    });

    test('should display a spinner while loading the children', async () => {
      southConnectorService.browseExplore.mockReturnValue(NEVER);

      await tester.expandButton('Objects').click();

      await expect.element(tester.node('Objects').getByCss('.spinner-border')).toBeInTheDocument();
    });

    test('should expand a node and load its children', async () => {
      southConnectorService.browseExplore.mockReturnValue(of({ entries: [entry('Server', false)] }));

      await tester.expandButton('Objects').click();

      expect(southConnectorService.browseExplore).toHaveBeenCalledWith(southConnector.id, 'sessionId', 'Objects');
      await expect.element(tester.nodes).toHaveLength(3);
      await expect.element(tester.nodes.nth(1)).toHaveTextContent('ServerObject');
      await expect.element(tester.nodes.nth(1).getByCss('.explore-indent')).toHaveLength(1);
      await expect.element(tester.collapseButton('Objects')).toHaveAttribute('aria-expanded', 'true');
    });

    test('should expand a node when its row is clicked, but never collapse it', async () => {
      southConnectorService.browseExplore.mockReturnValue(of({ entries: [entry('Server', false)] }));

      await tester.row('Objects').click();
      await expect.element(tester.nodes).toHaveLength(3);
      await expect.element(tester.detailsName).toHaveTextContent('Objects');

      await tester.row('Objects').click();
      await expect.element(tester.nodes).toHaveLength(3);
      expect(southConnectorService.browseExplore).toHaveBeenCalledTimes(1);
    });

    test('should load the children of a child node', async () => {
      southConnectorService.browseExplore.mockReturnValueOnce(of({ entries: [entry('Server', true)] }));
      southConnectorService.browseExplore.mockReturnValueOnce(of({ entries: [entry('Status', false)] }));

      await tester.expandButton('Objects').click();
      await tester.expandButton('Server').click();

      expect(southConnectorService.browseExplore).toHaveBeenLastCalledWith(southConnector.id, 'sessionId', 'Server');
      await expect.element(tester.nodes).toHaveLength(4);
      await expect.element(tester.nodes.nth(2)).toHaveTextContent('StatusObject');
      await expect.element(tester.nodes.nth(2).getByCss('.explore-indent')).toHaveLength(2);
    });

    test('should collapse an expanded node, and re-expand it without browsing again', async () => {
      southConnectorService.browseExplore.mockReturnValue(of({ entries: [entry('Server', false)] }));
      await tester.expandButton('Objects').click();
      await expect.element(tester.nodes).toHaveLength(3);

      await tester.collapseButton('Objects').click();
      await expect.element(tester.nodes).toHaveLength(2);
      await expect.element(tester.expandButton('Objects')).toHaveAttribute('aria-expanded', 'false');

      await tester.expandButton('Objects').click();
      await expect.element(tester.nodes).toHaveLength(3);
      expect(southConnectorService.browseExplore).toHaveBeenCalledTimes(1);
    });

    test('should keep showing the details of a selected child when its parent is collapsed and re-expanded', async () => {
      southConnectorService.browseExplore.mockReturnValue(of({ entries: [entry('Server', false, { nodeId: 'ns=0;i=2253' })] }));
      await tester.expandButton('Objects').click();
      await tester.row('Server').click();

      await tester.collapseButton('Objects').click();
      await expect.element(tester.detailsName).toHaveTextContent('Server');

      await tester.expandButton('Objects').click();
      await expect.element(tester.row('Server')).toHaveAttribute('aria-current', 'true');
    });

    test('should surface an error when browsing fails, and allow to retry', async () => {
      southConnectorService.browseExplore.mockReturnValueOnce(
        throwError(() => new HttpErrorResponse({ error: { message: 'browse failed' } }))
      );

      await tester.expandButton('Objects').click();

      await expect.element(tester.nodeErrors).toHaveTextContent('browse failed');
      await expect.element(tester.nodeErrors.getByCss('.explore-indent')).toHaveLength(1);
      await expect.element(tester.nodes).toHaveLength(2);

      southConnectorService.browseExplore.mockReturnValue(of({ entries: [entry('Server', false)] }));
      await tester.expandButton('Objects').click();

      await expect.element(tester.nodeErrors).not.toBeInTheDocument();
      await expect.element(tester.nodes).toHaveLength(3);
    });

    test('should drop the caret but keep the type when an expandable node has no children', async () => {
      southConnectorService.browseExplore.mockReturnValue(of({ entries: [] }));

      await tester.expandButton('Objects').click();

      await expect.element(tester.expandButton('Objects')).not.toBeInTheDocument();
      await expect.element(tester.collapseButton('Objects')).not.toBeInTheDocument();
      await expect.element(tester.node('Objects')).toHaveTextContent('ObjectsObject');
      await expect.element(tester.expandButton('Types')).toBeVisible();
    });
  });

  describe('checkable nodes', () => {
    test('should not show any checkbox by default', async () => {
      prepareWith([entry('Objects', true)]);

      await expect.element(tester.nodes).toHaveLength(1);
      await expect.element(tester.root.getByRole('checkbox')).not.toBeInTheDocument();
    });

    test('should check and uncheck any node, without selecting nor expanding it', async () => {
      southConnectorService.startExplore.mockReturnValue(
        of({ sessionId: 'sessionId', entries: [entry('Objects', true), entry('Server', false)] })
      );
      tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type, { checkable: true });

      await tester.root.getByRole('checkbox', { name: 'Select Objects' }).click();
      await tester.root.getByRole('checkbox', { name: 'Select Server' }).click();
      expect(Array.from(tester.component.checkedIds())).toEqual(['Objects', 'Server']);
      expect(southConnectorService.browseExplore).not.toHaveBeenCalled();
      await expect.element(tester.details).toHaveTextContent('Select a node to see its details');

      await tester.root.getByRole('checkbox', { name: 'Select Objects' }).click();
      expect(Array.from(tester.component.checkedIds())).toEqual(['Server']);
    });

    describe('sub-nodes', () => {
      beforeEach(() => {
        southConnectorService.startExplore.mockReturnValue(
          of({ sessionId: 'sessionId', entries: [entry('Objects', true), entry('Server', false)] })
        );
      });

      function checkbox(name: string) {
        return tester.root.getByRole('checkbox', { name: `Select ${name}` });
      }

      test('should offer to select the sub-nodes of a node with sub-nodes only, when nodes can be checked', async () => {
        tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type, { checkable: true });

        await expect.element(tester.root.getByRole('button', { name: 'Select all the sub-nodes of Objects' })).toBeInTheDocument();
        await expect.element(tester.root.getByRole('button', { name: 'Select all the sub-nodes of Server' })).not.toBeInTheDocument();
      });

      test('should not offer it when nodes can not be checked', async () => {
        prepareWith([entry('Objects', true)]);

        await expect.element(tester.nodes).toHaveLength(1);
        await expect.element(tester.root.getByRole('button', { name: 'Select all the sub-nodes of Objects' })).not.toBeInTheDocument();
      });

      test('should load the sub-nodes to select them all, then unselect them all', async () => {
        southConnectorService.browseExplore.mockReturnValue(of({ entries: [entry('Temperature', false), entry('Pressure', false)] }));
        tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type, { checkable: true });

        await tester.root.getByRole('button', { name: 'Select all the sub-nodes of Objects' }).click();

        expect(southConnectorService.browseExplore).toHaveBeenCalledWith(southConnector.id, 'sessionId', 'Objects');
        await expect.element(checkbox('Temperature')).toBeChecked();
        await expect.element(checkbox('Pressure')).toBeChecked();
        // the node itself is left as it was
        await expect.element(checkbox('Objects')).not.toBeChecked();

        await tester.root.getByRole('button', { name: 'Unselect all the sub-nodes of Objects' }).click();

        await expect.element(checkbox('Temperature')).not.toBeChecked();
        await expect.element(checkbox('Pressure')).not.toBeChecked();
        expect(southConnectorService.browseExplore).toHaveBeenCalledTimes(1);
      });

      test('should select the remaining sub-nodes when only some are, and expand a collapsed node without browsing again', async () => {
        southConnectorService.browseExplore.mockReturnValue(of({ entries: [entry('Temperature', false), entry('Pressure', false)] }));
        tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type, { checkable: true });
        await tester.expandButton('Objects').click();
        await checkbox('Temperature').click();
        await tester.collapseButton('Objects').click();
        await expect.element(tester.nodes).toHaveLength(2);

        await tester.root.getByRole('button', { name: 'Select all the sub-nodes of Objects' }).click();

        await expect.element(tester.nodes).toHaveLength(4);
        await expect.element(checkbox('Temperature')).toBeChecked();
        await expect.element(checkbox('Pressure')).toBeChecked();
        expect(southConnectorService.browseExplore).toHaveBeenCalledTimes(1);
      });
    });

    test('should start with the given nodes checked', async () => {
      southConnectorService.startExplore.mockReturnValue(
        of({ sessionId: 'sessionId', entries: [entry('Objects', true), entry('Server', false)] })
      );
      tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type, {
        checkable: true,
        checkedIds: ['Server']
      });

      await expect.element(tester.root.getByRole('checkbox', { name: 'Select Server' })).toBeChecked();
      await expect.element(tester.root.getByRole('checkbox', { name: 'Select Objects' })).not.toBeChecked();
    });
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

    tester.component.prepare(null, southConnector.settings, southConnector.type, { api });
    await tester.expandButton('Objects').click();
    await expect.element(tester.nodes).toHaveLength(2);
    tester.fixture.destroy();

    expect(api.start).toHaveBeenCalledWith(southConnector.settings, southConnector.type);
    expect(api.browse).toHaveBeenCalledWith('customSession', 'Objects');
    expect(api.close).toHaveBeenCalledWith('customSession');
    expect(southConnectorService.startExplore).not.toHaveBeenCalled();
  });
});
