import { HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { DownloadService } from './download.service';

describe('DownloadService', () => {
  let service: DownloadService;

  beforeEach(() => {
    service = TestBed.inject(DownloadService);
  });

  test('should download the blob of an HTTP response', () => {
    const blob = new Blob(['test content'], { type: 'text/plain' });
    const downloadFile = vi.spyOn(service, 'downloadFile').mockImplementation(() => {});

    service.download(new HttpResponse<Blob>({ body: blob }), 'test-file.txt');

    expect(downloadFile).toHaveBeenCalledWith({ blob, name: 'test-file.txt' });
  });

  test('should download a file through a temporary link and release its URL', () => {
    const blob = new Blob(['test content'], { type: 'text/plain' });
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickedLinks: Array<{ href: string | null; download: string }> = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clickedLinks.push({ href: this.getAttribute('href'), download: this.download });
    });

    service.downloadFile({ blob, name: 'test-file.txt' });

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clickedLinks).toEqual([{ href: 'blob:mock-url', download: 'test-file.txt' }]);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});
