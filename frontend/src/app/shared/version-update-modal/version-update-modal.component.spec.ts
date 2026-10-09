import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { WindowService } from '../window.service';
import { VersionUpdateModalComponent } from './version-update-modal.component';

class VersionUpdateModalComponentTester {
  readonly fixture = TestBed.createComponent(VersionUpdateModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading');
  readonly message = this.root.getByCss('.modal-body p').first();
  readonly versions = this.root.getByCss('.modal-body p').nth(1);
  readonly remaining = this.root.getByCss('.progress-text');
  readonly progressBar = this.root.getByRole('progressbar');
  readonly reloadButton = this.root.getByRole('button', { name: 'Reload Now' });
}

describe('VersionUpdateModalComponent', () => {
  let tester: VersionUpdateModalComponentTester;
  let activeModal: MockObject<NgbActiveModal>;
  let windowService: MockObject<WindowService>;

  beforeEach(() => {
    // only the countdown interval and the clock are faked: the locators and assertions keep their real timeouts
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    activeModal = createMock(NgbActiveModal);
    windowService = createMock(WindowService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: WindowService, useValue: windowService }
      ]
    });

    tester = new VersionUpdateModalComponentTester();
    tester.fixture.componentInstance.initialize('3.4.0', '3.5.0');
  });

  afterEach(() => vi.useRealTimers());

  test('should display the versions and a 60 seconds countdown', async () => {
    await expect.element(tester.title).toHaveTextContent('Update Available');
    await expect.element(tester.remaining).toHaveTextContent('60s');
    await expect.element(tester.versions).toHaveTextContent('3.4.0 3.5.0');
    // the seconds of the message are not asserted: waiting for the translation advances the fake clock
    await expect.element(tester.message).toMatchTextContent(/The page will automatically reload in \d+ seconds/);
    await expect.element(tester.progressBar).toHaveAttribute('aria-valuenow', '1');
  });

  test('should count down over time', async () => {
    await vi.advanceTimersByTimeAsync(30_000);

    await expect.element(tester.remaining).toHaveTextContent('30s');
    await expect.element(tester.progressBar).toHaveAttribute('aria-valuenow', '0.5');
    expect(windowService.reload).not.toHaveBeenCalled();
  });

  test('should reload when countdown reaches zero, and stop counting', async () => {
    await vi.advanceTimersByTimeAsync(60_000);

    expect(activeModal.close).toHaveBeenCalled();
    expect(windowService.reload).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(windowService.reload).toHaveBeenCalledTimes(1);
  });

  test('should reload immediately when reload button is clicked', async () => {
    await tester.reloadButton.click();

    expect(activeModal.close).toHaveBeenCalled();
    expect(windowService.reload).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(windowService.reload).toHaveBeenCalledTimes(1);
  });

  test('should stop counting when destroyed', async () => {
    tester.fixture.destroy();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(windowService.reload).not.toHaveBeenCalled();
  });
});
