const fs = require('fs')

const readStream = fs.createReadStream('./tests/csv/input/fichier.csv')
const content = readStream.read()
console.log(content)
readStream.on('error', (err) => {
  console.error(err)
})

readStream.on('open', (fd) => {
  console.log('FIle opened', fd)
})

readStream.on('ready', () => {
  console.log('File ready..')
})

readStream.on('data', (chunk) => {
  console.log('Reading datas:', chunk.toString())
})
console.log('Finished')
