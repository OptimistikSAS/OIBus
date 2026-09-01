import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, EMPTY, Subscription, switchMap } from 'rxjs';
import { ConfigurationWorkflowDTO } from '../../../../../../backend/shared/model/configuration-workflow.model';
import { Page } from '../../../../../../backend/shared/model/types';
import { WorkflowRunDTO } from '../../../../../../backend/shared/model/workflow-run.model';
import { PageLoader } from '../../../shared/page-loader.service';
import { emptyPage } from '../../../shared/test-utils';
import { ConfigurationWorkflowService } from '../../../services/configuration-workflow.service';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { DatetimePipe } from '../../../shared/datetime.pipe';

/**
 * Standalone, server-paginated page listing a Configuration Workflow's run history, most recent first.
 */
@Component({
  selector: 'oib-workflow-run-history',
  imports: [TranslateDirective, TranslatePipe, PaginationComponent, DatetimePipe],
  templateUrl: './workflow-run-history.component.html',
  styleUrl: './workflow-run-history.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  providers: [PageLoader]
})
export class WorkflowRunHistoryComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private pageLoader = inject(PageLoader);
  private configurationWorkflowService = inject(ConfigurationWorkflowService);

  southId!: string;
  workflowId!: string;
  workflow = signal<ConfigurationWorkflowDTO | null>(null);
  loading = signal(false);
  runs = signal<Page<WorkflowRunDTO>>(emptyPage());
  subscription = new Subscription();

  ngOnInit(): void {
    this.southId = this.route.snapshot.paramMap.get('southId')!;
    this.workflowId = this.route.snapshot.paramMap.get('workflowId')!;

    this.configurationWorkflowService.get(this.southId, this.workflowId).subscribe(workflow => this.workflow.set(workflow));

    this.subscription.add(
      this.pageLoader.pageLoads$
        .pipe(
          switchMap(page => {
            this.loading.set(true);
            return this.configurationWorkflowService.listRuns(this.southId, this.workflowId, page).pipe(catchError(() => EMPTY));
          })
        )
        .subscribe(runs => {
          this.runs.set(runs);
          this.loading.set(false);
        })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  back(): void {
    this.router.navigate(['/south', this.southId]);
  }
}
