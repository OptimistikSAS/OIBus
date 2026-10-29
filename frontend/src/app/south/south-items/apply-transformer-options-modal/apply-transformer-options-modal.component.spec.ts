import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { CustomTransformerDTO, SourceOriginSouthDTO, StandardTransformerDTO } from '@oibus/shared/api/transformer.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import testData from '../../../../test/test-data';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { NorthConnectorService } from '../../../services/north-connector.service';
import { ApplyTransformerOptionsModalComponent, TransformerOptionsChange } from './apply-transformer-options-modal.component';

const north = testData.north.list[0];
const southSource = north.transformers[0].source as SourceOriginSouthDTO;
const topicTransformer: CustomTransformerDTO = {
  ...testData.transformers.customList[0],
  name: 'topic transformer',
  manifest: {
    ...testData.transformers.customList[0].manifest,
    attributes: [
      {
        type: 'string',
        key: 'topic',
        translationKey: 'configuration.oibus.manifest.transformers.record-list-to-modbus.mapping.point-id',
        defaultValue: null,
        validators: [],
        displayProperties: { row: 0, columns: 4, displayInViewMode: true }
      }
    ]
  }
};
const savedTransformer: TransformerOptionsChange['transformer'] = {
  id: 'northTransformerId',
  transformer: topicTransformer,
  options: { topic: 'saved' },
  source: { ...southSource, items: [] }
};

class ApplyTransformerOptionsModalComponentTester {
  readonly fixture = TestBed.createComponent(ApplyTransformerOptionsModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading', { level: 4 });
  readonly route = this.root.getByCss('#apply-route');
  readonly changeCount = this.root.getByCss('#apply-change-count');
  readonly options = this.root.getByCss('#apply-options');
  readonly scope = this.root.getByCss('#apply-scope');
  readonly itemCount = this.root.getByCss('#apply-item-count');
  readonly items = this.root.getByCss('#apply-items');
  readonly notes = this.root.getByCss('#apply-notes');
  readonly applyButton = this.root.getByRole('button', { name: 'Apply' });
  readonly cancelButton = this.root.getByRole('button', { name: 'Cancel' });

  constructor(change: Partial<TransformerOptionsChange> = {}) {
    this.fixture.componentInstance.prepare({
      north,
      transformer: savedTransformer,
      options: { topic: 'applied' },
      impactedItems: ['item1', 'item2'],
      ...change
    });
  }
}

describe('ApplyTransformerOptionsModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;
  let northConnectorService: MockObject<NorthConnectorService>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    northConnectorService = createMock(NorthConnectorService);
    northConnectorService.addOrEditTransformer.mockImplementation((_northId, transformer) => of(transformer));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: NorthConnectorService, useValue: northConnectorService }
      ]
    });
  });

  test('should show what changes, and the items affected', async () => {
    const tester = new ApplyTransformerOptionsModalComponentTester();

    await expect.element(tester.title).toHaveTextContent('Apply the changes to the transformer?');
    await expect.element(tester.route).toHaveTextContent(`topic transformer, which sends the data of ${southSource.south.name} to North 1`);
    await expect.element(tester.changeCount).toHaveTextContent('1 option(s) changed');
    await expect.element(tester.options).toMatchTextContent(/applied/);
    await expect.element(tester.options).toMatchTextContent(/saved/);
    await expect.element(tester.scope).toHaveTextContent(`The transformer applies to all the items of ${southSource.south.name}.`);
    await expect.element(tester.itemCount).toHaveTextContent('2 item(s) sent to North 1 through it:');
    await expect.element(tester.items).toHaveTextContent('item1item2');
    await expect.element(tester.notes).toMatchTextContent(/Only the transformer of this north changes/);
    await expect.element(tester.notes).toMatchTextContent(/The code of the custom transformer topic transformer does not change\./);
    await expect.element(tester.notes).toMatchTextContent(/The change is saved right away/);
  });

  test('should tell the transformer of a group, and the items it leaves out', async () => {
    const tester = new ApplyTransformerOptionsModalComponentTester({
      transformer: {
        ...savedTransformer,
        source: {
          ...savedTransformer.source,
          group: { id: 'group1', name: 'GroupA' },
          excludedItems: [{ ...southSource.items[0], id: 'item3', name: 'item3' }]
        }
      }
    });

    await expect
      .element(tester.scope)
      .toHaveTextContent(`The transformer applies to the items of the group GroupA of ${southSource.south.name}. 1 item(s) are left out.`);
  });

  test('should tell the transformer of items chosen, a standard one, without change', async () => {
    const standard: StandardTransformerDTO = {
      id: 'record-list-to-file',
      type: 'standard',
      functionName: 'record-list-to-file',
      inputType: 'record-list',
      outputType: 'file',
      manifest: topicTransformer.manifest
    };
    const tester = new ApplyTransformerOptionsModalComponentTester({
      transformer: { ...savedTransformer, transformer: standard, source: southSource },
      options: { topic: 'saved' }
    });

    await expect.element(tester.scope).toHaveTextContent(`The transformer applies to items chosen in ${southSource.south.name}.`);
    await expect.element(tester.changeCount).toHaveTextContent('No option changed.');
    await expect.element(tester.root.getByCss('#apply-custom')).not.toBeInTheDocument();
  });

  test('should count the items beyond the ones shown', async () => {
    const tester = new ApplyTransformerOptionsModalComponentTester({
      impactedItems: Array.from({ length: 23 }, (_, index) => `item${index}`)
    });

    await expect.element(tester.items.getByRole('listitem')).toHaveLength(20);
    await expect.element(tester.items).toMatchTextContent(/and 3 more$/);
  });

  test('should save the options to the transformer of the north, and close with it', async () => {
    const tester = new ApplyTransformerOptionsModalComponentTester();

    await tester.applyButton.click();

    const applied = { ...savedTransformer, options: { topic: 'applied' } };
    expect(northConnectorService.addOrEditTransformer).toHaveBeenCalledWith(north.id, applied);
    expect(activeModal.close).toHaveBeenCalledWith(applied);
  });

  test('should cancel', async () => {
    const tester = new ApplyTransformerOptionsModalComponentTester();

    await tester.cancelButton.click();

    expect(activeModal.dismiss).toHaveBeenCalled();
    expect(northConnectorService.addOrEditTransformer).not.toHaveBeenCalled();
  });
});
