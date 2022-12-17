/**
 * DTO for proxies
 */
export interface ProxyDTO {
  id: string;
  name: string;
  description: string;
  protocol: "http" | "https";
  host: string;
  port: number;
  username: string;
  password: string;
}

/**
 * Light DTO for proxies in list
 */
export interface ProxyLightDTO {
  id: string;
  name: string;
}

/**
 * Command DTO for proxies
 */
export interface ProxyCommandDTO {
  name: string;
  description: string;
  protocol: "http" | "https";
  host: string;
  port: number;
  username: string;
  password: string;
}
