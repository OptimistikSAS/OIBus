const mongo = require('mongodb')

const ApiHandler = require('../ApiHandler.class')

/**
 * Reads a string in pointId format and returns an object with corresponding indexes and values.
 * @param {String} pointId - String with this form : value1.name1/value2.name2#value
 * @return {Object} Values indexed by name
 */
const pointIdToNodes = (pointId) => {
  const attributes = {}
  pointId
    .slice(1)
    .split('/')
    .forEach((node) => {
      const nodeId = node.replace(/[\w ]+\.([\w]+)/g, '$1') // Extracts the word after the dot
      attributes[nodeId] = node.replace(/([\w ]+)\.[\w]+/g, '$1') // Extracts the one before
    })
  return attributes
}

/**
 * Escape spaces.
 * @param {*} chars - The content to escape
 * @return {*} The escaped or the original content
 */
const escapeSpace = (chars) => {
  if (typeof chars === 'string') {
    return chars.replace(/ /g, '\\ ')
  }
  return chars
}

/**
 * Class MongoDB - generates and sends MongoDB requests
 * Warning : This class is based on InfluxDB class
 * Data received are structured on InfluxDB "Model"
 * Nodes is (for example) "/ANA.base/1RCV019MT.repere"
 *    ANA    ==> Collection Name
 *    repere ==> One index (we will also add timestamp index)
 * Value is JSON object which is insert in document like that
 * Normally this JSON object must contains "repere" and "timestamp" fields used in indexes
 */
class MongoDB extends ApiHandler {
  /**
   * Constructor for MongoDB
   * @constructor
   * @param {Object} applicationParameters - The application parameters
   * @param {Engine} engine - The Engine
   * @return {void}
   */
  constructor(applicationParameters, engine) {
    super(applicationParameters, engine)

    this.canHandleValues = true
  }

  /**
   * Handle values by sending them to MongoDB.
   * @param {object[]} values - The values
   * @return {Promise} - The handle status
   */
  async handleValues(values) {
    this.logger.silly(`Link handleValues() call with ${values.length} values`)
    try {
      await this.makeRequest(values)
    } catch (error) {
      this.logger.error(error)
      throw error
    }
    return true
  }

  /**
   * Connection to MongoDB
   * @return {void}
   */
  connect() {
    this.logger.info('Connection to MongoDB')
    const { host, user, password, db } = this.application.MongoDB

    // creating url connection string
    const url = `mongodb://${user}:${this.decryptPassword(password)}@${host}`

    this.client = new mongo.MongoClient(url)
    this.client.connect((error) => {
      if (error) {
        this.logger.info(`Error during Connection To MongoDB : ${error}`)
        this.client_db = null
      } else {
        this.logger.info('Connection To MongoDB : OK')

        // open database db
        this.client_db = this.client.db(db)

        // variables used to work with Collection and indexes creation if DB Collection doesn't exists

        // getting database list Collections
        this.listCollections = []
        this.client_db.listCollections({}).toArray((err, collNames) => {
          if (!err) {
            this.listCollections = collNames.slice()
          }
        })

        // indication that collection existence is not checked
        this.collectionChecked = false
        // indication that tagFields aren't already got
        this.gettagFields = false
        // array used to store fields tags (this array is populate only with the tags of the first value)
        this.tagFields = []
      }
    })
  }

  /**
   * Disconnection from MongoDB
   * @return {void}
   */
  disconnect() {
    this.logger.info('Disconnection from MongoDB')
    this.client.close()
  }

