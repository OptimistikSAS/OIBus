const jsmodbus = require('jsmodbus');
const net = require('net');
const optimizedConfig = require('./config/optimizedConfig');

/**
 * Class ModbusClient : provides instruction for modbus client connection
 */
class ModbusClient {
  /**
   * Constructor for ModbusClient
   * @param {String} configPath : path to the non-optimized configuration file
   */
  constructor({ equipments, modbus }, responses) {
    this.socket = new net.Socket();
    this.client = new jsmodbus.client.TCP(this.socket);
    this.connected = false;
    this.optimizedConfig = optimizedConfig(
      equipments,
      modbus.addressGap || 1000,
    );
    this.responses = responses;
  }

  /**
   * Runs right instructions based on a given scanMode
   * @param {String} scanMode : cron time
   * @return {void}
   */
  poll(scanMode) {
    if (!this.connected)
      console.error('You must be connected before calling poll.');

    const scanGroup = this.optimizedConfig[scanMode];
    Object.keys(scanGroup).forEach(equipment => {
      Object.keys(scanGroup[equipment]).forEach(type => {
        const addressesForType = scanGroup[equipment][type]; // Addresses of the group
        // Build function name, IMPORTANT: type must be singular
        const funcName = `read${`${type.charAt(0).toUpperCase()}${type.slice(
          1,
        )}`}s`;

        // Dynamic call of the appropriate function based on type

        Object.keys(addressesForType).forEach(range => {
          const rangeAddresses = range.split('-');
          const startAddress = parseInt(rangeAddresses[0], 10); // First address of the group
          const endAddress = parseInt(rangeAddresses[1], 10); // Last address of the group
          const rangeSize = endAddress - startAddress; // Size of the addresses group
          this.modbusFunction(funcName, { startAddress, rangeSize });
        });
      });
    });
  }

  /**
   * Dynamically call the right function based on the given name
   * @param {String} funcName : name of the function to run
   * @param {Object} infos : informations about the group of addresses (first address of the group, size)
   * @return {void}
   */
  modbusFunction(funcName, { startAddress, rangeSize }) {
    this.client[funcName](startAddress, rangeSize)
      .then(({ response }) => {
        const id = `${startAddress}-${startAddress + rangeSize}:${new Date()}`;
        this.responses.update({ id, data: response }, value =>
          console.log(value),
        );
      })
      .catch(error => {
        console.error(error);
        this.disconnect();
      });
  }

  /**
   * Initiates a connection to the given host on port 502
   * @param {String} host : host ip address
   * @param {Function} : callback function
   * @return {void}
   * @todo why 502 is hardcoded?
   */
  connect(host) {
    try {
      this.socket.connect({ host, port: 502 });
    } catch (error) {
      console.log(error);
    }

    this.connected = true;
  }

  /**
   * Close the connection
   * @return {void}
   */
  disconnect() {
    this.socket.end();
    this.connected = false;
  }
}

module.exports = ModbusClient;
