import { TestBed } from '@angular/core/testing';
import { ItemTestCodeblockResultComponent } from './item-test-codeblock-result.component';
import { Component, viewChild } from '@angular/core';
import { OIBusContent, OIBusRawContent, OIBusTimeValueContent } from '../../../../../../../../backend/shared/model/engine.model';
import { ComponentTester } from 'ngx-speculoos';
import { provideI18nTesting } from '../../../../../../i18n/mock-i18n';

@Component({
  selector: 'oib-test-item-test-codeblock-result-component',
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

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });

    tester = new ItemTestCodeblockResultComponentTester();

    writeValueChunkedSpy = spyOn(tester.componentInstance.testedComponent().codeBlock(), 'writeValueChunked');
    writeValueSpy = spyOn(tester.componentInstance.testedComponent().codeBlock(), 'writeValue');
    changeLanguageSpy = spyOn(tester.componentInstance.testedComponent().codeBlock(), 'changeLanguage');

    await tester.change();
  });

  it('should write json content stringified', () => {
    expect(writeValueChunkedSpy).toHaveBeenCalledWith(JSON.stringify(tester.componentInstance.content.content, null, 2));
  });

  it('should write plaintext content stringified', async () => {
    tester.changeContentType('plaintext');
    await tester.change();

    // plaintext -> time-values -> simple stringify
    expect(writeValueChunkedSpy).toHaveBeenCalledWith(JSON.stringify(tester.componentInstance.content.content));

    // plaintext -> any -> with content
    tester.changeContent({ type: 'any', filePath: '/path/to/file', content: 'foo bar' });
    await tester.change();
    expect(writeValueChunkedSpy).toHaveBeenCalledWith('foo bar');

    // plaintext -> any -> without content
    tester.changeContent({ type: 'any', filePath: '/path/to/file' });
    await tester.change();
    expect(writeValueChunkedSpy).toHaveBeenCalledWith('/path/to/file');
  });

  it('should provide supported display modes', () => {
    // time-values -> json, any
    expect(tester.componentInstance.testedComponent().getSupportedDisplayModes({ type: 'time-values' } as OIBusContent)).toEqual([
      'json',
      'any'
    ]);

    // raw csv -> any
    expect(tester.componentInstance.testedComponent().getSupportedDisplayModes({ type: 'any' } as OIBusContent)).toEqual(['any']);

    // unexpected -> nothing
    expect(
      tester.componentInstance
        .testedComponent()
        .getSupportedDisplayModes({ type: 'unexpected', filePath: 'test.txt' } as unknown as OIBusContent)
    ).toEqual(null);
  });

  it('should empty the contents if cleaned', async () => {
    tester.componentInstance.testedComponent().cleanup();
    await tester.change();

    expect(writeValueSpy).toHaveBeenCalledWith('');
    expect(changeLanguageSpy).toHaveBeenCalledWith('plaintext');
  });
});
