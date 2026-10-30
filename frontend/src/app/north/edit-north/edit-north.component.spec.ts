import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';

import { firstValueFrom, isObservable, of } from 'rxjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { NorthConnectorDTO } from '@oibus/shared/api/north-connector.model';
import { NorthConnectorManifest, NorthType } from '@oibus/shared/connector/north-manifest.model';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { EmptyRouteComponent } from '../../../test/empty-route.component';
import testData from '../../../test/test-data';
import { createMock, MockObject, stubRoute } from '../../../test/vitest-create-mock';
import { CertificateService } from '../../services/certificate.service';
import { EngineService } from '../../services/engine.service';
import { NorthConnectorService } from '../../services/north-connector.service';
import { ScanModeService } from '../../services/scan-mode.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { TransformerService } from '../../services/transformer.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { DefaultValidationErrorsComponent } from '../../shared/default-validation-errors/default-validation-errors.component';
import { MockModalService, provideModalTesting } from '../../shared/mock-modal.service.testing';
import { NotificationService } from '../../shared/notification.service';
import { TestConnectionResultModalComponent } from '../../shared/test-connection-result-modal/test-connection-result-modal.component';
import { UnsavedChangesConfirmationService } from '../../shared/unsaved-changes-confirmation.service';
import { EditNorthComponent, NorthConnectorStep } from './edit-north.component';

const manifest: NorthConnectorManifest = {
  ...testData.north.manifest,
  id: 'file-writer',
  settings: {
    ...testData.north.manifest.settings,
    attributes: [
      {
        type: 'string',
        key: 'outputFolder',
        translationKey: 'configuration.oibus.manifest.north.file-writer.output-folder',
        defaultValue: null,
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 0, columns: 4, displayInViewMode: true }
      }
    ]
  }
};

