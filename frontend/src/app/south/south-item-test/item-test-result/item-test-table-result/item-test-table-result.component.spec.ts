import { ComponentTester } from 'ngx-speculoos';
import { ItemTestTableResultComponent } from './item-test-table-result.component';
import { Component, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../../../../i18n/mock-i18n';
import { OIBusContent, OIBusRawContent, OIBusTimeValueContent } from '../../../../../../../backend/shared/model/engine.model';

@Component({
  template: ` <oib-item-test-table-result #testedComponent [content]="content" />`,
  imports: [ItemTestTableResultComponent]
})
class TestComponent {
  readonly testedComponent = viewChild.required<ItemTestTableResultComponent>('testedComponent');
  content: OIBusTimeValueContent = {
    type: 'time-values',
    content: [
      { pointId: 'pointId', timestamp: '2023-01-01T00:00:01.000Z', data: { value: 1 } },
      { pointId: 'pointId', timestamp: '2023-01-01T00:00:02.000Z', data: { value: 2 } },
      { pointId: 'pointId', timestamp: '2023-01-01T00:00:03.000Z', data: { value: 3 } }
    ]
  };
}

class ItemTestTableResultComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  changeContent(content: OIBusRawContent) {
    this.componentInstance.content = content as any;
  }

  get tableRows() {
    return this.elements<HTMLDivElement>('.grid-table-row');
  }

  get tableHeaders() {
    return this.elements<HTMLDivElement>('.grid-table-header > div');
  }
}

describe('ItemTestTableResultComponent', () => {
  let tester: ItemTestTableResultComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });

    tester = new ItemTestTableResultComponentTester();
    tester.detectChanges();
  });

  it('should display time values as a table', () => {
    expect(tester.component).toBeTruthy();
    expect(tester.tableRows.length).toBe(tester.componentInstance.content.content!.length);

    // Make sure the columns are what we expect them to be
    for (let i = 0; i < tester.componentInstance.content.content!.length; i++) {
      const element = tester.componentInstance.content.content![i];
      const columns = tester.tableRows[i].elements<HTMLDivElement>('div');
      expect(columns[0].nativeElement.innerText).toBe(element.timestamp);
      expect(columns[1].nativeElement.innerText).toBe(element.pointId);
      expect(columns[2].nativeElement.innerText).toBe(String(element.data.value));
      expect(columns[3].nativeElement.innerText).toBe('{}');
    }
  });

  it('should display csv as a table', () => {
    tester.changeContent({
      type: 'any',
      filePath: 'test.csv',
      content: 'foo,bar,baz\n1234,string with spaces,5678'
    });
    tester.detectChanges();

    // Make sure the columns are what we expect them to be
    const headers = tester.tableHeaders;
    expect(headers[0].nativeElement.innerText).toBe('foo');
    expect(headers[1].nativeElement.innerText).toBe('bar');
    expect(headers[2].nativeElement.innerText).toBe('baz');

    // Make sure the columns are what we expect them to be
    const columns = tester.tableRows[0].elements<HTMLDivElement>('div');
    expect(columns[0].nativeElement.innerText).toBe('1234');
    expect(columns[1].nativeElement.innerText).toBe('string with spaces');
    expect(columns[2].nativeElement.innerText).toBe('5678');
  });

  it('should not display csv as a table', () => {
    tester.changeContent({
      type: 'any',
      filePath: 'test.csv',
      content: ''
    });
    tester.detectChanges();

    // Make sure the columns are what we expect them to be
    expect(tester.tableHeaders.length).toBe(0);
    expect(tester.tableRows.length).toBe(0);
  });

  it('should provide supported display modes', () => {
    // time-values -> table
    expect(tester.componentInstance.testedComponent().getSupportedDisplayModes({ type: 'time-values' } as OIBusContent)).toEqual(['table']);

    // any (csv with content) -> table
    expect(
      tester.componentInstance
        .testedComponent()
        .getSupportedDisplayModes({ type: 'any', filePath: 'test.csv', content: 'a,b,c\nd,e,f' } as OIBusContent)
    ).toEqual(['table']);

    // any (csv without content) -> table
    expect(
      tester.componentInstance.testedComponent().getSupportedDisplayModes({
        type: 'any',
        filePath: 'test.csv'
      } as OIBusContent)
    ).toEqual(null);

    // any (generic) -> nothing
    expect(
      tester.componentInstance.testedComponent().getSupportedDisplayModes({
        type: 'any',
        filePath: 'test.txt'
      } as OIBusContent)
    ).toEqual(null);

    // unexpected -> nothing
    expect(
      tester.componentInstance
        .testedComponent()
        .getSupportedDisplayModes({ type: 'unexpected', filePath: 'test.txt' } as unknown as OIBusContent)
    ).toEqual(null);
  });

  it('should empty the table if cleaned', () => {
    tester.componentInstance.testedComponent().cleanup();
    tester.detectChanges();
    expect(tester.tableRows.length).toBe(0);
  });

  it('should report errors', () => {
    const changePage = spyOn(tester.componentInstance.testedComponent(), 'changePage');
    changePage.and.throwError(new Error('Error parsing data'));
    tester.componentInstance.testedComponent().resetPage();
    expect(tester.componentInstance.testedComponent().errorMessage).toBe('Error parsing data');
  });
});
