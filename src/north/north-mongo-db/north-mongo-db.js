const mongo = require('mongodb')
const { vsprintf } = require('sprintf-js')
const objectPath = require('object-path')

const NorthConnector = require('../north-connector')

/**
 * Class NorthMongoDB - Send data to MongoDB
 */
class NorthMongoDB extends NorthConnector {
  static category = 'DatabaseIn'

  /**
   * Constructor for NorthMongoDB
   * @constructor
   * @param {Object} configuration - The North connector configuration
   * @param {Object[]} proxies - The list of available proxies
   * @return {void}
   */
  constructor(
    configuration,
    proxies,
  ) {
    super(
      configuration,
      proxies,
    )
    this.canHandleValues = true

    const {
      host,
      user,
      password,
      db,
      regExp,
      collection,
      indexFields,
      createCollection,
      timeStampKey,
      useDataKeyValue,
      keyParentValue,
    } = configuration.settings
    this.host = host
    this.user = user
    this.password = password
    this.database = db
    this.regExp = regExp
    this.collection = collection
    this.indexFields = indexFields
    this.createCollection = createCollection
    this.timestampKey = timeStampKey
    this.useDataKeyValue = useDataKeyValue
    this.keyParentValue = keyParentValue

    // Initialized at connection
    this.client = null
    this.mongoDatabase = null
    this.listCollections = null
    this.collectionExists = false
  }

