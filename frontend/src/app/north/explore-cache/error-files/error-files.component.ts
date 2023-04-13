import { Component, Input, OnInit } from '@angular/core';
import { SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { TranslateModule } from '@ngx-translate/core';
import { formDirectives } from '../../../shared/form-directives';
import { NorthConnectorService } from '../../../services/north-connector.service';
import { NgForOf, NgIf } from '@angular/common';
import { NorthCacheFiles, NorthConnectorDTO } from '../../../../../../shared/model/north-connector.model';
import { RouterLink } from '@angular/router';
import { DatetimePipe } from '../../../shared/datetime.pipe';
import { LogLevelsEnumPipe } from '../../../shared/log-levels-enum.pipe';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { FileSizePipe } from '../../../shared/file-size.pipe';
import { SubNavbarComponent } from '../../sub-navbar/sub-navbar.component';

@Component({
  selector: 'oib-error-files',
  templateUrl: './error-files.component.html',
  styleUrls: ['./error-files.component.scss'],
  imports: [
    ...formDirectives,
    TranslateModule,
    SaveButtonComponent,
    NgForOf,
    DatetimePipe,
    LogLevelsEnumPipe,
    NgIf,
    PaginationComponent,
    FileSizePipe,
    SubNavbarComponent,
    RouterLink
  ],
  standalone: true
})
export class ErrorFilesComponent implements OnInit {
  @Input() northConnector: NorthConnectorDTO | null = null;
  errorFiles: Array<NorthCacheFiles> = [];
  checkboxByErrorFiles: Map<string, boolean> = new Map<string, boolean>();

  // the checkbox states for the input parameters
  mainErrorFilesCheckboxState: 'CHECKED' | 'UNCHECKED' | 'INDETERMINATE' = 'UNCHECKED';

  constructor(private northConnectorService: NorthConnectorService) {}

  ngOnInit() {
    this.northConnectorService.getNorthConnectorCacheErrorFiles(this.northConnector!.id).subscribe(errorFiles => {
      this.checkboxByErrorFiles.clear();
      errorFiles.forEach(errorFile => {
        this.checkboxByErrorFiles.set(errorFile.filename, false);
      });
      this.errorFiles = errorFiles;
    });
  }

  retryErrorFiles() {
    const files = this.errorFiles.filter(file => this.checkboxByErrorFiles.get(file.filename)).map(file => file.filename);
    this.northConnectorService.retryNorthConnectorCacheErrorFiles(this.northConnector!.id, files).subscribe(() => {
      this.refreshErrorFiles();
    });
  }

  removeErrorFiles() {
    const files = this.errorFiles.filter(file => this.checkboxByErrorFiles.get(file.filename)).map(file => file.filename);
    this.northConnectorService.removeNorthConnectorCacheErrorFiles(this.northConnector!.id, files).subscribe(() => {
      this.refreshErrorFiles();
    });
  }

  refreshErrorFiles() {
    this.northConnectorService.getNorthConnectorCacheErrorFiles(this.northConnector!.id).subscribe(errorFiles => {
      this.checkboxByErrorFiles.clear();
      errorFiles.forEach(errorFile => {
        this.checkboxByErrorFiles.set(errorFile.filename, false);
      });
      this.errorFiles = errorFiles;
    });
  }

  /**
   * Called when the user check or uncheck the main checkbox
   */
  onFileErrorMainCheckBoxClick(isChecked: boolean) {
    this.errorFiles.forEach(errorFile => {
      this.checkboxByErrorFiles.set(errorFile.filename, isChecked);
    });
    if (isChecked) {
      this.mainErrorFilesCheckboxState = 'CHECKED';
    } else {
      this.mainErrorFilesCheckboxState = 'UNCHECKED';
    }
  }

  onFileErrorCheckboxClick(isChecked: boolean, errorFile: NorthCacheFiles) {
    this.checkboxByErrorFiles.set(errorFile.filename, isChecked);
    let everythingIsChecked = true;
    let everythingIsUnChecked = true;
    for (const isSelected of this.checkboxByErrorFiles.values()) {
      if (!isSelected) {
        everythingIsChecked = false;
      } else {
        everythingIsUnChecked = false;
      }
    }
    if (everythingIsChecked && !everythingIsUnChecked) {
      this.mainErrorFilesCheckboxState = 'CHECKED';
    } else if (!everythingIsChecked && everythingIsUnChecked) {
      this.mainErrorFilesCheckboxState = 'UNCHECKED';
    } else {
      this.mainErrorFilesCheckboxState = 'INDETERMINATE';
    }
  }
}
