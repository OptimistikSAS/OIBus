import { ServerTrustDTO, ServerTrustStateDTO } from '@oibus/shared/api/server-identity.model';
import { PresentedServerIdentity } from '@oibus/shared/domain/server-identity.model';

/** The settings telling which server a connector connects to: an identity is trusted for this server only */
const ENDPOINT_SETTINGS = ['url', 'host', 'port', 'securityMode', 'securityPolicy'];

/** The server the settings connect to, to drop an identity trusted in a form when it changes */
export function serverEndpointOf(settings: object | null | undefined): string {
  const values = (settings ?? {}) as Record<string, unknown>;
  return JSON.stringify(ENDPOINT_SETTINGS.map(key => values[key] ?? null));
}

/**
 * Whether the identity a server presents must be reviewed before the connector connects to it: not trusted, and not about
 * to be trusted at the first connection (a connector of a former version, see `ServerTrust.trustOnFirstUse`).
 */
export function mustReviewServerIdentity(presented: PresentedServerIdentity | null, serverTrust: ServerTrustDTO | null): boolean {
  if (!presented || presented.status === 'trusted') {
    return false;
  }
  return !(presented.status === 'unknown' && serverTrust?.trustOnFirstUse);
}

/**
 * The trust shown on the page of a connector: the identity it refused only while it runs (a stopped connector refuses
 * nothing), and nothing at all when there is nothing to show - no identity trusted, refused nor to trust at the first
 * connection, as for a connector which does not check the identity of its server with its settings (OPC UA with the
 * security mode None).
 */
export function toDisplayedServerTrust(state: ServerTrustStateDTO | null, running: boolean): ServerTrustStateDTO | null {
  if (!state) {
    return null;
  }
  const displayed = running ? state : { ...state, pending: null };
  return displayed.identity || displayed.pending || displayed.trustOnFirstUse ? displayed : null;
}
