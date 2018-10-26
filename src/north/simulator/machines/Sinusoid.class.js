const Machine = require('./Machine.class')

class Sinusoid extends Machine {
  constructor(parameters) {
    super(parameters)
    this.counter = 0
  }

  run() {
    const { qualityIndicator, counterSpeed } = this.parameters
    let measure = Math.sin(this.counter)
    this.counter += counterSpeed
    let quality
    if (Math.random() < qualityIndicator) {
      quality = true
    } else {
      quality = false
      measure *= 2 * Math.random()
    }
    this.state = { measure, quality }
  }
}

module.exports = Sinusoid
