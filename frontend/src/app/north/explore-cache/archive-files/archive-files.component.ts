import { Component, Input, OnInit } from '@angular/core';
import { SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { TranslateModule } from '@ngx-translate/core';
import { formDirectives } from '../../../shared/form-directives';
import { NorthConnectorService } from '../../../services/north-connector.service';
import { NgForOf, NgIf } from '@angular/common';
import { NorthCacheFiles, NorthConnectorDTO } from '../../../../../../shared/model/north-connector.model';
import { RouterLink } from '@angular/router';
import { DatetimePipe } from '../../../shared/datetime.pipe';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { FileSizePipe } from '../../../shared/file-size.pipe';

@Component({
  selector: 'oib-archive-files',
  templateUrl: './archive-files.component.html',
  styleUrls: ['./archive-files.component.scss'],
  imports: [
    ...formDirectives,
    TranslateModule,
    SaveButtonComponent,
    NgForOf,
    DatetimePipe,
    NgIf,
    PaginationComponent,
    FileSizePipe,
    RouterLink
  ],
  standalone: true
})
export class ArchiveFilesComponent implements OnInit {
  @Input() northConnector: NorthConnectorDTO | null = null;
  archiveFiles: Array<NorthCacheFiles> = [];
  checkboxByArchiveFiles: Map<string, boolean> = new Map<string, boolean>();

  // the checkbox states for the input parameters
  mainArchiveFilesCheckboxState: 'CHECKED' | 'UNCHECKED' | 'INDETERMINATE' = 'UNCHECKED';

  constructor(private northConnectorService: NorthConnectorService) {}

  ngOnInit() {
    this.northConnectorService.getNorthConnectorCacheArchiveFiles(this.northConnector!.id).subscribe(archiveFiles => {
      this.checkboxByArchiveFiles.clear();
      archiveFiles.forEach(archiveFile => {
        this.checkboxByArchiveFiles.set(archiveFile.filename, false);
      });
      this.archiveFiles = archiveFiles;
    });
  }

  retryArchiveFiles() {
    const files = this.archiveFiles.filter(file => this.checkboxByArchiveFiles.get(file.filename)).map(file => file.filename);
    this.northConnectorService.retryNorthConnectorCacheArchiveFiles(this.northConnector!.id, files).subscribe(() => {
      this.refreshArchiveFiles();
      this.mainArchiveFilesCheckboxState = 'UNCHECKED';
    });
  }

  removeArchiveFiles() {
    const files = this.archiveFiles.filter(file => this.checkboxByArchiveFiles.get(file.filename)).map(file => file.filename);
    this.northConnectorService.removeNorthConnectorCacheArchiveFiles(this.northConnector!.id, files).subscribe(() => {
      this.refreshArchiveFiles();
      this.mainArchiveFilesCheckboxState = 'UNCHECKED';
    });
  }

  refreshArchiveFiles() {
    this.northConnectorService.getNorthConnectorCacheArchiveFiles(this.northConnector!.id).subscribe(archiveFiles => {
      this.checkboxByArchiveFiles.clear();
      archiveFiles.forEach(archiveFile => {
        this.checkboxByArchiveFiles.set(archiveFile.filename, false);
      });
      this.archiveFiles = archiveFiles;
    });
  }

  /**
   * Called when the user check or uncheck the main checkbox
   */
  onArchiveFileMainCheckBoxClick(isChecked: boolean) {
    this.archiveFiles.forEach(archiveFile => {
      this.checkboxByArchiveFiles.set(archiveFile.filename, isChecked);
    });
    if (isChecked) {
      this.mainArchiveFilesCheckboxState = 'CHECKED';
    } else {
      this.mainArchiveFilesCheckboxState = 'UNCHECKED';
    }
  }

  onArchiveFileCheckboxClick(isChecked: boolean, archiveFile: NorthCacheFiles) {
    this.checkboxByArchiveFiles.set(archiveFile.filename, isChecked);
    let everythingIsChecked = true;
    let everythingIsUnChecked = true;
    for (const isSelected of this.checkboxByArchiveFiles.values()) {
      if (!isSelected) {
        everythingIsChecked = false;
      } else {
        everythingIsUnChecked = false;
      }
    }
    if (everythingIsChecked && !everythingIsUnChecked) {
      this.mainArchiveFilesCheckboxState = 'CHECKED';
    } else if (!everythingIsChecked && everythingIsUnChecked) {
      this.mainArchiveFilesCheckboxState = 'UNCHECKED';
    } else {
      this.mainArchiveFilesCheckboxState = 'INDETERMINATE';
    }
  }
}
