---
displayed_sidebar: developerSidebar
sidebar_position: 3
---

# Connector class
OIBus connectors must implements specific methods that wll be called by the engine. Some methods are common for South and
North connectors, some are specific, depending on the connector capabilities

## Common methods
### Start
Method called at connector startup. When overriding this method, call the parent method at the end.
You can use this method to create temp folders, locale cache database, etc...

```` typescript title="Start method example"
override async start(): Promise<void> {
  await createFolder(this.tmpFolder); // imported from '../../service/utils'
  await super.start();
}
````
The `super.start()` line calls the connect method. If `start` is not implemented, only the parent method will be called.

### Connect (optional)
This method connect, if necessary, the connector to its target. When overriding this method, call the parent method
once the connection is established.

```` typescript title="MQTT connect example"
override async connect(): Promise<void> {
  this.logger.info(`Connecting to "${this.connector.settings.url}"`);
  const options = await this.createConnectionOptions();

  this.client = mqtt.connect(this.connector.settings.url, options);
  this.client.on('connect', async () => {
    this.logger.info(`Connected to ${this.connector.settings.url}`);
    await super.connect();
  });
  this.client.on('error', error => {
    this.logger.error(`MQTT connection error ${error}`);
  });
}
````

If not implemented, only the parent method will be called.

### Stop (optional)
When changing configuration, or restarting OIBus, the connector must be stopped. This method allows you to clean cache at
connector stop.
If not implemented, only the parent method will be called. The parent method call the disconnect method.

### Disconnect
This method closes all active connection. You must implement it if you use a `connect` method.
```` typescript title="MQTT disconnect example"
  override async disconnect(): Promise<void> {
    if (this.client) {
      this.client.end(true);
      this.logger.info(`Disconnected from ${this.connector.settings.url}...`);
    }
    await super.disconnect();
  }
````

### Test connection
Implement this method to test connection settings from the frontend form. The settings will be passed in the connector 
constructor. You then have access to all the object context with `this`.

```` typescript title="Test connection example"
override async testConnection(): Promise<void> {
    // Your tests here
}
````

:::caution
Be sure to close your connection at the end of the test.
:::

## North methods
North connectors can implement two interfaces: `HandlesFile` and `HandlesValues`


## South methods
South connectors can implement four interfaces: `QueriesHistory`, `QueriesLastPoint`, `QueriesFile`, `QueriesSubscription`.