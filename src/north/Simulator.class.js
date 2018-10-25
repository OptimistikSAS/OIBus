const timexe = require('timexe')
// Machines
const Tank = require('./simulator/machines/Tank.class')
const Mixer = require('./simulator/machines/Mixer.class')
const Remplissage = require('./simulator/machines/Remplissage.class')
// ApiHandler
const ApiHandler = require('./ApiHandler.class')
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
  constructor(api, engine) {
    super(api, engine)
    this.activeMachines = {}
    // Machines
    this.config.north.Simulator.machines.forEach((machine) => {
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
