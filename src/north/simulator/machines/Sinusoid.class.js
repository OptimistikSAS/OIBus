const Machine = require('./Machine.class')

class Sinusoid extends Machine {
  constructor(parameters) {
    super(parameters)
    this.counter = 0
  }

  run() {
    const { qualityIndicator, counterSpeed } = this.parameters
    const measure = Math.sin(this.counter)
    this.counter += counterSpeed
    let quality
    if (Math.random() < qualityIndicator) {
      quality = true
    } else {
      quality = false
    }
    this.state = { measure, quality }
  }
}

module.exports = Sinusoid
