import EncryptionService from './encryption.service';

import { ProxyDTO } from '../../shared/model/proxy.model';
import url from 'node:url';
import ProxyAgent from 'proxy-agent';
import { AgentOptions } from 'agent-base';

/**
 * This service manage proxies for use in north or south connectors
 */
export default class ProxyService {
  private proxies: Array<ProxyDTO>;
  private encryptionService: EncryptionService;

  constructor(proxies: Array<ProxyDTO>, encryptionService: EncryptionService) {
    this.proxies = proxies;
    this.encryptionService = encryptionService;
  }

  /**
   * Create a proxy agent to use wih HTTP requests
   */
  async createProxyAgent(address: string, username: string | null, password: string | null): Promise<any> {
    const proxyOptions = url.parse(address);

    if (username && password) {
      proxyOptions.auth = `${username}:${await this.encryptionService.decryptText(password)}`;
    }

    return new ProxyAgent(proxyOptions as AgentOptions);
  }

  async getProxy(proxyName: string): Promise<typeof ProxyAgent | null> {
    const foundProxy = this.proxies.find(({ name }) => name === proxyName);
    if (foundProxy) {
      return this.createProxyAgent(foundProxy.address, foundProxy.username, foundProxy.password);
    }
    return null;
  }
}
