export interface HandlesAgent {
  handleConnectMessage(connected: boolean, error: string): Promise<void>;
  handleInitializeMessage(): Promise<void>;
  handleReadMessage(messageObject: any): Promise<void>;
}
