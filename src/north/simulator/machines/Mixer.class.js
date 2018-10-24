const Machine = require('./Machine.class.js')

class Mixer extends Machine {
  constructor(parameters) {
    super(parameters)
    this.currentSpeed = 0
    this.duration = 0
    this.running = false
  }

  run(refreshCycle) {
    let quality
    const { rotationSpeed, rotationDuration, precision } = this.parameters
    this.currentSpeed = rotationSpeed * (1 - precision + Math.random() * 2 * precision)
    this.duration = (this.duration + refreshCycle / 1000)
    if (this.duration >= rotationDuration) {
      this.running = false
      this.duration = 0
      this.currentSpeed = 0
      quality = true
    } else if (Math.random() < 0.95) {
      quality = true
    } else {
      quality = false
    }
    this.state = { speed: this.currentSpeed, duration: this.duration, quality }
  }
}

module.exports = Mixer
