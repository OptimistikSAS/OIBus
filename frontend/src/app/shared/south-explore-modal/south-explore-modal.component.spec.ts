import { SouthExploreModalComponent } from './south-explore-modal.component';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { SouthConnectorService } from '../../services/south-connector.service';
import { of } from 'rxjs';
import testData from '../../../../../backend/src/tests/utils/test-data';
import { beforeEach, describe, expect, test } from 'vitest';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { page } from 'vitest/browser';

class SouthExploreModalComponentTester {
  readonly fixture = TestBed.createComponent(SouthExploreModalComponent);
  readonly component = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly cancel = this.root.getByRole('button', { name: 'Close' });
  readonly tree = this.root.getByCss('#explore-tree');
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
    // Mirrors every real caller: prepare() is invoked immediately after modalService.open(), before
    // this fixture's own detectChanges() (and so @ViewChild resolution) has run.
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type);
    tester.fixture.detectChanges();

    expect(southConnectorService.startExplore).toHaveBeenCalledWith(southConnector.id, southConnector.settings, southConnector.type);
    await expect.element(tester.tree).toBeInTheDocument();
  });

  test('should dismiss on cancel', async () => {
    tester.component.prepare(southConnector.id, southConnector.settings, southConnector.type);
    tester.fixture.detectChanges();

    await tester.cancel.click();

    expect(fakeActiveModal.dismiss).toHaveBeenCalled();
  });
});
