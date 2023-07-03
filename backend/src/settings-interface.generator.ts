import { appendFileSync, openSync, readdirSync } from 'node:fs';
import { OibFormControl } from '../../shared/model/form.model';
import { ConnectorManifest } from '../../shared/model/types';
import { SouthConnectorManifest } from '../../shared/model/south-connector.model';

const SOUTH_SETTINGS_DESTINATION_PATH = '../shared/model/south-settings.model.ts';
const NORTH_SETTINGS_DESTINATION_PATH = '../shared/model/north-settings.model.ts';

const SCAN_MODE_IMPORT = 'import { ScanModeDTO } from "./scan-mode.model";';
const TIMEZONE_IMPORT = "import { Timezone } from './types';\n";

type ConnectorType = 'South' | 'North';

generateSettingsInterfaces();

async function generateSettingsInterfaces() {
  // create the destination file
  openSync(SOUTH_SETTINGS_DESTINATION_PATH, 'w');
  await generateSettingsInterfacesForConnectorType('South');
  openSync(NORTH_SETTINGS_DESTINATION_PATH, 'w');
  await generateSettingsInterfacesForConnectorType('North');
}

/**
 * This function is used to build the south settings interface from the various manifests in order to
 * enforce type safety when using those settings in the connectors.
 * This function runs an all manifests and will generate the corresponding typescript interface declaration
 * in shared folder located in the root path of the project
 */
async function generateSettingsInterfacesForConnectorType(connectorType: ConnectorType) {
  // gather all manifests
  const manifests = listFiles(`./src/${connectorType.toLowerCase()}`)
    .filter(file => file.endsWith('manifest.ts'))
    // transform ./src/south/south-ads/manifest.ts to ./south/south-ads/manifest
    .map(file => file.replace('./src', '.').replace('.ts', ''));

  const settingsTypesToGenerate: TypeGenerationDescription = {
    imports: new Set<string>(connectorType === 'South' ? [SCAN_MODE_IMPORT] : []),
    enums: [],
    settingsInterfaces: [],
    settingsSubInterfaces: [],
    itemSettingsInterfaces: [],
    itemSettingsSubInterfaces: []
  };

  for (const manifestPath of manifests) {
    // import the manifest
    const module = await import(manifestPath);
    generateTypesForManifest(module.default, settingsTypesToGenerate, connectorType);
  }
  buildTypescriptFile(settingsTypesToGenerate, connectorType);
}

/**
 * Create the appropriate typescript file from the types in the given path
 */
function buildTypescriptFile(typesToGenerate: TypeGenerationDescription, connectorType: ConnectorType) {
  const path = connectorType === 'South' ? SOUTH_SETTINGS_DESTINATION_PATH : NORTH_SETTINGS_DESTINATION_PATH;
  typesToGenerate.imports.forEach(importToWrite => {
    appendFileSync(path, `${importToWrite}\n`);
  });

  typesToGenerate.enums.forEach(enumToWrite => {
    const listName = toSnakeCase(enumToWrite.name).toUpperCase() + 'S';
    appendFileSync(path, `const ${listName} = [${enumToWrite.values.map(v => `'${v}'`).join(', ')}] as const\n`);
    appendFileSync(path, `export type ${enumToWrite.name} = (typeof ${listName})[number];\n\n`);
  });

  typesToGenerate.settingsSubInterfaces.forEach(interfaceToWrite => {
    appendFileSync(path, `export interface ${interfaceToWrite.name} {\n`);
    interfaceToWrite.attributes.forEach(attribute => {
      appendFileSync(path, `  ${attribute.key}: ${attribute.type};\n`);
    });
    appendFileSync(path, '}\n\n');
  });

  appendFileSync(path, `interface Base${connectorType}Settings {}\n\n`);

  typesToGenerate.settingsInterfaces.forEach(interfaceToWrite => {
    appendFileSync(path, `export interface ${interfaceToWrite.name} extends Base${connectorType}Settings {\n`);
    interfaceToWrite.attributes.forEach(attribute => {
      appendFileSync(path, `  ${attribute.key}: ${attribute.type};\n`);
    });
    appendFileSync(path, '}\n\n');
  });

  // create the union type
  const types = typesToGenerate.settingsInterfaces.map(i => `  | ${i.name}`).join('\n');
  appendFileSync(path, `export type ${connectorType}Settings =\n`);
  appendFileSync(path, types);
  appendFileSync(path, '\n\n');

  if (connectorType === 'South') {
    typesToGenerate.itemSettingsSubInterfaces.forEach(interfaceToWrite => {
      appendFileSync(path, `export interface ${interfaceToWrite.name} {\n`);
      interfaceToWrite.attributes.forEach(attribute => {
        appendFileSync(path, `  ${attribute.key}: ${attribute.type};\n`);
      });
      appendFileSync(path, '}\n\n');
    });

    appendFileSync(path, `interface Base${connectorType}ItemSettings {\n`);
    appendFileSync(path, '  id: string;\n');
    appendFileSync(path, '  name: string;\n');
    appendFileSync(path, '  scanMode: ScanModeDTO;\n');
    appendFileSync(path, '}\n\n');

    typesToGenerate.itemSettingsInterfaces.forEach(interfaceToWrite => {
      appendFileSync(path, `export interface ${interfaceToWrite.name} extends Base${connectorType}ItemSettings {\n`);
      interfaceToWrite.attributes.forEach(attribute => {
        appendFileSync(path, `  ${attribute.key}: ${attribute.type};\n`);
      });
      appendFileSync(path, '}\n\n');
    });

    // create the union type
    const itemTypes = typesToGenerate.itemSettingsInterfaces.map(i => `  | ${i.name}`).join('\n');
    appendFileSync(path, `export type ${connectorType}ItemSettings =\n`);
    appendFileSync(path, itemTypes);
  }
}

