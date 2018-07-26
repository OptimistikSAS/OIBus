/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = "./src/index.js");
/******/ })
/************************************************************************/
/******/ ({

/***/ "./node_modules/@koa/cors/index.js":
/*!*****************************************!*\
  !*** ./node_modules/@koa/cors/index.js ***!
  \*****************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
eval("\n\n/**\n * CORS middleware\n *\n * @param {Object} [options]\n *  - {String|Function(ctx)} origin `Access-Control-Allow-Origin`, default is request Origin header\n *  - {String|Array} allowMethods `Access-Control-Allow-Methods`, default is 'GET,HEAD,PUT,POST,DELETE,PATCH'\n *  - {String|Array} exposeHeaders `Access-Control-Expose-Headers`\n *  - {String|Array} allowHeaders `Access-Control-Allow-Headers`\n *  - {String|Number} maxAge `Access-Control-Max-Age` in seconds\n *  - {Boolean} credentials `Access-Control-Allow-Credentials`\n *  - {Boolean} keepHeadersOnError Add set headers to `err.header` if an error is thrown\n * @return {Function} cors middleware\n * @api public\n */\nmodule.exports = function(options) {\n  const defaults = {\n    allowMethods: 'GET,HEAD,PUT,POST,DELETE,PATCH',\n  };\n\n  options = Object.assign({}, defaults, options);\n\n  if (Array.isArray(options.exposeHeaders)) {\n    options.exposeHeaders = options.exposeHeaders.join(',');\n  }\n\n  if (Array.isArray(options.allowMethods)) {\n    options.allowMethods = options.allowMethods.join(',');\n  }\n\n  if (Array.isArray(options.allowHeaders)) {\n    options.allowHeaders = options.allowHeaders.join(',');\n  }\n\n  if (options.maxAge) {\n    options.maxAge = String(options.maxAge);\n  }\n\n  options.credentials = !!options.credentials;\n  options.keepHeadersOnError = options.keepHeadersOnError === undefined || !!options.keepHeadersOnError;\n\n  return function cors(ctx, next) {\n    // If the Origin header is not present terminate this set of steps.\n    // The request is outside the scope of this specification.\n    const requestOrigin = ctx.get('Origin');\n\n    // Always set Vary header\n    // https://github.com/rs/cors/issues/10\n    ctx.vary('Origin');\n\n    if (!requestOrigin) {\n      return next();\n    }\n\n    let origin;\n\n    if (typeof options.origin === 'function') {\n      // FIXME: origin can be promise\n      origin = options.origin(ctx);\n      if (!origin) {\n        return next();\n      }\n    } else {\n      origin = options.origin || requestOrigin;\n    }\n\n    const headersSet = {};\n\n    function set(key, value) {\n      ctx.set(key, value);\n      headersSet[key] = value;\n    }\n\n    if (ctx.method !== 'OPTIONS') {\n      // Simple Cross-Origin Request, Actual Request, and Redirects\n      set('Access-Control-Allow-Origin', origin);\n\n      if (options.credentials === true) {\n        set('Access-Control-Allow-Credentials', 'true');\n      }\n\n      if (options.exposeHeaders) {\n        set('Access-Control-Expose-Headers', options.exposeHeaders);\n      }\n\n      if (!options.keepHeadersOnError) {\n        return next();\n      }\n      return next().catch(err => {\n        err.headers = Object.assign({}, err.headers, headersSet);\n        throw err;\n      });\n    } else {\n      // Preflight Request\n\n      // If there is no Access-Control-Request-Method header or if parsing failed,\n      // do not set any additional headers and terminate this set of steps.\n      // The request is outside the scope of this specification.\n      if (!ctx.get('Access-Control-Request-Method')) {\n        // this not preflight request, ignore it\n        return next();\n      }\n\n      ctx.set('Access-Control-Allow-Origin', origin);\n\n      if (options.credentials === true) {\n        ctx.set('Access-Control-Allow-Credentials', 'true');\n      }\n\n      if (options.maxAge) {\n        ctx.set('Access-Control-Max-Age', options.maxAge);\n      }\n\n      if (options.allowMethods) {\n        ctx.set('Access-Control-Allow-Methods', options.allowMethods);\n      }\n\n      let allowHeaders = options.allowHeaders;\n      if (!allowHeaders) {\n        allowHeaders = ctx.get('Access-Control-Request-Headers');\n      }\n      if (allowHeaders) {\n        ctx.set('Access-Control-Allow-Headers', allowHeaders);\n      }\n\n      ctx.status = 204;\n    }\n  };\n};\n\n\n//# sourceURL=webpack:///./node_modules/@koa/cors/index.js?");

/***/ }),

/***/ "./src/controllers/nodes.js":
/*!**********************************!*\
  !*** ./src/controllers/nodes.js ***!
  \**********************************/
/*! no static exports found */
/***/ (function(module, exports) {

eval("function getNode(ctx) {\n  const { query } = ctx.request\n  const { node } = query\n  const authHeader = ctx.request.header.authorization || ''\n  // following sequence allow to determine the user/password\n  // used in the web request\n  // authHeader format: \"Basic <hashcode for user:pass\"\n\n  // 1/ Check format\n  if (authHeader.startsWith('Basic ')) {\n    // 2 extract encoded user:pass\n    const encodedUsernamePassword = authHeader.split(' ')[1]\n\n    // 3 decode back from Base64 to string:\n    const usernamePassword = Buffer.from(encodedUsernamePassword, 'base64')\n      .toString()\n      .split(':')\n    const username = usernamePassword[0]\n    const password = usernamePassword[1]\n    console.log(`request from ${username} with password:${password}`)\n  } else {\n    // Handle what happens if that isn't the case\n    throw new Error(\"The authorization header is either empty or isn't Basic.\")\n  }\n  ctx.ok({ node, query, comment: ' node was requested!' })\n}\n\nmodule.exports = { getNode }\n\n\n//# sourceURL=webpack:///./src/controllers/nodes.js?");

/***/ }),

/***/ "./src/controllers/users.js":
/*!**********************************!*\
  !*** ./src/controllers/users.js ***!
  \**********************************/
/*! no static exports found */
/***/ (function(module, exports) {

eval("function getUser(ctx) {\n  const { query } = ctx.request\n  const { user } = query\n\n  ctx.ok({ user, query, comment: ' user was requested!' })\n}\n\nmodule.exports = { getUser }\n\n\n//# sourceURL=webpack:///./src/controllers/users.js?");

/***/ }),

/***/ "./src/index.js":
/*!**********************!*\
  !*** ./src/index.js ***!
  \**********************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

eval("__webpack_require__(/*! dotenv */ \"dotenv\").config()\nconst server = __webpack_require__(/*! ./server */ \"./src/server.js\")\nconst fs = __webpack_require__(/*! fs */ \"fs\")\nconst { CronJob } = __webpack_require__(/*! cron */ \"cron\")\nconst ModbusClient = __webpack_require__(/*! ./south/modbus/ModbusClient.class */ \"./src/south/modbus/ModbusClient.class.js\")\nconst configService = __webpack_require__(/*! ./services/config.service */ \"./src/services/config.service.js\")\n\nconst args = configService.parseArgs() || {} // Arguments of the command\nconst { configPath = './fTbus.config.json' } = args // Get the configuration file path\n\n// Check if the provided file is json\nif (!configPath.endsWith('.json')) {\n  console.error('You must provide a json file for the configuration!')\n}\n\n/**\n * Tries to read a file at a given path\n * @param {String} path : path to the file to read\n * @return {*} : content of the file\n */\nconst tryReadFile = (path) => {\n  try {\n    return JSON.parse(fs.readFileSync(path, 'utf8')) // Get fTbus configuration file\n  } catch (error) {\n    console.error(error)\n    return error\n  }\n}\n\nconst fTbusConfig = tryReadFile(configPath)\n\nconst { scanModes, configExemple } = fTbusConfig // Get the cron frequences file path\nconst frequences = tryReadFile(scanModes)\n\n// Check if the frequences file has been correctly retreived\nif (!frequences) {\n  console.error('Frequences file not found.')\n} \n\nconst port = process.env.PORT || 3333\nserver.listen(port, () => console.info(`API server started on ${port}`))\n\n\n//# sourceURL=webpack:///./src/index.js?");

/***/ }),

