import EncryptionService from './encryption.service';
import url from 'node:url';
import ProxyAgent from 'proxy-agent';
import { AgentOptions } from 'agent-base';
import ProxyRepository from '../repository/proxy.repository';

import { ProxyDTO } from '../../../shared/model/proxy.model';

/**
 * This service manage proxies for use in north or south connectors
 */
export default class ProxyService {
  constructor(private readonly proxyRepository: ProxyRepository, private readonly encryptionService: EncryptionService) {}

  /**
   * Create a proxy agent to use wih HTTP requests
   */
  async createProxyAgent(proxyId: string): Promise<any | undefined> {
    const proxySettings: ProxyDTO | null = this.proxyRepository.getProxy(proxyId);
    if (!proxySettings) return undefined;

    const proxyOptions = url.parse(proxySettings.address);

    if (proxySettings.username && proxySettings.password) {
      proxyOptions.auth = `${proxySettings.username}:${await this.encryptionService.decryptText(proxySettings.password)}`;
    }

    return new ProxyAgent(proxyOptions as AgentOptions);
  }
}
