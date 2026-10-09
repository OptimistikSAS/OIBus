import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';

import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { RegistrationSettingsDTO } from '@oibus/shared/api/engine.model';
import { OIBusCommandDTO } from '@oibus/shared/oia/command.model';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import testData from '../../../test/test-data';
import { createMock, MockObject, stubRoute } from '../../../test/vitest-create-mock';
import { EngineService } from '../../services/engine.service';
import { OibusCommandService } from '../../services/oibus-command.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { provideCurrentUser } from '../../shared/current-user-testing';
import { MockModalService, provideModalTesting } from '../../shared/mock-modal.service.testing';
import { NotificationService } from '../../shared/notification.service';
import { toPage } from '../../shared/utils/page.utils';
import { OIARegistrationComponent } from './oia-registration.component';
import { OiaCommandDetailsModalComponent } from './oibus-command-details-modal/oia-command-details-modal.component';
import { RegisterOibusModalComponent } from './register-oibus-modal/register-oibus-modal.component';

const registered = testData.oIAnalytics.registration.completed;
const notRegistered: RegistrationSettingsDTO = { ...registered, status: 'NOT_REGISTERED', activationDate: '', activationCode: '' };
const pending: RegistrationSettingsDTO = { ...registered, status: 'PENDING', activationDate: '', activationCode: 'ABC123' };
const commands: Array<OIBusCommandDTO> = [
  { ...testData.oIAnalytics.commands.oIBusList[0], status: 'COMPLETED', completedDate: '2020-03-16T00:00:00.000Z' },
  { ...testData.oIAnalytics.commands.oIBusList[1], status: 'RETRIEVED' }
];

