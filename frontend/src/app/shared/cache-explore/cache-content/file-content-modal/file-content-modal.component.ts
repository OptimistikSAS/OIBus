import { Component, inject, viewChild } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { OibCodeBlockComponent } from '../../../form/oib-code-block/oib-code-block.component';
import { FileCacheContent } from '../../../../../../../backend/shared/model/engine.model';
import { FileSizePipe } from '../../../file-size.pipe';

@Component({
  selector: 'oib-file-content-modal',
  imports: [TranslateDirective, OibCodeBlockComponent, FileSizePipe],
  templateUrl: './file-content-modal.component.html',
  styleUrl: './file-content-modal.component.scss'
})
export class FileContentModalComponent {
  private modal = inject(NgbActiveModal);

  readonly codeBlock = viewChild.required<OibCodeBlockComponent>('codeBlock');
  filename = '';
  fileCacheContent: FileCacheContent | null = null;
  private callbackSet = false;

  prepare(filename: string, fileCacheContent: FileCacheContent) {
    this.filename = filename;
    this.fileCacheContent = fileCacheContent;

    this.codeBlock().changeLanguage(this.fileCacheContent.truncated ? 'raw' : this.fileCacheContent.contentType);
    this.codeBlock().writeValue(this.fileCacheContent.content);
    // Attach a listener to the code editor to resize the modal when the content changes
    this.codeBlock().onChange = () => {
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

  dismiss() {
    this.modal.dismiss();
  }
}