/***/ "./src/routes/index.js":
/*!*****************************!*\
  !*** ./src/routes/index.js ***!
  \*****************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

eval("const users = __webpack_require__(/*! ./users */ \"./src/routes/users.js\")\nconst nodes = __webpack_require__(/*! ./nodes */ \"./src/routes/nodes.js\")\n\nmodule.exports = (router) => {\n  router.prefix('/v1')\n  router.use('/users', users)\n  router.use('/nodes', nodes)\n}\n\n\n//# sourceURL=webpack:///./src/routes/index.js?");

/***/ }),

/***/ "./src/routes/nodes.js":
/*!*****************************!*\
  !*** ./src/routes/nodes.js ***!
  \*****************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

eval("const Router = __webpack_require__(/*! koa-router */ \"koa-router\")\n\nconst router = new Router()\nconst Ctrl = __webpack_require__(/*! ../controllers/nodes */ \"./src/controllers/nodes.js\")\n\nrouter.get('/', Ctrl.getNode)\n\nmodule.exports = router.routes()\n\n\n//# sourceURL=webpack:///./src/routes/nodes.js?");

/***/ }),

/***/ "./src/routes/users.js":
/*!*****************************!*\
  !*** ./src/routes/users.js ***!
  \*****************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

eval("const Router = __webpack_require__(/*! koa-router */ \"koa-router\")\n\nconst router = new Router()\nconst Ctrl = __webpack_require__(/*! ../controllers/users */ \"./src/controllers/users.js\")\n\nrouter.get('/', Ctrl.getUser)\n\nmodule.exports = router.routes()\n\n\n//# sourceURL=webpack:///./src/routes/users.js?");

