const db = require('better-sqlite3')

const CACHE_TABLE_NAME = 'cache'

const changeColumnName = (databasePath, oldName, newName) => {
  const database = db(databasePath)
  database.prepare(`ALTER TABLE ${CACHE_TABLE_NAME} 
                           RENAME ${oldName} TO ${newName};`).run()
  database.close()
  return true
}

const addColumn = (databasePath, tableName, newColumnName) => {
  const database = db(databasePath)
  database.prepare(`ALTER TABLE ${tableName} ADD ${newColumnName} VARCHAR;`).run()
  database.close()
  return true
}

const removeColumn = (databasePath, tableName, columnToRemove) => {
  const database = db(databasePath)
  database.prepare(`ALTER TABLE ${tableName} DROP ${columnToRemove};`).run()
  database.close()
}

const changeColumnValue = (databasePath, columnName, oldValue, newValue) => {
  const database = db(databasePath)
  database.prepare(`UPDATE ${CACHE_TABLE_NAME} SET ${columnName} = '${newValue}'
                           WHERE ${columnName} = '${oldValue}';`).run()
  database.close()
  return true
}

module.exports = {
  changeColumnName,
  addColumn,
  removeColumn,
  changeColumnValue,
}
