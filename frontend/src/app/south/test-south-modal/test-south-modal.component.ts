import { Component, ViewChild, AfterViewInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { OibCodeBlockComponent } from '../../shared/form/oib-code-block/oib-code-block.component';
import { MonacoEditorLoaderService } from '../../shared/form/oib-code-block/monaco-editor-loader.service';

@Component({
  selector: 'oib-test-south-modal',
  templateUrl: './test-south-modal.component.html',
  styleUrl: './test-south-modal.component.scss',
  imports: [OibCodeBlockComponent],
  standalone: true
})
export class TestSouthModalComponent implements AfterViewInit {
  @ViewChild('monacoEditor') codeBlock: OibCodeBlockComponent = new OibCodeBlockComponent(new MonacoEditorLoaderService());
  result: string = 'No result';
  resultContent: string | Record<string, any>[] = 'No content';

  constructor(private modal: NgbActiveModal) {}

  prepare(result: any) {
    if (result) {
      this.result = 'Test successfully run';
    }
    if (result.content) {
      this.resultContent = result.content;
    }
    if (typeof this.resultContent !== 'string') {
      let totalResult = '';
      for (let i = 0; i < this.resultContent.length; i++) {
        totalResult += this.resultContent[i]['data']['value'] + '\n';
      }
      this.resultContent = totalResult;
    }
  }

  ngAfterViewInit() {
    this.codeBlock.writeValue(this.resultContent as string);
  }

  close() {
    this.modal.close();
  }
}
