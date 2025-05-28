import { Component, effect, input, viewChild } from '@angular/core';
import { OIBusContent } from '../../../../../../../../backend/shared/model/engine.model';
import { OibCodeBlockComponent } from '../../../../../shared/form/oib-code-block/oib-code-block.component';
import { ContentDisplayMode } from '../item-test-result.component';
import { BaseItemTestResult } from '../item-test-result.interface';
import { ProgressbarComponent } from '../../../../../history-query/history-query-detail/history-metrics/progressbar/progressbar.component';

@Component({
  selector: 'oib-item-test-codeblock-result',
  imports: [OibCodeBlockComponent, ProgressbarComponent],
  templateUrl: './item-test-codeblock-result.component.html',
  styleUrl: './item-test-codeblock-result.component.scss'
})
export class ItemTestCodeblockResultComponent implements BaseItemTestResult {
  content = input.required<OIBusContent>();
  contentType = input.required<'json' | 'plaintext'>();
  errorMessage: string | null = null;

  readonly codeBlock = viewChild.required<OibCodeBlockComponent>('monacoEditor');

  constructor() {
    effect(() => this.contentType() && this.writeValue());
  }

  private writeValue() {
    this.codeBlock().changeLanguage(this.contentType());
    const content = this.content();

    switch (this.contentType()) {
      // Pretty print json values
      case 'json':
        this.codeBlock().writeValueChunked(JSON.stringify(content.content, null, 2));
        break;

      // Display their raw content
      case 'plaintext':
        switch (content.type) {
          case 'time-values':
            this.codeBlock()?.writeValueChunked(JSON.stringify(content.content));
            break;
          case 'any':
            this.codeBlock()?.writeValueChunked(content.content ?? content.filePath);
            break;
        }
        break;
    }
  }

  getSupportedDisplayModes(content: OIBusContent): Array<ContentDisplayMode> | null {
    switch (content.type) {
      case 'time-values':
        return ['json', 'any'];
      case 'any':
        return ['any'];
      default:
        return null;
    }
  }

  cleanup(): void {
    this.codeBlock().writeValue('');
    this.codeBlock().changeLanguage('plaintext');
  }
}
