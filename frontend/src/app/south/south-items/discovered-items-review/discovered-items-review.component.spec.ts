import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { SouthConnectorItemCommandDTO } from '@oibus/shared/api/south-connector.model';
import { SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';
import { SouthFolderScannerItemSettings, SouthItemSettings } from '@oibus/shared/connector/south-settings.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import testData from '../../../../test/test-data';
import { DiscoveredItemsReviewComponent } from './discovered-items-review.component';

class DiscoveredItemsReviewComponentTester {
  readonly fixture = TestBed.createComponent(DiscoveredItemsReviewComponent);
  readonly component = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly rows = this.root.getByCss('#discovered-items-table tbody tr');
  readonly headers = this.root.getByCss('#discovered-items-table thead th');
  readonly names = this.root.getByCss('.discovered-item-name');
  readonly included = this.root.getByCss('.discovered-item-included');
  readonly selectAll = this.root.getByCss('#discovered-items-all');
  readonly count = this.root.getByCss('#discovered-items-count');

  show(
    commands: Array<SouthConnectorItemCommandDTO>,
    existingItems: Array<{ name: string; settings: SouthItemSettings }> = [],
    manifest: SouthConnectorManifest = defaultManifest
  ) {
    this.fixture.componentRef.setInput('commands', commands);
    this.fixture.componentRef.setInput('manifest', manifest);
    this.fixture.componentRef.setInput('existingItems', existingItems);
    this.fixture.detectChanges();
  }
}

const defaultManifest: SouthConnectorManifest = {
  ...testData.south.manifest,
  discovery: { kind: 'tree', defaults: { identityKeyFields: ['id'], itemFieldMapping: { name: '{{path}}', 'settings.regex': '{{id}}' } } }
};

function discovered(name: string, regex: string): SouthConnectorItemCommandDTO {
  const command = testData.south.itemCommand;
  return { ...command, id: null, name, scanModeId: null, settings: { ...(command.settings as SouthFolderScannerItemSettings), regex } };
}

describe('DiscoveredItemsReviewComponent', () => {
  let tester: DiscoveredItemsReviewComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    tester = new DiscoveredItemsReviewComponentTester();
  });

  test('should list the items with the settings that tell them apart, all included', async () => {
    tester.show([discovered('folder/a', 'a.csv'), discovered('folder/b', 'b.csv')]);

    await expect.element(tester.rows).toHaveLength(2);
    await expect.element(tester.names.nth(0)).toHaveValue('folder/a');
    // the include checkbox, the name, the regex - the only setting that differs - and the status column
    await expect.element(tester.headers).toHaveLength(4);
    await expect.element(tester.rows.nth(1)).toMatchTextContent('b.csv');
    await expect.element(tester.count).toHaveTextContent('Selected items: 2 of 2');
    expect(tester.component.valid()).toBe(true);
  });

  test('should list a nested setting under its own label, a select or boolean value translated, as SQL items have', async () => {
    const trackingManifest: SouthConnectorManifest = {
      ...defaultManifest,
      items: {
        ...defaultManifest.items,
        rootAttribute: {
          ...defaultManifest.items.rootAttribute,
          attributes: defaultManifest.items.rootAttribute.attributes.map(attribute =>
            attribute.key === 'settings' && attribute.type === 'object'
              ? {
                  ...attribute,
                  attributes: [
                    ...attribute.attributes,
                    {
                      type: 'object',
                      key: 'trackingInstant',
                      translationKey: 'configuration.oibus.manifest.south.items.mssql.tracking-instant.title',
                      displayProperties: { visible: true, wrapInBox: false },
                      enablingConditions: [],
                      validators: [],
                      attributes: [
                        {
                          type: 'boolean',
                          key: 'trackInstant',
                          translationKey: 'configuration.oibus.manifest.south.items.mssql.tracking-instant.track-instant',
                          defaultValue: false,
                          validators: [],
                          displayProperties: { row: 0, columns: 4, displayInViewMode: true }
                        },
                        {
                          type: 'string',
                          key: 'fieldName',
                          translationKey: 'configuration.oibus.manifest.south.items.mssql.tracking-instant.field-name',
                          defaultValue: null,
                          validators: [],
                          displayProperties: { row: 0, columns: 4, displayInViewMode: true }
                        },
                        {
                          type: 'object',
                          key: 'dateTimeInput',
                          translationKey: 'configuration.oibus.manifest.south.items.mssql.tracking-instant.date-time-input.title',
                          displayProperties: { visible: true, wrapInBox: false },
                          enablingConditions: [],
                          validators: [],
                          attributes: [
                            {
                              type: 'string-select',
                              key: 'type',
                              translationKey: 'configuration.oibus.manifest.south.items.mssql.tracking-instant.date-time-input.type',
                              selectableValues: ['date-time-2', 'date-time'],
                              defaultValue: 'date-time-2',
                              validators: [],
                              displayProperties: { row: 0, columns: 4, displayInViewMode: true }
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              : attribute
          )
        }
      }
    };
    const tracked = (name: string, fieldName: string | null): SouthConnectorItemCommandDTO => ({
      ...discovered(name, 'same'),
      settings: {
        query: 'SELECT * FROM logs',
        requestTimeout: 15000,
        trackingInstant: fieldName ? { trackInstant: true, fieldName, dateTimeInput: { type: 'date-time-2' } } : { trackInstant: false }
      }
    });
    tester.show([tracked('a', 'produced_at'), tracked('b', null)], [], trackingManifest);

    // the include checkbox, the name, then the settings that differ
    await expect.element(tester.headers.nth(2)).toHaveTextContent('Track instant');
    await expect.element(tester.headers.nth(3)).toMatchTextContent(/^Field name$/i);
    await expect.element(tester.headers.nth(4)).toHaveTextContent('Type');
    await expect.element(tester.rows.nth(0)).toMatchTextContent(/Yes\s*produced_at\s*DateTime2/);
    await expect.element(tester.rows.nth(1)).toMatchTextContent(/No/);
  });

  test('should skip by default what an item already reads, and refuse a name an item already has', async () => {
    tester.show(
      [discovered('folder/a', 'a.csv'), discovered('folder/b', 'b.csv')],
      [
        { name: 'existing', settings: discovered('', 'a.csv').settings },
        { name: 'folder/b', settings: discovered('', 'other').settings }
      ]
    );

    await expect.element(tester.included.nth(0)).not.toBeChecked();
    await expect.element(tester.rows.nth(0)).toMatchTextContent('Already read by existing');
    await expect.element(tester.rows.nth(1)).toMatchTextContent('Name already used');
    expect(tester.component.valid()).toBe(false);

    await tester.names.nth(1).fill('folder/b2');

    expect(tester.component.valid()).toBe(true);
    expect(tester.component.includedCommands().map(command => command.name)).toEqual(['folder/b2']);
  });

  test('should refuse the same name twice among the added items, and a blank one', async () => {
    tester.show([discovered('same', 'a.csv'), discovered('same', 'b.csv')]);

    await expect.element(tester.root.getByText('Name already used')).toHaveLength(2);
    expect(tester.component.valid()).toBe(false);
    await tester.included.nth(1).click();
    expect(tester.component.valid()).toBe(true);

    await tester.names.nth(0).fill('  ');
    await expect.element(tester.root.getByText('A name is required')).toBeInTheDocument();
    expect(tester.component.valid()).toBe(false);
  });

  test('should include or exclude every item at once', async () => {
    tester.show([discovered('folder/a', 'a.csv'), discovered('folder/b', 'b.csv')]);
    await expect.element(tester.selectAll).toBeChecked();

    await tester.selectAll.click();

    await expect.element(tester.count).toHaveTextContent('Selected items: 0 of 2');
    expect(tester.component.valid()).toBe(false);
    await tester.selectAll.click();
    await expect.element(tester.count).toHaveTextContent('Selected items: 2 of 2');
  });

  test('should start again from the new items when they change', async () => {
    tester.show([discovered('folder/a', 'a.csv'), discovered('folder/b', 'b.csv')]);
    await tester.included.nth(0).click();

    tester.show([discovered('folder/c', 'c.csv')]);

    await expect.element(tester.rows).toHaveLength(1);
    expect(tester.component.includedCommands().map(command => command.name)).toEqual(['folder/c']);
  });
});
