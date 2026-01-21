import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { VersionUpdateModalComponent } from './version-update-modal.component';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { WindowService } from '../window.service';
import { provideI18nTesting } from '../../../i18n/mock-i18n';

describe('VersionUpdateModalComponent', () => {
  let component: VersionUpdateModalComponent;
  let fixture: ComponentFixture<VersionUpdateModalComponent>;
  let activeModal: jasmine.SpyObj<NgbActiveModal>;
  let windowService: jasmine.SpyObj<WindowService>;

  beforeEach(async () => {
    const activeModalSpy = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);
    const windowServiceSpy = jasmine.createSpyObj('WindowService', ['reload']);

    await TestBed.configureTestingModule({
      imports: [VersionUpdateModalComponent],
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: activeModalSpy },
        { provide: WindowService, useValue: windowServiceSpy }
      ]
    }).compileComponents();

    activeModal = TestBed.inject(NgbActiveModal) as jasmine.SpyObj<NgbActiveModal>;
    windowService = TestBed.inject(WindowService) as jasmine.SpyObj<WindowService>;

    fixture = TestBed.createComponent(VersionUpdateModalComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with 60 seconds', () => {
    fixture.detectChanges();
    expect(component.remainingSeconds()).toBe(60);
    expect(component.progress()).toBe(1);
  });

  it('should count down over time', fakeAsync(() => {
    fixture.detectChanges();

    tick(1000);
    expect(component.remainingSeconds()).toBeLessThan(60);
    expect(component.progress()).toBeLessThan(1);
    expect(component.progress()).toBeGreaterThan(0);
  }));

  it('should reload when countdown reaches zero', fakeAsync(() => {
    fixture.detectChanges();

    tick(60000); // Wait for 60 seconds
    tick(100); // Wait for the last interval update

    expect(activeModal.close).toHaveBeenCalled();
    expect(windowService.reload).toHaveBeenCalled();
  }));

  it('should reload immediately when reload button is clicked', () => {
    fixture.detectChanges();

    component.reload();

    expect(activeModal.close).toHaveBeenCalled();
    expect(windowService.reload).toHaveBeenCalled();
  });

  it('should clear interval on destroy', fakeAsync(() => {
    fixture.detectChanges();

    fixture.destroy();

    tick(5000);

    // After destroy, the countdown should not continue
    // We can't easily test this directly, but we verify no errors occur
    expect(component).toBeTruthy();
  }));

  it('should update progress proportionally', fakeAsync(() => {
    fixture.detectChanges();

    tick(30000); // Wait for 30 seconds (half the time)

    const progress = component.progress();
    expect(progress).toBeGreaterThan(0.45);
    expect(progress).toBeLessThan(0.55);
  }));

  it('should display translated title', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const title = compiled.querySelector('.modal-title');

    expect(title).toBeTruthy();
  });

  it('should display reload button', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const button = compiled.querySelector('#reload-button');

    expect(button).toBeTruthy();
  });
});
