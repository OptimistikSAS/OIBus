import { TestBed } from '@angular/core/testing';
import { HttpResponse } from '@angular/common/http';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { DownloadService } from './download.service';

describe('DownloadService', () => {
  let service: DownloadService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DownloadService]
    });
    service = TestBed.inject(DownloadService);
  });

  test('should be created', () => {
    expect(service).toBeTruthy();
  });

  test('should download a blob from HttpResponse', () => {
    const mockBlob = new Blob(['test content'], { type: 'text/plain' });
    const mockResponse = new HttpResponse<Blob>({ body: mockBlob });
    const filename = 'test-file.txt';

    vi.spyOn(service, 'downloadFile');
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('mock-url');
    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click: vi.fn(),
      setAttribute: vi.fn()
    } as unknown as HTMLElement);

    service.download(mockResponse, filename);

    expect(service.downloadFile).toHaveBeenCalledWith({ blob: mockBlob, name: filename });
  });

  test('should download a file', () => {
    const mockBlob = new Blob(['test content'], { type: 'text/plain' });
    const filename = 'test-file.txt';

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('mock-url');
    vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);
    const linkSpy = { click: vi.fn(), href: '', download: '' };
    vi.spyOn(document, 'createElement').mockReturnValue(linkSpy as unknown as HTMLElement);

    service.downloadFile({ blob: mockBlob, name: filename });

    expect(URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    expect(document.createElement).toHaveBeenCalledWith('a');
    expect(linkSpy.href).toBe('mock-url');
    expect(linkSpy.download).toBe(filename);
    expect(linkSpy.click).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('mock-url');
  });
});
