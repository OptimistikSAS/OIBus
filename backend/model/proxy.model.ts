/**
 * DTO for proxies
 */
export interface ProxyDTO {
  id: string;
  name: string;
  description: string;
  address;
  username: string;
  password: string;
}

/**
 * Command DTO for proxies
 */
export interface ProxyCommandDTO {
  name: string;
  description: string;
  address: string;
  username: string;
  password: string;
}
