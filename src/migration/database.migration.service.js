import db from 'better-sqlite3'

const CACHE_TABLE_NAME = 'cache'

const changeColumnName = async (databasePath, oldName, newName) => {
  const database = await db(databasePath)
  await database.prepare(`ALTER TABLE ${CACHE_TABLE_NAME} 
                           RENAME ${oldName} TO ${newName};`).run()
  await database.close()
  return true
}

const addColumn = async (databasePath, tableName, newColumnName) => {
  const database = await db(databasePath)
  await database.prepare(`ALTER TABLE ${tableName} ADD ${newColumnName} VARCHAR;`).run()
  await database.close()
  return true
}

const changeColumnValue = async (databasePath, columnName, oldValue, newValue) => {
  const database = await db(databasePath)
  await database.prepare(`UPDATE ${CACHE_TABLE_NAME} SET ${columnName} = '${newValue}'
                           WHERE ${columnName} = '${oldValue}';`).run()
  await database.close()
  return true
}

export default { changeColumnName, addColumn, changeColumnValue }