/***/ }),

/***/ "./src/server.js":
/*!***********************!*\
  !*** ./src/server.js ***!
  \***********************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

eval("const Koa = __webpack_require__(/*! koa */ \"koa\")\nconst Router = __webpack_require__(/*! koa-router */ \"koa-router\")\nconst auth = __webpack_require__(/*! koa-basic-auth */ \"koa-basic-auth\")\nconst logger = __webpack_require__(/*! koa-logger */ \"koa-logger\")\nconst cors = __webpack_require__(/*! @koa/cors */ \"./node_modules/@koa/cors/index.js\")\nconst bodyParser = __webpack_require__(/*! koa-bodyparser */ \"koa-bodyparser\")\nconst helmet = __webpack_require__(/*! koa-helmet */ \"koa-helmet\")\nconst respond = __webpack_require__(/*! koa-respond */ \"koa-respond\")\n\nconst app = new Koa()\nconst router = new Router()\n\n\n// Development style logging middleware\n// Recommended that you .use() this middleware near the top\n//  to \"wrap\" all subsequent middleware.\nif (true) {\n  app.use(logger())\n}\n// koa-helmet is a wrapper for helmet to work with koa.\n// It provides important security headers to make your app more secure by default.\napp.use(helmet())\n\n// custom 401 handling\napp.use(async (ctx, next) => {\n  try {\n    await next()\n  } catch (err) {\n    if (err.status === 401) {\n      ctx.status = 401\n      ctx.set('WWW-Authenticate', 'Basic')\n      ctx.body = 'access was not authorized'\n    } else {\n      throw err\n    }\n  }\n})\n\n// Add simple \"blanket\" basic auth with username / password.\n// Password protect downstream middleware:\napp.use(auth({ name: 'jf', pass: 'jfhjfh' }))\n\n// CORS middleware for Koa\napp.use(cors())\n\n// A body parser for koa, base on co-body. support json, form and text type body.\napp.use(bodyParser({\n  enableTypes: ['json'],\n  jsonLimit: '5mb',\n  strict: true,\n  onerror(err, ctx) {\n    ctx.throw('body parse error', 422)\n  },\n}))\n\n// Middleware for Koa that adds useful methods to the Koa context.\napp.use(respond())\n\n// API routes\n// Router middleware for koa\n// Express-style routing using app.get, app.put, app.post, etc.\n// Named URL parameters.\n// Named routes with URL generation.\n// Responds to OPTIONS requests with allowed methods.\n// Support for 405 Method Not Allowed and 501 Not Implemented.\n// Multiple route middleware.\n// Multiple routers.\n// Nestable routers.\n// ES7 async/await support.\n__webpack_require__(/*! ./routes */ \"./src/routes/index.js\")(router)\n\napp.use(router.routes())\napp.use(router.allowedMethods())\n\nmodule.exports = app\n\n\n//# sourceURL=webpack:///./src/server.js?");

/***/ }),

