const Machine = require('./Machine.class.js')

class Tank extends Machine {
  constructor(parameters) {
    super(parameters)
    this.currentLevel = 0
    this.fill = true
  }

  run() {
    const { fillPerRefresh, emptyPerRefresh, capacity, precision } = this.parameters
    let quality
    if (Math.random() < 0.95) {
      quality = true
    } else {
      quality = false
    }
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
    /*
level,tank=cuve1 value=60.09423243397569 1388567520000000000
measurement,tag_set field_set timestamp
*/
    this.value = { fillLevel: this.currentLevel, quality }
  }
}

module.exports = Tank
