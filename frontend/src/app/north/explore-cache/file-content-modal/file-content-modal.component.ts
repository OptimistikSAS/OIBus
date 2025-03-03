import { Component, inject, viewChild } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { OibCodeBlockComponent } from '../../../shared/form/oib-code-block/oib-code-block.component';
import { CacheMetadata } from '../../../../../../backend/shared/model/engine.model';

@Component({
  selector: 'oib-file-content-modal',
  imports: [TranslateDirective, OibCodeBlockComponent],
  templateUrl: './file-content-modal.component.html',
  styleUrl: './file-content-modal.component.scss'
})
export class FileContentModalComponent {
  private modal = inject(NgbActiveModal);

  readonly codeBlock = viewChild.required<OibCodeBlockComponent>('codeBlock');
  contentFile: { metadataFilename: string; metadata: CacheMetadata } | null = null;
  content = '';
  private callbackSet = false;

  prepareForCreation(contentFile: { metadataFilename: string; metadata: CacheMetadata }, content: string) {
    this.contentFile = contentFile;
    this.content = content;

    this.codeBlock().writeValue(this.content);
    // this.codeBlock().contentType = this.contentFile.metadata.contentType === 'raw' ? 'csv' : 'json';

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
