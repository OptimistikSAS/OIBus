import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ItemTestCodeblockResultComponent } from './item-test-codeblock-result.component';
describe('ItemTestCodeblockResultComponent', () => {
  let component: ItemTestCodeblockResultComponent;
  let fixture: ComponentFixture<ItemTestCodeblockResultComponent>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ItemTestCodeblockResultComponent] }).compileComponents();
    fixture = TestBed.createComponent(ItemTestCodeblockResultComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
