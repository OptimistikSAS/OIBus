import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BoxTableComponent } from './box-table.component';

describe('BoxTableComponent', () => {
  let component: BoxTableComponent;
  let fixture: ComponentFixture<BoxTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ BoxTableComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BoxTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
