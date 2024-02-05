import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProgressbarComponent } from './progressbar.component';

describe('ProgressbarComponent', () => {
  let component: ProgressbarComponent;
  let fixture: ComponentFixture<ProgressbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProgressbarComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ProgressbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set the width of the progress bar', () => {
    component.value = 0.5;
    fixture.detectChanges();
    // class .progress-bar is a child of ngb-progressbar
    const progressBar = fixture.nativeElement.querySelector('.progress-bar');
    expect(progressBar.style.width).toBe('50%');
  });

  it('should set the width of the progress bar to 100%', () => {
    component.value = 1;
    fixture.detectChanges();
    const progressBar = fixture.nativeElement.querySelector('.progress-bar');
    expect(progressBar.style.width).toBe('100%');
  });

  it('should animate the progress bar', () => {
    component.value = 0.5;
    component.animated = true;
    fixture.detectChanges();
    const progressBar = fixture.nativeElement.querySelector('.progress-bar');
    expect(progressBar.classList).toContain('progress-bar-animated');
  });

  it('should take max value into account', () => {
    component.value = 63;
    component.max = 180;
    fixture.detectChanges();
    const progressBar = fixture.nativeElement.querySelector('.progress-bar');
    expect(progressBar.style.width).toBe('35%');
  });
});
