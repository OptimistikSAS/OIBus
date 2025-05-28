import { TestBed } from '@angular/core/testing';
import { HttpResponse } from '@angular/common/http';
import { DownloadService } from './download.service';

describe('DownloadService', () => {
  let service: DownloadService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DownloadService]
    });
    service = TestBed.inject(DownloadService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should download a blob from HttpResponse', () => {
    const mockBlob = new Blob(['test content'], { type: 'text/plain' });
    const mockResponse = new HttpResponse<Blob>({ body: mockBlob });
    const filename = 'test-file.txt';

    spyOn(service, 'downloadFile').and.callThrough();
    spyOn(URL, 'createObjectURL').and.returnValue('mock-url');
    spyOn(document, 'createElement').and.returnValue({
      href: '',
      download: '',
      click: jasmine.createSpy('click'),
      setAttribute: jasmine.createSpy('setAttribute')
    } as unknown as HTMLAnchorElement);

    service.download(mockResponse, filename);

    expect(service.downloadFile).toHaveBeenCalledWith({ blob: mockBlob, name: filename });
  });

  it('should download a file', () => {
    const mockBlob = new Blob(['test content'], { type: 'text/plain' });
    const filename = 'test-file.txt';

    spyOn(URL, 'createObjectURL').and.returnValue('mock-url');
    spyOn(URL, 'revokeObjectURL');
    const linkSpy = jasmine.createSpyObj('a', ['click']);
    spyOn(document, 'createElement').and.returnValue(linkSpy);

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
