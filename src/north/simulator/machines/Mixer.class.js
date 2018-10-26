const timexe = require('timexe')
const Machine = require('./Machine.class.js')

class Mixer extends Machine {
  constructor(parameters) {
    super(parameters)
    this.currentSpeed = 0
    this.duration = 0
    this.running = false
    this.setTimer()
  }

  run(refreshCycle) { // refreshCycle in milliseconds
    if (!this.running) return
    let quality
    const { qualityIndicator, rotationSpeed, rotationDuration, precision } = this.parameters
    this.currentSpeed = rotationSpeed * (1 - precision + Math.random() * 2 * precision)
    this.duration = this.duration + refreshCycle / 1000
    if (this.duration >= rotationDuration) {
      this.running = false
      this.duration = 0
      this.currentSpeed = 0
      quality = true
    } else if (Math.random() < qualityIndicator) {
      quality = true
    } else {
      quality = false
      this.currentSpeed *= (Math.random() - Math.random() + Math.random())
    }
    this.state = { speed: this.currentSpeed, duration: this.duration, quality }
  }

  setTimer() {
    // A timerSet boolean could be used to ensure the timer is set only once
    timexe(this.parameters.rotation, () => {
      this.running = true
    })
  }
}

module.exports = Mixer
