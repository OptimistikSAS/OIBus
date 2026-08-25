import { SouthConnectorManifest } from '../../../../../backend/shared/model/south-connector.model';
import { OIBusObjectAttribute } from '../../../../../backend/shared/model/form.model';

export function deriveItemImportFields(manifest: SouthConnectorManifest): {
  expectedHeaders: Array<string>;
  optionalHeaders: Array<string>;
} {
  const expectedHeaders = ['name', 'enabled'];
  const optionalHeaders: Array<string> = [];

  const settingsAttribute = manifest.items.rootAttribute.attributes.find(
    attribute => attribute.key === 'settings'
  )! as OIBusObjectAttribute;
  settingsAttribute.attributes.forEach(setting => {
    if (settingsAttribute.enablingConditions.find(element => element.targetPathFromRoot === setting.key)) {
      optionalHeaders.push(`settings_${setting.key}`);
    } else {
      expectedHeaders.push(`settings_${setting.key}`);
    }
  });

  return { expectedHeaders, optionalHeaders };
}
