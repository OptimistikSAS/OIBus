import { Component, OnInit } from '@angular/core';
import { NgForOf, NgIf } from '@angular/common';
import { switchMap } from 'rxjs';
import { ProxyDTO } from '../../../../../shared/model/proxy.model';
import { EditProxyModalComponent } from '../edit-proxy-modal/edit-proxy-modal.component';
import { Modal, ModalService } from '../../shared/modal.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { ProxyService } from '../../services/proxy.service';
import { NotificationService } from '../../shared/notification.service';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'oib-proxy-list',
  standalone: true,
  imports: [NgIf, NgForOf, TranslateModule],
  templateUrl: './proxy-list.component.html',
  styleUrls: ['./proxy-list.component.scss']
})
export class ProxyListComponent implements OnInit {
  proxies: Array<ProxyDTO> = [];

  constructor(
    private confirmationService: ConfirmationService,
    private modalService: ModalService,
    private notificationService: NotificationService,
    private proxyService: ProxyService
  ) {}

  ngOnInit() {
    this.proxyService.getProxies().subscribe(proxyList => {
      this.proxies = proxyList;
    });
  }

  /**
   * Open a modal to edit a proxy
   */
  openEditProxyModal(proxy: ProxyDTO) {
    const modalRef = this.modalService.open(EditProxyModalComponent);
    const component: EditProxyModalComponent = modalRef.componentInstance;
    component.prepareForEdition(proxy);
    this.refreshAfterEditProxyModalClosed(modalRef, 'updated');
  }

  /**
   * Open a modal to create a proxy
   */
  openCreationProxyModal() {
    const modalRef = this.modalService.open(EditProxyModalComponent);
    const component: EditProxyModalComponent = modalRef.componentInstance;
    component.prepareForCreation();
    this.refreshAfterEditProxyModalClosed(modalRef, 'created');
  }

  /**
   * Refresh the proxy list when the proxy is edited
   */
  private refreshAfterEditProxyModalClosed(modalRef: Modal<any>, mode: 'created' | 'updated') {
    modalRef.result.subscribe((proxy: ProxyDTO) => {
      this.proxyService.getProxies().subscribe(proxies => {
        this.proxies = proxies;
      });
      this.notificationService.success(`engine.proxy.${mode}`, {
        name: proxy.name
      });
    });
  }

  /**
   * Delete a proxy by its ID
   */
  deleteProxy(proxy: ProxyDTO) {
    this.confirmationService
      .confirm({
        messageKey: 'engine.proxy.confirm-deletion',
        interpolateParams: { name: proxy.name }
      })
      .pipe(
        switchMap(() => {
          return this.proxyService.deleteProxy(proxy.id);
        })
      )
      .subscribe(() => {
        this.proxyService.getProxies().subscribe(proxies => {
          this.proxies = proxies;
        });
        this.notificationService.success('engine.proxy.deleted', {
          name: proxy.name
        });
      });
  }
}
