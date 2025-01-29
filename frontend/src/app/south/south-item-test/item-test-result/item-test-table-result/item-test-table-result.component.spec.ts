import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ItemTestTableResultComponent } from './item-test-table-result.component';
describe('ItemTestTableResultComponent', () => {
  let component: ItemTestTableResultComponent;
  let fixture: ComponentFixture<ItemTestTableResultComponent>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ItemTestTableResultComponent] }).compileComponents();
    fixture = TestBed.createComponent(ItemTestTableResultComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
