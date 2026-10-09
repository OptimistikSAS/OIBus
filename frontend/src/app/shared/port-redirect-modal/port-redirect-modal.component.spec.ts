import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { WindowService } from '../window.service';
import { PortRedirectModalComponent } from './port-redirect-modal.component';

class PortRedirectModalComponentTester {
  readonly fixture = TestBed.createComponent(PortRedirectModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading');
  readonly message = this.root.getByCss('.modal-body p');
  readonly remaining = this.root.getByCss('.progress-container span');
  readonly progressBar = this.root.getByRole('progressbar');
  readonly redirectButton = this.root.getByRole('button', { name: 'Redirect Now' });
}

describe('PortRedirectModalComponent', () => {
  let tester: PortRedirectModalComponentTester;
  let windowService: MockObject<WindowService>;

  beforeEach(() => {
    // only the countdown interval and the clock are faked: the locators and assertions keep their real timeouts
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    windowService = createMock(WindowService);

    TestBed.configureTestingModule({
      providers: [NgbActiveModal, { provide: WindowService, useValue: windowService }, provideI18nTesting()]
    });

    tester = new PortRedirectModalComponentTester();
    tester.fixture.componentInstance.initialize(3333);
  });

  afterEach(() => vi.useRealTimers());

  test('should display the new port and the countdown', async () => {
    await expect.element(tester.title).toHaveTextContent('Port Changed');
    await expect.element(tester.remaining).toHaveTextContent('30s');
    // the seconds of the message are not asserted: waiting for the translation advances the fake clock
    await expect
      .element(tester.message)
      .toMatchTextContent(/The web server port has been changed to 3333. You will be automatically redirected in \d+ seconds./);
    await expect.element(tester.progressBar).toHaveAttribute('aria-valuenow', '1');
  });

  test('should count down every second', async () => {
    await vi.advanceTimersByTimeAsync(15_000);

    await expect.element(tester.remaining).toHaveTextContent('15s');
    await expect.element(tester.progressBar).toHaveAttribute('aria-valuenow', '0.5');
    expect(windowService.redirectTo).not.toHaveBeenCalled();
  });

  test('should redirect to the new port when countdown reaches zero, and stop counting', async () => {
    await vi.advanceTimersByTimeAsync(30_000);

    const currentUrl = new URL(window.location.href);
    expect(windowService.redirectTo).toHaveBeenCalledWith(
      `${currentUrl.protocol}//${currentUrl.hostname}:3333${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`
    );

    await vi.advanceTimersByTimeAsync(10_000);
    expect(windowService.redirectTo).toHaveBeenCalledTimes(1);
  });

  test('should redirect immediately when redirect button is clicked, and stop counting', async () => {
    await tester.redirectButton.click();

    expect(windowService.redirectTo).toHaveBeenCalledWith(expect.stringContaining(':3333'));

    await vi.advanceTimersByTimeAsync(30_000);
    expect(windowService.redirectTo).toHaveBeenCalledTimes(1);
  });

  test('should stop counting when destroyed', async () => {
    tester.fixture.destroy();

    await vi.advanceTimersByTimeAsync(30_000);
    expect(windowService.redirectTo).not.toHaveBeenCalled();
  });
});
