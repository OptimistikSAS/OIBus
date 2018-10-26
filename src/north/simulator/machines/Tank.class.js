const Machine = require('./Machine.class.js')

class Tank extends Machine {
  constructor(parameters) {
    super(parameters)
    this.currentLevel = 0
    this.fill = true
  }

  run() {
    const { qualityIndicator, fillPerRefresh, emptyPerRefresh, capacity, precision } = this.parameters
    let quality
    if (this.currentLevel === 0) this.fill = true
    if (this.fill) {
      this.currentLevel += fillPerRefresh * (1 - precision + Math.random() * 2 * precision)
      if (this.currentLevel > capacity) {
        this.currentLevel = capacity
        this.fill = false
      }
    } else {
      this.currentLevel -= emptyPerRefresh * (1 - precision + Math.random() * 2 * precision)
      if (this.currentLevel < 0) {
        this.currentLevel = 0
      }
    }
    let fillLevel = this.currentLevel
    if (Math.random() < qualityIndicator) {
      quality = true
    } else {
      quality = false
      fillLevel += 10 * Math.random() - 5 * Math.random() - 5 * Math.random()
    }
    this.state = { fillLevel, quality }
  }
}

module.exports = Tank
