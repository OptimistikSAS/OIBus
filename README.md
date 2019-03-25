# OIBus
## How OIBus works

###### Overall workflow

* The Engine is what holds everything together : its start method is like a pseudo-constructor, it creates and then stores every Protocol, Application, and Queue object that will be used to receive and treat the data.

* The index reads the config file, instanciates the unique Engine and runs its start method which will also create the CronJobs to call the onScan() methods on the right time and for the right points.

* The onScan() methods are what run the services : protocols' onScan() will make the data requests to the right equipments and store it in the queues ; applications' onScan will retrieve the data in their own queue to treat it however they need to.

###### Classes used


* **Engine:**  
  * one instance  
  * start method handles the initialization of all the applications and protocols and their connection  
  * also creates the CronJobs which call the onScan  
  * contains one array for all the queues, one array for the activeApplication and one array for the activeProtocols  

* **Queue:**  
  * one instance per application  
  * all queues are stored in a single Engine array  
  * provides encapsulation for an array of Objects containing data and metadata for each measured point:  
  * enqueue(), dequeue(), flush() and a length getter  
  * all queues are updated simultaneously with the receiving of a data response  

* **Server:**  
  * one instance

* **Protocol:** one instance per unique protocol  
*A parent class. Each protocol has its own class and specifications.*  
Every Protocol has:  
  * one array of equipments with one entry for each equipment using this protocol. Each entry contains the information and objects needed to connect with the equipment  
  * one onScan() method  
  * one connect() and one deconnect() method  


* *An example of protocol : OPCUA.class*
  * The equipments array is defined in the Protocol superclass :
  ```
  constructor(engine) {
    this.engine = engine
    this.equipments = {}
  }
  ```
  The equipments are then added with the add function :  
  ```
  const add = (opcua, equipment, equipments) => {
    equipments[equipment.equipmentId] = {
      client: new Opcua.OPCUAClient({ endpoint_must_exist: false }),
      url: sprintf(opcua.connectionAddress.opc, equipment.OPCUA),
    }
  } 
  ```
  As you can see every equipment using the OPCUA protocol needs *1 object* (an OPCUA client) and *1 parameter* (the end point URL) to be connected to.
  * Here is the connect() method :
  ```
  async connect() {
    await Object.values(this.equipments).forEach(async (equipment) => {
      await equipment.client.connect(equipment.url)
      await equipment.client.createSession((err, session) => {
        if (!err) {
          equipment.session = session
          equipment.connected = true
        }
      })
    })
  }
  ```
  The client's connect method is called with the equipment's URL as an argument. Then the session is created and a reference to it is stored in the equipments entry together with a 'connected' attribute.  
  * The onScan() method goes like this :  
  ```
  async onScan(scanMode) {
    const scanGroup = this.optimizedConfig[scanMode]
    Object.keys(scanGroup).forEach((equipment) => {
      if (this.equipments[equipment].connected) {
        const nodesToRead = {}
        scanGroup[equipment].forEach((point) => {
          nodesToRead[point.pointId] = { nodeId: sprintf('ns=%(ns)s;s=%(s)s', point.OPCUAnodeId) }
        })
        this.equipments[equipment].session.read(Object.values(nodesToRead), 10, (err, dataValues) => {
          if (!err && Object.keys(nodesToRead).length === dataValues.length) {
            Object.keys(nodesToRead).forEach((pointId) => {
              const dataValue = dataValues.shift()
              this.engine.addValue({
                pointId,
                timestamp: dataValue.sourceTimestamp.toString(),
                data: dataValue.value.value,
              })
            })
          }
        })
      }
    })
  }
  ```
  For every connected equipment, every point with the given scanMode is added to a 'nodesToRead' object which is passed as an argument to the equipment session's function 'read' , then the values read are added to the queues using the engine method addValue().


* **Application:** one instance per application  
*A parent class. Each application has its own class and specifications.*  
Every application has:   
  * one Queue which is actually a reference to their specific Queue in the array from Engine.  
  * an applicationParameters object containing information to be used by the application  
  * one onScan() method  
  * one connect() and one disconnect() method  


* *An example of Application : InfluxDB.class*
  * The Queue and applicationParameters are defined in the super constructor :
  ```
  constructor(engine, applicationParameters) {
    this.queue = new Queue(engine)
    this.applicationParameters = applicationParameters
  }
  ```
  * No connect() method is defined in InfluxDB, since it doesn't use a connected process : all insert commands are sent via multiple fetch requests.
  * The onScan() method is as such :
  ```
  onScan() {
    this.queue.flush(value => this.makeRequest(value))
  }
  ```
  This uses the flush() method in Queue which empties the queue in InfluxDB one entry at a time while calling the makeRequest() method in InfluxDB for each one of them. makeRequest() goes like this :
  ```
  makeRequest(entry) {
    const { data, pointId, timestamp } = entry
    const nodes = { data, host: this.host, timestamp }
    Object.entries(pointIdToNodes(pointId)).forEach(([nodeId, node]) => {
      nodes[nodeId] = node
    })
    Object.entries(nodes).forEach(([nodeId, node]) => {
      if (nodeId !== 'data') {
        nodes[nodeId] = node.replace(/ /g, '\\ ')
        if (!Number.isNaN(parseInt(node, 10))) nodes.measurement = nodeId
      }
    })
    const insert = this.applicationParameters.InfluxDB.insert.replace(/'/g, '')
    let body = `${insert.split(' ')[2]} ${insert.split(' ')[3]}`
      .replace(/zzz/g, '%(measurement)s')
      .replace(/ \w+=.*/g, ' %(dataId)s=%(data)s') // Looks for the last field (value field) and inserts the data
    Object.keys(nodes).forEach((nodeId) => {
      const notTags = ['data', 'host', 'measurement', nodes.measurement, 'base']
      if (!notTags.includes(nodeId)) {
        // Replaces 3-same-letter fields by a tagName
        // i.e : Transforms xxx=%(xxx) into tagName=%(tagName)
        body = body.replace(/([a-z])\1\1(tag)?=%\(\1\1\1\)/, `${nodeId}=%(${nodeId})`)
      }
    })
    // Removes any unused 'xxx=%(xxx)' field from body
    body = body.replace(/,([a-z])\1\1(tag)?=%\(\1\1\1\)/g, '')
    body = sprintf(body, nodes)
    fetch(sprintf(`http://${insert.split(' ')[0]}`, nodes), {
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    })
  }
  ```
  In short, makeRequest() reads an entry in the queue and uses a series of regular expressions to build a string out of it which can be used by a fetch request to the Influx database. Then it calls the actual fetch.
