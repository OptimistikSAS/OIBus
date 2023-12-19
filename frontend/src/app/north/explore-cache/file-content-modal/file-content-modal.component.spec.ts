import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { FileContentModalComponent } from './file-content-modal.component';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock } from 'ngx-speculoos';

describe('FileContentModalComponent', () => {
  let component: FileContentModalComponent;
  let fixture: ComponentFixture<FileContentModalComponent>;
  const mockModal = createMock(NgbActiveModal);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TranslateModule, CommonModule],
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
    const filename = 'test.json';
    const contentType = 'json';
    const content = '{ "foo": "bar" }';
    component.prepareForCreation(filename, contentType, content);

    expect(component.filename).toEqual(filename);
    expect(component.contentType).toEqual(contentType);
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
