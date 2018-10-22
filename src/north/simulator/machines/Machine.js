class Machine {
  constructor(id, parameter) {
    this.id = id
    this.parameter = parameter
    this.state = {}
    console.info(id, 'registered')
  }
  // eslint-disable-next-line
  run() {}
}
module.exports = Machine
