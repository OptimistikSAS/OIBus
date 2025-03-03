import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { FileContentModalComponent } from './file-content-modal.component';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock } from 'ngx-speculoos';
import testData from '../../../../../../backend/src/tests/utils/test-data';

describe('FileContentModalComponent', () => {
  let component: FileContentModalComponent;
  let fixture: ComponentFixture<FileContentModalComponent>;
  const mockModal = createMock(NgbActiveModal);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TranslateDirective],
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: mockModal }]
    }).compileComponents();

    fixture = TestBed.createComponent(FileContentModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call prepareForCreation method with correct parameters', () => {
    const contentFile = {
      metadataFilename: 'file1.json',
      metadata: {
        contentFile: '8-1696843490050.txt',
        contentSize: 6,
        numberOfElement: 0,
        createdAt: testData.constants.dates.DATE_1,
        contentType: 'raw',
        source: 'south',
        options: {}
      }
    };
    const content = '{ "foo": "bar" }';
    component.prepareForCreation(contentFile, content);

    expect(component.contentFile!.metadata.contentFile).toEqual(contentFile.metadata.contentFile);
    expect(component.content).toEqual(content);
  });

  it('should load OibCodeBlockComponent', () => {
    const codeBlock = fixture.debugElement.nativeElement.querySelector('oib-code-block');
    expect(codeBlock).toBeTruthy();
  });

  it('should call dismiss method', () => {
    component.dismiss();
    expect(mockModal.dismiss).toHaveBeenCalled();
  });
});
