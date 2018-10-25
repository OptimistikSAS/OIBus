// Machines
const Tank = require('./machines/Tank.class')
const Mixer = require('./machines/Mixer.class')
const Remplissage = require('./machines/Remplissage.class')
// ApiHandler
const ApiHandler = require('../ApiHandler.class')
// List of all machines
const machineList = {
  Tank,
  Mixer,
  Remplissage,
}

const checkConfig = (config) => {
  const simulationEntries = [
    'engine.scanModes',
    'engine.logParameters',
    'engine.port',
    'engine.user',
    'engine.password',
    'south.equipments',
    'north.machines',
  ]

  // If the engine works as a simulator
  simulationEntries.forEach((entry) => {
    const [key, subkey] = entry.split('.')
    if (!config[key]) {
      throw new Error(`You should define ${key} in the config file`)
    }
    if (!config[key][subkey]) {
      throw new Error(`You should define ${entry} in the config file`)
    }
  })
}

class Simulator extends ApiHandler {
  /**
   * @constructor for Simulator
   * Reads the config file and create the corresponding Object.
   * Makes the necessary changes to the pointId attributes.
   * Checks for critical entries such as scanModes and equipments.
   * @param {String} config : path to the config file
   * @return {Object} readConfig : parsed config Object
   */
  constructor(applicationParameters, engine) {
    super(applicationParameters, engine)
    this.parameters = applicationParameters
    this.activeMachines = {}
    // Machines
    this.parameters.machines.forEach((machine) => {
      const { machineId, type, enabled } = machine
      const Machine = machineList[type]
      if (enabled) {
        if (Machine) {
          this.activeMachines[machineId] = new Machine(machine)
        } else {
          throw new Error(`Machine for ${machineId} is not supported : ${type}`)
        }
      }
    })
  }

  /**
   * get the value of state from the machine and return it to the protocol
   * @param {*} machineId
   * @returns {*} value
   * @memberof Engine
   */
  getValue(machineId) {
    const value = this.activeMachines[machineId].getState()
    return value
  }

  connect() {
    console.log(this.parameters.applicationID, 'conneted')
    // Run the machines recurringly with an interval setted in advance
    const { refreshCycle } = this.config.north.Simulator
    setInterval(() => {
      this.activeMachines.forEach((machine) => {
        machine.run()
      })
    }, refreshCycle)
  }
}
module.exports = Simulator
