const Machine = require('./Machine.class.js')

class Remplissage extends Machine {
  constructor(id, parameter) {
    super(id, parameter)
    this.alarmAge = 0
    this.maxAlarmAge = -1 // -1 => no alarm
  }

  run(currentDate) {
    const { cadence, alarmChance, alarmMinAge, alarmMaxAge, precision } = this.parameter
    let ae = null
    this.currentCadence = cadence * (1 - precision + Math.random() * 2 * precision)
    // if  alarm
    if (this.maxAlarmAge !== -1) {
      if (this.alarmAge > this.maxAlarmAge) {
        // end alarm
        ae = `{ "date": ${currentDate.getTime()}000000, "status": "end"}`
        this.maxAlarmAge = -1
        this.alarmAge = 0
      } else {
        // increase age and keep cadence to 0
        this.alarmAge += 1
        this.currentCadence = 0
      }
    } else if (Math.random() < alarmChance) {
      //  start alarm!
      this.maxAlarmAge = alarmMinAge + Math.random() * alarmMaxAge
      this.alarmAge = 1
      ae = `{ "date": ${currentDate.getTime()}000000, "status": "start"}`
    }
    return {
      ts: `${this.id} value=${this.currentCadence} ${currentDate.getTime()}000000`,
      ae,
    }
  }
}

module.exports = Remplissage
