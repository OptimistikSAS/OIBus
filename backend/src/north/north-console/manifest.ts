import Joi from 'joi';
import { NorthConnectorManifest } from '../../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  name: 'Console',
  category: 'debug',
  description: 'Console description',
  modes: {
    files: true,
    points: true
  },
  settings: [
    {
      key: 'verbose',
      type: 'OibCheckbox',
      label: 'Verbose',
      newRow: true,
      validators: [{ key: 'required' }],
      readDisplay: true
    }
  ],
  schema: Joi.object({
    verbose: Joi.boolean().required().falsy(0).truthy(1)
  })
};

export default manifest;
