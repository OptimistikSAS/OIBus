import pino from 'pino';
import { Transformer } from '../../model/transformer.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';
import { CacheMetadata } from '../../../shared/model/engine.model';
import { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { OibFormControl } from '../../../shared/model/form.model';

export default abstract class OIBusTransformer {
  constructor(
    protected logger: pino.Logger,
    protected transformer: Transformer,
    protected northConnector: NorthConnectorEntity<NorthSettings>,
    protected _options: object
  ) {}
  abstract transform(
    data: ReadStream | Readable,
    source: string,
    filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: string }>;

  abstract get manifestSettings(): Array<OibFormControl>;
}
