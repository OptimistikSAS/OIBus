const later = require('later')
const Machine = require('./Machine.js')

class Tank extends Machine {
  constructor(id, parameter) {
    super(id, parameter)
    const parse = later.parse.cron(parameter.fill)
    this.schedFill = later.schedule(parse)
    this.currentLevel = 0
    this.fill = true
  }

  run(currentDate) {
    const { fillPerSecond, emptyPerSecond, capacity, precision } = this.parameter
    if (this.schedFill.isValid(currentDate)) this.fill = true
    if (this.fill) {
      this.currentLevel += fillPerSecond * (1 - precision + Math.random() * 2 * precision)
      if (this.currentLevel > capacity) {
        this.currentLevel = capacity
        this.fill = false
      }
    } else {
      this.currentLevel -= emptyPerSecond * (1 - precision + Math.random() * 2 * precision)
      if (this.currentLevel < 0) {
        this.currentLevel = 0
      }
    }
    /*
      level,tank=cuve1 value=60.09423243397569 1388567520000000000
      measurement,tag_set field_set timestamp
    */
    return { ts: `${this.id} value=${this.currentLevel} ${currentDate.getTime()}000000` }
  }
}

module.exports = Tank
