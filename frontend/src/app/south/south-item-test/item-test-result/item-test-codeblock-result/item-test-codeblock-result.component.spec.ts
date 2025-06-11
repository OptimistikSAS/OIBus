import { TestBed } from '@angular/core/testing';
import { ItemTestCodeblockResultComponent } from './item-test-codeblock-result.component';
import { Component, viewChild } from '@angular/core';
import { OIBusContent, OIBusRawContent, OIBusTimeValueContent } from '../../../../../../../backend/shared/model/engine.model';
import { ComponentTester } from 'ngx-speculoos';
import { provideI18nTesting } from '../../../../../i18n/mock-i18n';

@Component({
  template: ` <oib-item-test-codeblock-result #testedComponent [content]="content" [contentType]="contentType" />`,
  imports: [ItemTestCodeblockResultComponent]
})
class TestComponent {
  readonly testedComponent = viewChild.required<ItemTestCodeblockResultComponent>('testedComponent');
  content: OIBusTimeValueContent = {
    type: 'time-values',
    content: [
      { pointId: 'pointId', timestamp: '2023-01-01T00:00:01.000Z', data: { value: 1 } },
      { pointId: 'pointId', timestamp: '2023-01-01T00:00:02.000Z', data: { value: 2 } },
      { pointId: 'pointId', timestamp: '2023-01-01T00:00:03.000Z', data: { value: 3 } }
    ]
  };
  contentType: 'json' | 'plaintext' = 'json';
}

class ItemTestCodeblockResultComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  changeContent(content: OIBusRawContent) {
    this.componentInstance.content = content as any;
  }

  changeContentType(contentType: 'json' | 'plaintext') {
    this.componentInstance.contentType = contentType;
  }
}

describe('ItemTestCodeblockResultComponent', () => {
  let tester: ItemTestCodeblockResultComponentTester;
  let writeValueChunkedSpy: jasmine.Spy<(value: string, chunkSize?: number) => Promise<void>>;
  let writeValueSpy: jasmine.Spy<(value: string) => void>;
  let changeLanguageSpy: jasmine.Spy<(language: string) => void>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });

    tester = new ItemTestCodeblockResultComponentTester();

    writeValueChunkedSpy = spyOn(tester.componentInstance.testedComponent().codeBlock(), 'writeValueChunked');
    writeValueSpy = spyOn(tester.componentInstance.testedComponent().codeBlock(), 'writeValue');
    changeLanguageSpy = spyOn(tester.componentInstance.testedComponent().codeBlock(), 'changeLanguage');

    tester.detectChanges();
  });

  it('should write json content stringified', () => {
    expect(writeValueChunkedSpy).toHaveBeenCalledWith(JSON.stringify(tester.componentInstance.content.content, null, 2));
  });

  it('should write plaintext content stringified', () => {
    tester.changeContentType('plaintext');
    tester.detectChanges();

    // plaintext -> time-values -> simple stringify
    expect(writeValueChunkedSpy).toHaveBeenCalledWith(JSON.stringify(tester.componentInstance.content.content));

    // plaintext -> raw -> with content
    tester.changeContent({ type: 'raw', filePath: '/path/to/file', content: 'foo bar' });
    tester.detectChanges();
    expect(writeValueChunkedSpy).toHaveBeenCalledWith('foo bar');

    // plaintext -> raw -> without content
    tester.changeContent({ type: 'raw', filePath: '/path/to/file' });
    tester.detectChanges();
    expect(writeValueChunkedSpy).toHaveBeenCalledWith('/path/to/file');
  });

  it('should provide supported display modes', () => {
    // time-values -> json, raw
    expect(tester.componentInstance.testedComponent().getSupportedDisplayModes({ type: 'time-values' } as OIBusContent)).toEqual([
      'json',
      'raw'
    ]);

    // raw csv -> raw
    expect(tester.componentInstance.testedComponent().getSupportedDisplayModes({ type: 'raw' } as OIBusContent)).toEqual(['raw']);

    // unexpected -> nothing
    expect(
      tester.componentInstance
        .testedComponent()
        .getSupportedDisplayModes({ type: 'unexpected', filePath: 'test.txt' } as unknown as OIBusContent)
    ).toEqual(null);
  });

  it('should empty the contents if cleaned', () => {
    tester.componentInstance.testedComponent().cleanup();
    tester.detectChanges();

    expect(writeValueSpy).toHaveBeenCalledWith('');
    expect(changeLanguageSpy).toHaveBeenCalledWith('plaintext');
  });
});
