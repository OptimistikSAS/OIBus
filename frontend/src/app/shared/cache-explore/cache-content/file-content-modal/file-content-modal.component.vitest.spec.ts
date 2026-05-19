import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { beforeEach, describe, expect, test } from 'vitest';
import { FileContentModalComponent } from './file-content-modal.component';
import { provideI18nTesting } from '../../../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../../../test/vitest-create-mock';

describe('FileContentModalComponent', () => {
  let component: FileContentModalComponent;
  let fixture: ComponentFixture<FileContentModalComponent>;
  let mockModal: MockObject<NgbActiveModal>;

  beforeEach(async () => {
    mockModal = createMock(NgbActiveModal);

    await TestBed.configureTestingModule({
      imports: [TranslateDirective],
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: mockModal }]
    }).compileComponents();

    fixture = TestBed.createComponent(FileContentModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  test('should create', () => {
    expect(component).toBeTruthy();
  });

  test('should call prepare method with correct parameters', () => {
    const content = '{ "foo": "bar" }';
    component.prepare('file1', {
      content,
      contentFilename: 'contentFilename.json',
      contentType: 'json',
      totalSize: content.length,
      truncated: false
    });

    expect(component.filename).toEqual('file1');
    expect(component.fileCacheContent).toEqual({
      content,
      contentFilename: 'contentFilename.json',
      contentType: 'json',
      totalSize: content.length,
      truncated: false
    });
  });

  test('should load OibCodeBlockComponent', () => {
    const codeBlock = fixture.debugElement.nativeElement.querySelector('oib-code-block');
    expect(codeBlock).toBeTruthy();
  });

  test('should call dismiss method', () => {
    component.dismiss();
    expect(mockModal.dismiss).toHaveBeenCalled();
  });
});
