import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { TranslateDirective } from '@ngx-translate/core';

import { ServerIdentity, SshHostKeyServerIdentityDetails, X509ServerIdentityDetails } from '@oibus/shared/domain/server-identity.model';

import { DatetimePipe } from '../../datetime.pipe';

/**
 * What an identity presented by a server says about it, to compare with the server before trusting it: its SHA-256
 * fingerprint and, for a certificate, its subject, issuer, validity and names. With the identity trusted before, when it
 * changed.
 */
@Component({
  selector: 'oib-server-identity',
  templateUrl: './server-identity.component.html',
  styleUrl: './server-identity.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, DatetimePipe]
})
export class ServerIdentityComponent {
  readonly identity = input.required<ServerIdentity>();
  /** The identity trusted before, shown when the server presents another one */
  readonly previous = input<ServerIdentity | null>(null);

  readonly x509 = computed(() => (this.identity().type === 'x509' ? (this.identity().details as X509ServerIdentityDetails) : null));
  readonly sshHostKey = computed(() =>
    this.identity().type === 'ssh-host-key' ? (this.identity().details as SshHostKeyServerIdentityDetails) : null
  );
  /** The identity trusted before, when it is not the one presented */
  readonly changedFrom = computed(() => {
    const previous = this.previous();
    return previous && previous.fingerprint !== this.identity().fingerprint ? previous : null;
  });
  /** Whether the certificate is not valid now */
  readonly outOfValidity = computed(() => {
    const x509 = this.x509();
    const now = Date.now();
    return !!x509 && (Date.parse(x509.validFrom) > now || Date.parse(x509.validTo) < now);
  });
}
