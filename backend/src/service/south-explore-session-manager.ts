import type SouthConnector from '../south/south-connector';
import { SouthItemSettings, SouthSettings } from '../../shared/model/south-settings.model';
import { SouthConnectorExploreEntry } from '../../shared/model/south-connector.model';
import { generateRandomId } from './utils';

// A stateful explore session keeps a connected South connector in memory so the user can
// interactively browse the data source (expand OPC-UA nodes, walk a folder tree, ...).
const DEFAULT_IDLE_TIMEOUT = 600_000; // 10 minutes of inactivity before a session is closed
const DEFAULT_MAX_SESSIONS = 20; // upper bound on concurrent live sessions

interface ExploreSession {
  id: string;
  south: SouthConnector<SouthSettings, SouthItemSettings>;
  state: 'ready' | 'closing';
  timer: NodeJS.Timeout;
}

/**
 * Holds interactive "explore" sessions in memory. Each session wraps a connected, ephemeral
 * South connector; the caller is responsible for building and connecting it before `start`.
 * Sessions are keyed by a generated id (never the connector id, which is shared by all
 * unsaved connectors) and are automatically closed after a period of inactivity.
 */
export default class SouthExploreSessionManager {
  private readonly sessions = new Map<string, ExploreSession>();

  constructor(
    private readonly idleTimeout: number = DEFAULT_IDLE_TIMEOUT,
    private readonly maxSessions: number = DEFAULT_MAX_SESSIONS
  ) {}

  /**
   * Register an already-connected South connector as a new explore session.
   * Evicts the oldest session first when the maximum number of sessions is reached.
   */
  async start(south: SouthConnector<SouthSettings, SouthItemSettings>): Promise<string> {
    if (this.sessions.size >= this.maxSessions) {
      const oldestId = this.sessions.keys().next().value;
      if (oldestId) {
        await this.close(oldestId);
      }
    }
    const id = generateRandomId();
    this.sessions.set(id, { id, south, state: 'ready', timer: this.armTimer(id) });
    return id;
  }

  /**
   * Browse (expand) an entry within a session. Resets the session's idle timer.
   */
  async browse(sessionId: string, parentId: string | null): Promise<Array<SouthConnectorExploreEntry>> {
    const session = this.sessions.get(sessionId);
    if (!session || session.state !== 'ready') {
      throw new Error(`Explore session "${sessionId}" not found`);
    }
    if (!session.south.hasExplore()) {
      throw new Error('South connector does not support exploration');
    }
    this.resetTimer(session);
    return await session.south.explore(parentId);
  }

  /**
   * Close a session and release its connector. Idempotent.
   */
  async close(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    session.state = 'closing';
    clearTimeout(session.timer);
    this.sessions.delete(sessionId);
    await session.south.stop();
  }

  /**
   * Close every open session. Used on OIBus shutdown to avoid leaking live sessions.
   */
  async closeAll(): Promise<void> {
    await Promise.all([...this.sessions.keys()].map(id => this.close(id)));
  }

  private armTimer(sessionId: string): NodeJS.Timeout {
    const timer = setTimeout(() => {
      this.close(sessionId).catch(() => undefined);
    }, this.idleTimeout);
    timer.unref?.();
    return timer;
  }

  private resetTimer(session: ExploreSession): void {
    clearTimeout(session.timer);
    session.timer = this.armTimer(session.id);
  }
}