function isSouthConnector(manifestObject: ConnectorManifest): manifestObject is SouthConnectorManifest {
  return (manifestObject as SouthConnectorManifest).items !== undefined;
}

/**
 * Generate the appropriate types for the given manifest file
 * @param manifestObject the manifest
 * @param typesToGenerate the objet on which the various types are added
 * @param connectorType the type of connector between north and south
 */
function generateTypesForManifest(
  manifestObject: ConnectorManifest,
  typesToGenerate: TypeGenerationDescription,
  connectorType: ConnectorType
): void {
  const interfaceName =
    connectorType === 'South' ? buildSouthInterfaceName(manifestObject.id, false) : buildNorthInterfaceName(manifestObject.id);

  // gather recursively all sub interfaces
  const subManifests: Array<SubManifest> = collectSubManifests(manifestObject.settings);
  subManifests.forEach(subManifest => {
    const subManifestInterface = generateInterface(
      interfaceName + capitalizeFirstLetter(subManifest.name),
      subManifest.settings,
      typesToGenerate
    );
    typesToGenerate.settingsSubInterfaces.push(subManifestInterface);
  });

  // generate main settings interfaces
  const mainSettingsInterface = generateInterface(interfaceName, manifestObject.settings, typesToGenerate);
  typesToGenerate.settingsInterfaces.push(mainSettingsInterface);

  if (isSouthConnector(manifestObject)) {
    const interfaceName = buildSouthInterfaceName(manifestObject.id, true);

    // gather recursively all sub interfaces
    const itemSubManifests: Array<SubManifest> = collectSubManifests(manifestObject.items.settings);
    itemSubManifests.forEach(subManifest => {
      const subManifestInterface = generateInterface(
        interfaceName + capitalizeFirstLetter(subManifest.name),
        subManifest.settings,
        typesToGenerate
      );
      typesToGenerate.itemSettingsSubInterfaces.push(subManifestInterface);
    });

    // generate item settings interface
    const mainItemSettingsInterface = generateInterface(interfaceName, manifestObject.items.settings, typesToGenerate);
    typesToGenerate.itemSettingsInterfaces.push(mainItemSettingsInterface);
  }
}

function generateInterface(interfaceName: string, settings: Array<OibFormControl>, typesToGenerate: TypeGenerationDescription): Interface {
  const attributes: Array<Attribute> = [];
  settings.forEach(setting => {
    switch (setting.type) {
      case 'OibText':
      case 'OibTextArea':
      case 'OibSecret':
      case 'OibCodeBlock':
        attributes.push({ key: setting.key, type: 'string' });
        break;
      case 'OibSelect':
        const enumName = `${interfaceName}${capitalizeFirstLetter(setting.key)}`;
        typesToGenerate.enums.push({ name: enumName, values: setting.options });
        attributes.push({ key: setting.key, type: `${enumName}` });
        break;
      case 'OibCheckbox':
        attributes.push({ key: setting.key, type: 'boolean' });
        break;
      case 'OibScanMode':
        typesToGenerate.imports.add(SCAN_MODE_IMPORT);
        attributes.push({ key: setting.key, type: 'ScanMode' });
        break;
      case 'OibTimezone':
        typesToGenerate.imports.add(TIMEZONE_IMPORT);
        attributes.push({ key: setting.key, type: 'Timezone' });
        break;
      case 'OibProxy':
        attributes.push({ key: setting.key, type: 'string' });
        break;
      case 'OibFormArray':
        attributes.push({ key: setting.key, type: `Array<${interfaceName}${capitalizeFirstLetter(setting.key)}>` });
        break;
      case 'OibFormGroup':
        attributes.push({ key: setting.key, type: `${interfaceName}${capitalizeFirstLetter(setting.key)}` });
        break;
      case 'OibNumber':
        attributes.push({ key: setting.key, type: 'number' });
        break;
    }
  });
  return { name: interfaceName, attributes };
}