  /**
   * Connection to MongoDB
   * @param {String} _additionalInfo - Connection information to display in the logger
   * @returns {Promise<void>} - The result promise
   */
  async connect(_additionalInfo = '') {
    this.logger.info(`Connecting North "${this.name}" to MongoDB: `
        + `${this.user === '' ? `mongodb://${this.host}` : `mongodb://${this.user}:<password>@${this.host}`}`)

    const url = (this.user === '') ? `mongodb://${this.host}`
      : `mongodb://${this.user}:${await this.encryptionService.decryptText(this.password)}@${this.host}`

    this.client = new mongo.MongoClient(url)
    await this.client.connect()

    this.mongoDatabase = this.client.db(this.database)

    // Variables used to work with Collections and indexes creation if DB Collection doesn't exist
    this.listCollections = await this.mongoDatabase.listCollections(null, { nameOnly: true }).toArray()

    // Indication that collection existence is not checked
    this.collectionExists = false

    await super.connect(`url: ${url}`)
  }

  /**
   * Handle values by sending them to MongoDB.
   * @param {Object[]} values - The values to send
   * @returns {Promise<void>} - The result promise
   */
  async handleValues(values) {
    this.logger.trace(`Handle ${values.length} values.`)

    let body = ''
    let collectionValue = ''
    let indexFieldsValue = ''

    values.forEach((entry) => {
      const {
        pointId,
        data,
      } = entry

      const mainRegExp = new RegExp(this.regExp)
      const groups = mainRegExp.exec(pointId)
      // Remove the first element, which is the matched string, because we only need the groups
      groups.shift()

      collectionValue = vsprintf(this.collection, groups)
      indexFieldsValue = vsprintf(this.indexFields, groups)

      // If there are fewer groups than placeholders, vsprintf will put undefined.
      // We look for the number of 'undefined' before and after the replacement to see if this is the case
      if ((collectionValue.match(/undefined/g) || []).length > (this.collection.match(/undefined/g) || []).length) {
        this.logger.error(`RegExp returned by ${this.regExp} for ${pointId} doesn't have enough groups for the collection.`)
        return
      }
      if ((indexFieldsValue.match(/undefined/g) || []).length > (this.indexFields.match(/undefined/g) || []).length) {
        this.logger.error(`RegExp returned by ${this.regExp} for ${pointId} doesn't have enough groups for indexes.`)
        return
      }

      // Convert indexFieldsValue into mongoIndexFields for inserting with insertMany function
      // example : "Site:XXX,Tranche:1,Repere:XXXXXXXXX"
      const mongoIndexFields = `"${indexFieldsValue}"`.replace(/:/g, '":"')
        .replace(/,/g, '","')

      // Determinate the value to process depending on useDataKeyValue and keyParentValue parameters.
      // In fact, as some use cases can produce value structured as JSON objects, values which could be atomic values
      // (integer, float, ...) or JSON object must be processed
      let dataValue
      if (this.useDataKeyValue) {
        // The data to use is the key "value" of a JSON object data (data.value)
        // This data.value can be a JSON object or an atomic value (i.e. integer or float or string, ...)
        // If it's a JSON, the function return a data where the path is given by keyParentValue parameter even if the
        // JSON object contains more than one level of object.
        // For example: data = { value: { "level1": { "level2": { value: ..., timestamp:... } } } }
        // In this context :
        //   - the object to use, containing value and timestamp, is localised in data.value object by keyParentValue
        // level1.level2
        //   - To retrieve this object, we use objectPath with parameters: (data.value, 'level1.level2')
        dataValue = objectPath.get(data.value, this.keyParentValue)
      } else {
        // Data to use is the JSON object data
        dataValue = data
      }

      let timestamp
      if (this.timestampPathInDataValue) {
        // Case where the timestamp is within the dataValue fields received.
        timestamp = objectPath.get(dataValue, this.timestampPathInDataValue)
        // Once retrieved, remove the timestamp from the fields to not take it again in the other fields
        objectPath.del(dataValue, this.timestampPathInDataValue)
      } else {
        // Case where the timestamp is directly at the root of the data received
        timestamp = entry.timestamp
      }

      // Converts data into fields for MongoDB
      let mongoFields = `"${this.timestampKey}":"${timestamp}"`
      // Filter the timestamp field in the dataValue object in case we already have a timestamp from the main JSON object
      Object.entries(dataValue).filter(([fieldKey]) => fieldKey !== 'timestamp')
        .forEach(([fieldKey, fieldValue]) => {
          mongoFields = `${mongoFields},"${fieldKey}":"${fieldValue}"`
        })

      // Append entry to body
      if (body === '') {
        body = `{${mongoIndexFields},${mongoFields}}`
      } else {
        body += `,\n{${mongoIndexFields},${mongoFields}}`
      }
    })

    if (!this.collectionExists && this.createCollection) {
      // Before inserting data in MongoDB, ensure the collection exists with indexes which are based on indexFields tags
      await this.ensureCollectionExists(collectionValue, indexFieldsValue, this.timestampKey)
    }

    // Inserting JSON Array in MongoDB
    await this.mongoDatabase.collection(collectionValue).insertMany(JSON.parse(`[${body}]`))
  }

  /**
   * Disconnection from MongoDB
   * @returns {Promise<void>} - The result promise
   */
  async disconnect() {
    this.logger.info(`Disconnecting North "${this.name}" from MongoDB.`)
    if (this.client) {
      await this.client.close()
    }
    await super.disconnect()
  }

  /**
   * Ensure the collection exists and create it with indexes if it does not exist
   * @param {String} collectionName  - The collection name
   * @param {String[]} indexFields - Array of fields which compose the index
   * @param {String} timeStampKey - Indicate the timestamp field name to add in index
   * @returns {Promise<void>} - The result promise
   */
  async ensureCollectionExists(collectionName, indexFields, timeStampKey) {
    const existingCollection = this.listCollections.find((collection) => collection.name === collectionName)

    if (!existingCollection) {
      // The collection doesn't exist, we create it with indexes
      await this.mongoDatabase.createCollection(collectionName)
      this.logger.info(`Collection "${collectionName}" successfully created.`)

      // 1rst step: retrieve the list of index fields
      // indexFields is a string formatted like this: "site:%2$s,unit:%3$s,sensor:%4$s"
      const listIndexFields = []
      const arrayTmp = `${indexFields},${timeStampKey}:xx`.replace(/"/g, '')
        .split(/[\s,:]+/)

      for (let i = 0; i < arrayTmp.length; i += 2) {
        listIndexFields.push(arrayTmp[i])
      }

      // 2nd step: create a JSON object which contain the list of index fields and order (0/1)
      let listIndex = null
      for (let i = 0; i < listIndexFields.length; i += 1) {
        if (!listIndex) {
          listIndex = `"${listIndexFields[i]}":1`
        } else {
          listIndex = `${listIndex},"${listIndexFields[i]}":1`
        }
      }
      await this.mongoDatabase.collection(collectionName).createIndex(JSON.parse(`{${listIndex}}`))
      this.logger.info(`Collection indexes successfully created for collection "${collectionName}".`)
    }

    // Do not check again for the next requests
    this.collectionExists = true
  }
}

module.exports = NorthMongoDB
