import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProgressbarComponent } from './progressbar.component';
import { Component, signal } from '@angular/core';

@Component({
  selector: 'oib-test-progressbar-component',
  template: '<oib-progressbar [value]="value()" [max]="max()" [animated]="animated()" />',
  imports: [ProgressbarComponent]
})
class ProgressbarTestComponent {
  value = signal(0.5);
  max = signal(1);
  animated = signal(false);
}

describe('ProgressbarComponent', () => {
  let fixture: ComponentFixture<ProgressbarTestComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(ProgressbarTestComponent);
    fixture.detectChanges();
  });

  it('should set the width of the progress bar', () => {
    fixture.detectChanges();
    // class .progress-bar is a child of ngb-progressbar
    const progressBar = fixture.nativeElement.querySelector('.progress-bar');
    expect(progressBar.style.width).toBe('50%');
  });

  it('should set the width of the progress bar to 100%', () => {
    fixture.componentInstance.value.set(1);
    fixture.detectChanges();
    const progressBar = fixture.nativeElement.querySelector('.progress-bar');
    expect(progressBar.style.width).toBe('100%');
  });

  it('should animate the progress bar', () => {
    fixture.componentInstance.animated.set(true);
    fixture.detectChanges();
    const progressBar = fixture.nativeElement.querySelector('.progress-bar');
    expect(progressBar.classList).toContain('progress-bar-animated');
  });

  it('should take max value into account', () => {
    fixture.componentInstance.value.set(63);
    fixture.componentInstance.max.set(180);
    fixture.detectChanges();
    const progressBar = fixture.nativeElement.querySelector('.progress-bar');
    expect(progressBar.style.width).toBe('35%');
  });
});