class EditNorthComponentTester {
  readonly fixture = TestBed.createComponent(EditNorthComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading', { level: 1 });
  readonly name = this.root.getByLabelText('Name', { exact: true });
  readonly description = this.root.getByLabelText('Description', { exact: true });
  readonly outputFolder = this.root.getByLabelText('Output folder');
  readonly scanMode = this.root.getByLabelText('Schedule');
  readonly numberOfElements = this.root.getByLabelText('Number of elements');
  // the transformers of the sources: without south, only the one of the OIBus API data source
  readonly deleteTransformerButtons = this.root.getByCss('oib-north-transformers').getByRole('button', { name: 'Delete transformer' });
  readonly saveButton = this.root.getByRole('button', { name: 'Save' });
  readonly testButton = this.root.getByRole('button', { name: 'Test settings' });
  readonly nextButton = this.root.getByRole('button', { name: 'Next' });
  readonly backButton = this.root.getByRole('button', { name: 'Back' });
  readonly reviewErrors = this.root.getByCss('#review-errors');
  readonly reviewChanges = this.root.getByCss('#review-changes');
  readonly transformerChanges = this.root.getByCss('#transformer-changes');
  readonly cachingSummary = this.root.getByCss('#caching-summary');

  step(step: NorthConnectorStep) {
    return this.root.getByCss(`#north-step-${step}`);
  }

  async goTo(step: NorthConnectorStep) {
    await this.step(step).click();
  }

  /** The button of a mode of the connector step: "Duplicate existing" or "New settings" */
  connectorMode(name: 'Duplicate existing' | 'New settings') {
    return this.root.getByRole('button', { name, exact: true });
  }

  /** The card of an existing connector or of a type of the connector step, by the name it starts with */
  connectorCard(name: string) {
    return this.root.getByRole('button', { name: new RegExp(`^${name}`) });
  }
}

describe('EditNorthComponent', () => {
  let northConnectorService: MockObject<NorthConnectorService>;
  let notificationService: MockObject<NotificationService>;
  let unsavedChangesConfirmationService: MockObject<UnsavedChangesConfirmationService>;
  let northConnector: NorthConnectorDTO;

  function configure(route: { params?: Record<string, string>; queryParams?: Record<string, string> }) {
    const engineService = createMock(EngineService);
    engineService.getInfo.mockReturnValue(of(testData.engine.oIBusInfo));
    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([{ path: 'north/:northId', component: EmptyRouteComponent }]),
        provideModalTesting(),
        { provide: ActivatedRoute, useValue: stubRoute(route) },
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: ScanModeService, useValue: scanModeService },
        { provide: CertificateService, useValue: certificateService },
        { provide: TransformerService, useValue: transformerService },
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService },
        { provide: EngineService, useValue: engineService },
        { provide: UnsavedChangesConfirmationService, useValue: unsavedChangesConfirmationService }
      ]
    });
    TestBed.createComponent(DefaultValidationErrorsComponent);
  }

  let scanModeService: MockObject<ScanModeService>;
  let certificateService: MockObject<CertificateService>;
  let transformerService: MockObject<TransformerService>;
  let southConnectorService: MockObject<SouthConnectorService>;
  let confirmationService: MockObject<ConfirmationService>;

  beforeEach(() => {
    northConnectorService = createMock(NorthConnectorService);
    scanModeService = createMock(ScanModeService);
    certificateService = createMock(CertificateService);
    transformerService = createMock(TransformerService);
    southConnectorService = createMock(SouthConnectorService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);
    unsavedChangesConfirmationService = createMock(UnsavedChangesConfirmationService);

    northConnector = structuredClone(testData.north.list[0]);
    northConnectorService.getNorthManifest.mockReturnValue(of(manifest));
    northConnectorService.list.mockReturnValue(of(testData.north.listLight));
    northConnectorService.findById.mockReturnValue(of(northConnector));
    northConnectorService.create.mockReturnValue(of(northConnector));
    northConnectorService.update.mockReturnValue(of(undefined));
    scanModeService.list.mockReturnValue(of(testData.scanMode.list));
    certificateService.list.mockReturnValue(of([]));
    transformerService.list.mockReturnValue(of([]));
    southConnectorService.list.mockReturnValue(of([]));
    confirmationService.confirm.mockReturnValue(of(undefined));
    unsavedChangesConfirmationService.confirmUnsavedChanges.mockReturnValue(of(true));
  });

  describe('create mode', () => {
    beforeEach(() => configure({ queryParams: { type: 'file-writer' } }));

    test('should display an empty form with default values', async () => {
      const tester = new EditNorthComponentTester();

      await expect.element(tester.title).toHaveTextContent('Create File writer north connector');
      expect(northConnectorService.getNorthManifest).toHaveBeenCalledWith('file-writer');
      expect(northConnectorService.findById).not.toHaveBeenCalled();
      await expect.element(tester.name).toHaveValue('');
      await tester.goTo('caching');
      await expect.element(tester.numberOfElements).toHaveValue(1000);
      await expect.element(tester.deleteTransformerButtons).toHaveLength(0);
    });

    test('should go through the steps of a new connector, the next one opening once the current one is valid', async () => {
      const tester = new EditNorthComponentTester();
      // the settings come first, to be tested right away
      await expect.element(tester.step('settings')).toHaveAttribute('aria-current', 'step');
      await expect.element(tester.testButton).toBeVisible();
      await expect.element(tester.saveButton).not.toBeInTheDocument();
      await expect.element(tester.backButton).not.toBeInTheDocument();

      await tester.nextButton.click();
      await expect.element(tester.step('settings')).toHaveAttribute('aria-current', 'step');
      await expect.element(tester.step('settings')).toHaveClass('modal-step-invalid');

      await tester.outputFolder.fill('/out');
      // Enter in a field opens the next step too
      await userEvent.keyboard('{Enter}');
      await expect.element(tester.step('caching')).toHaveAttribute('aria-current', 'step');
      await expect.element(tester.numberOfElements).toBeVisible();
      // the schedule is required
      await tester.nextButton.click();
      await expect.element(tester.step('caching')).toHaveAttribute('aria-current', 'step');
      await expect.element(tester.step('caching')).toHaveClass('modal-step-invalid');

      await tester.scanMode.selectOptions('scanMode1');
      await tester.nextButton.click();
      await expect.element(tester.root.getByRole('button', { name: 'Add a transformer' })).toBeVisible();
      await tester.backButton.click();
      await expect.element(tester.step('caching')).toHaveAttribute('aria-current', 'step');
      await tester.nextButton.click();
      await tester.nextButton.click();
      await expect.element(tester.step('general')).toHaveAttribute('aria-current', 'step');
      // the name is required
      await tester.nextButton.click();
      await expect.element(tester.step('general')).toHaveAttribute('aria-current', 'step');
      await expect.element(tester.step('general')).toHaveClass('modal-step-invalid');

      await tester.name.fill('New north');
      await tester.nextButton.click();
      await expect.element(tester.step('review')).toHaveAttribute('aria-current', 'step');
      await expect.element(tester.saveButton).toBeVisible();
      await expect.element(tester.nextButton).not.toBeInTheDocument();
      await expect.element(tester.reviewErrors).not.toBeInTheDocument();
      await expect.element(tester.reviewChanges).not.toBeInTheDocument();
      await expect.element(tester.cachingSummary).toMatchTextContent(/Schedule\s*scanMode1/);
      await expect.element(tester.cachingSummary).toMatchTextContent(/Minimum delay between two transmissions\s*200 ms/);
    });

    test('should list the steps to fix in the review, and open them', async () => {
      const tester = new EditNorthComponentTester();
      await tester.goTo('review');

      await expect.element(tester.reviewErrors).toMatchTextContent(/Fix these steps before saving:\s*Settings\s*Cache\s*General/);
      await tester.reviewErrors.getByRole('button', { name: 'Cache' }).click();

      await expect.element(tester.step('caching')).toHaveAttribute('aria-current', 'step');
    });

    test('should not save an invalid form', async () => {
      const tester = new EditNorthComponentTester();
      await tester.goTo('review');

      await tester.saveButton.click();

      // the first step with an error opens
      await expect.element(tester.step('settings')).toHaveAttribute('aria-current', 'step');
      await expect.element(tester.root.getByText('This field is required').first()).toBeVisible();
      expect(northConnectorService.create).not.toHaveBeenCalled();
    });

    test('should check that the name is unique', async () => {
      const tester = new EditNorthComponentTester();
      await tester.goTo('general');

      await tester.name.fill(' north 2 ');
      await tester.goTo('review');
      await tester.saveButton.click();

      await expect.element(tester.step('general')).toHaveClass('modal-step-invalid');
      await tester.goTo('general');
      await expect.element(tester.root.getByText('Must be unique')).toBeVisible();
      expect(northConnectorService.create).not.toHaveBeenCalled();
    });

    test('should create a north connector', async () => {
      const tester = new EditNorthComponentTester();

      await tester.outputFolder.fill('/out');
      await tester.goTo('caching');
      await tester.scanMode.selectOptions('scanMode1');
      await tester.goTo('general');
      await tester.name.fill('New north');
      await tester.description.fill('my description');
      await tester.goTo('review');
      await tester.saveButton.click();

      expect(northConnectorService.create).toHaveBeenCalledWith(
        {
          name: 'New north',
          type: 'file-writer',
          description: 'my description',
          enabled: true,
          settings: { outputFolder: '/out' },
          caching: {
            trigger: { scanModeId: 'scanModeId1', scanModeName: null, numberOfElements: 1000, numberOfFiles: 1 },
            throttling: { runMinDelay: 200, maxSize: 0, maxNumberOfElements: 10000 },
            error: { retryInterval: 5000, retryCount: 3, retentionDuration: 0 },
            archive: { enabled: false, retentionDuration: 72 }
          },
          transformers: []
        },
        ''
      );
      expect(notificationService.success).toHaveBeenCalledWith('north.created', { name: 'New north' });
      await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/north/northId1'));
    });

    test('should test the connection with the settings only', async () => {
      const modalService = TestBed.inject(MockModalService);
      const fakeModal = createMock(TestConnectionResultModalComponent);
      modalService.mockClosedModal(fakeModal);
      const tester = new EditNorthComponentTester();
      await tester.goTo('settings');

      await tester.testButton.click();
      await expect.element(tester.root.getByText('This field is required').first()).toBeVisible();
      expect(fakeModal.runTest).not.toHaveBeenCalled();

      await tester.outputFolder.fill('/out');
      await tester.testButton.click();

      expect(fakeModal.runTest).toHaveBeenCalledWith('north', null, { outputFolder: '/out' }, 'file-writer');
    });

    test('should ask for confirmation before leaving a modified form', async () => {
      const tester = new EditNorthComponentTester();
      await expect.element(tester.name).toBeInTheDocument();
      expect(tester.fixture.componentInstance.canDeactivate()).toBe(true);

      await tester.goTo('general');
      await tester.name.fill('New north');

      const result = tester.fixture.componentInstance.canDeactivate();
      expect(isObservable(result) && (await firstValueFrom(result))).toBe(true);
      expect(unsavedChangesConfirmationService.confirmUnsavedChanges).toHaveBeenCalled();
    });
  });

  describe('edit mode', () => {
    beforeEach(() => configure({ params: { northId: 'northId1' } }));

    test('should display the north connector without mutating it', async () => {
      const tester = new EditNorthComponentTester();

      await expect.element(tester.title).toHaveTextContent('Edit North 1');
      expect(northConnectorService.findById).toHaveBeenCalledWith('northId1');
      await expect.element(tester.name).toHaveValue('North 1');
      await tester.goTo('settings');
      await expect.element(tester.outputFolder).toHaveValue('output-folder');
      await tester.goTo('caching');
      await expect.element(tester.scanMode).toHaveDisplayValue('scanMode1');
      await expect.element(tester.numberOfElements).toHaveValue(250);
      await tester.goTo('transformers');
      await expect.element(tester.deleteTransformerButtons).toHaveLength(1);
      expect(northConnector).toEqual(testData.north.list[0]);
    });

    test('should save an edited connector from any step', async () => {
      const tester = new EditNorthComponentTester();
      await expect.element(tester.name).toHaveValue('North 1');
      await tester.goTo('caching');
      // Save is the main action, Next a subtle one
      await expect.element(tester.nextButton).toHaveClass('btn-subtle');

      await tester.saveButton.click();

      expect(northConnectorService.update).toHaveBeenCalledWith('northId1', expect.objectContaining({ name: 'North 1' }));
    });

    test('should show what changed since the edited connector was saved', async () => {
      const tester = new EditNorthComponentTester();
      await expect.element(tester.name).toHaveValue('North 1');
      await tester.goTo('review');
      await expect.element(tester.reviewChanges).toHaveTextContent('No change since the connector was saved');
      await expect.element(tester.transformerChanges).not.toBeInTheDocument();

      await tester.goTo('general');
      await tester.description.fill('changed description');
      await tester.goTo('caching');
      await tester.numberOfElements.fill('300');
      await tester.goTo('transformers');
      await tester.deleteTransformerButtons.nth(0).click();
      await tester.goTo('review');

      await expect.element(tester.reviewChanges).toHaveTextContent('Changes since the connector was saved: 3');
      await expect.element(tester.transformerChanges).toHaveTextContent('Transformers added: 0 · changed: 0 · removed: 1');
      await expect.element(tester.cachingSummary).toMatchTextContent(/Number of elements\s*Changed\s*300\s*Was\s*250/);
    });

    test('should accept its own name', async () => {
      const tester = new EditNorthComponentTester();
      await expect.element(tester.name).toHaveValue('North 1');

      await tester.goTo('general');
      await tester.name.fill('north 1');
      await tester.saveButton.click();

      expect(northConnectorService.update).toHaveBeenCalled();
    });

    test('should update the north connector with the in-memory transformers', async () => {
      const tester = new EditNorthComponentTester();
      await expect.element(tester.name).toHaveValue('North 1');

      await tester.goTo('transformers');
      await expect.element(tester.deleteTransformerButtons).toHaveLength(1);
      await tester.deleteTransformerButtons.nth(0).click();
      await tester.goTo('general');
      await tester.description.fill('updated');
      await tester.saveButton.click();

      expect(northConnectorService.removeTransformer).not.toHaveBeenCalled();
      const [northId, command] = northConnectorService.update.mock.lastCall!;
      expect(northId).toBe('northId1');
      expect(command).toEqual(
        expect.objectContaining({
          name: 'North 1',
          description: 'updated',
          caching: expect.objectContaining({
            trigger: { scanModeId: 'scanModeId1', scanModeName: null, numberOfElements: 250, numberOfFiles: 1 }
          })
        })
      );
      expect(command.transformers.map(transformer => transformer.id)).toEqual(['northTransformerId1', 'northTransformerId3']);
      expect(command.transformers[0]).toEqual(expect.objectContaining({ id: 'northTransformerId1', transformerId: 'transformerId1' }));
      expect(notificationService.success).toHaveBeenCalledWith('north.updated', { name: 'North 1' });
      expect(northConnectorService.findById).toHaveBeenCalledTimes(2);
      await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/north/northId1'));
    });

    test('should test the connection of the edited connector', async () => {
      const modalService = TestBed.inject(MockModalService);
      const fakeModal = createMock(TestConnectionResultModalComponent);
      modalService.mockClosedModal(fakeModal);
      const tester = new EditNorthComponentTester();
      await tester.goTo('settings');
      await expect.element(tester.outputFolder).toHaveValue('output-folder');

      await tester.testButton.click();

      expect(fakeModal.runTest).toHaveBeenCalledWith('north', 'northId1', { outputFolder: 'output-folder' }, 'file-writer');
    });
  });

  describe('duplicate mode', () => {
    beforeEach(() => configure({ queryParams: { duplicate: 'northId1' } }));

    test('should create a copy of the duplicated connector', async () => {
      const tester = new EditNorthComponentTester();

      await expect.element(tester.title).toHaveTextContent('Create File writer north connector');
      expect(northConnectorService.findById).toHaveBeenCalledWith('northId1');
      await expect.element(tester.name).toHaveValue('North 1');
      // the duplicated connector's name is already used
      await tester.goTo('general');
      await tester.name.fill('North 1 copy');
      await tester.goTo('review');
      // a copy is new: nothing to compare with
      await expect.element(tester.reviewChanges).not.toBeInTheDocument();
      await tester.saveButton.click();

      expect(northConnectorService.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'North 1 copy', type: 'file-writer' }),
        'northId1'
      );
      expect(northConnectorService.create.mock.lastCall![0].transformers).toHaveLength(3);
    });
  });

  describe('connector step', () => {
    const northTypes: Array<NorthType> = [
      { id: 'console', category: 'debug', types: ['file'] },
      { id: 'file-writer', category: 'file', types: ['file'] }
    ];

    beforeEach(() => {
      northConnectorService.getNorthTypes.mockReturnValue(of(northTypes));
      configure({});
    });

    test('should start a new connector with the type chosen in the first step', async () => {
      const tester = new EditNorthComponentTester();
      await expect.element(tester.step('connector')).toHaveAttribute('aria-current', 'step');
      await expect.element(tester.title).toHaveTextContent('Create a north connector');
      await expect.element(tester.connectorMode('New settings')).toHaveAttribute('aria-pressed', 'true');
      await expect.element(tester.root.getByRole('group', { name: 'Debug' })).toBeInTheDocument();
      await expect.element(tester.name).not.toBeInTheDocument();

      // a type is required
      await tester.nextButton.click();
      await expect.element(tester.root.getByText('This field is required')).toBeVisible();
      await expect.element(tester.step('connector')).toHaveClass('modal-step-invalid');
      expect(northConnectorService.getNorthManifest).not.toHaveBeenCalled();

      await tester.connectorCard('File writer').click();
      await tester.nextButton.click();

      await expect.element(tester.step('settings')).toHaveAttribute('aria-current', 'step');
      await expect.element(tester.title).toHaveTextContent('Create File writer north connector');
      expect(northConnectorService.getNorthManifest).toHaveBeenCalledWith('file-writer');
      expect(northConnectorService.findById).not.toHaveBeenCalled();
    });

    test('should duplicate the existing connector chosen in the first step', async () => {
      const tester = new EditNorthComponentTester();

      await tester.connectorMode('Duplicate existing').click();
      await tester.connectorCard('North 1').click();
      await tester.goTo('general');
      await expect.element(tester.name).toHaveValue('North 1');
      expect(northConnectorService.findById).toHaveBeenCalledWith('northId1');
      await tester.name.fill('North 1 copy');
      await tester.goTo('review');
      await tester.saveButton.click();

      expect(northConnectorService.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'North 1 copy', type: 'file-writer' }),
        'northId1'
      );
      expect(northConnectorService.create.mock.lastCall![0].transformers).toHaveLength(3);
    });

    test('should start the connector over, once confirmed, when another one is chosen', async () => {
      const tester = new EditNorthComponentTester();
      await tester.connectorMode('Duplicate existing').click();
      await tester.connectorCard('North 1').click();
      await tester.nextButton.click();
      await expect.element(tester.step('settings')).toHaveAttribute('aria-current', 'step');

      // back to the same connector: it is kept
      await tester.goTo('connector');
      await tester.goTo('caching');
      await expect.element(tester.step('caching')).toHaveAttribute('aria-current', 'step');
      expect(confirmationService.confirm).not.toHaveBeenCalled();
      expect(northConnectorService.findById).toHaveBeenCalledTimes(1);

      // a type starts it over, without the transformers of the duplicated connector
      await tester.goTo('connector');
      await tester.connectorMode('New settings').click();
      await tester.connectorCard('Console').click();
      await tester.nextButton.click();
      expect(confirmationService.confirm).toHaveBeenCalledWith({ messageKey: 'north.steps.confirm-connector-change' });
      await expect.element(tester.step('settings')).toHaveAttribute('aria-current', 'step');
      expect(northConnectorService.getNorthManifest).toHaveBeenLastCalledWith('console');
      await tester.goTo('general');
      await expect.element(tester.name).toHaveValue('');
      await tester.goTo('transformers');
      await expect.element(tester.deleteTransformerButtons).toHaveLength(0);
    });

    test('should not ask for confirmation to leave once the connector is saved', async () => {
      const tester = new EditNorthComponentTester();
      await tester.connectorCard('File writer').click();
      await tester.nextButton.click();
      await tester.outputFolder.fill('/out');
      await tester.goTo('caching');
      await tester.scanMode.selectOptions('scanMode1');
      await tester.goTo('general');
      await tester.name.fill('New north');
      await tester.goTo('review');

      await tester.saveButton.click();

      expect(northConnectorService.create).toHaveBeenCalled();
      expect(tester.fixture.componentInstance.canDeactivate()).toBe(true);
      expect(unsavedChangesConfirmationService.confirmUnsavedChanges).not.toHaveBeenCalled();
    });

    test('should ask for confirmation before leaving once a connector is chosen', async () => {
      const tester = new EditNorthComponentTester();
      await expect.element(tester.step('connector')).toHaveAttribute('aria-current', 'step');
      expect(tester.fixture.componentInstance.canDeactivate()).toBe(true);
      const confirmation = of(false);
      unsavedChangesConfirmationService.confirmUnsavedChanges.mockReturnValue(confirmation);

      await tester.connectorCard('Console').click();

      expect(tester.fixture.componentInstance.canDeactivate()).toBe(confirmation);
    });
  });
});
