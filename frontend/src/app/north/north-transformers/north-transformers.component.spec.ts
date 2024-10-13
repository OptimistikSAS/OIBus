import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NorthConnectorManifest } from '../../../../../shared/model/north-connector.model';
import { NorthTransformersComponent } from './north-transformers.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { provideHttpClient } from '@angular/common/http';
import { TransformerService } from '../../services/transformer.service';
import { of } from 'rxjs';
import { RichSelectComponent } from '../../shared/rich-select/rich-select.component';
import { TransformerDTO } from '../../../../../shared/model/transformer.model';

const testManifest: NorthConnectorManifest = {
  transformers: [
    { inputType: 'time-values', outputType: 'transformer-data', type: 'standard' },
    { inputType: 'time-values', outputType: 'transformer-data', type: 'custom' },
    { inputType: 'raw', outputType: 'transformer-data', type: 'standard' }
  ]
} as NorthConnectorManifest;

const testTransformerDtos: Array<TransformerDTO> = [
  {
    id: 't1',
    name: 'transformer 1',
    description: '',
    inputType: 'time-values',
    outputType: 'transformer-data',
    code: '',
    fileRegex: ''
  },
  {
    id: 't2',
    name: 'transformer 2',
    description: '',
    inputType: 'raw',
    outputType: 'transformer-data',
    code: '',
    fileRegex: ''
  }
];

const mockVoid = '' as any;

@Component({
  template: `<oib-north-transformers [transformersManifest]="manifest.transformers" [northId]="northId" />`,
  standalone: true,
  imports: [NorthTransformersComponent]
})
class TestComponent {
  manifest = testManifest;
  northId = 'northId';
}

class NorthTransformersComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get title() {
    return this.element('#transformers-title')!;
  }

  get inputRows() {
    return this.elements('tbody > tr')!;
  }
}

