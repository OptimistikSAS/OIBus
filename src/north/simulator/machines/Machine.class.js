class Machine {
  constructor(parameters) {
    this.parameters = parameters
    this.state = {}
    console.info(parameters.machineId, 'registered')
  }
  // eslint-disable-next-line
  run() {}

  getState() {
    return this.state
  }
}
module.exports = Machine
