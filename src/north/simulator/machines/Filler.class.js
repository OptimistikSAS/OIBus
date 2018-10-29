const Machine = require('./Machine.class.js')

class Filler extends Machine {
  constructor(parameters) {
    super(parameters)
    this.alarmAge = 0
    this.maxAlarmAge = -1 // -1 => no alarm
  }

  run() {
    const currentDate = new Date()
    const { cadence, alarmChance, alarmMinAge, alarmMaxAge, precision, qualityIndicator } = this.parameters
    let quality = true
    let ae = null
    // if  alarm
    if (this.maxAlarmAge !== -1) {
      if (this.alarmAge > this.maxAlarmAge) {
        // end alarm
        this.currentCadence = 0
        ae = `{ "date": ${currentDate.getTime()}000000, "status": "end"}`
        this.maxAlarmAge = -1
        this.alarmAge = 0
      } else {
        // increase age and keep cadence to 0
        this.alarmAge += 1
        this.currentCadence = cadence * (1 - precision + Math.random() * 2 * precision)
        if (Math.random() < qualityIndicator) {
          quality = true
        } else {
          quality = false
          this.currentCadence *= (Math.random() - Math.random() + Math.random())
        }
      }
    } else if (Math.random() < alarmChance) {
      //  start alarm!
      this.maxAlarmAge = alarmMinAge + Math.random() * (alarmMaxAge - alarmMinAge)
      this.alarmAge = 1
      ae = `{ "date": ${currentDate.getTime()}000000, "status": "start"}`
    }
    this.state = { currentCadence: this.currentCadence, maxAlarmAge: this.maxAlarmAge, alarmAge: this.alarmAge, ae, quality }
  }
}

module.exports = Filler
