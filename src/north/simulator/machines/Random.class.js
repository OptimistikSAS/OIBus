const Machine = require('./Machine.class')

class Random extends Machine {
  run() {
    const { integer, scale, qualityIndicator } = this.parameters
    let quality
    if (Math.random() < qualityIndicator) {
      quality = true
    } else {
      quality = false
    }
    let number = Math.random() * scale
    if (integer) number = Math.floor(number)
    this.state = { number, quality }
  }
}

module.exports = Random
