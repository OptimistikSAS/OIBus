import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import testData from '../../../test/test-data';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { SouthConnectorService } from '../../services/south-connector.service';
import { SouthExploreModalComponent } from './south-explore-modal.component';

class SouthExploreModalComponentTester {
  readonly fixture = TestBed.createComponent(SouthExploreModalComponent);
  readonly component = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly cancel = this.root.getByRole('button', { name: 'Close' });
  readonly tree = this.root.getByCss('#explore-tree');
  readonly title = this.root.getByRole('heading');
}

describe('SouthExploreModalComponent', () => {
  let tester: SouthExploreModalComponentTester;
  let fakeActiveModal: MockObject<NgbActiveModal>;
  let southConnectorService: MockObject<SouthConnectorService>;

  const southConnector = testData.south.list[0];

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);
    southConnectorService = createMock(SouthConnectorService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: fakeActiveModal },
        { provide: SouthConnectorService, useValue: southConnectorService }
      ]
    });

    tester = new SouthExploreModalComponentTester();
    southConnectorService.closeExplore.mockReturnValue(of(undefined));
    southConnectorService.startExplore.mockReturnValue(
      of({ sessionId: 'sessionId', entries: [{ id: 'ns=0;i=85', name: 'Objects', metadata: { type: 'Object' }, hasChildren: true }] })
    );
  });

  test('should forward prepare() to the embedded explore tree, even when called before the view is first checked', async () => {
    // Mirrors every real caller: prepare() is invoked immediately after modalService.open(), before the view child is resolved
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type);

    await expect.element(tester.tree).toBeInTheDocument();
    expect(southConnectorService.startExplore).toHaveBeenCalledWith(southConnector.id, southConnector.settings, southConnector.type);
    await expect.element(tester.title).toHaveTextContent('Explore data source');
  });

  test('should forward prepare() to the embedded explore tree when the view is already checked', async () => {
    await tester.fixture.whenStable();

    tester.component.prepare(null, southConnector.settings, southConnector.type);

    await expect.element(tester.tree).toBeInTheDocument();
    expect(southConnectorService.startExplore).toHaveBeenCalledWith('create', southConnector.settings, southConnector.type);
  });

  test('should close with the selected node', async () => {
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type, undefined, true);

    await tester.root.getByRole('button', { name: 'Select' }).click();

    expect(fakeActiveModal.close).toHaveBeenCalledWith({
      id: 'ns=0;i=85',
      name: 'Objects',
      metadata: { type: 'Object' },
      hasChildren: true
    });
  });

  test('should dismiss on cancel', async () => {
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type);

    await tester.cancel.click();

    expect(fakeActiveModal.dismiss).toHaveBeenCalled();
  });
});