/***/ "./src/services/config.service.js":
/*!****************************************!*\
  !*** ./src/services/config.service.js ***!
  \****************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

eval("const minimist = __webpack_require__(/*! minimist */ \"minimist\")\n\n/**\n * Checks if the right arguments have been passed to the command\n * @param {Object} args : arguments of the command\n * @return {boolean} : whether the right arguments have been passed or not\n */\nconst isValidArgs = ({ config = './fTbus.config.json' }) => {\n  if (!config) {\n    console.error('No config file specified, exemple: --config ./config/config.json')\n    return false\n  }\n  return true\n}\n\n/**\n * Retreives the arguments passed to the command\n * @return {Object} args : retreived arguments, or null\n */\nconst parseArgs = () => {\n  const args = minimist(process.argv.slice(2))\n\n  if (isValidArgs(args)) {\n    return args\n  }\n  return null\n}\n\nmodule.exports = { parseArgs }\n\n\n//# sourceURL=webpack:///./src/services/config.service.js?");

/***/ }),

/***/ "./src/south/modbus/ModbusClient.class.js":
/*!************************************************!*\
  !*** ./src/south/modbus/ModbusClient.class.js ***!
  \************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

eval("const modbus = __webpack_require__(/*! jsmodbus */ \"jsmodbus\")\nconst net = __webpack_require__(/*! net */ \"net\")\nconst getConfig = __webpack_require__(/*! ./config/modbus.config */ \"./src/south/modbus/config/modbus.config.js\")\n\n/**\n * Class ModbusClient : provides instruction for modbus client connection\n */\nclass ModbusClient {\n  /**\n   * Constructor for ModbusClient\n   * @param {String} configPath : path to the non-optimized configuration file\n   */\n  constructor(configPath) {\n    this.socket = new net.Socket()\n    this.client = new modbus.client.TCP(this.socket)\n    this.connected = false\n    this.optimizedConfig = getConfig(configPath)\n  }\n\n  /**\n   * Runs right instructions based on a given scanMode\n   * @param {String} scanMode : cron time\n   * @return {void}\n   */\n  pol(scanMode) {\n    if (this.connected) {\n      const scanGroup = this.optimizedConfig[scanMode]\n      Object.keys(scanGroup).forEach((equipment) => {\n        Object.keys(scanGroup[equipment]).forEach((type) => {\n          const addressesForType = scanGroup[equipment][type] // Addresses of the group\n\n          const funcName = `read${`${type.charAt(0).toUpperCase()}${type.slice(1)}`}s` // Build function name, IMPORTANT: type must be singular\n\n          // Dynamic call of the appropriate function based on type\n          const modbusFunction = (startAddress, count) =>\n            this.client[funcName](startAddress, count)\n              .then((resp) => {\n                console.log('Response: ', JSON.stringify(resp.response))\n              })\n              .catch((error) => {\n                console.error(error)\n                this.disconnect()\n              })\n\n          Object.keys(addressesForType).forEach((range) => {\n            const rangeAddresses = range.split('-')\n            const startAddress = parseInt(rangeAddresses[0], 10) // First address of the group\n            const endAddress = parseInt(rangeAddresses[1], 10) // Last address of the group\n            const rangeSize = endAddress - startAddress // Size of the addresses group\n            modbusFunction(startAddress, rangeSize)\n          })\n        })\n      })\n    } else {\n      console.error('You must be connected to run pol.')\n    }\n  }\n\n  /**\n   * Initiates a connection to the given host on port 502\n   * @param {String} host : host ip address\n   * @param {Function} : callback function\n   * @return {void}\n   */\n  connect(host) {\n    this.socket.connect({ host, port: 502 })\n    this.connected = true\n  }\n\n  /**\n   * Close the connection\n   * @return {void}\n   */\n  disconnect() {\n    this.socket.end()\n    this.connected = false\n  }\n}\n\nmodule.exports = ModbusClient\n\n\n//# sourceURL=webpack:///./src/south/modbus/ModbusClient.class.js?");

/***/ }),

