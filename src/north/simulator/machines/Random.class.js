const Machine = require('./Machine.class')

class Random extends Machine {
  run() {
    const { integer, scale, qualityIndicator } = this.parameters
    let quality
    let number = Math.random() * scale
    if (integer) number = Math.floor(number)
    if (Math.random() < qualityIndicator) {
      quality = true
    } else {
      quality = false
      number *= -Math.random()
    }
    this.state = { number, quality }
  }
}

module.exports = Random
