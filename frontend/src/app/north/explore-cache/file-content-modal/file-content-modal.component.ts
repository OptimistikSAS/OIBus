import { AfterViewInit, Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { OibCodeBlockComponent } from '../../../shared/form/oib-code-block/oib-code-block.component';

@Component({
  selector: 'oib-file-content-modal',
  standalone: true,
  imports: [TranslateModule, CommonModule, OibCodeBlockComponent],
  templateUrl: './file-content-modal.component.html',
  styleUrl: './file-content-modal.component.scss'
})
export class FileContentModalComponent implements AfterViewInit {
  constructor(private modal: NgbActiveModal) {}
  @ViewChild('codeBlock') codeBlock!: OibCodeBlockComponent;
  content: string = '';
  filename: string = '';
  contentType: string = '';
  private callbackSet = false;

  ngAfterViewInit() {
    this.codeBlock.writeValue(this.content);
    this.codeBlock.contentType = this.contentType;

    // Attach a listener to the code editor to resize the modal when the content changes
    this.codeBlock.onChange = () => {
      if (this.callbackSet) {
        return;
      }

      this.codeBlock.codeEditorInstance!.onDidContentSizeChange(() => {
        const contentHeight = Math.min(window.innerHeight * 0.75, this.codeBlock.codeEditorInstance!.getContentHeight());
        const containerWidth = this.codeBlock._editorContainer!.nativeElement.clientWidth;

        this.codeBlock._editorContainer!.nativeElement.style.height = `${contentHeight}px`;
        this.codeBlock.codeEditorInstance!.layout({ width: containerWidth, height: contentHeight });
        this.callbackSet = true;
      });
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