  /**
   * Makes an MongoDB request with the parameters in the Object arg.
   * @param {Object[]} entries - The entry from the event
   * @return {Promise} - The request status
   */
  async makeRequest(entries) {
    // const { host, user, password, db, precision = 'ms' } = this.application.MongoDB

    let body = ''
    let collection = ''

    entries.forEach((entry) => {
      const { pointId, data } = entry
      const Nodes = Object.entries(pointIdToNodes(pointId))
      /** @todo check logic again - Modif Yves */
      // const measurement = Nodes[Nodes.length - 1][0]

      // eslint-disable-next-line prefer-destructuring
      collection = Nodes[0][1]

      // Convert nodes into tags for CLI
      // For InfluxDB the tags is use to identify the tags (indexes)
      // To be in the same usage than InfluxDB, we add timestamp in tags
      let tags = null
      Nodes.slice(1).forEach(([tagKey, tagValue]) => {
        if (!tags) tags = `"${escapeSpace(tagKey)}":"${escapeSpace(tagValue)}"`
        else tags = `${tags},"${escapeSpace(tagKey)}":"${escapeSpace(tagValue)}"`
      })
      tags = `${tags},"timestamp":"xxxxxxx"` // "xx...xx" part will not be used.

      if ((!this.collectionChecked) && (!this.gettagFields)) {
        // getting fields which compose the tags
        const taglist = tags.replace(/"/g, '').split(/[\s,:]+/)
        for (let i = 0; i < taglist.length; i += 2) {
          this.tagFields.push(taglist[i])
        }
        this.gettagFields = true
      }

      // Converts data into fields for CLI
      let fields = null
      // FIXME rewrite this part to handle a data in form of {value: string, quality: string}
      // The data received from MQTT is type of string, so we need to transform it to Json
      const dataJson = JSON.parse(decodeURI(data))
      Object.entries(dataJson).forEach(([fieldKey, fieldValue]) => {
        if (!fields) fields = `"${escapeSpace(fieldKey)}":${escapeSpace(fieldValue)}`
        else fields = `${fields},"${escapeSpace(fieldKey)}":${escapeSpace(fieldValue)}`
      })

      /*
      // Convert timestamp to the configured precision
      let preciseTimestamp = new Date(timestamp).getTime()
      switch (precision) {
        case 'ns':
          preciseTimestamp = 1000 * 1000 * timestamp
          break
        case 'u':
          preciseTimestamp = 1000 * timestamp
          break
        case 'ms':
          break
        case 's':
          preciseTimestamp = Math.floor(timestamp / 1000)
          break
        case 'm':
          preciseTimestamp = Math.floor(timestamp / 1000 / 60)
          break
        case 'h':
          preciseTimestamp = Math.floor(timestamp / 1000 / 60 / 60)
          break
        default:
          preciseTimestamp = timestamp
      }
      */

      // Append entry to body
      // body += `${collection},${tags} ${fields} ${preciseTimestamp}\n`
      if (body === '') {
        body = `{${tags},${fields}}`
      } else {
        body += `,\n{${tags},${fields}}`
      }
    })

    let bodyjson = {}

    if (!this.collectionChecked) {
      // before inserting data in MongoDB, ensuring, for the first time, that
      // collection exists with indexes which are based on tags tagKeys
      await this.ensureCollectionExists(collection, this.tagFields)

      this.logger.info('Want to write datas in MongoDB Database')

      // converting body in JSON Array
      bodyjson = JSON.parse(`[${body}]`)

      // Inserting JSON Array in MongoDB
      this.client_db.collection(collection).insertMany(bodyjson)
    } else {
      // converting body in JSON Array
      bodyjson = JSON.parse(`[${body}]`)

      // Inserting JSON Array in MongoDB
      this.client_db.collection(collection).insertMany(bodyjson)
    }
    return true
  }


  /**
   * Ensure Collection exists and create it with indexes if not exists
   * @param {string}   collection  - The collection name
   * @param {string[]} fields      - array of fields which compose the index
   * @return {void}
   */
  async ensureCollectionExists(collection, fields) {
    if (!this.listCollections.includes(collection)) {
      // the collection doesn't exists, we create it with indexes
      await this.client_db.createCollection(collection, ((error1) => {
        if (error1) {
          this.logger.info(`Error during Collection (${collection}) creation : ${error1}`)
        } else {
          this.logger.info(`Collection (${collection}) Creation : Success`)
          // the collection was created
          // now we will crate index based on tagkeys array
          let indexfields = null
          for (let i = 0; i < fields.length; i += 1) {
            if (!indexfields) indexfields = `"${fields[i]}":1`
            else indexfields = `${indexfields},"${fields[i]}":1`
          }
          this.client_db.collection(collection).createIndex(JSON.parse(`{${indexfields}}`), ((error2) => {
            if (error2) {
              this.logger.info(`Error during Collection (${collection}) Indexes Creation : ${error2}`)
            } else {
              this.logger.info(`Collection (${collection}) Indexes Creation : Success`)
            }
            // disable this part of code for the next time
          }))
        }
      }))
    }
    this.collectionChecked = true
  }
}

module.exports = MongoDB
