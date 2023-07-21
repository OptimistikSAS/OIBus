// @ts-ignore
import ads from 'ads-client';

import manifest from './manifest';
import SouthConnector from '../south-connector';
import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';
import { DateTime } from 'luxon';
import { Instant } from '../../../../shared/model/types';
import EncryptionService from '../../service/encryption.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import { QueriesLastPoint, TestsConnection } from '../south-interface';
import { SouthADSItemSettings, SouthADSSettings } from '../../../../shared/model/south-settings.model';

interface ADSOptions {
  targetAmsNetId: string;
  targetAdsPort: number;
  localAmsNetId?: string;
  localAdsPort?: number;
  routerAddress?: string;
  routerTcpPort?: number;
  autoReconnect: boolean;
}

/**
 * Class SouthADS - Provides instruction for TwinCAT ADS client connection
 */
export default class SouthADS extends SouthConnector<SouthADSSettings, SouthADSItemSettings> implements QueriesLastPoint, TestsConnection {
  static type = manifest.id;

  private client: ads.Client | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(
    connector: SouthConnectorDTO<SouthADSSettings>,
    items: Array<SouthConnectorItemDTO<SouthADSItemSettings>>,
    engineAddValuesCallback: (southId: string, values: Array<any>) => Promise<void>,
    engineAddFileCallback: (southId: string, filePath: string) => Promise<void>,
    encryptionService: EncryptionService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string
  ) {
    super(connector, items, engineAddValuesCallback, engineAddFileCallback, encryptionService, repositoryService, logger, baseFolder);
  }

  /**
   * Parse received values to convert them in points before sending them to the Cache
   */
  parseValues(
    itemName: string,
    dataType: string,
    valueToParse: any,
    timestamp: Instant,
    subItems: Array<any> = [],
    enumInfo: Array<{ name: string; value: number }> = []
  ): Array<any> {
    let valueToAdd = null;
    /**
     * Source of the following data types:
     * https://infosys.beckhoff.com/english.php?content=../content/1033/tcplccontrol/html/tcplcctrl_plc_data_types_overview.htm&id
     * Used by TwinCAT PLC Control
     */
    switch (dataType) {
      case 'BOOL':
        if (this.connector.settings.boolAsText === 'Text') {
          valueToAdd = JSON.stringify(valueToParse);
        } else {
          valueToAdd = valueToParse ? '1' : '0';
        }
        break;
      case 'BYTE':
      case 'WORD':
      case 'DWORD':
      case 'SINT':
      case 'USINT':
      case 'INT':
      case 'UINT':
      case 'DINT':
      case 'UDINT':
      case 'LINT':
      case 'ULINT':
      case 'TIME': // TIME and TIME_OF_DAY are parsed as numbers
      case 'TIME_OF_DAY':
        valueToAdd = JSON.stringify(parseInt(valueToParse, 10));
        break;
      case 'REAL':
      case 'LREAL':
        valueToAdd = JSON.stringify(parseFloat(valueToParse));
        break;
      case 'STRING':
      case dataType.match(/^STRING\([0-9]*\)$/)?.input: // Example: STRING(35)
        valueToAdd = valueToParse;
        break;
      case 'DATE':
      case 'DATE_AND_TIME':
        valueToAdd = new Date(valueToParse).toISOString();
        break;
      case dataType.match(/^ARRAY\s\[[0-9][0-9]*\.\.[0-9][0-9]*]\sOF\s.*$/)?.input: {
        // Example: ARRAY [0..4] OF INT
        const parsedValues = valueToParse.map((element: any, index: number) =>
          this.parseValues(
            `${itemName}.${index}`,
            dataType.split(/^ARRAY\s\[[0-9][0-9]*\.\.[0-9][0-9]*]\sOF\s/)[1],
            element,
            timestamp,
            subItems,
            enumInfo
          )
        );
        return parsedValues.reduce((concatenatedResults: Array<any>, result: Array<any>) => [...concatenatedResults, ...result], []);
      }
      default:
        if (subItems.length > 0) {
          // It is an ADS structure object (as json)
          // TODO @burgerni look into this
          const structure = (this.connector.settings as any).structureFiltering.find((element: any) => element.name === dataType);
          if (structure) {
            const parsedValues = subItems
              .filter(item => structure.fields === '*' || structure.fields.split(',').includes(item.name))
              .map(subItem =>
                this.parseValues(
                  `${itemName}.${subItem.name}`,
                  subItem.type,
                  valueToParse[subItem.name],
                  timestamp,
                  subItem.subItems,
                  subItem.enumInfo
                )
              );
            return parsedValues.reduce((concatenatedResults, result) => [...concatenatedResults, ...result], []);
          }
          this.logger.debug(
            `Data Structure ${dataType} not parsed for data ${itemName}. To parse it, please specify it in the connector settings`
          );
        } else if (enumInfo.length > 0) {
          // It is an ADS Enum object
          if (this.connector.settings.enumAsText === 'Text') {
            valueToAdd = valueToParse.name;
          } else {
            valueToAdd = JSON.stringify(valueToParse.value);
          }
        } else {
          this.logger.warn(`dataType ${dataType} not supported yet for point ${itemName}. Value was ${JSON.stringify(valueToParse)}`);
        }
        break;
    }
    if (valueToAdd !== null) {
      return [
        {
          pointId: itemName,
          timestamp,
          data: { value: valueToAdd }
        }
      ];
    }
    return [];
  }

