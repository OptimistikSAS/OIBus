import { AfterViewInit, Component, inject, viewChild } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { OibCodeBlockComponent } from '../../../shared/form/oib-code-block/oib-code-block.component';

@Component({
  selector: 'oib-file-content-modal',
  imports: [TranslateDirective, OibCodeBlockComponent],
  templateUrl: './file-content-modal.component.html',
  styleUrl: './file-content-modal.component.scss'
})
export class FileContentModalComponent implements AfterViewInit {
  private modal = inject(NgbActiveModal);

  readonly codeBlock = viewChild.required<OibCodeBlockComponent>('codeBlock');
  content = '';
  filename = '';
  contentType = '';
  private callbackSet = false;

  ngAfterViewInit() {
    this.codeBlock().writeValue(this.content);
    const codeBlock = this.codeBlock();

    // Attach a listener to the code editor to resize the modal when the content changes
    codeBlock.onChange = () => {
      if (this.callbackSet) {
        return;
      }

      const codeBlockValue = this.codeBlock();
      const codeEditorInstance = codeBlockValue.codeEditorInstance();
      if (codeEditorInstance) {
        codeEditorInstance.onDidContentSizeChange(() => {
          const contentHeight = Math.min(window.innerHeight * 0.75, codeEditorInstance.getContentHeight());
          const containerWidth = this.codeBlock()._editorContainer()!.nativeElement.clientWidth;
          codeBlockValue._editorContainer()!.nativeElement.style.height = `${contentHeight}px`;
          codeEditorInstance.layout({ width: containerWidth, height: contentHeight });
          this.callbackSet = true;
        });
      }
    };
  }

  prepareForCreation(filename: string, contentType: string, content: string) {
    this.filename = filename;
    this.contentType = contentType;
    this.content = content;
  }

  dismiss() {
    this.modal.dismiss();
  }
}