class OIARegistrationComponentTester {
  readonly fixture = TestBed.createComponent(OIARegistrationComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading', { level: 1 }).first();
  readonly registerButton = this.root.getByRole('button', { name: 'Register' });
  readonly unregisterButton = this.root.getByRole('button', { name: 'Unregister' });
  readonly editRegisterButton = this.root.getByRole('button', { name: 'Edit registration' });
  readonly activationCode = this.root.getByRole('heading', { name: 'ABC123' });
  readonly hostLink = this.root.getByRole('link', { name: registered.host });
  readonly commandRows = this.root.getByCss('tbody tr');
  readonly noCommand = this.root.getByText('No command');
  readonly searchButton = this.root.getByRole('button', { name: 'Search' });
  readonly pagination = this.root.getByCss('oib-pagination');

  commandCell(row: number, column: number) {
    return this.commandRows.nth(row).getByCss('td').nth(column);
  }
}

describe('OIARegistrationComponent', () => {
  let engineService: MockObject<EngineService>;
  let oibusCommandService: MockObject<OibusCommandService>;
  let confirmationService: MockObject<ConfirmationService>;
  let notificationService: MockObject<NotificationService>;
  let modalService: MockModalService<RegisterOibusModalComponent | OiaCommandDetailsModalComponent>;

  beforeEach(() => {
    engineService = createMock(EngineService);
    oibusCommandService = createMock(OibusCommandService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);

    engineService.getInfo.mockReturnValue(of(testData.engine.oIBusInfo));
    engineService.getRegistrationSettings.mockReturnValue(of(registered));
    oibusCommandService.search.mockReturnValue(of(toPage(commands)));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        provideModalTesting(),
        provideCurrentUser(),
        { provide: ActivatedRoute, useValue: stubRoute({ queryParams: { types: 'restart-engine' } }) },
        { provide: EngineService, useValue: engineService },
        { provide: OibusCommandService, useValue: oibusCommandService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });
    modalService = TestBed.inject(MockModalService);
  });

  afterEach(() => vi.useRealTimers());

  describe('not registered', () => {
    beforeEach(() => engineService.getRegistrationSettings.mockReturnValue(of(notRegistered)));

    test('should display the register button', async () => {
      const tester = new OIARegistrationComponentTester();

      await expect.element(tester.title).toHaveTextContent('OIAnalytics registration');
      await expect.element(tester.registerButton).toBeInTheDocument();
      await expect.element(tester.unregisterButton).not.toBeInTheDocument();
      await expect.element(tester.commandRows).toHaveLength(0);
    });

    test('should register and check the registration again', async () => {
      const fakeModal = createMock(RegisterOibusModalComponent);
      modalService.mockClosedModal(fakeModal);
      const tester = new OIARegistrationComponentTester();
      await expect.element(tester.registerButton).toBeInTheDocument();
      engineService.getRegistrationSettings.mockReturnValue(of(pending));

      await tester.registerButton.click();

      expect(fakeModal.prepare).toHaveBeenCalledWith(notRegistered, 'register', testData.engine.oIBusInfo.ignoreRemoteUpdate);
      expect(notificationService.success).toHaveBeenCalledWith('oia-module.registration.saved');
      await expect.element(tester.activationCode).toBeInTheDocument();
    });

    test('should not check the registration again when the registration is cancelled', async () => {
      modalService.mockDismissedModal(createMock(RegisterOibusModalComponent));
      const tester = new OIARegistrationComponentTester();

      await tester.registerButton.click();

      expect(engineService.getRegistrationSettings).toHaveBeenCalledTimes(1);
      expect(notificationService.success).not.toHaveBeenCalled();
    });
  });

  describe('pending', () => {
    test('should display the activation code', async () => {
      engineService.getRegistrationSettings.mockReturnValue(of(pending));
      const tester = new OIARegistrationComponentTester();

      await expect.element(tester.activationCode).toBeInTheDocument();
      await expect.element(tester.root.getByText(/^Expired on/)).toBeInTheDocument();
      await expect.element(tester.registerButton).not.toBeInTheDocument();
    });

    test('should check the registration every 3 seconds until it is no longer pending', async () => {
      vi.useFakeTimers();
      engineService.getRegistrationSettings.mockReturnValue(of(pending));
      const tester = new OIARegistrationComponentTester();
      await vi.advanceTimersByTimeAsync(0);
      expect(engineService.getRegistrationSettings).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(3000);
      expect(engineService.getRegistrationSettings).toHaveBeenCalledTimes(2);

      engineService.getRegistrationSettings.mockReturnValue(of(registered));
      await vi.advanceTimersByTimeAsync(3000);
      expect(engineService.getRegistrationSettings).toHaveBeenCalledTimes(3);
      expect(tester.fixture.componentInstance.registration()).toEqual(registered);

      await vi.advanceTimersByTimeAsync(9000);
      expect(engineService.getRegistrationSettings).toHaveBeenCalledTimes(3);
    });

    test('should unregister and stop checking the registration', async () => {
      vi.useFakeTimers();
      engineService.getRegistrationSettings.mockReturnValue(of(pending));
      engineService.unregister.mockReturnValue(of(undefined));
      confirmationService.confirm.mockReturnValue(of(undefined));
      const tester = new OIARegistrationComponentTester();
      await vi.advanceTimersByTimeAsync(0);
      engineService.getRegistrationSettings.mockReturnValue(of(notRegistered));

      tester.root.getByRole('button', { name: 'Unregister' }).element().dispatchEvent(new MouseEvent('click'));

      expect(confirmationService.confirm).toHaveBeenCalledWith({ messageKey: 'oia-module.registration.confirm-unregistration' });
      expect(engineService.unregister).toHaveBeenCalled();
      expect(notificationService.success).toHaveBeenCalledWith('oia-module.registration.unregistered');
      expect(tester.fixture.componentInstance.registration()).toEqual(notRegistered);
      const calls = engineService.getRegistrationSettings.mock.calls.length;
      await vi.advanceTimersByTimeAsync(9000);
      expect(engineService.getRegistrationSettings).toHaveBeenCalledTimes(calls);
    });
  });

  describe('registered', () => {
    test('should display the registration and the commands', async () => {
      const tester = new OIARegistrationComponentTester();

      await expect.element(tester.hostLink).toHaveAttribute('href', registered.host);
      await expect.element(tester.commandRows).toHaveLength(2);
      await expect.element(tester.commandCell(0, 2)).toHaveTextContent(`Upgrade version (${commands[0].id})`);
      await expect.element(tester.commandCell(0, 3)).toHaveTextContent('Completed');
      await expect.element(tester.commandCell(1, 3)).toHaveTextContent('Pending');
      // details only for the completed or errored commands
      await expect.element(tester.commandRows.nth(0).getByRole('button', { name: 'Command details' })).toBeInTheDocument();
      await expect.element(tester.commandRows.nth(1).getByRole('button', { name: 'Command details' })).not.toBeInTheDocument();
      await expect.element(tester.pagination).toBeInTheDocument();
      expect(oibusCommandService.search).toHaveBeenCalledWith({
        page: 0,
        types: ['restart-engine'],
        status: [],
        start: undefined,
        end: undefined,
        ack: undefined
      });
    });

    test('should display an empty command list', async () => {
      oibusCommandService.search.mockReturnValue(of(toPage([])));
      const tester = new OIARegistrationComponentTester();

      await expect.element(tester.noCommand).toBeInTheDocument();
      await expect.element(tester.pagination).not.toBeInTheDocument();
    });

    test('should refresh the commands every 10 seconds', async () => {
      vi.useFakeTimers();
      new OIARegistrationComponentTester();
      await vi.advanceTimersByTimeAsync(0);
      expect(oibusCommandService.search).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(10_000);

      expect(oibusCommandService.search).toHaveBeenCalledTimes(2);
    });

    test('should search the commands', async () => {
      const tester = new OIARegistrationComponentTester();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

      await tester.searchButton.click();

      expect(navigate).toHaveBeenCalledWith(['.'], {
        queryParams: { types: ['restart-engine'], status: [], page: 0 },
        relativeTo: TestBed.inject(ActivatedRoute)
      });
    });

    test('should open the details of a command', async () => {
      const fakeModal = createMock(OiaCommandDetailsModalComponent);
      modalService.mockClosedModal(fakeModal);
      const tester = new OIARegistrationComponentTester();

      await tester.commandRows.nth(0).getByRole('button', { name: 'Command details' }).click();

      expect(fakeModal.prepare).toHaveBeenCalledWith(commands[0]);
    });

    test('should delete a command and refresh the list', async () => {
      confirmationService.confirm.mockReturnValue(of(undefined));
      oibusCommandService.delete.mockReturnValue(of(undefined));
      const tester = new OIARegistrationComponentTester();
      await expect.element(tester.commandRows).toHaveLength(2);
      oibusCommandService.search.mockReturnValue(of(toPage([commands[1]])));

      await tester.commandRows.nth(0).getByRole('button', { name: 'Delete command' }).click();

      expect(confirmationService.confirm).toHaveBeenCalledWith({ messageKey: 'oia-module.commands.confirm-delete' });
      expect(oibusCommandService.delete).toHaveBeenCalledWith(commands[0]);
      expect(notificationService.success).toHaveBeenCalledWith('oia-module.commands.deleted');
      await expect.element(tester.commandRows).toHaveLength(1);
    });

    test('should edit the registration', async () => {
      const fakeModal = createMock(RegisterOibusModalComponent);
      modalService.mockClosedModal(fakeModal);
      const tester = new OIARegistrationComponentTester();
      await expect.element(tester.hostLink).toBeInTheDocument();
      const updated = { ...registered, host: 'http://updated:4200' };
      engineService.getRegistrationSettings.mockReturnValue(of(updated));

      await tester.editRegisterButton.click();

      expect(fakeModal.prepare).toHaveBeenCalledWith(registered, 'edit', testData.engine.oIBusInfo.ignoreRemoteUpdate);
      expect(notificationService.success).toHaveBeenCalledWith('oia-module.registration.saved');
      await expect.element(tester.root.getByRole('link', { name: 'http://updated:4200' })).toBeInTheDocument();
    });

    test('should unregister', async () => {
      engineService.unregister.mockReturnValue(of(undefined));
      confirmationService.confirm.mockReturnValue(of(undefined));
      const tester = new OIARegistrationComponentTester();
      await expect.element(tester.hostLink).toBeInTheDocument();
      engineService.getRegistrationSettings.mockReturnValue(of(notRegistered));

      await tester.unregisterButton.click();

      await expect.element(tester.registerButton).toBeInTheDocument();
      await expect.element(tester.commandRows).toHaveLength(0);
    });
  });
});
