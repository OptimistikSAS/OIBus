import { Injectable } from '@angular/core';
import { HttpResponse } from '@angular/common/http';

/**
 * Service used to trigger the download of a blob contained in an HTTP response.
 */
@Injectable({
  providedIn: 'root'
})
export class DownloadService {
  constructor() {}

  /**
   * Triggers the download of the blob contained in the given response, using the file name
   * It consists in creating a link, setting its href and download attributes, clicking the link,
   * then revoking the URL created from the blob to make it eligible to garbage collection.
   */
  download(response: HttpResponse<Blob>, filename: string) {
    this.downloadFile({ blob: response.body!, name: filename });
  }

  /**
   * Triggers the download of the given blob, using the given file name.
   * It consists in creating a link, setting its href and download attributes, clicking the link,
   * then revoking the URL created from the blob to make it eligible to garbage collection.
   */
  downloadFile(file: { blob: Blob; name: string }) {
    const downloadUrl = URL.createObjectURL(file.blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = file.name;
    link.click();

    URL.revokeObjectURL(downloadUrl);
  }
}