/***/ "./src/south/modbus/config/modbus.config.js":
/*!**************************************************!*\
  !*** ./src/south/modbus/config/modbus.config.js ***!
  \**************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

eval("const fs = __webpack_require__(/*! fs */ \"fs\")\n\n/**\n * Retreives a nested property from an object\n * @param {Object} obj : objectwhich contains the nested property\n * @param {String} nestedProp : property to search inside the object, must be of format \"property.nestedProperty\"\n * @param {boolean} delProp : whether to delete the property once find or not\n * @return {*} : value of the property\n */\nconst findProperty = (obj, nestedProp, delProp) => {\n  const propArray = nestedProp.split('.')\n  const currentProp = propArray.splice(0, 1)[0]\n  if (propArray.length !== 0) {\n    return findProperty(obj[currentProp], propArray.join('.'), delProp)\n  }\n  const res = obj[currentProp]\n  if (delProp) delete obj[currentProp] // Delete useless property\n  return res\n}\n\n/**\n * Groups objects based on a mutual property\n * @param {[ Object ]} array : array of objects to group\n * @param {String} key : name of the property on which base the groups\n * @return {Object} acc : grouped objects\n */\nconst groupBy = (array, key, newProps = {}) =>\n  array.reduce((acc, obj) => {\n    const group = findProperty(obj, key, true)\n    if (!acc[group]) acc[group] = []\n    acc[group].push({ ...obj, ...newProps })\n    return acc\n  }, {})\n\nconst findAddressesGroup = (object, address) =>\n  Object.keys(object).find((group) => {\n    const rangeAddresses = group.split('-')\n    const start = parseInt(rangeAddresses[0], 10)\n    const end = parseInt(rangeAddresses[1], 10)\n    return address >= start && address <= end\n  })\n\n/**\n * Groups the equipments by addresses to optimize requests\n * @param {[ Object ]} array : array of objects to group\n * @param {String} key : key or nested key address to find it inside the objects\n * @param {int} groupSize : number of address by group\n * @return {Object} acc : grouped object by addresses\n */\nconst groupAddresses = (array, key, groupSize) => {\n  const sortedArray = array.sort((a, b) => {\n    const strAddressA = findProperty(a, key, false) // String address A\n    const strAddressB = findProperty(b, key, false) // String address B\n    return parseInt(strAddressA, 16) - parseInt(strAddressB, 16)\n  })\n  return sortedArray.reduce((acc, obj) => {\n    const strAddress = findProperty(obj, key, false)\n    const addressValue = parseInt(strAddress, 16) // Decimal value of hexadecimal address\n    const nearestLimit = Math.round(addressValue / 16) * 16 // Nearest address group limit\n    const groupStart = addressValue <= nearestLimit ? nearestLimit - 16 : nearestLimit // First address of the group\n    const end = Math.round((nearestLimit + groupSize) / 16) * 16 // Last address\n\n    const groupName = findAddressesGroup(acc, addressValue) || `${groupStart}-${end}`\n    if (!acc[groupName]) acc[groupName] = []\n    acc[groupName].push(obj)\n    return acc\n  }, {})\n}\n\n/**\n * Gets the configuration file\n * @return {boolean}\n */\nconst getConfig = (path) => {\n  const configFile = JSON.parse(fs.readFileSync(path, 'utf8')) // Read configuration file synchronously\n\n  if (!configFile) {\n    console.error(`The file ${path} could not be loaded!`)\n    return false\n  }\n\n  const optimized = configFile.reduce((acc, { equipmentId, protocol, variables }) => {\n    const protocolConfig = JSON.parse(fs.readFileSync(`./tests/${protocol}.config.json`, 'utf8')) // Read configuration file synchronously\n    const { addressGap } = protocolConfig\n\n    if (protocol === 'modbus') {\n      const scanModes = groupBy(variables, 'scanMode', { equipmentId })\n      Object.keys(scanModes).forEach((scan) => {\n        scanModes[scan] = groupBy(scanModes[scan], 'equipmentId')\n        Object.keys(scanModes[scan]).forEach((equipment) => {\n          scanModes[scan][equipment] = groupBy(scanModes[scan][equipment], `${protocol}.type`)\n          Object.keys(scanModes[scan][equipment]).forEach((type) => {\n            scanModes[scan][equipment][type] = groupAddresses(scanModes[scan][equipment][type], `${protocol}.address`, addressGap)\n          })\n        })\n      })\n      Object.keys(scanModes).forEach((scan) => {\n        if (!acc[scan]) acc[scan] = {}\n        acc[scan] = { ...acc[scan], ...scanModes[scan] }\n      })\n    }\n\n    return acc\n  }, {})\n\n  fs.writeFile('./tests/optimizedConfig.json', JSON.stringify(optimized), 'utf8', () => {\n    console.info('Optimized config file has been generated.')\n  })\n  return optimized\n}\n\nmodule.exports = getConfig\n\n\n//# sourceURL=webpack:///./src/south/modbus/config/modbus.config.js?");