describe('NorthTransformersComponent', () => {
  let tester: NorthTransformersComponentTester;
  let transformerService: jasmine.SpyObj<TransformerService>;

  beforeEach(() => {
    transformerService = createMock(TransformerService);

    TestBed.configureTestingModule({
      imports: [NorthTransformersComponent],
      providers: [provideI18nTesting(), provideHttpClient(), { provide: TransformerService, useValue: transformerService }]
    });

    transformerService.list.and.returnValues(of(testTransformerDtos), of([]));
    transformerService.assign.and.returnValue(of(mockVoid));
    transformerService.unassign.and.returnValue(of(mockVoid));
    transformerService.create.and.returnValue(of(mockVoid));
    transformerService.update.and.returnValue(of(mockVoid));
    transformerService.delete.and.returnValue(of(mockVoid));

    tester = new NorthTransformersComponentTester();
    tester.detectChanges();
  });

  it('should create', () => {
    expect(tester.title).toBeTruthy();
  });

  it('should have as many rows as unique input types', () => {
    const uniqueInputCount = [...new Set(testManifest.transformers?.map(t => t.inputType))].length;
    expect(tester.inputRows.length).toEqual(uniqueInputCount);
  });

  it('should only have standard transformers selected by default', () => {
    for (const row of tester.inputRows) {
      const selects = row.components(RichSelectComponent);
      // Only 'output data' and 'standard' transformer type selects should be rendered
      expect(selects.length).toEqual(2);
      expect(selects[1].selectedLabel).toEqual('standard');
    }
  });

  it('should have custom transformers selected by default', () => {
    // Recreate the tester with one of the selected transformers
    // Note: First call returns all transformers, second one only selected ones
    transformerService.list.and.returnValues(of(testTransformerDtos), of([testTransformerDtos[0]]));
    tester = new NorthTransformersComponentTester();
    tester.detectChanges();

    let customFound = false;
    for (const row of tester.inputRows) {
      const selects = row.components(RichSelectComponent);
      if (selects.length === 3) {
        expect(selects[2].selectedLabel).toBe(testTransformerDtos[0].name);
        customFound = true;
      }
    }

    expect(customFound).toBe(true);
  });

  it('should be able to select a custom transformer', () => {
    // Note: dropdowns need indexing because they do not auto-close on simulated click

    // select custom type
    const transformerTypeSelect = tester.inputRows[0].elements('oib-rich-select')[1];
    transformerTypeSelect.element('button')?.click();
    tester.elements('.dropdown-menu.show')[0].element<HTMLButtonElement>('.dropdown-item:not(.selected)')?.click();

    // select custom transformer
    const transformerImplementationSelect = tester.inputRows[0].elements('oib-rich-select')[2];
    transformerImplementationSelect.element('button')?.click();
    tester.elements('.dropdown-menu.show')[1].element<HTMLButtonElement>('.dropdown-item:not(.selected)')?.click();

    // expect type and implementation to change
    expect(tester.inputRows[0].components(RichSelectComponent)[1].selectedLabel).toBe('custom');
    expect(tester.inputRows[0].components(RichSelectComponent)[2].selectedLabel).toBe(testTransformerDtos[0].name);
  });

  it('should be able to change options when selecting a standard transformer after a custom one', () => {
    // Make sure the first transformer is selected
    transformerService.list.and.returnValues(of(testTransformerDtos), of([testTransformerDtos[0]]));
    tester = new NorthTransformersComponentTester();
    tester.detectChanges();

    // select standard type
    const transformerTypeSelect = tester.inputRows[0].elements('oib-rich-select')[1];
    transformerTypeSelect.element('button')?.click();
    tester.elements('.dropdown-menu.show')[0].element<HTMLButtonElement>('.dropdown-item:not(.selected)')?.click();

    expect(tester.inputRows[0].components(RichSelectComponent)[1].selectedLabel).toBe('standard');
    // it should not have the third select for implementations
    expect(tester.inputRows[0].components(RichSelectComponent).length).toBe(2);
    expect(transformerService.unassign).toHaveBeenCalled();
  });

  it('should be able to select a different custom transformer', () => {
    const testTransformerDtos = [
      {
        id: 't1',
        name: 'transformer 1',
        description: '',
        inputType: 'time-values',
        outputType: 'transformer-data',
        code: '',
        fileRegex: ''
      },
      {
        id: 't2',
        name: 'transformer 2',
        description: '',
        inputType: 'time-values',
        outputType: 'transformer-data',
        code: '',
        fileRegex: ''
      }
    ];
    transformerService.list.and.returnValues(of(testTransformerDtos), of([testTransformerDtos[0]]));
    tester = new NorthTransformersComponentTester();
    tester.detectChanges();

    // select custom transformer
    const transformerImplementationSelect = tester.inputRows[0].elements('oib-rich-select')[2];
    transformerImplementationSelect.element('button')?.click();
    tester.elements('.dropdown-menu.show')[0].element<HTMLButtonElement>('.dropdown-item:not(.selected)')?.click();

    // expect type and implementation to change
    expect(tester.inputRows[0].components(RichSelectComponent)[1].selectedLabel).toBe('custom');
    expect(tester.inputRows[0].components(RichSelectComponent)[2].selectedLabel).toBe(testTransformerDtos[1].name);
    expect(transformerService.unassign).toHaveBeenCalled();
    expect(transformerService.assign).toHaveBeenCalled();
  });

  it('should be able to create transformer', () => {
    // select custom by default
    transformerService.list.and.returnValues(of(testTransformerDtos), of([testTransformerDtos[0]]));
    tester = new NorthTransformersComponentTester();
    tester.detectChanges();

    const transformerImplementationSelect = tester.inputRows[0].elements('oib-rich-select')[2];
    transformerImplementationSelect.element('button')?.click();
    // last on is the create new button
    tester.element<HTMLButtonElement>('.dropdown-menu.show > button:last-of-type')?.element('button')?.click();

    // reach the modal using parent (body)
    const modal = tester.nativeElement.parentElement?.querySelector('oib-edit-transformer-modal');
    expect(modal).toBeDefined();
    expect(modal!.querySelector<HTMLHeadingElement>('.modal-title')?.innerText).toContain('Create');
  });

  it('should be able to update transformer', () => {
    // select custom by default
    transformerService.list.and.returnValues(of(testTransformerDtos), of([testTransformerDtos[0]]));
    tester = new NorthTransformersComponentTester();
    tester.detectChanges();

    const transformerImplementationSelect = tester.inputRows[0].elements('oib-rich-select')[2];
    transformerImplementationSelect.element('button')?.click();
    // first button is edit
    tester.element('.dropdown-menu.show')?.elements<HTMLButtonElement>('button button')[0]?.click();

    // reach the modal using parent (body)
    const modal = tester.nativeElement.parentElement?.querySelector('oib-edit-transformer-modal');
    expect(modal).toBeDefined();
    expect(modal!.querySelector<HTMLHeadingElement>('.modal-title')?.innerText).toContain('Edit');

    modal?.querySelector<HTMLButtonElement>('oib-save-button > button')?.click();
  });

  it('should be able to delete transformer', () => {
    // select custom by default
    transformerService.list.and.returnValues(of(testTransformerDtos), of([testTransformerDtos[0]]));
    tester = new NorthTransformersComponentTester();
    tester.detectChanges();

    const transformerImplementationSelect = tester.inputRows[0].elements('oib-rich-select')[2];
    transformerImplementationSelect.element('button')?.click();
    // second button is delete
    tester.element('.dropdown-menu.show')?.elements<HTMLButtonElement>('button button')[1]?.click();
    // only the create new button should be visible
    expect(tester.element('.dropdown-menu.show')?.elements<HTMLButtonElement>('button button').length).toBe(1);
    expect(transformerService.delete).toHaveBeenCalled();
  });
});