  async lastPointQuery(items: Array<SouthConnectorItemDTO<SouthADSItemSettings>>): Promise<void> {
    const timestamp = DateTime.now().toUTC().toISO()!;
    try {
      const results = await Promise.all(items.map(item => this.readAdsSymbol(item.name, timestamp)));
      await this.addValues(results.reduce((concatenatedResults, result) => [...concatenatedResults, ...result], []));
    } catch (error: any) {
      if (error.message.startsWith('Client is not connected')) {
        this.logger.error('ADS client disconnected. Reconnecting');
        await this.disconnect();
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
      } else {
        throw error;
      }
    }
  }

  readAdsSymbol(itemName: string, timestamp: Instant): Promise<Array<any>> {
    return new Promise((resolve, reject) => {
      this.client
        .readSymbol(itemName)
        .then((nodeResult: any) => {
          const parsedResult = this.parseValues(
            `${this.connector.settings.plcName}${itemName}`,
            nodeResult.symbol?.type,
            nodeResult.value,
            timestamp,
            nodeResult.type?.subItems,
            nodeResult.type?.enumInfo
          );
          resolve(parsedResult);
        })
        .catch((error: Error) => {
          reject(error);
        });
    });
  }

  createConnectionOptions(): ADSOptions {
    const options: ADSOptions = {
      targetAmsNetId: this.connector.settings.netId, // example: 192.168.1.120.1.1
      targetAdsPort: this.connector.settings.port, // example: 851
      autoReconnect: false
    };
    if (this.connector.settings.clientAmsNetId) {
      // needs to match a route declared in PLC StaticRoutes.xml file. Example: 10.211.55.2.1.1
      options.localAmsNetId = this.connector.settings.clientAmsNetId;
    }
    if (this.connector.settings.clientAdsPort) {
      // should be an unused port. Example: 32750
      options.localAdsPort = this.connector.settings.clientAdsPort;
    }
    if (this.connector.settings.routerAddress) {
      // distant address of the PLC. Example: 10.211.55.3
      options.routerAddress = this.connector.settings.routerAddress;
    }
    if (this.connector.settings.routerTcpPort) {
      // port of the Ams router (must be open on the PLC). Example : 48898 (which is default)
      options.routerTcpPort = this.connector.settings.routerTcpPort;
    }
    return options;
  }
  /**
   * Initiates a connection to the right netId and port.
   */
  async connect(): Promise<void> {
    try {
      const options = this.createConnectionOptions();
      this.logger.info(`Connecting to ADS Client with options ${JSON.stringify(options)}`);

      this.client = new ads.Client(options);
      await this.connectToAdsServer();
    } catch (error) {
      this.logger.error(`ADS connect error: ${JSON.stringify(error)}`);
      await this.disconnect();
      this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
    }
  }

  override async testConnection(): Promise<void> {
    const options = this.createConnectionOptions();
    this.logger.info(`Connecting to ADS Client with options ${JSON.stringify(options)}`);

    this.client = new ads.Client(options);
    const result = await this.client.connect();
    this.logger.info(
      `Connected to ${result.targetAmsNetId} with local AmsNetId ${result.localAmsNetId} and local port ${result.localAdsPort}. Disconnecting...`
    );
    await this.disconnect();
    this.logger.info(`ADS connection correctly closed`);
  }

  /**
   * Connect the ADS client to the ADS server with the already provided connection options
   */
  async connectToAdsServer(): Promise<void> {
    const result = await this.client.connect();
    this.logger.info(
      `Connected to the ${result.targetAmsNetId} with local AmsNetId ${result.localAmsNetId} and local port ${result.localAdsPort}`
    );
    await super.connect();
  }

  /**
   * Disconnect the ADS Client
   */
  disconnectAdsClient(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.client.connection.connected) {
        resolve();
      } else {
        this.client
          .disconnect()
          .then(() => resolve())
          .catch((error: Error) => reject(error));
      }
    });
  }

  /**
   * Close the connection
   */
  async disconnect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    try {
      await this.disconnectAdsClient();
    } catch (error) {
      this.logger.error(`ADS disconnect error. ${error}`);
    }
    this.logger.info(`ADS client disconnected from ${this.connector.settings.netId}:${this.connector.settings.port}`);
    this.client = null;
    await super.disconnect();
  }
}
