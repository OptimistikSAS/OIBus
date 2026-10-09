import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../../../test/vitest-create-mock';
import { FileContentModalComponent } from './file-content-modal.component';

class FileContentModalComponentTester {
  readonly fixture = TestBed.createComponent(FileContentModalComponent);
  readonly component = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading');
  readonly details = this.root.getByCss('.modal-body > .mb-2');
  readonly code = this.root.getByCss('oib-code-block');
  readonly closeButton = this.root.getByRole('button', { name: 'Close' });
}

describe('FileContentModalComponent', () => {
  let tester: FileContentModalComponentTester;
  let mockModal: MockObject<NgbActiveModal>;
  const content = '{ "foo": "bar" }';

  beforeEach(async () => {
    mockModal = createMock(NgbActiveModal);
    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: mockModal }]
    });
    tester = new FileContentModalComponentTester();
    await tester.fixture.whenStable();
  });

  test('should display the content of a file', async () => {
    tester.component.prepare('file1.json', {
      content,
      contentFilename: 'content.json',
      contentType: 'json',
      totalSize: content.length,
      truncated: false
    });

    await expect.element(tester.title).toHaveTextContent('Content of file content.json (file1.json)');
    await expect.element(tester.details).toMatchTextContent(/^Content size: 16 B\s*Content type: json$/);
    await expect.element(tester.code).toMatchTextContent(/"foo": "bar"/);
  });

  test('should display a truncated content as raw text', async () => {
    tester.component.prepare('file1.json', {
      content,
      contentFilename: 'content.json',
      contentType: 'json',
      totalSize: 2048,
      truncated: true
    });

    await expect
      .element(tester.details)
      .toMatchTextContent(
        /^Content is truncated. Real size: 2.0 kB. Retrieved size: 16 B\s*Content type: json. Displayed as raw text because the content is truncated$/
      );
    await expect.element(tester.code).toMatchTextContent(/"foo": "bar"/);
  });

  test('should dismiss', async () => {
    await tester.closeButton.click();

    expect(mockModal.dismiss).toHaveBeenCalled();
  });
});