/**
 * Get all sub manifests
 */
function collectSubManifests(manifestControls: Array<OibFormControl>): Array<SubManifest> {
  const subManifests: Array<SubManifest> = [];
  manifestControls.forEach(formControl => {
    if (formControl.type === 'OibFormGroup' || formControl.type === 'OibFormArray') {
      subManifests.push(...collectSubManifests(formControl.content));
      subManifests.push({ name: formControl.key, settings: formControl.content });
    }
  });
  return subManifests;
}

/**
 * List all the files in the given root directory recursively traversing it
 * @param directory the root directory to start looking for files
 */
function listFiles(directory: string) {
  let files: Array<string> = [];
  const items = readdirSync(directory, { withFileTypes: true });

  for (const item of items) {
    if (item.isDirectory()) {
      files = [...files, ...listFiles(`${directory}/${item.name}`)];
    } else {
      files.push(`${directory}/${item.name}`);
    }
  }

  return files;
}

function buildNorthInterfaceName(connectorId: string): string {
  switch (connectorId) {
    case 'aws-s3':
      return 'NorthAmazonS3Settings';
    case 'azure-blob':
      return 'NorthAzureBlobSettings';
    case 'console':
      return 'NorthConsoleSettings';
    case 'csv-to-http':
      return 'NorthCsvToHttpSettings';
    case 'file-writer':
      return 'NorthFileWriterSettings';
    case 'influxdb':
      return 'NorthInfluxDBSettings';
    case 'mongodb':
      return 'NorthMongoDBSettings';
    case 'mqtt':
      return 'NorthMqttSettings';
    case 'oianalytics':
      return 'NorthOIAnalyticsSettings';
    case 'oiconnect':
      return 'NorthOIConnectSettings';
    case 'timescaledb':
      return 'NorthTimescaleDBSettings';
    case 'watsy':
      return 'NorthWatsySettings';
  }
  return '';
}

function buildSouthInterfaceName(connectorId: string, itemInterface: boolean): string {
  const prefix = itemInterface ? 'Item' : '';
  switch (connectorId) {
    case 'ads':
      return `SouthADS${prefix}Settings`;
    case 'folder-scanner':
      return `SouthFolderScanner${prefix}Settings`;
    case 'modbus':
      return `SouthModbus${prefix}Settings`;
    case 'mqtt':
      return `SouthMQTT${prefix}Settings`;
    case 'mssql':
      return `SouthMSSQL${prefix}Settings`;
    case 'mysql':
      return `SouthMySQL${prefix}Settings`;
    case 'odbc':
      return `SouthODBC${prefix}Settings`;
    case 'oiconnect':
      return `SouthOIConnect${prefix}Settings`;
    case 'opc-hda':
      return `SouthOPCHDA${prefix}Settings`;
    case 'opcua-da':
      return `SouthOPCUADA${prefix}Settings`;
    case 'opcua-ha':
      return `SouthOPCUAHA${prefix}Settings`;
    case 'oracle':
      return `SouthOracle${prefix}Settings`;
    case 'postgresql':
      return `SouthPostgreSQL${prefix}Settings`;
    case 'sqlite':
      return `SouthSQLite${prefix}Settings`;
  }
  return '';
}

function capitalizeFirstLetter(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function toSnakeCase(s: string) {
  return s
    .split(/(?=[A-Z])/)
    .join('_')
    .toLowerCase();
}

interface SubManifest {
  name: string;
  settings: Array<OibFormControl>;
}

interface TypeGenerationDescription {
  imports: Set<string>;
  enums: Array<Enums>;
  settingsInterfaces: Array<Interface>;
  settingsSubInterfaces: Array<Interface>;
  itemSettingsInterfaces: Array<Interface>;
  itemSettingsSubInterfaces: Array<Interface>;
}

interface Interface {
  name: string;
  attributes: Array<Attribute>;
}

interface Attribute {
  key: string;
  type: string;
}

interface Enums {
  name: string;
  values: Array<string>;
}