/***/ }),

/***/ "cron":
/*!***********************!*\
  !*** external "cron" ***!
  \***********************/
/*! no static exports found */
/***/ (function(module, exports) {

eval("module.exports = require(\"cron\");\n\n//# sourceURL=webpack:///external_%22cron%22?");

/***/ }),

/***/ "dotenv":
/*!*************************!*\
  !*** external "dotenv" ***!
  \*************************/
/*! no static exports found */
/***/ (function(module, exports) {

eval("module.exports = require(\"dotenv\");\n\n//# sourceURL=webpack:///external_%22dotenv%22?");

/***/ }),

/***/ "fs":
/*!*********************!*\
  !*** external "fs" ***!
  \*********************/
/*! no static exports found */
/***/ (function(module, exports) {

eval("module.exports = require(\"fs\");\n\n//# sourceURL=webpack:///external_%22fs%22?");

/***/ }),

/***/ "jsmodbus":
/*!***************************!*\
  !*** external "jsmodbus" ***!
  \***************************/
/*! no static exports found */
/***/ (function(module, exports) {

eval("module.exports = require(\"jsmodbus\");\n\n//# sourceURL=webpack:///external_%22jsmodbus%22?");

/***/ }),

/***/ "koa":
/*!**********************!*\
  !*** external "koa" ***!
  \**********************/
/*! no static exports found */
/***/ (function(module, exports) {

eval("module.exports = require(\"koa\");\n\n//# sourceURL=webpack:///external_%22koa%22?");

/***/ }),

/***/ "koa-basic-auth":
/*!*********************************!*\
  !*** external "koa-basic-auth" ***!
  \*********************************/
/*! no static exports found */
/***/ (function(module, exports) {

eval("module.exports = require(\"koa-basic-auth\");\n\n//# sourceURL=webpack:///external_%22koa-basic-auth%22?");

/***/ }),

/***/ "koa-bodyparser":
/*!*********************************!*\
  !*** external "koa-bodyparser" ***!
  \*********************************/
/*! no static exports found */
/***/ (function(module, exports) {

eval("module.exports = require(\"koa-bodyparser\");\n\n//# sourceURL=webpack:///external_%22koa-bodyparser%22?");

/***/ }),

/***/ "koa-helmet":
/*!*****************************!*\
  !*** external "koa-helmet" ***!
  \*****************************/
/*! no static exports found */
/***/ (function(module, exports) {

eval("module.exports = require(\"koa-helmet\");\n\n//# sourceURL=webpack:///external_%22koa-helmet%22?");

/***/ }),

/***/ "koa-logger":
/*!*****************************!*\
  !*** external "koa-logger" ***!
  \*****************************/
/*! no static exports found */
/***/ (function(module, exports) {

eval("module.exports = require(\"koa-logger\");\n\n//# sourceURL=webpack:///external_%22koa-logger%22?");

/***/ }),

/***/ "koa-respond":
/*!******************************!*\
  !*** external "koa-respond" ***!
  \******************************/
/*! no static exports found */
/***/ (function(module, exports) {

eval("module.exports = require(\"koa-respond\");\n\n//# sourceURL=webpack:///external_%22koa-respond%22?");

/***/ }),

/***/ "koa-router":
/*!*****************************!*\
  !*** external "koa-router" ***!
  \*****************************/
/*! no static exports found */
/***/ (function(module, exports) {

eval("module.exports = require(\"koa-router\");\n\n//# sourceURL=webpack:///external_%22koa-router%22?");

/***/ }),

/***/ "minimist":
/*!***************************!*\
  !*** external "minimist" ***!
  \***************************/
/*! no static exports found */
/***/ (function(module, exports) {

eval("module.exports = require(\"minimist\");\n\n//# sourceURL=webpack:///external_%22minimist%22?");

/***/ }),

/***/ "net":
/*!**********************!*\
  !*** external "net" ***!
  \**********************/
/*! no static exports found */
/***/ (function(module, exports) {

eval("module.exports = require(\"net\");\n\n//# sourceURL=webpack:///external_%22net%22?");

/***/ })

/******/ });