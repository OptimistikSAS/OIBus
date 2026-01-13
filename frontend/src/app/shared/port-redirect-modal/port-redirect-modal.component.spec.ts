import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PortRedirectModalComponent } from './port-redirect-modal.component';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { WindowService } from '../window.service';
import { provideI18nTesting } from '../../../i18n/mock-i18n';

describe('PortRedirectModalComponent', () => {
  let component: PortRedirectModalComponent;
  let fixture: ComponentFixture<PortRedirectModalComponent>;
  let windowService: jasmine.SpyObj<WindowService>;

  beforeEach(async () => {
    const windowServiceSpy = jasmine.createSpyObj('WindowService', ['redirectTo']);

    await TestBed.configureTestingModule({
      imports: [PortRedirectModalComponent],
      providers: [NgbActiveModal, { provide: WindowService, useValue: windowServiceSpy }, provideI18nTesting()]
    }).compileComponents();

    windowService = TestBed.inject(WindowService) as jasmine.SpyObj<WindowService>;
    fixture = TestBed.createComponent(PortRedirectModalComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    if (component) {
      component.ngOnDestroy();
    }
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with the new port', () => {
    component.initialize(3333);
    expect(component.newPort()).toBe(3333);
  });

  it('should start countdown on init', () => {
    component.initialize(3333);
    component.ngOnInit();
    expect(component.secondsRemaining()).toBe(30);
    expect(component.progress()).toBe(1);
  });

  it('should redirect when countdown reaches zero', (done: DoneFn) => {
    jasmine.clock().install();

    component.initialize(3333);
    component.ngOnInit();

    // Fast forward time by 30 seconds
    jasmine.clock().tick(30000);

    // The redirect should have been called after 30 intervals
    expect(windowService.redirectTo).toHaveBeenCalled();

    jasmine.clock().uninstall();
    done();
  });

  it('should redirect immediately when redirect button is clicked', () => {
    component.initialize(3333);
    component.redirect();
    expect(windowService.redirectTo).toHaveBeenCalled();
  });

  it('should construct correct redirect URL', () => {
    component.initialize(3333);
    component.redirect();
    const redirectUrl = windowService.redirectTo.calls.mostRecent().args[0];
    expect(redirectUrl).toContain(':3333');
  });
});
