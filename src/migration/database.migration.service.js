const sqlite = require('sqlite')
const sqlite3 = require('sqlite3')

const CACHE_TABLE_NAME = 'cache'

const changeColumnName = async (databasePath, oldName, newName) => {
  const database = await sqlite.open({ filename: databasePath, driver: sqlite3.cached.Database })
  await database.run(`ALTER TABLE ${CACHE_TABLE_NAME} 
                           RENAME ${oldName} TO ${newName};`)
  return true
}

const addColumn = async (databasePath, tableName, newColumnName) => {
  const database = await sqlite.open({ filename: databasePath, driver: sqlite3.cached.Database })
  await database.run(`ALTER TABLE ${tableName} ADD ${newColumnName} VARCHAR;`)
}

const changeColumnValue = async (databasePath, columnName, oldValue, newValue) => {
  const database = await sqlite.open({ filename: databasePath, driver: sqlite3.cached.Database })
  await database.run(`UPDATE ${CACHE_TABLE_NAME} SET ${columnName} = '${newValue}'
                           WHERE ${columnName} = '${oldValue}';`)
  return true
}

module.exports = {
  changeColumnName,
  addColumn,
  changeColumnValue,
}
