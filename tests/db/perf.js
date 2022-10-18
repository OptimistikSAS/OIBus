/* eslint-disable no-await-in-loop */
/* eslint-disable no-console */
const { createValuesDatabase, saveValues, getCount, getValuesToSend, removeSentValues } = require('../../src/service/database.service')

const start = () => {
  console.time('total')
  const db = createValuesDatabase('./test.db', { wal: false, optimize: false })
  const timestamp = new Date('01/01/2020')
  const quality = 'OK'
  const dataSourceId = 'datasourceid'
  const received = []
  const size = 1000000
  console.time('create.array')
  for (let i = 0; i < size; i += 1) {
    received.push({ timestamp: timestamp + 10 * i, pointId: `pointId${i}`, data: { value: i, quality, id: dataSourceId } })
  }
  console.timeEnd('create.array')
  for (let i = 0; i < 10; i += 1) {
    console.time(`save${i}`)
    saveValues(db, 'sourceid', received)
    console.timeEnd(`save${i}`)
    console.time(`-->count${i}`)
    const count = getCount(db)
    process.stdout.write(`${count}`)
    console.timeEnd(`-->count${i}`)
    console.time(`-> get${i}`)
    for (let get = 0; get < 10; get += 1) {
      const values = getValuesToSend(db, size / 10)
      process.stdout.write('.')
      removeSentValues(db, values)
      process.stdout.write('-')
    }
    console.timeEnd(`-> get${i}`)
  }
  console.timeEnd('total')
}

start()
