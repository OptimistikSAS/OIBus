# Changelog

## [3.7.1](https://github.com/OptimistikSAS/OIBus/compare/v3.7.0...v3.7.1) (2025-11-24)


### Bug Fixes

* fix oibus array async/await methods ([76f9abf](https://github.com/OptimistikSAS/OIBus/commit/76f9abf9da291e66acc3d2afced8aedb14ceeaaf))
* **forms:** added export and import functionality with modals for array element in forms ([5a88308](https://github.com/OptimistikSAS/OIBus/commit/5a883084aec819a7f81670b207c24af75cb30333))
* **forms:** remove undefined conversion in typeahead ([9877de1](https://github.com/OptimistikSAS/OIBus/commit/9877de12df6326a848222f20131596a52d75c80e))
* **migration:** replace enum by string in model ([fd4d957](https://github.com/OptimistikSAS/OIBus/commit/fd4d957ecfdf2cb79406a7a977fb8d1ec51772d7))
* **modbus:** add connection timeout for north and south modbus connector ([cb5712d](https://github.com/OptimistikSAS/OIBus/commit/cb5712d69b820910c3a38c538de5634b88f7cd4d))
* **opcua:** add maxNumberOfMessages flushMessageTimeout for south opcua connectors ([f2add93](https://github.com/OptimistikSAS/OIBus/commit/f2add93734f1e0c63ccf964af6054016a677f0e3))
* **transformer:** add options to time values to csv transformer ([14b57e7](https://github.com/OptimistikSAS/OIBus/commit/14b57e7b253f1f8aea039b5afe7134b75a4f4b2b))
* **transformer:** fix default value in edit mode patch value ([807ec33](https://github.com/OptimistikSAS/OIBus/commit/807ec33db6b7e94f2c6e21820e0e0405d6f94fea))
* **transformer:** fix translation for oibus transformers ([04072c9](https://github.com/OptimistikSAS/OIBus/commit/04072c946a5f30a16dd3107ef4d8deb353b0cddd))

## [3.7.0](https://github.com/OptimistikSAS/OIBus/compare/v3.6.9...v3.7.0) (2025-11-24)


### Features

* add docker compose to start simulation servers ([4f09b10](https://github.com/OptimistikSAS/OIBus/commit/4f09b10d768a94e411652438c59cb85bb1a5809c))
* **api:** adapt services to new api ([ff9424e](https://github.com/OptimistikSAS/OIBus/commit/ff9424e181958572bd4e19d79621057c6fcc50c7))
* **api:** add openapi in docusaurus ([e606066](https://github.com/OptimistikSAS/OIBus/commit/e6060664685210fc104aae28acf8dd2d5f1a012e))
* **api:** basic skeleton for open api spec with express and docusaurus ([59ffbfc](https://github.com/OptimistikSAS/OIBus/commit/59ffbfc5a128038d510bd1d9bc6245e9841a1d85))
* **api:** improve controller with validation ([da361cb](https://github.com/OptimistikSAS/OIBus/commit/da361cb1040bb45de048e35176ff240bcc4642ec))
* **api:** refactor model and backend services and repositories ([d341f6f](https://github.com/OptimistikSAS/OIBus/commit/d341f6feacccacd65b9d7816c1a87f7651c91907))
* **api:** refactor model and frontend components, adapt frontend api services ([567ccb9](https://github.com/OptimistikSAS/OIBus/commit/567ccb9d2ca1213819f99b3b9949495875cc10a9))
* **api:** simplify DTOs ([5278318](https://github.com/OptimistikSAS/OIBus/commit/5278318ca101d540ebcd7bd9677a3054f0b9cea8))
* **command:** add setpoint command ([e3f2cff](https://github.com/OptimistikSAS/OIBus/commit/e3f2cffb15bd09d16aa7ee17a70c8f7e91e8500a))
* **form:** show edit-mode placeholder for secret fields ([be2a199](https://github.com/OptimistikSAS/OIBus/commit/be2a199cce8e2fa1c387fe740c238b4475b81c3c))
* **frontend:** added loading state management for cache actions and enhanced file table UI ([a4ba16d](https://github.com/OptimistikSAS/OIBus/commit/a4ba16dbe297fa576237380e1a12e6c8eefc1183))
* **frontend:** implemented date range selector component with validation and predefined ranges ([8f025ed](https://github.com/OptimistikSAS/OIBus/commit/8f025ed3391cb7444cb54f6458a07c94b7bbf8de))
* **history-query, north, south, scan-mode, transformer:** implemented unique name validation for creation and updates across services ([25aed4b](https://github.com/OptimistikSAS/OIBus/commit/25aed4bed3055857113972fba2e8a2cf44551b12))
* **history-query, south:** implemented bulk enable, disable, and delete actions for items ([9c18ebe](https://github.com/OptimistikSAS/OIBus/commit/9c18ebe1bd50eb4694a6c0e1f2e47fcd4da5b019))
* **history-query, south:** updated item status display ([48c14d2](https://github.com/OptimistikSAS/OIBus/commit/48c14d228995a7eb3d288fc8545e41e415e4b1b7))
* **items:** adapt items bulk actions with new api ([47cdc61](https://github.com/OptimistikSAS/OIBus/commit/47cdc6164f5f8f29cffe0ba4444fd8d471e84237))
* **launcher:** implemented user password reset functionality and improved argument handling ([6c4b659](https://github.com/OptimistikSAS/OIBus/commit/6c4b6593288d138ce3cee9dd5a4c7790a2d7762c))
* **launcher:** replaced command line arguments 'check' with 'version' for OIBus launcher and related services ([480982f](https://github.com/OptimistikSAS/OIBus/commit/480982fdfccde67412a218d357a82b195370784c))
* **north:** add transformer options ([22ce96d](https://github.com/OptimistikSAS/OIBus/commit/22ce96de0265a39e7a4fb27e39974819d60a6e76))
* **north:** create new north connectors (opcua, modbus, mqtt) ([3fb4861](https://github.com/OptimistikSAS/OIBus/commit/3fb4861768b0e7ea2c5b2442361b2f7e28a66232))
* **north:** improve transformer ux ([2e05f8a](https://github.com/OptimistikSAS/OIBus/commit/2e05f8a212467aa3fd51129d874272cfb5746c44))
* **oianalytics:** truncate test item result when testing from oianalytics ([75d0360](https://github.com/OptimistikSAS/OIBus/commit/75d036029df8cfab1e60dc8b9917d83e476c0e6b))
* **oibus-secret-form:** prevent password managers autofilling secrets ([56b5e8c](https://github.com/OptimistikSAS/OIBus/commit/56b5e8cedb65434257325b61ed7b1020a3f66c7c))
* **oibus:** add setpoint OIBus data type ([537dfe0](https://github.com/OptimistikSAS/OIBus/commit/537dfe096177fcf4351181508bd6ceef3cee6bbb))
* **postgresql:** add ssl option ([ec8b7e7](https://github.com/OptimistikSAS/OIBus/commit/ec8b7e778a7af861b734e86baf70a950ec584cd5))
* **south-oledb:** added password field to SouthOLEDB settings and updated connection handling ([9b3ef83](https://github.com/OptimistikSAS/OIBus/commit/9b3ef836cf7c67bbf7524ad7283d9c4c1c42487e))
* **south:** implemented FTP south connector ([090023f](https://github.com/OptimistikSAS/OIBus/commit/090023f4dd7126d1bbcb66af74c8608e1ec3f895))
* **tests:** enhanced error handling in connector tests and updated auth middleware for improved response management ([8af8cf8](https://github.com/OptimistikSAS/OIBus/commit/8af8cf8ff4405540b6e604ded20bc84bb6c6d2df))
* **transformer:** create transformers entities and select standard ones from north ([2c12bbb](https://github.com/OptimistikSAS/OIBus/commit/2c12bbb56c776007cb0bfd27d4bd1f2b971f05af))
* **transformer:** implement standard transformers ([f57bda8](https://github.com/OptimistikSAS/OIBus/commit/f57bda8df097fba2ccabc99427699307a3e51fe6))


### Bug Fixes

* **api:** fix api calls after rework ([1e0f149](https://github.com/OptimistikSAS/OIBus/commit/1e0f1497114997d564551d54212961deff54a72e))
* **api:** improve dto documentation ([239fcda](https://github.com/OptimistikSAS/OIBus/commit/239fcda6161514f5f30975fa264731399fb0fc28))
* **api:** separate into two endpoints the content controller to add content from external application directly through the api ([9b1cc2b](https://github.com/OptimistikSAS/OIBus/commit/9b1cc2b8f578616c1c6f1b7305502817f8edef98))
* **compression:** properly manage unique filename and compression in datastream ([f643062](https://github.com/OptimistikSAS/OIBus/commit/f643062fa2a84a0999f0b4cd55a37ec95dcfc3d4))
* **connectors:** improve OIBus ergonomics on connectors and history query edition ([ac701a8](https://github.com/OptimistikSAS/OIBus/commit/ac701a853244f6836a414559c729b5f73fcc6e0e))
* **datetimepicker:** aligned timepicker component style ([29255f2](https://github.com/OptimistikSAS/OIBus/commit/29255f2ff62bb2d2b84a1a01856a97c6d94e244c))
* **engine:** improved logger settings form with conditional fields and reordered categories ([6d2925c](https://github.com/OptimistikSAS/OIBus/commit/6d2925c009960761aed4ce02b4030309ee714fce))
* **engine:** remove transformer service from north connectors ([a636878](https://github.com/OptimistikSAS/OIBus/commit/a6368786ab779f940daeec78c3bdc1c6e7d1e8de))
* **engine:** rework the way history queries and connectors are instantiated ([932a4ce](https://github.com/OptimistikSAS/OIBus/commit/932a4ce6246902ec5173993cc531fff3997f4305))
* **file-table:** simplified selection controls and removed main checkbox ([d6184e2](https://github.com/OptimistikSAS/OIBus/commit/d6184e2fc6b52659026c563818dd865e049e79c3))
* **frontend:** tooltip integration ([0c97732](https://github.com/OptimistikSAS/OIBus/commit/0c977324f217170b25999cc7b1da6227166289c7))
* **ftp:** fix interface generation for FTP South connector ([160f3bc](https://github.com/OptimistikSAS/OIBus/commit/160f3bcec30430c69b769ccd0500405a8e73e5b2))
* **history-query, south:** enhanced selection controls with select/unselect all functionality and improved UI elements ([0013127](https://github.com/OptimistikSAS/OIBus/commit/001312764daa231679954cf4c80c416c7a85c55b))
* **history-query, south:** replace enable/disable tests with status display tests ([ad2df6a](https://github.com/OptimistikSAS/OIBus/commit/ad2df6addc823fd00c15ff37d3e9f21620b69e6b))
* **history-query, south:** streamlined bulk enable, disable, and delete item actions with improved error handling ([f1ea2e1](https://github.com/OptimistikSAS/OIBus/commit/f1ea2e17aafaa5fe0e51924a8bee074cf0231ed2))
* **history-query:** change debug to trace in history query ([1e64b10](https://github.com/OptimistikSAS/OIBus/commit/1e64b104919e43102f6d4a03fcb36f664fa79ca5))
* **history-query:** remove encryption service from constructor ([a101536](https://github.com/OptimistikSAS/OIBus/commit/a101536ab729f6481e8778a704c429628b55e7c9))
* **history-query:** updated table layout and styles for metrics display; enhanced progress bar styling ([55e97d9](https://github.com/OptimistikSAS/OIBus/commit/55e97d9eff3d574df5b24a7be8db7c269af2d40b))
* **history:** properly manage item testing when creating history from south ([ca882e6](https://github.com/OptimistikSAS/OIBus/commit/ca882e6e0522bb8db2162ddb0b7036e195d244a5))
* **history:** properly manage transformer when creating history from north ([d90e6aa](https://github.com/OptimistikSAS/OIBus/commit/d90e6aaa815006eef2bedc4f6040390d9da0f759))
* **install:** improve arg management in install script and adapt mass install script in doc ([7344030](https://github.com/OptimistikSAS/OIBus/commit/734403076523b3274b6fc82d0b900295a9f41178))
* **logs:** updated styles for timepicker, logs, and datetimepicker components; improved button styles and adjust translations ([81c2476](https://github.com/OptimistikSAS/OIBus/commit/81c2476f592e454e338cf0d52b114901024b3f21))
* **modbus:** share common code between north and south ([b692a68](https://github.com/OptimistikSAS/OIBus/commit/b692a6892cbf605d5d3fc5f53a7f988ec6f30aac))
* **mqtt:** fix translation ([5723394](https://github.com/OptimistikSAS/OIBus/commit/5723394fa196a6fbe4186ce12aff3994cc45fbe6))
* **mqtt:** password not required ([04a3924](https://github.com/OptimistikSAS/OIBus/commit/04a392408c457be0f4f6b9a47841f403b2c7657f))
* **mqtt:** properly manage mqtt publish errors ([2834736](https://github.com/OptimistikSAS/OIBus/commit/2834736c9cc222cde3651b3a934cb7cfe608d9a4))
* **mqtt:** share common code between north and south ([ef43228](https://github.com/OptimistikSAS/OIBus/commit/ef43228fbec34ee4f7944685d6bbe310af78cd1f))
* **north:** fix trigger on transform ([af0e7ac](https://github.com/OptimistikSAS/OIBus/commit/af0e7accf7818d7c7dee1aa9bcf636047f668dfe))
* **north:** manage setpoints for console and file writer ([9cba764](https://github.com/OptimistikSAS/OIBus/commit/9cba764add01b2bf995387494fad761a92fc22d6))
* **north:** properly reconnect and retry on handle values error ([e917888](https://github.com/OptimistikSAS/OIBus/commit/e917888fb2a194193166d969a62bfd5a4cd33ef3))
* **north:** remove encryption service from constructor ([3a76ec0](https://github.com/OptimistikSAS/OIBus/commit/3a76ec0db5e6d1f73131e846d34074781615f4b9))
* **north:** remove north repository and scan mode repository from north connector and switch to ScanModeDTO in frontend payloads ([ae34346](https://github.com/OptimistikSAS/OIBus/commit/ae34346387179429420c08e8d40519479f71acf5))
* **north:** set error retention duration default value to 0 ([256c2c6](https://github.com/OptimistikSAS/OIBus/commit/256c2c666d1360ce955631489602f8f094cb384e))
* **oianalytics:** add 500 (server error) code in retryable http status codes ([45c8d29](https://github.com/OptimistikSAS/OIBus/commit/45c8d29d17ae3d8668c6c5c8b8ed73536343a546))
* **oianalytics:** fix message trigger on registration ([3ea40d7](https://github.com/OptimistikSAS/OIBus/commit/3ea40d7961cd4b483d33884bab9b514c3d5f79f6))
* **opcua:** properly manage write error and reconnection on north opcua ([9dd793e](https://github.com/OptimistikSAS/OIBus/commit/9dd793e480d6bd18de0267833fee95e014093a2a))
* **opcua:** share common code between north and south ([cf33c88](https://github.com/OptimistikSAS/OIBus/commit/cf33c88c9192c75b84f9c78b492afbd105ab2a7b))
* **routes:** clean up and refactor web server routes code ([350c7ad](https://github.com/OptimistikSAS/OIBus/commit/350c7ad68d9e03756c2e74e96a25f31de447ff1b))
* **scan-mode:** fix scan mode forms ([e478c60](https://github.com/OptimistikSAS/OIBus/commit/e478c60e85e8e0cc0da931a69ae548477cb08353))
* **scan-mode:** fix scan mode subscription display ([7e0bc0c](https://github.com/OptimistikSAS/OIBus/commit/7e0bc0c6c7e8591623846b323b3814780b6dbf38))
* south connector doc and translation ([d5edb8e](https://github.com/OptimistikSAS/OIBus/commit/d5edb8ed5fbda9c676e39de361dedd2f2c100e33))
* **south-oledb:** add password migration ([7e2e3f0](https://github.com/OptimistikSAS/OIBus/commit/7e2e3f06716c606afbb0ed6ca714eb74714e858c))
* **south:** fix intervals generation ([8752481](https://github.com/OptimistikSAS/OIBus/commit/8752481cf1fee2fa70d6f3eb4efd182dbc354f89))
* **south:** fix reconnection ([06d870e](https://github.com/OptimistikSAS/OIBus/commit/06d870e6f195a638ccb4dbf98935ec40302c94f0))
* **south:** properly display item name when testing it ([0746f21](https://github.com/OptimistikSAS/OIBus/commit/0746f21d7185b26787c8325bdd3c8399b890f4a8))
* **south:** remove encryption service from constructor ([d122139](https://github.com/OptimistikSAS/OIBus/commit/d12213944c09a4b92771655a9ddb5e461896188d))
* **test:** simplify code for tests (connection, items) of connectors ([630262a](https://github.com/OptimistikSAS/OIBus/commit/630262ae12e0f00531c3de4195f839609c118c3e))
* **transformer:** refactor manifest and transformers options ([49c7cc2](https://github.com/OptimistikSAS/OIBus/commit/49c7cc2a87bd8f1d52ef1e7eab304c83b6da020e))
* **validator:** fix joi validator after manifest refactor for arrays ([cb4a121](https://github.com/OptimistikSAS/OIBus/commit/cb4a121d8792feca173878af4ee7dd358db2256e))
* **web-client:** fix array list display and array element display ([71f7cba](https://github.com/OptimistikSAS/OIBus/commit/71f7cba9f0c31f9649d60ea2a645c1a93f75ec37))
* **web-client:** fix double modal on ip filter edition ([222f1a6](https://github.com/OptimistikSAS/OIBus/commit/222f1a6d12aa2a57a2c8212766560d93cfb73d27))
* **windows:** improve windows installer and choose service name ([fd426e9](https://github.com/OptimistikSAS/OIBus/commit/fd426e912520777ce4124d3f780d1137674f1833))
* **windows:** remove cert temporally ([6269695](https://github.com/OptimistikSAS/OIBus/commit/626969593d50f7d8659d4697c283883f282fdaa5))

## [3.6.9](https://github.com/OptimistikSAS/OIBus/compare/v3.6.8...v3.6.9) (2025-10-03)


### Bug Fixes

* **azure:** fix migration of azure north connector in 3.5.0 ([1d4fb28](https://github.com/OptimistikSAS/OIBus/commit/1d4fb2871ade61ef9d200b3c5d0645c37882c878))
* **north:** debug log instead of warning when task is already running ([fa727df](https://github.com/OptimistikSAS/OIBus/commit/fa727df6bf0cfff169af4cad9f79f610cd5ae53d))
* **oianalytics:** display command ID and delete command ([d7d2415](https://github.com/OptimistikSAS/OIBus/commit/d7d24159ca79a004397160dcc2c864f83e724986))
* **oianalytics:** fix http error handling when sending messages to OIAnalytics ([b55dd05](https://github.com/OptimistikSAS/OIBus/commit/b55dd057e5a4898dad2251f318a4469d1a52c8a0))

## [3.6.8](https://github.com/OptimistikSAS/OIBus/compare/v3.6.7...v3.6.8) (2025-09-04)


### Bug Fixes

* **north:** fix the way OIBusError is detected ([9e8cf4b](https://github.com/OptimistikSAS/OIBus/commit/9e8cf4b5495f37190a2bbe369c4f652c262563ab))
* **sql:** fix date time fields types for mysql and mssql ([cd9ea45](https://github.com/OptimistikSAS/OIBus/commit/cd9ea45bf8943193a4b0074ed78f437d2a3770c8))

## [3.6.7](https://github.com/OptimistikSAS/OIBus/compare/v3.6.6...v3.6.7) (2025-08-27)


### Bug Fixes

* **engine:** add OIBus user agent in HTTP Request utils ([90f8643](https://github.com/OptimistikSAS/OIBus/commit/90f8643e6e0c3784c3c8dd33bca4842963669a41))
* **engine:** simplify IP filter on localhost ([f899e66](https://github.com/OptimistikSAS/OIBus/commit/f899e66a088e219d84dd8e406f32bd15ec9dd773))

## [3.6.6](https://github.com/OptimistikSAS/OIBus/compare/v3.6.5...v3.6.6) (2025-08-12)


### Bug Fixes

* **engine:** test both ipv6 and ipv4 regex when ipv4 pattern ([97b4e36](https://github.com/OptimistikSAS/OIBus/commit/97b4e367a097c063616f437c93d9b41e71a6f226))
* **logger:** do not remove logs if not necessary ([241c47c](https://github.com/OptimistikSAS/OIBus/commit/241c47c6a723f3d79d397e71fb518fb0ae3e1600))
* **oianalytics:** adapt ip filtering with ipv4 and ipv6 regex ([736d623](https://github.com/OptimistikSAS/OIBus/commit/736d623f38842d9dd20b11e5afec31ece85af280))
* **oianalytics:** fix command acknowledgment if not found ([b078131](https://github.com/OptimistikSAS/OIBus/commit/b07813115bb09e87b6013c563df2807f78ac2123))
* **proxy-server:** fix ip filtering in proxy server and port forwarding ([39e6313](https://github.com/OptimistikSAS/OIBus/commit/39e63137c8767bfc59d48d9d8e730867adb9de75))

## [3.6.5](https://github.com/OptimistikSAS/OIBus/compare/v3.6.4...v3.6.5) (2025-07-30)


### Bug Fixes

* **backend:** improved code coverage in joi validators ([8737b03](https://github.com/OptimistikSAS/OIBus/commit/8737b03d3104c2b7befcd97afde3b59530ab6695))
* **frontend:** truncated long import modal fields with ellipsis and tooltips ([bbc96a3](https://github.com/OptimistikSAS/OIBus/commit/bbc96a3964665969784aeb444ba459ea8e67922a))
* **logs:** fix database is locked when the logs.db file is too big ([67cc310](https://github.com/OptimistikSAS/OIBus/commit/67cc3103b9de92a186577f203f3f6a11864b71d4))
* **logs:** vacuum logs.db at startup ([1be70b9](https://github.com/OptimistikSAS/OIBus/commit/1be70b9e1b7db176982cd576b47544ee20caa0bc))

## [3.6.4](https://github.com/OptimistikSAS/OIBus/compare/v3.6.3...v3.6.4) (2025-07-28)


### Bug Fixes

* **mqtt:** implemented MQTT topic overlap validation and related tests ([2a77c88](https://github.com/OptimistikSAS/OIBus/commit/2a77c884eb44b33a6bb110c3a4eba46a8a691e90))
* **mqtt:** implemented MQTT topic overlap validation and related tests in the import modal ([b092559](https://github.com/OptimistikSAS/OIBus/commit/b092559a696c53473db2f549ff3f19db50b4609e))
* **opcua:** fix migration of items ([813d2a3](https://github.com/OptimistikSAS/OIBus/commit/813d2a34be7ead86e9616a23a919a3d6e080d2d0))

## [3.6.3](https://github.com/OptimistikSAS/OIBus/compare/v3.6.2...v3.6.3) (2025-07-17)


### Bug Fixes

* add missing provideHttpClientTesting in tests ([b4a5cac](https://github.com/OptimistikSAS/OIBus/commit/b4a5cac1b1f6b490793ad4a3ff6043c08f6ba4aa))
* **frontend:** add enable/disable all permissions buttons for OIBus registration ([afb0cb5](https://github.com/OptimistikSAS/OIBus/commit/afb0cb58e29ddf001984a783a0d92506716ec5f9))
* **frontend:** implemented CSV import modal, south-item component and validation tests ([2ef3089](https://github.com/OptimistikSAS/OIBus/commit/2ef30898fe96dc121bd4cdbd903fdf7303c87ce8))
* **frontend:** pause/resume functionality for autoloading logs ([f242758](https://github.com/OptimistikSAS/OIBus/commit/f242758fdecc44839c32d2b91b3dfa0ace14a92c))
* **opcua:** choose timestamp in DA mode ([cb5a0c8](https://github.com/OptimistikSAS/OIBus/commit/cb5a0c82787c49bcffeec2e13e7863df8cba7f2e))

## [3.6.2](https://github.com/OptimistikSAS/OIBus/compare/v3.6.1...v3.6.2) (2025-06-25)


### Bug Fixes

* **api:** properly manage file received from add-content endpoint ([cef731c](https://github.com/OptimistikSAS/OIBus/commit/cef731ce9b4c160f45597aa97888e198558bcc28))
* **clean-up:** clean up oianalytics command and message tables ([c360452](https://github.com/OptimistikSAS/OIBus/commit/c36045200c5645c71fdaca20c4b35d74ee353d6d))
* **frontend:** confirmation modal component for unsaved changes ([ad32c7d](https://github.com/OptimistikSAS/OIBus/commit/ad32c7d47d196cd3c6d60273b7c2fe962d8fbfd6))
* **frontend:** implemented unsaved changes guard and integrated with relevant components ([2327da9](https://github.com/OptimistikSAS/OIBus/commit/2327da930e55c80a7d0d3879dfe4c163da5b7ede))
* **frontend:** moved unsaved changes confirmation modal template to separate HTML file ([7bca8f9](https://github.com/OptimistikSAS/OIBus/commit/7bca8f9d7ac7d0561891c9188281ac2cd0799e41))
* **frontend:** preventing closing the modal by clicking outside the form ([e968641](https://github.com/OptimistikSAS/OIBus/commit/e9686418f29e7f4d4375b78363553e457e66ed51))
* **history-query:** send history queries to OIAnalytics on finish ([0ae3ae6](https://github.com/OptimistikSAS/OIBus/commit/0ae3ae667cca5612a9e4914a9b6cac7db710a2c4))

## [3.6.1](https://github.com/OptimistikSAS/OIBus/compare/v3.6.0...v3.6.1) (2025-06-11)


### Bug Fixes

* **history-query:** add missing translation when updating history query status ([a6e4e05](https://github.com/OptimistikSAS/OIBus/commit/a6e4e054acb67b005e5d3c10dbe30a9aa4e2fa02))
* **north-rest:** fix time values for north rest ([b26551c](https://github.com/OptimistikSAS/OIBus/commit/b26551c74c0b8902311e6e55ec5591f2b496998a))
* **opcua:** fix null value log for opcua south connector ([f3db00f](https://github.com/OptimistikSAS/OIBus/commit/f3db00f0d10c34edbaebf16b3505a94648c8e0da))
* **opcua:** fix release of continuation point and resolve node id ([cafd3da](https://github.com/OptimistikSAS/OIBus/commit/cafd3daeaab8ca8acc7a43a7ab9fccd55c287c42))

## [3.6.0](https://github.com/OptimistikSAS/OIBus/compare/v3.5.18...v3.6.0) (2025-06-09)


### Features

* **aws-s3:** remove proxy agent ([31daa23](https://github.com/OptimistikSAS/OIBus/commit/31daa23138d7b4c28722593a011cd9e7cb033ca6))
* **backend:** Add new http request utils and implement them in north REST and OIAnalytics ([fac31f6](https://github.com/OptimistikSAS/OIBus/commit/fac31f65f6ecd985a380261b4dbd0d1f5fe4e9e7))
* **backend:** added unique and singleTrue reference fields ([f22e187](https://github.com/OptimistikSAS/OIBus/commit/f22e1875116afafc55a8321c295712843ce81f10))
* **backend:** added unique and singleTrue validators to manifest files ([7f9baed](https://github.com/OptimistikSAS/OIBus/commit/7f9baed8caf2debb38c5883f859145da79cdb626))
* **backend:** enhanced JoiValidator to support unique and single true validations for array fields ([0d07c33](https://github.com/OptimistikSAS/OIBus/commit/0d07c339f70335fa46883070ae07d2996a70c2f9))
* **backend:** implemented array level validators and enhanced singleTrue validator handling ([b3ed51d](https://github.com/OptimistikSAS/OIBus/commit/b3ed51ddf6d311e8705d51d4fb9fab5e599c5ceb))
* **backend:** Replace fetch in OIAnalytics related files ([424b9be](https://github.com/OptimistikSAS/OIBus/commit/424b9be0da5776ec3086d581fef43ed547a8c5c5))
* **backend:** Replace fetch in south connectors ([7c0dc81](https://github.com/OptimistikSAS/OIBus/commit/7c0dc816003f84bb44969ab12bf893c84a51a3bf))
* **cache:** clean up archive and error cache based on config, even if connector is disabled ([b072566](https://github.com/OptimistikSAS/OIBus/commit/b072566a40b02f0e3dff88494067652a3c65c38c))
* **cache:** interact with history query cache ([6685960](https://github.com/OptimistikSAS/OIBus/commit/668596026d87f5762e6857c1a8a30bcc3eb84fa2))
* **cache:** interact with history query cache ([5941bfd](https://github.com/OptimistikSAS/OIBus/commit/5941bfd366d0966cfd1050245cc62e5cea7e3ff2))
* **cache:** rework cache structure on frontend ([d9df04e](https://github.com/OptimistikSAS/OIBus/commit/d9df04ea1bb4f73b1c83070eda72f43030c7c7f8))
* **engine:** rework cache structure with content ([8e705d2](https://github.com/OptimistikSAS/OIBus/commit/8e705d2a8c47caf1cd6da8fadc2bef30b14e9512))
* **frontend:** add multiple ways to display item test results ([58594d4](https://github.com/OptimistikSAS/OIBus/commit/58594d4addbe1ea56f3d799217e44158cad4d8b8))
* **frontend:** added comprehensive tests for OibArrayComponent ([201477e](https://github.com/OptimistikSAS/OIBus/commit/201477e36192c409e712f5929cec340ad9293f09))
* **frontend:** added proper error messages for unique and single true validators ([1345aa0](https://github.com/OptimistikSAS/OIBus/commit/1345aa05c81928466614998694726a38002e4b12))
* **frontend:** added tests for duplication button ([6609501](https://github.com/OptimistikSAS/OIBus/commit/660950163996786bc66bf96d6c40974a2b02bd3f))
* **frontend:** implement array-specific validators for unique field names and single true reference fields ([fe11a38](https://github.com/OptimistikSAS/OIBus/commit/fe11a3894fbd3c0ac3b1973e854fcc0213b126b5))
* **frontend:** implemented datetime field duplication ([e55a92d](https://github.com/OptimistikSAS/OIBus/commit/e55a92db04247d0e39f0e2387dd7067d7ba8fbf0))
* **frontend:** implemented unit tests for uniqueFieldNamesValidator and singleTrueValidator ([f8d5157](https://github.com/OptimistikSAS/OIBus/commit/f8d51571b9f67a081305653d81b70331cdbf568c))
* **frontend:** moved uniqueFieldNamesValidator and singleTrueValidator to validators module ([6a234f4](https://github.com/OptimistikSAS/OIBus/commit/6a234f4648169bdb9109cc1734e48c8b8d89b039))
* **frontend:** working on frontend validation for unique and singleTrue fields ([d1ad41d](https://github.com/OptimistikSAS/OIBus/commit/d1ad41d8d0c833a781e722e0043d70a122720210))
* **mqtt:** add settings for throttling mqtt messages ([c37e25e](https://github.com/OptimistikSAS/OIBus/commit/c37e25e1da61811b1fd243bb060faacac6cd593c))
* **north:** Add new north REST API connector ([baa712e](https://github.com/OptimistikSAS/OIBus/commit/baa712e1e7234224a622d47041bef8429de54bb6))
* **north:** Add tests to the north REST connector ([45344ba](https://github.com/OptimistikSAS/OIBus/commit/45344bab533d176222b9e42718daa394b8b344f6))
* **north:** Rewrite north REST to use undici ([00c0701](https://github.com/OptimistikSAS/OIBus/commit/00c070198dd29ee82df698295d0d994b0cf3285e))
* **oianalytics:** manage remote config for history queries ([c790c6b](https://github.com/OptimistikSAS/OIBus/commit/c790c6bee323ed450083ca33bc23f0f9190f63d8))
* **oianalytics:** manage test item and connectors commands ([cd675dd](https://github.com/OptimistikSAS/OIBus/commit/cd675dd976dc56a4ad62ad1165a034b2f564f687))
* **oianalytics:** retrieve commands for ip filters and certificates ([61296e5](https://github.com/OptimistikSAS/OIBus/commit/61296e543d9d308796a29db987269cc3b16eaef2))
* **oianalytics:** send history query to OIAnalytics ([6f9d59f](https://github.com/OptimistikSAS/OIBus/commit/6f9d59fff544a75c06640ae7484bae9f91d8cab1))
* **oianalytics:** update registration settings edition with command permissions ([f792fc2](https://github.com/OptimistikSAS/OIBus/commit/f792fc27a3c1e62841f354cbe10473da57e89f9b))
* **opc:** add da option for opc south connector ([2ff3fa2](https://github.com/OptimistikSAS/OIBus/commit/2ff3fa29d59dd12d012b7a734d7bf16b6b052866))
* **proxy:** add accept unauthorized option ([f6d773e](https://github.com/OptimistikSAS/OIBus/commit/f6d773ed0e35b8298528a7b189d9626f73b72666))
* **slims:** deprecate slims south connector ([f54cb48](https://github.com/OptimistikSAS/OIBus/commit/f54cb486aad874fc02ce5036c3acdf30c35875cf))
* **south:** extended OibArray type with allowRowDuplication field and enabled it in sql connector manifests ([954cfa1](https://github.com/OptimistikSAS/OIBus/commit/954cfa1e7d908234d5769e5b468f618e1d7c8928))
* **south:** Fix code coverage reporting by ignoring mock functions ([7863791](https://github.com/OptimistikSAS/OIBus/commit/7863791917876fcd969d66b5c0e73ac25bba65c8))


### Bug Fixes

* **backend:** Add HTTPRequest tests ([c0fdbf4](https://github.com/OptimistikSAS/OIBus/commit/c0fdbf403cfd982e335bd30a30fd2473bd9d6ab7))
* **backend:** Completely remove node-fetch dependency from project ([5e452cb](https://github.com/OptimistikSAS/OIBus/commit/5e452cb8184610f526812f2d53b8f9e56a90425c))
* **backend:** Fix encryption service tests ([80ebd00](https://github.com/OptimistikSAS/OIBus/commit/80ebd0050be454a70afd25db88dba3de9bd6658e))
* **backend:** Fix encryption tests ([0a6fe08](https://github.com/OptimistikSAS/OIBus/commit/0a6fe08096a9c27177f440c3e32914fd22ff02dc))
* **backend:** Fix NorthREST tests ([657f8fc](https://github.com/OptimistikSAS/OIBus/commit/657f8fc4b3dfc3e0622ecd5eedc40c7bf58fccb2))
* **backend:** Fix OIAnalytics client service tests ([0fdf7c0](https://github.com/OptimistikSAS/OIBus/commit/0fdf7c051c97f22a3ec14d5e5fde572b78cf9e3e))
* **backend:** Fix oianalytics tests ([7c9e8f2](https://github.com/OptimistikSAS/OIBus/commit/7c9e8f225f676e624fa306ab9de3d4b65c2c5613))
* **backend:** Fix OIAnalytics tests ([9608769](https://github.com/OptimistikSAS/OIBus/commit/96087695826a3603bb7e2241681d399a69aa73eb))
* **backend:** Fix south-odbc tests ([8174a52](https://github.com/OptimistikSAS/OIBus/commit/8174a5287a102809cfb7c46eaa1bb22ab0b0b1ab))
* **backend:** Fix south-oianalytics tests ([287819f](https://github.com/OptimistikSAS/OIBus/commit/287819f630691f0fbe60558081c2827837bdf7ce))
* **backend:** Fix south-oledb tests ([ff71167](https://github.com/OptimistikSAS/OIBus/commit/ff71167f771cf6f0e8256f9b7cfd05b28750f815))
* **backend:** Fix south-opc tests ([95c4287](https://github.com/OptimistikSAS/OIBus/commit/95c42879cb37ece7aead542434ca51d2e7ad53bd))
* **backend:** Fix south-pi tests ([ae19474](https://github.com/OptimistikSAS/OIBus/commit/ae19474fbe0c088913617e25ca3828f76f8b30b9))
* **backend:** Fix utils tests ([608fe30](https://github.com/OptimistikSAS/OIBus/commit/608fe30e46805968acdc4568147c0c25a47b8c2c))
* **backend:** Fix wrong argument in index.ts ([74dce7a](https://github.com/OptimistikSAS/OIBus/commit/74dce7aa59effb6edc3fcf3ca79eaa4be9db90df))
* **backend:** Implement code changes from review for HTTPRequest migration ([e335238](https://github.com/OptimistikSAS/OIBus/commit/e3352383ae5490ba97818e8159286de5516be8a7))
* **backend:** Improve http error handling for HTTPRequests ([a3e974e](https://github.com/OptimistikSAS/OIBus/commit/a3e974e511f1bb93006741b2a8a6751e8cf82015))
* **cache:** do not remove files from archive and error if metadata does not exist ([521af50](https://github.com/OptimistikSAS/OIBus/commit/521af503251be85bfb77ccd9e8f898acf60c253c))
* **encryption:** properly create cert folder in data-folder ([673c447](https://github.com/OptimistikSAS/OIBus/commit/673c447492e6cb3224b27848f3d9d821bfab41c3))
* **encryption:** remove encryption from constructor in oianalytics service ([6ef24b1](https://github.com/OptimistikSAS/OIBus/commit/6ef24b1aafad38332cc180594514f2a3f96d74fc))
* **frontend:** disable duplicate button during edit mode ([3830c73](https://github.com/OptimistikSAS/OIBus/commit/3830c73c7459976935a1c6ab6e55237e11d58532))
* **frontend:** ensured icons are visible on white background ([8c8da17](https://github.com/OptimistikSAS/OIBus/commit/8c8da17e64336bf51dff127ebfe6cdbe09195b57))
* **frontend:** fix OIBus title when not authenticated ([8f6730b](https://github.com/OptimistikSAS/OIBus/commit/8f6730bc3a1e9af9e9d18976b2a23834d6bea614))
* **frontend:** fix translation of select field in item import modals ([ceb3e01](https://github.com/OptimistikSAS/OIBus/commit/ceb3e017c3c473adfc69002aba9b006904ab231a))
* **launcher:** fix ts synthax ([9e0220a](https://github.com/OptimistikSAS/OIBus/commit/9e0220a9becf329a81646f35f53359a70e21e5f2))
* **logger:** fix encryption init in oianalytics logger transport ([4a27552](https://github.com/OptimistikSAS/OIBus/commit/4a27552e693fb47ab258865460e87b498f605e9c))
* **metrics:** fix timeout init write on stream for metrics ([4d1fe6b](https://github.com/OptimistikSAS/OIBus/commit/4d1fe6b678e00af3bdb0e4d255ccf1fb7269f493))
* **mqtt:** fix mqtt test item error ([d2286c5](https://github.com/OptimistikSAS/OIBus/commit/d2286c5e043d3739121289c3e83e16300cad07bc))
* **mqtt:** fix mqtt translation ([9240ca8](https://github.com/OptimistikSAS/OIBus/commit/9240ca87385630e9b293f1627ffa78a699150aef))
* **mqtt:** migrate mqtt settings ([2a5cbb2](https://github.com/OptimistikSAS/OIBus/commit/2a5cbb2e379387797b70c9c613f7d179eb3012c0))
* **north-rest:** fix north rest interface generation ([967d615](https://github.com/OptimistikSAS/OIBus/commit/967d6152ce827e76c960955809d15c3df6882573))
* **north:** do not log an error when metadata folder does not exists because north has not been started yet ([8e01d67](https://github.com/OptimistikSAS/OIBus/commit/8e01d67e8f16711bbbc1357ae2950e8836b1efb1))
* **odbc:** manage odbc loading when the driver is not installed ([3b82db5](https://github.com/OptimistikSAS/OIBus/commit/3b82db5a19bb57428967ac0bba9ed1ad0c70652d))
* **oianalytics:** change default command refresh interval from 10 to 60s ([1917328](https://github.com/OptimistikSAS/OIBus/commit/191732869bbd6ba27748fd4db60e48ceddfd8137))
* **oianalytics:** dot not decrypt token for oianalytics pino transport ([7c1fab1](https://github.com/OptimistikSAS/OIBus/commit/7c1fab181af47566c0f6762675016de3fc182eff))
* **oianalytics:** fix bearer token when using OIA registration ([b7d7b9b](https://github.com/OptimistikSAS/OIBus/commit/b7d7b9b26be03c4d267fd9fcb0c66d0971f6bdf2))
* **oianalytics:** manage remote start/pause for history queries ([620c53a](https://github.com/OptimistikSAS/OIBus/commit/620c53a072fa96ec41a83c96229dc7f2fde1691a))
* **oianalytics:** manage secrets when testing connectors and items ([5242ef1](https://github.com/OptimistikSAS/OIBus/commit/5242ef103f70b735b45a82cf233705f26197983e))
* **opcua:** fix status code check on opcua ha values retrieval ([c4febd6](https://github.com/OptimistikSAS/OIBus/commit/c4febd67414763c42ec1438a5df7749c6f3e4cae))
* **oracle:** properly set connection timeout in connectString ([63bcc39](https://github.com/OptimistikSAS/OIBus/commit/63bcc39868e92ba7a27d4467b6ff47bd553b202e))
* **south:** convert stringified booleans into boolean when importing south items ([8abeb1b](https://github.com/OptimistikSAS/OIBus/commit/8abeb1bc1d488e00524000d94cf2aaeb609ebe62))

## [3.5.18](https://github.com/OptimistikSAS/OIBus/compare/v3.5.17...v3.5.18) (2025-04-16)


### Bug Fixes

* **mqtt:** fix mqtt reconnection when closing unintentionally the client ([030248a](https://github.com/OptimistikSAS/OIBus/commit/030248a7be8265f94008bebdbc73dc8fbd3f6999))
* **mqtt:** fix mqtt reconnection when testing items ([40c911f](https://github.com/OptimistikSAS/OIBus/commit/40c911f409b93aa1510b72d00116075a7fb4141c))

## [3.5.17](https://github.com/OptimistikSAS/OIBus/compare/v3.5.16...v3.5.17) (2025-04-11)


### Bug Fixes

* **items:** fix uploading large number of items ([a7f31cb](https://github.com/OptimistikSAS/OIBus/commit/a7f31cb258733de60e07bf36e9e82bfd34878c24))
* **mqtt:** improve mqtt logging and re-subscriptions ([4809703](https://github.com/OptimistikSAS/OIBus/commit/4809703fd230b0f3ca3828b327f32e8c4a7e0ac5))
* **opc:** fix connection error ([8f290ad](https://github.com/OptimistikSAS/OIBus/commit/8f290ad6a1bb0c201f28cac1462e50bda76f075b))
* **opc:** fix item testing of opc south connector ([9f8376a](https://github.com/OptimistikSAS/OIBus/commit/9f8376ae1da223b84861cfcda2cbc3816f93e58f))

## [3.5.16](https://github.com/OptimistikSAS/OIBus/compare/v3.5.15...v3.5.16) (2025-04-02)


### Bug Fixes

* **metrics:** metrics are sent to the logger every 30 minutes instead of every minute ([39b45a1](https://github.com/OptimistikSAS/OIBus/commit/39b45a1765934b4b32b1623853042112aed633c5))

## [3.5.15](https://github.com/OptimistikSAS/OIBus/compare/v3.5.14...v3.5.15) (2025-03-31)


### Bug Fixes

* **logger:** properly log engine metrics every 10 minutes and improve metrics doc ([df82317](https://github.com/OptimistikSAS/OIBus/commit/df8231780029af3dbcb82305789a2acd39aa270d))
* **logger:** vacuum at transport startup ([e341a11](https://github.com/OptimistikSAS/OIBus/commit/e341a114786bdcd664d71c65303bb38c94e1b0ab))
* **logger:** vacuum logs database and improve logs writing and removing performances ([9afe63f](https://github.com/OptimistikSAS/OIBus/commit/9afe63fa4ff4d81bd36689da8d72aa9fae55352f))
* **mqtt:** fix event emitter and reconnection to mqtt broker ([9ecb508](https://github.com/OptimistikSAS/OIBus/commit/9ecb5085327defc16325f21a5a5aed71742aebdc))
* **opcua:** batch opcua subscription messages ([097c7ad](https://github.com/OptimistikSAS/OIBus/commit/097c7ad6d025eb83909c54768009836b55341802))
* **opcua:** filter node to read if no more data or bad status ([f7fd5d8](https://github.com/OptimistikSAS/OIBus/commit/f7fd5d8e7fd38ebb54156e6ead8aacf5eff694c7))
* **opcua:** fix continuation point and test item ([bbd1db7](https://github.com/OptimistikSAS/OIBus/commit/bbd1db782947ba9eda71b8ec6314b8975a23d707))

## [3.5.14](https://github.com/OptimistikSAS/OIBus/compare/v3.5.13...v3.5.14) (2025-03-21)


### Bug Fixes

* **mqtt:** rework connection and handling of messages ([77f20cb](https://github.com/OptimistikSAS/OIBus/commit/77f20cb5beb238af9ee85009256a51419b37db70))

## [3.5.13](https://github.com/OptimistikSAS/OIBus/compare/v3.5.12...v3.5.13) (2025-03-12)


### Bug Fixes

* **mqtt:** catch handle message error ([2a51ce5](https://github.com/OptimistikSAS/OIBus/commit/2a51ce58dcfdd02d1008f785f67de1a01663437e))

## [3.5.12](https://github.com/OptimistikSAS/OIBus/compare/v3.5.11...v3.5.12) (2025-02-24)


### Bug Fixes

* **south:** fix max instant for odbc and oledb ([1aa194d](https://github.com/OptimistikSAS/OIBus/commit/1aa194d63115ddf24fced386754e434e9b4ba8dc))

## [3.5.11](https://github.com/OptimistikSAS/OIBus/compare/v3.5.10...v3.5.11) (2025-02-18)


### Bug Fixes

* **north:** properly manage time values for amazon s3 and azure blob ([eaf4cff](https://github.com/OptimistikSAS/OIBus/commit/eaf4cffccc8b6bcf9836ac1f946610564d6b6273))
* **south:** return empty string if no instant is provided ([2e9a001](https://github.com/OptimistikSAS/OIBus/commit/2e9a001d60a68e9db667f4d6c9bb69ebeb599f0f))

## [3.5.10](https://github.com/OptimistikSAS/OIBus/compare/v3.5.9...v3.5.10) (2025-02-14)


### Bug Fixes

* **backend:** Fix error file management by verifying correct path ([89a9892](https://github.com/OptimistikSAS/OIBus/commit/89a9892860a96ba1df4d4da4418ba084088fb04f))
* **folder-scanner:** do not use folder scanner table when testing ([14cb029](https://github.com/OptimistikSAS/OIBus/commit/14cb029c899366c43d7ba182d7ef6028415a77ad))
* **mqtt:** fix reconnection on broker with persistent connection ([c5d1e96](https://github.com/OptimistikSAS/OIBus/commit/c5d1e96aadd2eb8e8394831a7d17969e9a9e8197))
* **opcua:** set oibus timestamp when server timestamp is not set ([452beb8](https://github.com/OptimistikSAS/OIBus/commit/452beb885bb1ed01ac0bb1ee9b529f44c82c7ac0))
* **web-client:** do not display fields when condition does not match ([f3aa370](https://github.com/OptimistikSAS/OIBus/commit/f3aa370975677d4dfb6f0eb07b18a707192dd401))

## [3.5.9](https://github.com/OptimistikSAS/OIBus/compare/v3.5.8...v3.5.9) (2025-02-04)


### Bug Fixes

* **oianalytics:** fix registration command validation in API ([e82363d](https://github.com/OptimistikSAS/OIBus/commit/e82363d0cfa6fd7114d3a2e4553042fe9b23dbdd))
* **oianalytics:** update logger in oianalytics command ([3117347](https://github.com/OptimistikSAS/OIBus/commit/311734796a2a1138e7167f0bf62fde77e745a690))

## [3.5.8](https://github.com/OptimistikSAS/OIBus/compare/v3.5.7...v3.5.8) (2025-01-27)


### Bug Fixes

* **oianalytics:** only ignore remote update command if flag is set to true ([67268e7](https://github.com/OptimistikSAS/OIBus/commit/67268e79e906cea5ca93cf7821691c9dc4e88f4a))

## [3.5.7](https://github.com/OptimistikSAS/OIBus/compare/v3.5.6...v3.5.7) (2025-01-24)


### Bug Fixes

* **history-query:** filter disabled items for history query ([ba3b37b](https://github.com/OptimistikSAS/OIBus/commit/ba3b37be99fe3a9855d2e2ba042f4556a1323b73))
* **north:** remove spread operator to avoid stack overflow ([b98a56b](https://github.com/OptimistikSAS/OIBus/commit/b98a56b43275dcdf2881b8ae88a93dce326ee79d))

## [3.5.6](https://github.com/OptimistikSAS/OIBus/compare/v3.5.5...v3.5.6) (2025-01-22)


### Bug Fixes

* **deps:** update typescript to v5.7.3 ([4671b33](https://github.com/OptimistikSAS/OIBus/commit/4671b33cb6e7a6ff51dff356f3639682d0c120b1))
* **north:** warn when exceeding cache size, and fix cache size edition ([52d3f16](https://github.com/OptimistikSAS/OIBus/commit/52d3f16f0300b64f5f3fa3029fe44487f04b2c87))

## [3.5.5](https://github.com/OptimistikSAS/OIBus/compare/v3.5.4...v3.5.5) (2025-01-17)


### Bug Fixes

* **history-query:** properly manage south items when creating from south ([2926efe](https://github.com/OptimistikSAS/OIBus/commit/2926efea2e562dab69f04dccf8591d728064344d))
* **proxy-server:** log error if port is already used ([0502a32](https://github.com/OptimistikSAS/OIBus/commit/0502a32382c353487269c8ec3ee22c069bfc528f))
* **web-client:** fix oib-search-form behavior ([6c4986a](https://github.com/OptimistikSAS/OIBus/commit/6c4986ae33c66d65d157793b7e8f62da057a96a0))

## [3.5.4](https://github.com/OptimistikSAS/OIBus/compare/v3.5.3...v3.5.4) (2025-01-13)


### Bug Fixes

* **history-query:** history query update fix with items ([c6bf3c4](https://github.com/OptimistikSAS/OIBus/commit/c6bf3c4b199e7f67adcfb3041337f41a05a933e7))

## [3.5.3](https://github.com/OptimistikSAS/OIBus/compare/v3.5.2...v3.5.3) (2025-01-13)


### Bug Fixes

* **south:** do not create tmp file if testing south connector ([8c88ed4](https://github.com/OptimistikSAS/OIBus/commit/8c88ed48718be559d39068cdc7a35b90d2c372cc))
* **south:** set default start time to max read interval if specified ([49eaf49](https://github.com/OptimistikSAS/OIBus/commit/49eaf49aa6f49c8e7d1966ca7add8fba23feff60))

## [3.5.2](https://github.com/OptimistikSAS/OIBus/compare/v3.5.1...v3.5.2) (2025-01-10)


### Bug Fixes

* **south:** set maxInstantPerItem to true for sql connectors ([94fbdb0](https://github.com/OptimistikSAS/OIBus/commit/94fbdb0b1f4cfa575679bb1eb5c84caf44f3f33f))

## [3.5.1](https://github.com/OptimistikSAS/OIBus/compare/v3.5.0...v3.5.1) (2025-01-09)


### Bug Fixes

* **migration:** properly remove north oibus connectors ([5176df4](https://github.com/OptimistikSAS/OIBus/commit/5176df4f95738dffe02146c15b001d92c31b6d06))
* **proxy-server:** properly filter ip address with regex ([89d5e4a](https://github.com/OptimistikSAS/OIBus/commit/89d5e4a4712706cb14b4e3eb616b54691b6de3fd))
* **update:** properly update launcher version if only launcher is updated ([3547c77](https://github.com/OptimistikSAS/OIBus/commit/3547c77b212e8db4aa841a42a23a63e615ac541e))

## [3.5.0](https://github.com/OptimistikSAS/OIBus/compare/v3.4.9...v3.5.0) (2025-01-06)


### Features

* **backend:** Improved test coverage on base folder changes ([1f061d5](https://github.com/OptimistikSAS/OIBus/commit/1f061d50b1b4179356ea25a9c88f5da853645bd1))
* **backend:** Refactor and migrate archive folder location ([87f86db](https://github.com/OptimistikSAS/OIBus/commit/87f86dbd27b28e50bbdd24f5727780ff9ac6c549))
* **backend:** Refactor data folder migration and base folder implementation throughout the project ([9edaff3](https://github.com/OptimistikSAS/OIBus/commit/9edaff3dbc9c643b0eb973c829e4f9f89e03c234))
* **connection-service:** Added frontend toggle for sharing a south connection ([7415d3e](https://github.com/OptimistikSAS/OIBus/commit/7415d3e03038104c80a77fa094b7abdd545edea1))
* **connection-service:** Create ConnectionService to manage shared connections and implement it for OPCUA ([5bc61d7](https://github.com/OptimistikSAS/OIBus/commit/5bc61d790c4f1750ccf70f8d1fbc6e8197fdae3a))
* creation of items with scan mode name ([92078a7](https://github.com/OptimistikSAS/OIBus/commit/92078a799bc6c8d3daca92f8a97972280ba7547b))
* **engine/south:** addContent replaces addValues and addFile ([9ee9453](https://github.com/OptimistikSAS/OIBus/commit/9ee9453ce144089486d89786ffb05b1f5f2516a4))
* **engine/south:** addContent replaces addValues and addFile ([f7ccd2c](https://github.com/OptimistikSAS/OIBus/commit/f7ccd2caf705958656a65774d7fbd5c4b21f29e2))
* **engine:** display launcher version in about screen ([2cdf03c](https://github.com/OptimistikSAS/OIBus/commit/2cdf03c2c54674b1b3ecea8a5ce7f2e75a5bf873))
* export and import items delimiter ([21bc884](https://github.com/OptimistikSAS/OIBus/commit/21bc884e37c09fb7d1d6964551b9da0a28c0c121))
* **external-source:** deprecate and remove external sources ([c81b223](https://github.com/OptimistikSAS/OIBus/commit/c81b2237ea3755e2bb33807d3bfbdaa76680afa7))
* **frontend:** Add additional history query south items tests ([d7e8b36](https://github.com/OptimistikSAS/OIBus/commit/d7e8b36156f0c4a93143b367b97d8ae0e9e6dad2))
* **frontend:** Add additional south items tests ([25bbc06](https://github.com/OptimistikSAS/OIBus/commit/25bbc063f03f531e49c10e2140e7a51782bb86df))
* **frontend:** Hide log search by default ([b964cb3](https://github.com/OptimistikSAS/OIBus/commit/b964cb3839785e882074b49680bbe57b0b69138a))
* **frontend:** Sort history query south items ([9a95923](https://github.com/OptimistikSAS/OIBus/commit/9a95923fd09e3f4a57d2f4d7dca7cb6657917272))
* **frontend:** Sort south items ([8c588fa](https://github.com/OptimistikSAS/OIBus/commit/8c588fac9648721f08ec9385cc276b3a14389b3a))
* **frontend:** Sort south items by scan mode name ([9b25775](https://github.com/OptimistikSAS/OIBus/commit/9b25775e4f9fd43765b2b3628bbab0069a5b91bb))
* **history:** Add shared connection support to history queries ([12619c6](https://github.com/OptimistikSAS/OIBus/commit/12619c6122be7ea2c60cefe83605d4d81953c935))
* **launcher:** pass launcher version to oibus binary ([52cffe6](https://github.com/OptimistikSAS/OIBus/commit/52cffe632e3b0c1b4e53236d216bb1a50a28f905))
* logs in connectors ([aa15acb](https://github.com/OptimistikSAS/OIBus/commit/aa15acb92137e24df7d707f42f0907a636001525))
* **north:** Add Azure Data Lake Storage (ADLS) ([5a92f2c](https://github.com/OptimistikSAS/OIBus/commit/5a92f2c3377f1ffb484f5744fe630e72f996de33))
* **north:** entry point in run method is now handleContent ([7e8ed9b](https://github.com/OptimistikSAS/OIBus/commit/7e8ed9bb95c549f8832bf8dcaff308ec8d84ecb4))
* **north:** entry point in run method is now handleContent ([a8e4164](https://github.com/OptimistikSAS/OIBus/commit/a8e416478cc39b98daf7ced043cf4f6ad4044dbe))
* **north:** improve cache settings display ([1c1444a](https://github.com/OptimistikSAS/OIBus/commit/1c1444aa1cfdc8334c9d2d9e890c11c4948b117c))
* **north:** merge archive and file cache services and improve cache size metrics ([0b8e158](https://github.com/OptimistikSAS/OIBus/commit/0b8e1587aee6b6fda05f49c7207bd25e5f724e61))
* **oianalytics-commands:** add retrieveSecretsFrom connector in OIAnalytics connector command creation ([4dfc23b](https://github.com/OptimistikSAS/OIBus/commit/4dfc23bcc792973cb090e036bc0831796d56defb))
* **oianalytics-commands:** add retrieveSecretsFrom connector in OIAnalytics connector command creation ([c2342a1](https://github.com/OptimistikSAS/OIBus/commit/c2342a165075b9da43d6020eef0707c81ee7b762))
* **oianalytics-commands:** display oianalytics commands in a modal ([fbd3853](https://github.com/OptimistikSAS/OIBus/commit/fbd38539af01cba55be6d77d25acc73a3478e5bd))
* **oianalytics:** add register settings intervals and command permissions ([d502136](https://github.com/OptimistikSAS/OIBus/commit/d502136dbd41a8bdb409b26b49d20b3239993f24))
* **oianalytics:** manage South items import from OIAnalytics ([665b6f9](https://github.com/OptimistikSAS/OIBus/commit/665b6f92c7032f83e2631aea7d9e10032cdc7362))
* **oianalytics:** update settings with OIAnalytics and start refactor controller / service / repo code structure ([579f05a](https://github.com/OptimistikSAS/OIBus/commit/579f05a979b011fdbae251363daaf27df991ea24))
* **service:** split controller, service and repository for certificate, user and log ([8989212](https://github.com/OptimistikSAS/OIBus/commit/89892129282cd82b6a9e650b85c7aac3d67b4d80))
* **south-items:** Add item testing on create pages and improve test coverage ([0c51a8c](https://github.com/OptimistikSAS/OIBus/commit/0c51a8c10d6a8298d757839938bdf3dcfd2f2c29))
* **south-items:** Added the ability to test items with history settings ([816286a](https://github.com/OptimistikSAS/OIBus/commit/816286a9b6b1d399f3801197cd978295da0cba53))
* **south:** add frontend interaction to test single run of items ([bd6046a](https://github.com/OptimistikSAS/OIBus/commit/bd6046adf1acbb0d3a4b1052c94cea3543994281))
* **south:** add single run of item test for sftp and opchda ([5346f91](https://github.com/OptimistikSAS/OIBus/commit/5346f91dee6786e306989d745d0d86b2cde8f52e))
* **south:** implement single run of items for south OIA, PI and Slims ([6981c2c](https://github.com/OptimistikSAS/OIBus/commit/6981c2c506d6da078e662b024edeecbe987c813c))
* **south:** single run of south item ([6ddac14](https://github.com/OptimistikSAS/OIBus/commit/6ddac141caa820487f312754d355cf25b52b6c6c))


### Bug Fixes

* adapt code after rebase ([6172fb3](https://github.com/OptimistikSAS/OIBus/commit/6172fb33bf5ba1b0e03735b3979c2ed486557919))
* adapt code after rebase ([d257842](https://github.com/OptimistikSAS/OIBus/commit/d257842a0ad31d18ec86d3fa8dfabc8e7b36334d))
* add proxy configuration without unregister ([15a93be](https://github.com/OptimistikSAS/OIBus/commit/15a93be5d184f2d2d7d6362df68f89c709dece91))
* **backend,frontend:** Fix history query metrics ([db5463a](https://github.com/OptimistikSAS/OIBus/commit/db5463ab4fc555f81dafcc81194473dcb140684a))
* **backend:** Fix folder creation for North/South Connectors and HistoryQuery ([049056b](https://github.com/OptimistikSAS/OIBus/commit/049056b737e807339a0e4da4f407a365868c665a))
* **backend:** Fixed tests after the base folder rework ([b29f440](https://github.com/OptimistikSAS/OIBus/commit/b29f440d5ba56aebaaba4ffaf2dc52a50412f8f9))
* **backend:** Omit dist folder from type checking since a frontend polyfill messes with the jest "it" function type ([9a0e5e1](https://github.com/OptimistikSAS/OIBus/commit/9a0e5e1389943e34a9b9bd6da09a087ba5aa6967))
* bad display on item import validation ([f8a1399](https://github.com/OptimistikSAS/OIBus/commit/f8a1399b1a779f3be04fd1fd279f190fd77be201))
* **cache:** fix uncontrolled data used in path expression ([205b345](https://github.com/OptimistikSAS/OIBus/commit/205b345b2bafe75269f1da3b38e7deb6a307ad61))
* code block stub component paths ([db62987](https://github.com/OptimistikSAS/OIBus/commit/db62987fa8d07d00db9419db4805e62b2f75eda0))
* **config:** adapt model and keys reload ([4952af2](https://github.com/OptimistikSAS/OIBus/commit/4952af2313087deb0baa4cac623cf8d4132535a6))
* conflict web server and proxy port ([c307140](https://github.com/OptimistikSAS/OIBus/commit/c307140d8967465b0655ad4f7e092c72b35d2afd))
* **connector:** adapt manifest display ([8e78bcb](https://github.com/OptimistikSAS/OIBus/commit/8e78bcbadb5a582f6b86f31a7dfef03782f20ca4))
* **connector:** fix cache folders creation at connector start ([69b16ee](https://github.com/OptimistikSAS/OIBus/commit/69b16ee462d8da10bfaece64afb1e7dec06312ec))
* **connector:** fix enable update on connector repositories ([2a8302b](https://github.com/OptimistikSAS/OIBus/commit/2a8302b02a2eb0eb5ab8842909a4d498c361ec0e))
* **connectors:** adapt manifest values and types ([7b97b76](https://github.com/OptimistikSAS/OIBus/commit/7b97b761eba724c7376b59ad9f55bacf7129d859))
* **connectors:** adapt model and migration ([4b435ff](https://github.com/OptimistikSAS/OIBus/commit/4b435ffa73d6b031d4758e68971885c333edc2b0))
* **connectors:** translate labels in manifest ([7d66238](https://github.com/OptimistikSAS/OIBus/commit/7d66238d2aeebc62dc0f5d0032de65e8ce073747))
* **engine:** fix archive removal and flush values when compacting ([4d2ceb1](https://github.com/OptimistikSAS/OIBus/commit/4d2ceb108b37ec6ff60a00310cb0214288706189))
* **engine:** properly restart OIBus on restart call ([a1ffaa0](https://github.com/OptimistikSAS/OIBus/commit/a1ffaa0f994d780dc752b3815117e7a999fa1f6a))
* **engine:** refactor engine to reload on config change ([e27bc2f](https://github.com/OptimistikSAS/OIBus/commit/e27bc2fc7157517430f79adf110b796b2f29fafd))
* **engine:** remove settings from oibus service ([acb0cb8](https://github.com/OptimistikSAS/OIBus/commit/acb0cb872361ec40946d055e9e684fc1ba446064))
* fix south opcua start time from cache after rebase ([1291a11](https://github.com/OptimistikSAS/OIBus/commit/1291a11771c5fa36f2b1698312ae2fdf4bb57e50))
* **folder-scanner:** fix folder scanner compression ([05ffbed](https://github.com/OptimistikSAS/OIBus/commit/05ffbedd506e3a3d5b8a506d12a0c4794a9fc78d))
* **frontend:** Fix CSS errors when displaying an empty box component ([89ba06e](https://github.com/OptimistikSAS/OIBus/commit/89ba06eb07d3e5835469611848677469c863b8dc))
* **frontend:** Fix item management and validation ([f364c7b](https://github.com/OptimistikSAS/OIBus/commit/f364c7b4cae72bf0ed268aad8f3ef19e13a61fa0))
* **frontend:** Validate that the start and end range is correct ([de1950e](https://github.com/OptimistikSAS/OIBus/commit/de1950ea5c0ca2bd83d4a03e05634612c3882b4a))
* history query cache reset on settings change ([ec59fc7](https://github.com/OptimistikSAS/OIBus/commit/ec59fc7aedbb42e105c4060541b6ae988ad90698))
* **history-query:** add history query tests and remove create full config message ([644a259](https://github.com/OptimistikSAS/OIBus/commit/644a25905456fb6b53bbce07b726e3ade0934707))
* **history-query:** fix history query settings tests ([0b1d6cf](https://github.com/OptimistikSAS/OIBus/commit/0b1d6cf8daaeea5cf2c7e6aa7a9a28377c12195b))
* **history-query:** Fix updating the UI on item changes ([28d52b0](https://github.com/OptimistikSAS/OIBus/commit/28d52b05c2a50317d02d20abf4b37bcb5ee70410))
* **history-query:** properly reset cache ([969f2c5](https://github.com/OptimistikSAS/OIBus/commit/969f2c5af322d80462fce99842c2dec42e1c4994))
* **history-query:** properly reset cache ([10762e4](https://github.com/OptimistikSAS/OIBus/commit/10762e4a27a5e9d199226b56e65edfed97f1c225))
* **installer:** fix crlf end of line on bat install and uninstall scripts for Windows ([a4d37d8](https://github.com/OptimistikSAS/OIBus/commit/a4d37d8160b86395558d5d8b7d56d4998e6c21df))
* **items:** fix export of south items on connector or history query creation ([d1e5e1c](https://github.com/OptimistikSAS/OIBus/commit/d1e5e1cb60a47ea298b29b8edac076e43d949e54))
* **launcher:** parse arguments in constructor to avoid multiple push of launcherVersion ([20f5511](https://github.com/OptimistikSAS/OIBus/commit/20f5511782a80f53fb92f2854e1f86d16a5834a7))
* **linux:** add auto-restart in linux install script ([3677666](https://github.com/OptimistikSAS/OIBus/commit/3677666bcc13c05667db151a8a6a6162287849c9))
* **metrics:** fix reset metrics ([d4a40e8](https://github.com/OptimistikSAS/OIBus/commit/d4a40e8db14d83e1d29514ff5496626cd7ad1e86))
* **metrics:** refactor and fix home metrics ([e88d4cb](https://github.com/OptimistikSAS/OIBus/commit/e88d4cb35c204980169f86293c3ec55592d0bba6))
* **metrics:** replace service by event emitter in connectors ([13357fe](https://github.com/OptimistikSAS/OIBus/commit/13357fea549801aa2cbee9d1339f0937f1719d69))
* **metrics:** rework history metrics ([d8cd886](https://github.com/OptimistikSAS/OIBus/commit/d8cd886998cb8a3670e2442074598fa40769c344))
* **migration:** fix migration file for 3.5 version ([9fb59b2](https://github.com/OptimistikSAS/OIBus/commit/9fb59b2f26a23c98c4df74d1f27fdd6786a68499))
* **migration:** remove north oibus and history queries with north oibus ([c1e59d1](https://github.com/OptimistikSAS/OIBus/commit/c1e59d19f2cef08cbda62e4fcfe7587be702f07b))
* **migration:** update properly registration settings ([866286f](https://github.com/OptimistikSAS/OIBus/commit/866286f6d0ee68fb370886f019791a1fac860969))
* **modbus:** fix data-type enum ([23634c9](https://github.com/OptimistikSAS/OIBus/commit/23634c93c0f746d7f0eb7caf59f8606a4f0e3112))
* **modbus:** fix modbus after rebase ([e161e37](https://github.com/OptimistikSAS/OIBus/commit/e161e373992dc4233adc9a23835777483fb20edc))
* move to ES6 bundle to fix package bundle error ([e21a5c6](https://github.com/OptimistikSAS/OIBus/commit/e21a5c68c80a212fc955e10d1ccff1aa7ed1dde3))
* **north:** add migration for North Azure Blob ([d0661be](https://github.com/OptimistikSAS/OIBus/commit/d0661be190b66bed4966699927ee1f0d80914dbc))
* **north:** do not create an empty folder on north connection test ([fd548ff](https://github.com/OptimistikSAS/OIBus/commit/fd548ff55a5c39c94a2bce19eed03cab4209d753))
* **north:** fix cache size display in log ([03f0def](https://github.com/OptimistikSAS/OIBus/commit/03f0def045c71391338d377abdc083b9fb41b87a))
* **north:** fix north files management ([8331969](https://github.com/OptimistikSAS/OIBus/commit/833196974a94f00bfd3efd45254e7eec7bce4f7b))
* **oianalytics:** adapt oianalytics message model ([e9f4861](https://github.com/OptimistikSAS/OIBus/commit/e9f4861e13d57727178a824687934b93e09a30e1))
* **oianalytics:** change reload-keys into regenerate-cipher-keys ([d85bb76](https://github.com/OptimistikSAS/OIBus/commit/d85bb76e8e6f5ce5bface9d196225b440bf68bc2))
* **oianalytics:** fix command execution async call ([2cbb3d0](https://github.com/OptimistikSAS/OIBus/commit/2cbb3d0a80ae81f81eb03ffa11d40d40d0d5d218))
* **oianalytics:** fix RSA encryption errors for OIAnalytics commands secrets decrypt ([fd7092c](https://github.com/OptimistikSAS/OIBus/commit/fd7092c5e4f07cdb7cd628cbea5479b9b2507233))
* **oianalytics:** fix translation of OIAnalytics commands and remove legacy UPGRADE command ([e83f2e6](https://github.com/OptimistikSAS/OIBus/commit/e83f2e68c79e66cd1782dc252511ed02e650a124))
* **oianalytics:** use oianalytics client, encrypt remote config secrets and implement remote config command ([53523c2](https://github.com/OptimistikSAS/OIBus/commit/53523c228c03c1a841a0e8c0c1e8cc8b70c08773))
* **oianalytics:** use retry interval when connection with OIA fails ([5ca9e8a](https://github.com/OptimistikSAS/OIBus/commit/5ca9e8aa94f1f2c0442893e8bdc1de21224d0176))
* **oianalytics:** use retry interval when connection with OIA fails for messages ([917397d](https://github.com/OptimistikSAS/OIBus/commit/917397d17f0ca1864fe5d65e5803ba3f86550bca))
* OIBus connector / history copy of items with enabled status ([aeaf0c0](https://github.com/OptimistikSAS/OIBus/commit/aeaf0c072cd50d7514e3382d460f7ef1d74692e2))
* **oibus:** manage reload-keys command retrieved from OIAnalytics ([5b4c3f0](https://github.com/OptimistikSAS/OIBus/commit/5b4c3f014acd776ac65b60d0f762fd06444d2635))
* **opc:** rename opc-hda connector into opc connector ([c2accda](https://github.com/OptimistikSAS/OIBus/commit/c2accdab7989bf0539305e058655f7394dacd22f))
* **opcua:** adapt opcua connector with pkg and node-opcua update ([776a37d](https://github.com/OptimistikSAS/OIBus/commit/776a37d403fe3ff42900b95e45bc59c416d67f57))
* **opcua:** do not catch session error on history query ([9dcdcbb](https://github.com/OptimistikSAS/OIBus/commit/9dcdcbbec16911a801473b1bb202cd705e33b701))
* **opcua:** retrieve timestamp from source or OPCUA server ([ade6dc6](https://github.com/OptimistikSAS/OIBus/commit/ade6dc68c96abfc42aa7eb4f0be86a0969ef0f58))
* **opcua:** use local timestamp when subscribing ([b322f04](https://github.com/OptimistikSAS/OIBus/commit/b322f04ffba26826156474d50869cfa37f44e218))
* **scan-mode:** fix scan mode validation http error and command payload ([f9e111b](https://github.com/OptimistikSAS/OIBus/commit/f9e111b5851ae887424c93b0a4c242549f6865fc))
* **sftp:** adapt connectors after rebase ([f8d60e5](https://github.com/OptimistikSAS/OIBus/commit/f8d60e5c08e7be25a01a06938a170ccac330d117))
* **south-items:** Add history test settings to all souths that support it ([d82a801](https://github.com/OptimistikSAS/OIBus/commit/d82a801d06414341d7b977a4698f251c0f607bd5))
* **south-items:** Fix tests after item test history settings ([1e44c54](https://github.com/OptimistikSAS/OIBus/commit/1e44c54b6d9add885f7bc748a08b68b7cf9e33bd))
* **south:** fix count result from agent result ([5724b0f](https://github.com/OptimistikSAS/OIBus/commit/5724b0f36d01b039c3167db3ea2dcfb5b13fa379))
* **south:** fix display issue on south settings ([5bc6bdf](https://github.com/OptimistikSAS/OIBus/commit/5bc6bdf01122ce7057571ced145560d9cb130852))
* **south:** fix oledb payload with outputTimestampFormat and test item payload ([851ca69](https://github.com/OptimistikSAS/OIBus/commit/851ca69abf00fdb86f1c656e29b59b478d392b27))
* **south:** improve south test coverage and fix item update ([9e3c855](https://github.com/OptimistikSAS/OIBus/commit/9e3c855d8291c3a4cdc220eca5c364bfdb83d03a))
* **south:** move south shared connection logic into specific settings ([2564034](https://github.com/OptimistikSAS/OIBus/commit/25640347bea523a2303e917b98a0d0be0c9065f9))
* **south:** move throttling settings into specific south settings ([7a7ed0e](https://github.com/OptimistikSAS/OIBus/commit/7a7ed0e12a0c4eb7971e981f69d4b446b3cf678c))
* **south:** use an enum instead of two boolean for scan mode settings in manifest ([4a36406](https://github.com/OptimistikSAS/OIBus/commit/4a3640618a0af428868015eabc1f07fab4a30973))
* test problem without odbc library ([6ba1961](https://github.com/OptimistikSAS/OIBus/commit/6ba1961b29c0c6ca6c50846ecbab21c622ff4d53))
* tests after rebase ([39f3995](https://github.com/OptimistikSAS/OIBus/commit/39f39958f2d459e279bfbdf7e48a7d3fa2ff358a))
* typescript lint ([f033770](https://github.com/OptimistikSAS/OIBus/commit/f033770b7f7d170e9176f95c0be8ad1564a32bbe))
* **update:** do not log an error when binary does not need to be updated but launcher does ([7de6c45](https://github.com/OptimistikSAS/OIBus/commit/7de6c45fcc83d441d7b75e9bde0834846a32f014))
* **update:** fix oibus launcher copy ([38df631](https://github.com/OptimistikSAS/OIBus/commit/38df6310ea897079daf3f1ca9dca05cf480d7e66))
* **update:** fix path for backup and update paths ([2f09670](https://github.com/OptimistikSAS/OIBus/commit/2f09670646a63f95378e71d526e60d5173d4aa1c))
* **update:** improve update command to better manage data folder backup and update launcher ([a598cb8](https://github.com/OptimistikSAS/OIBus/commit/a598cb8c401e428cffc092ba8c837043ef949d4a))
* **update:** log the update of OIBus launcher ([afd159c](https://github.com/OptimistikSAS/OIBus/commit/afd159c1dbc88802fb63b8ef170f096be36ccf4e))
* **update:** mark command as running ([840d759](https://github.com/OptimistikSAS/OIBus/commit/840d75940c1bbb54d8c1276cfb02ca62f89df259))
* **update:** remove backup files when startup succeeds ([fbe5295](https://github.com/OptimistikSAS/OIBus/commit/fbe5295c78117d39412e6b0b8c4baecc9772c57d))
* **update:** remove first argument for OIBus binary ([2861870](https://github.com/OptimistikSAS/OIBus/commit/286187082b4ef4a4dfe79863c05c58aeb82ee387))
* **web-client:** add parent form into oib-form to trigger validators on specific settings ([c4fce2c](https://github.com/OptimistikSAS/OIBus/commit/c4fce2c74575a0fa8e4d0b7d7ec2f430485fcd4c))
* **web-client:** correctly display items select title and option translation in display mode ([8f4e9e6](https://github.com/OptimistikSAS/OIBus/commit/8f4e9e6326aedfe2cf84b65916f2b3e20982c971))
* **web-client:** fix table size when text overflows ([ab8f8cd](https://github.com/OptimistikSAS/OIBus/commit/ab8f8cda2e05b5a09e31cb99cf62db913a0b2b70))
* **web-client:** keep padding for oib-form in oib-box ([b07872f](https://github.com/OptimistikSAS/OIBus/commit/b07872f82aeef1c61dd0f7c0f146a0dd83d44ca4))
* **web-server:** fix controller after rebase ([9388123](https://github.com/OptimistikSAS/OIBus/commit/9388123d0d6b4f435937916ed25a7a219477eb60))
* **windows-installer:** fix favicon path ([b546c22](https://github.com/OptimistikSAS/OIBus/commit/b546c22dff5a205754a56aca3666a85a1fb51ee1))

## [3.4.9](https://github.com/OptimistikSAS/OIBus/compare/v3.4.8...v3.4.9) (2024-12-18)


### Bug Fixes

* **oledb:** fix oledb read payload ([a8bccde](https://github.com/OptimistikSAS/OIBus/commit/a8bccde1930965bb987631084aa4deaddd994b5f))

## [3.4.8](https://github.com/OptimistikSAS/OIBus/compare/v3.4.7...v3.4.8) (2024-12-04)


### Bug Fixes

* **south:** update max instant if start interval is lower ([c089d0b](https://github.com/OptimistikSAS/OIBus/commit/c089d0b6adcb61beee0eb5ef082cb29c7e8fe63a))

## [3.4.7](https://github.com/OptimistikSAS/OIBus/compare/v3.4.6...v3.4.7) (2024-11-05)


### Bug Fixes

* **north:** pass dataStream parameter in north start method ([c0a7e07](https://github.com/OptimistikSAS/OIBus/commit/c0a7e077b3a4fe06ea98d82261df553166cbb40e))
* **opcua:** manage null terminated string with fix size ([23282db](https://github.com/OptimistikSAS/OIBus/commit/23282db9197563db4565c64baa7f4ee88602e772))

## [3.4.6](https://github.com/OptimistikSAS/OIBus/compare/v3.4.5...v3.4.6) (2024-10-02)


### Bug Fixes

* **south:** fix history interval query and error management ([266570f](https://github.com/OptimistikSAS/OIBus/commit/266570f669918a689602443fb2df4940715f9b91))

## [3.4.5](https://github.com/OptimistikSAS/OIBus/compare/v3.4.4...v3.4.5) (2024-10-01)


### Bug Fixes

* **mqtt:** fix payload parsing and unsubscribe on item change ([2aa36c4](https://github.com/OptimistikSAS/OIBus/commit/2aa36c4660c2c272de18a3a9f78d4aa7b4dcfcaf))
* **oibus-launcher:** pass full arg list to oibus child process ([7fa09f5](https://github.com/OptimistikSAS/OIBus/commit/7fa09f531e05f4449a14957dccbcf170f5748bd7))
* **oibus:** ignore remote update if arg is passed at startup ([523dda7](https://github.com/OptimistikSAS/OIBus/commit/523dda79312e2b9f5a5fe553f8bd4a85dc77d5ec))
* **oibus:** manage ignoreIpFilters arg ([56293f8](https://github.com/OptimistikSAS/OIBus/commit/56293f8b1cd7f4d1378580a16864d2a42c711c89))
* **oibus:** manage status endpoint without auth ([b9d2299](https://github.com/OptimistikSAS/OIBus/commit/b9d22997dda025bba54066fd36d147118bd3e940))
* **oibus:** resolve absolute path of config in oibus launcher argument ([bf3f915](https://github.com/OptimistikSAS/OIBus/commit/bf3f915e58932ee0b7264a023f75a3a3ef144ab9))
* **subscribe:** fix subscribed item on name or other settings change ([589d6ed](https://github.com/OptimistikSAS/OIBus/commit/589d6ed5d80b1b1a7818bd749b04fd038e771506))

## [3.4.4](https://github.com/OptimistikSAS/OIBus/compare/v3.4.3...v3.4.4) (2024-09-23)


### Bug Fixes

* **mqtt:** allow persistent in QoS 1 ([a754a9d](https://github.com/OptimistikSAS/OIBus/commit/a754a9dbf1688c9ebae170ae05a1d190761dbed8))
* **north:** await when removing error values ([aab1901](https://github.com/OptimistikSAS/OIBus/commit/aab1901d7922314ab62d216bc28f8d0b60663e10))
* **north:** fix chunk count in logs when caching values ([9c54fe8](https://github.com/OptimistikSAS/OIBus/commit/9c54fe8bc7bbf90a01ff78a11f4f76b494b653c7))
* **oledb:** simplify connection test ([91f6045](https://github.com/OptimistikSAS/OIBus/commit/91f6045b748269238a4cbfdd0b94d3c85b89e76e))
* **opcua:** convert ByteString to hex string ([d9a9561](https://github.com/OptimistikSAS/OIBus/commit/d9a9561772ae2cb2a959d92a1f67feb27b7603b1))
* **south-pi:** fix south pi connection test ([cca4db0](https://github.com/OptimistikSAS/OIBus/commit/cca4db00fd8a27d2bf3c6ae7f3c335c2ede0f94f))
* **south:** adapt South OPC to new OIBus Agent ([d2eb483](https://github.com/OptimistikSAS/OIBus/commit/d2eb4839d32ed2016b34da2a12e9b01cb0e6301f))

## [3.4.3](https://github.com/OptimistikSAS/OIBus/compare/v3.4.2...v3.4.3) (2024-09-13)


### Bug Fixes

* **south-pi:** throw error on history query error to not continue with history query intervals in case of failure ([e6d53b2](https://github.com/OptimistikSAS/OIBus/commit/e6d53b237d9321f6d101bb683fb11e8750399215))

## [3.4.2](https://github.com/OptimistikSAS/OIBus/compare/v3.4.1...v3.4.2) (2024-09-12)


### Bug Fixes

* **south:** keep start time from cache as reference on history query error ([17e2b43](https://github.com/OptimistikSAS/OIBus/commit/17e2b4356192078e18916ccdc46ec4a70a66a4d9))

## [3.4.1](https://github.com/OptimistikSAS/OIBus/compare/v3.4.0...v3.4.1) (2024-09-11)


### Bug Fixes

* **south-pi:** add startTime and endTime in history query debug log ([b8c5bc5](https://github.com/OptimistikSAS/OIBus/commit/b8c5bc5d76ff12148ff95cbf0ea10713977f4608))

## [3.4.0](https://github.com/OptimistikSAS/OIBus/compare/v3.3.14...v3.4.0) (2024-07-22)


### Features

* **sftp:** Implement North and South SFTP connectors ([4115a85](https://github.com/OptimistikSAS/OIBus/commit/4115a853cb560f076b8474f6bd26ec04cef32ab0))


### Bug Fixes

* **engine:** update version at startup if local oibus upgrade ([2f6a8fe](https://github.com/OptimistikSAS/OIBus/commit/2f6a8fe2a6fddb2a91a4d1f07439777d6bf55a4f))
* **frontend:** Add pending changes validation check ([5bd7b7c](https://github.com/OptimistikSAS/OIBus/commit/5bd7b7c6da8c683a1f6567f8fbe03c6a5a24dcfd))
* **installer:** fix linux script for automating installation ([21a09a2](https://github.com/OptimistikSAS/OIBus/commit/21a09a2a1e9445c314f2c278188211f6d214c07c))

## [3.3.14](https://github.com/OptimistikSAS/OIBus/compare/v3.3.13...v3.3.14) (2024-07-17)


### Bug Fixes

* **engine:** fix reload of settings and items on change ([51ab9ba](https://github.com/OptimistikSAS/OIBus/commit/51ab9bad8bcd1843b5ce87db11afa288eb609251))
* **engine:** fix update version log ([6d19fbe](https://github.com/OptimistikSAS/OIBus/commit/6d19fbe5751f1fab88776b00ca05e37d6d7c4761))
* **north:** transform json into csv for file north connectors ([79f19de](https://github.com/OptimistikSAS/OIBus/commit/79f19dec7b36378bacd9ac6158e4450ed41f30c8))
* **oia:** fix OIA acknowledgment command and logger service ([8a0fe27](https://github.com/OptimistikSAS/OIBus/commit/8a0fe27463e7272bc815c0afdf95aaf28e6f1976))
* **proxy-agent:** Fix http and https agent creation ([aba24a4](https://github.com/OptimistikSAS/OIBus/commit/aba24a4136e8ab83b2ac160bf4e86bcb021494c1))
* **proxy-server:** Fix HTTPS request proxying ([c3e06d9](https://github.com/OptimistikSAS/OIBus/commit/c3e06d931045f0264c15c2345060a2a359819218))
* **south-modbus:** fix error message thrown on last point query ([9e820df](https://github.com/OptimistikSAS/OIBus/commit/9e820df6013f095ac73d0f50c6fbbc92d76c5ecf))
* **south-opcua:** parse OPCUA value according to its DataType return by the server ([2cfcfef](https://github.com/OptimistikSAS/OIBus/commit/2cfcfefd801323b6d91157f35a69d68c50b12809))
* **south:** add ItemName filename variable and change default filename and sql query for sql connectors ([e0c36ea](https://github.com/OptimistikSAS/OIBus/commit/e0c36eae250ed2d9a1c14cacd90cd04e3f3345d9))
* **south:** catch subscription error ([2fc28f0](https://github.com/OptimistikSAS/OIBus/commit/2fc28f05dc23e7416ef6ac33a2e6539ecb038cb1))
* **south:** do not add items to list if disabled ([135e9d1](https://github.com/OptimistikSAS/OIBus/commit/135e9d1317df776cccbf107351f1f4db70ddfeb2))
* **south:** fix update of max instant with overlap ([9c1ddf7](https://github.com/OptimistikSAS/OIBus/commit/9c1ddf7308fa404bad06187a4b169bf7bec7f8b5))
* **web-server:** fix south id on south item deletion ([7ecc4f3](https://github.com/OptimistikSAS/OIBus/commit/7ecc4f311fc681bb76014161a958aff16449cbfa))

## [3.3.13](https://github.com/OptimistikSAS/OIBus/compare/v3.3.12...v3.3.13) (2024-07-03)


### Bug Fixes

* **north:** remove errored file from file queue ([6aa3a97](https://github.com/OptimistikSAS/OIBus/commit/6aa3a976928a17f7e8848e27d1c0e485591493ad))

## [3.3.12](https://github.com/OptimistikSAS/OIBus/compare/v3.3.11...v3.3.12) (2024-07-03)


### Bug Fixes

* **azure-blob:** connect through proxy and custom url ([b8aec6a](https://github.com/OptimistikSAS/OIBus/commit/b8aec6a3bf5a3303fb9aa499f7accbc723ed4656))
* **north-oianalytics:** remove compressed file only if not already compressed ([770708a](https://github.com/OptimistikSAS/OIBus/commit/770708a5cbfb0d194df50b88c28f4fdc144f9160))
* **south-opcua:** add numValuesPerNode when querying raw data and add timeoutHint in request header ([3381c82](https://github.com/OptimistikSAS/OIBus/commit/3381c826545e4abfa513d9215dcb306c82d79413))
* **web-client:** fix default retention duration for archive files to 72 hours ([7cabc19](https://github.com/OptimistikSAS/OIBus/commit/7cabc192773d7e176eeea5b0e517db442cdd2be3))

## [3.3.11](https://github.com/OptimistikSAS/OIBus/compare/v3.3.10...v3.3.11) (2024-07-01)


### Bug Fixes

* **cron:** attach context to CronJob and fix async call when archiving files ([4b6920c](https://github.com/OptimistikSAS/OIBus/commit/4b6920c3710c6941e3f4d2614cb74786e8279d4d))
* **north-oianalytics:** log references that are filtered out because of bad data type ([6c8e92b](https://github.com/OptimistikSAS/OIBus/commit/6c8e92b96405c887655ee88ae24fc9ea463a2303))
* **north:** fix file cache trigger when send file immediately is enabled ([9060709](https://github.com/OptimistikSAS/OIBus/commit/9060709a1f4c6281b91c07fff600277cf4ce9fb6))

## [3.3.10](https://github.com/OptimistikSAS/OIBus/compare/v3.3.9...v3.3.10) (2024-07-01)


### Bug Fixes

* **north-connector:** fix default behaviour for retry to false and fix run on scan mode ([35af100](https://github.com/OptimistikSAS/OIBus/commit/35af100a0681471472ac523e00bf6ea4f411113a))

## [3.3.9](https://github.com/OptimistikSAS/OIBus/compare/v3.3.8...v3.3.9) (2024-06-25)


### Bug Fixes

* **oianalytics:** filter payload before sending it to OIAnalytics ([56959fe](https://github.com/OptimistikSAS/OIBus/commit/56959fe98921ff2ae9ccdbafa1a42dd3329984b9))
* **pi:** fix reconnection on history failure ([fba7dbf](https://github.com/OptimistikSAS/OIBus/commit/fba7dbf83c679fff04db36d423d1e946b0803d5f))
* **reload:** fix async/await reload and clear timeout for south opcua ([a308063](https://github.com/OptimistikSAS/OIBus/commit/a308063276287ff0fa21c7a98109500ad61b1e17))

## [3.3.8](https://github.com/OptimistikSAS/OIBus/compare/v3.3.7...v3.3.8) (2024-06-11)


### Bug Fixes

* **oianalytics:** fix OIAnalytics message models ([ffd9046](https://github.com/OptimistikSAS/OIBus/commit/ffd904630d5775e327dc3751fcec10f85ecefb37))

## [3.3.7](https://github.com/OptimistikSAS/OIBus/compare/v3.3.6...v3.3.7) (2024-06-10)


### Bug Fixes

* **modbus:** fix modbus item data model for optional fields ([a228601](https://github.com/OptimistikSAS/OIBus/commit/a228601432daa6f44e744885d2296d0e780ee537))
* **modbus:** optimize last point query ([3f683c4](https://github.com/OptimistikSAS/OIBus/commit/3f683c4c8424b7da7e09236b231aef36fb000b89))
* **oianalytics:** send oibus info to oianalytics on engine name or version update ([314f8ff](https://github.com/OptimistikSAS/OIBus/commit/314f8ff112025e46738b8643fcbabe6680f4d2d5))
* **scan-mode:** allow creation of connectors with scan mode name ([fb5de79](https://github.com/OptimistikSAS/OIBus/commit/fb5de7918b70bb67ac3a167e3764232544444c58))

## [3.3.6](https://github.com/OptimistikSAS/OIBus/compare/v3.3.5...v3.3.6) (2024-05-28)


### Bug Fixes

* **proxy-server:** force redirect into https ([1341d0d](https://github.com/OptimistikSAS/OIBus/commit/1341d0dc0ff077a6cf798e0bce0581b5e30a2c82))

## [3.3.5](https://github.com/OptimistikSAS/OIBus/compare/v3.3.4...v3.3.5) (2024-05-23)


### Bug Fixes

* **logs:** improve south logging ([d6b4450](https://github.com/OptimistikSAS/OIBus/commit/d6b44507100a683029a5692c041bdef84252b7cd))
* **opcua:** add read timeout for OPCUA South connector ([9a18071](https://github.com/OptimistikSAS/OIBus/commit/9a1807198915e30d4ac464e3a12b70ac1ffa0d25))

## [3.3.4](https://github.com/OptimistikSAS/OIBus/compare/v3.3.3...v3.3.4) (2024-05-13)


### Bug Fixes

* **web-client:** display certificate list on connector forms ([83d601e](https://github.com/OptimistikSAS/OIBus/commit/83d601e7aa9b2c23723dc1d361380714f3809397))

## [3.3.3](https://github.com/OptimistikSAS/OIBus/compare/v3.3.2...v3.3.3) (2024-05-07)


### Bug Fixes

* **web-client:** add OIBus name in tab name ([6e2a8b7](https://github.com/OptimistikSAS/OIBus/commit/6e2a8b7fc33deb6724289feb50f23b7bb9964e02))

## [3.3.2](https://github.com/OptimistikSAS/OIBus/compare/v3.3.1...v3.3.2) (2024-04-26)


### Bug Fixes

* fix secrets duplication ([28b5849](https://github.com/OptimistikSAS/OIBus/commit/28b5849ecf63e3af35ab47a764a240f32c6433fe))
* **items:** fix items duplication ([b523aae](https://github.com/OptimistikSAS/OIBus/commit/b523aaea192f65ee1bb42c2088ffaaf9ffc36f33))

## [3.3.1](https://github.com/OptimistikSAS/OIBus/compare/v3.3.0...v3.3.1) (2024-04-19)


### Bug Fixes

* fix OIAnalytics connector migration ([7438e36](https://github.com/OptimistikSAS/OIBus/commit/7438e36de4b84ea8ae448ae17b117b5c88e83ee7))
* fix OIAnalytics registration url and accept unauthorized ([bad2d9a](https://github.com/OptimistikSAS/OIBus/commit/bad2d9a1e3c8e9177684c4361102db4492a42df0))
* **south:** fix export/import of items with group forms and optional fields ([0bd328b](https://github.com/OptimistikSAS/OIBus/commit/0bd328b1ed6b11fd94e4e4b18c13f94c9a2137a1))

## [3.3.0](https://github.com/OptimistikSAS/OIBus/compare/v3.2.0...v3.3.0) (2024-04-11)


### Features

* **south:** Add South OSIsoft PI connector ([dd07f7e](https://github.com/OptimistikSAS/OIBus/commit/dd07f7e5ab858174614e36778af3eb41ad8e0e20))


### Bug Fixes

* Fix user search ([4cb1c19](https://github.com/OptimistikSAS/OIBus/commit/4cb1c19c996af6f75e629d654a46013a815e631b))
* **oracle:** Manage thick / thin mode oracle client ([f7d5cd0](https://github.com/OptimistikSAS/OIBus/commit/f7d5cd0712d7f42fbfd0251ec9050c6808fffd04))
* sanitize IP filter and filePath ([1b53363](https://github.com/OptimistikSAS/OIBus/commit/1b533634d0184dd47e4a5a37106ef4bafdd7176e))
* Simplify proxy redirection ([49b1c9d](https://github.com/OptimistikSAS/OIBus/commit/49b1c9d1e9018376d069bbf91e98cf18ddee1e42))

## [3.2.0](https://github.com/OptimistikSAS/OIBus/compare/v3.1.0...v3.2.0) (2024-03-26)


### Features

* Adapt bash install scripts ([fe67e2d](https://github.com/OptimistikSAS/OIBus/commit/fe67e2d21d8b50ab64b3e4bda717f113ecdb77fb))
* Adapt bat install scripts ([ca2660d](https://github.com/OptimistikSAS/OIBus/commit/ca2660dc660bb83c5dbb4035315f72bf1beef42d))
* Adapt bundle for launcher ([ad33e2e](https://github.com/OptimistikSAS/OIBus/commit/ad33e2e466a13c0d14c6149780943e15c6abb201))
* **backend:** Create cron validation endpoint ([6667ebc](https://github.com/OptimistikSAS/OIBus/commit/6667ebc4572818b7f7b4bbbad09f874c13236349))
* Create launcher for OIBus auto-update ([1398328](https://github.com/OptimistikSAS/OIBus/commit/1398328286e090b7730f8d8b6f4c8a6fcbc4aa14))
* **engine:** Add Proxy server capabilities ([c1dd3af](https://github.com/OptimistikSAS/OIBus/commit/c1dd3af169c8efec47784cc1cf859f313d3622a0))
* **frontend:** Display number of items in tables ([92bd9e6](https://github.com/OptimistikSAS/OIBus/commit/92bd9e6bb70e278d0b49529f7186fe41a22374dc))
* **frontend:** Show warning when changing scan modes ([556a3f9](https://github.com/OptimistikSAS/OIBus/commit/556a3f935759ced5498bb36c1bc2c117b0292379))
* **frontend:** Validate cron and show next occurrences and human readable form ([3bfd42a](https://github.com/OptimistikSAS/OIBus/commit/3bfd42aaec0216ce161a92cc49df772349170ff9))
* **help:** Add contextual help that link to the official documentation ([8a4d597](https://github.com/OptimistikSAS/OIBus/commit/8a4d597936a891d3fe6d13616d930f622b1577fa))
* **history:** Add restart history buttons ([259a1c8](https://github.com/OptimistikSAS/OIBus/commit/259a1c874e22376d4868299b99db4296fba8a07a))
* **history:** Added progress bar ([fcff359](https://github.com/OptimistikSAS/OIBus/commit/fcff35949849e4fee7954db33d02f29176985aaa))
* **launcher:** Backup and rollback data-folder ([f010cab](https://github.com/OptimistikSAS/OIBus/commit/f010cab11d28db69868dfedebbf6b25d504abee1))
* **logger:** Add OIAnalytics Pino transport and refactor registration service to reload logger on change ([40a21cf](https://github.com/OptimistikSAS/OIBus/commit/40a21cfc165cfbd1db25ee1ffe0933acac144fbd))
* **north-cache:** Add actions to file tables ([9026e8f](https://github.com/OptimistikSAS/OIBus/commit/9026e8f04fa051e7cca2c10d0cb77982026abb50))
* **north-cache:** Display north error values ([4f430e5](https://github.com/OptimistikSAS/OIBus/commit/4f430e5575be550f72766b092eb7ec3fba7f41ec))
* **north-cache:** Display north regular values ([9b9d6bd](https://github.com/OptimistikSAS/OIBus/commit/9b9d6bdcea08e02963f6c9ba9f904cdd512d37b3))
* **oia-module:** Manage Commands acknowledgment ([726f4bd](https://github.com/OptimistikSAS/OIBus/commit/726f4bd36bdc5fda0ee505cc4dcad50b41c7f116))
* **oia-module:** Manage Upgrade command ([a4690b8](https://github.com/OptimistikSAS/OIBus/commit/a4690b8e515a9dc40fcd5be5eaac824e5b1d1fbd))
* **oia-module:** Queue commands when retrieving them ([89b513b](https://github.com/OptimistikSAS/OIBus/commit/89b513b913eb039b0e0298cd459cddc116abfe22))
* **oia-module:** Retrieve commands from OIA ([e9409b6](https://github.com/OptimistikSAS/OIBus/commit/e9409b6bcad78d99c4eef93d93fb9bbef7618027))
* **oia-module:** Use OIA module in OIA connectors ([784e907](https://github.com/OptimistikSAS/OIBus/commit/784e907545c246a44e2729e0dc916c7d583848b3))
* **oianalytics:** Compress values and files if not already compressed ([8457a23](https://github.com/OptimistikSAS/OIBus/commit/8457a23c72a61f919d1e046df840270c42c41ce0))
* **oib-help:** testing the import of a new 'oib-help' component ([000315a](https://github.com/OptimistikSAS/OIBus/commit/000315a6e5450f9a71606db52fa3f1e011336431))
* **OLEDB:** Add OLEDB South Connector ([8d2fde3](https://github.com/OptimistikSAS/OIBus/commit/8d2fde35fc55700aaa41cc0800d949c54eb87ccf))
* **proxy-server:** Filter IPs on proxy server ([ab9aced](https://github.com/OptimistikSAS/OIBus/commit/ab9aced5158b78165715bfd4f3f00f59c3e28459))
* **registration:** Add registration process (OIA module) ([b283915](https://github.com/OptimistikSAS/OIBus/commit/b283915e2ae2ead326e69e64a959c4f124926869))
* **registration:** Create registration backend service ([1d37015](https://github.com/OptimistikSAS/OIBus/commit/1d37015d84853523da9adc4b407ee216956b6e69))
* **registration:** Implement check registration process ([ba8d474](https://github.com/OptimistikSAS/OIBus/commit/ba8d474f9e212809188bbe7deff1501b986a22da))


### Bug Fixes

* Add error interceptor to display HTTP error in a notification ([b01604f](https://github.com/OptimistikSAS/OIBus/commit/b01604fca6bd1fa59c8f4d569e00a5d7cbc93f0b))
* **azure-blob:** fix test of writing access of a blob ([a601eb9](https://github.com/OptimistikSAS/OIBus/commit/a601eb90374a4b9c5f5db1d44733a9b22a8b0b4e))
* **backend:** Fix validation of optional items from csv ([cdc411d](https://github.com/OptimistikSAS/OIBus/commit/cdc411dbe3d9bf1fdc291d003bcf3148ce5f4822))
* **backend:** Fixed instantiating invalid cron jobs ([1fdb104](https://github.com/OptimistikSAS/OIBus/commit/1fdb1043cfa6450d4d57c0d0276395d2f3a19826))
* **ci:** adapt release please v4 ([5f81ae5](https://github.com/OptimistikSAS/OIBus/commit/5f81ae5e925267cea307db7a6d4ea597cd969db1))
* **connectors:** Only log test connection's errors on modal, not in logger anymore ([c65576a](https://github.com/OptimistikSAS/OIBus/commit/c65576a239a862a2b9b7714f52cd023f8d05c701))
* **engine:** fix OIBus unzip upgrade ([2cc93c3](https://github.com/OptimistikSAS/OIBus/commit/2cc93c36f2c99fe50552992d0705b24ddeefc21d))
* **form:** Increase max file size validator to match default OIBus engine value ([dcf914a](https://github.com/OptimistikSAS/OIBus/commit/dcf914ac68ec6fcce4d41bfd4a145ffc93496b8b))
* **frontend:** Fixed auto refreshing logs when the end date is filled or when the page number is other than 0 ([7055872](https://github.com/OptimistikSAS/OIBus/commit/7055872d67491c2ff88744dd5c789c129b482ab6))
* **history-metrics:** Reset metrics when resetting cache ([49535f8](https://github.com/OptimistikSAS/OIBus/commit/49535f84b867a425503f7b9b58831deb16db2d14))
* **history-query:** fix item update and history query error management ([ef0d3be](https://github.com/OptimistikSAS/OIBus/commit/ef0d3be42ef7613bd028fe22fbb6350278b68cd4))
* **history-query:** Improve South metrics logging on History Query ([2192774](https://github.com/OptimistikSAS/OIBus/commit/21927741af4045c52bb0e2f75d174eed2b49da80))
* **history-query:** Rationalisation of the design system on history query ([db4acc1](https://github.com/OptimistikSAS/OIBus/commit/db4acc15750ebd21fb92e704038f6e1573989bd0))
* **history:** Add additional tests for progress bar component ([4eadefd](https://github.com/OptimistikSAS/OIBus/commit/4eadefd581f3a24f37c550ec36e94daec7aeede0))
* **installer:** Fix service name with space on windows install script ([d3c2371](https://github.com/OptimistikSAS/OIBus/commit/d3c2371fa79b5abf14ff231baa039cf220d3b50a))
* **installer:** Remove service before installing it again ([9f00db7](https://github.com/OptimistikSAS/OIBus/commit/9f00db721755daadec384f65d0fbc9dd6004b0fe))
* **installer:** Set service path to update it or install it with Windows installer ([da3f5bb](https://github.com/OptimistikSAS/OIBus/commit/da3f5bb6071cdc9367ce105c37259374092f3ec1))
* **launcher:** Create backup folder if it does not exist ([8883245](https://github.com/OptimistikSAS/OIBus/commit/88832454a8363aa7b40947fc3334924457e09cec))
* **launcher:** Remove data folder after backup and improve upgrade log ([df0fd19](https://github.com/OptimistikSAS/OIBus/commit/df0fd1909b038a29b0b5c2256bbb2f3848a946b3))
* **launcher:** remove files after update ([aad2dbe](https://github.com/OptimistikSAS/OIBus/commit/aad2dbef4e6e34e6c6855ee91f1727045bdcafea))
* **north-cache:** Fix file table tests ([7fba183](https://github.com/OptimistikSAS/OIBus/commit/7fba183f3182fbf3dd84dc8aea2ca35a91c0a310))
* **north:** Added a conditional position for the save button in the subscription list + auto save for subscription ([9d4937c](https://github.com/OptimistikSAS/OIBus/commit/9d4937c6ca575b70dfc4f9b160f0530bfd3f33b1))
* **oia-module:** Fix path when updating OIBus from launcher ([17fbd7d](https://github.com/OptimistikSAS/OIBus/commit/17fbd7df903f194b608761d89a85c2f7d4f02053))
* **oianalytics:** Fix command acknowledgment and registration form ([9daeb69](https://github.com/OptimistikSAS/OIBus/commit/9daeb69fc8c1e7e88dfd15830508ff45c37fad49))
* **oianalytics:** Fix OIAnalytics endpoint for commands asset download ([045024a](https://github.com/OptimistikSAS/OIBus/commit/045024a37602df9ca36e3359be08b34c1c32003c))
* **oianalytics:** Fix OIAnalytics endpoint for commands asset download and OIAnalytics module reload ([971d48f](https://github.com/OptimistikSAS/OIBus/commit/971d48f0aec4cfdb21418960e99b72c8c9fdd20a))
* **oianalytics:** Fix OIAnalytics endpoint for commands retrieval and ack ([cf00357](https://github.com/OptimistikSAS/OIBus/commit/cf003575afb8c8fba2a454e909591c6bd66fb618))
* **oianalytics:** Move OIAnalytics module button access into engine menu ([2b672e5](https://github.com/OptimistikSAS/OIBus/commit/2b672e521c6ba0fe84ec52c83219d336cb06a11a))
* **oledb:** Remove unused password field ([f89aba6](https://github.com/OptimistikSAS/OIBus/commit/f89aba6b3035f99df0ff7c11a4dad8f03e3fdd09))
* Partitioning forms and items/sub with a new "save-zone" class + adding back btn on top of the pages ([dc2f9cf](https://github.com/OptimistikSAS/OIBus/commit/dc2f9cfd243c0afe671cf98d8f23357f30b79567))
* **proxy-server:** Catch error on proxy forward error ([2fd20f7](https://github.com/OptimistikSAS/OIBus/commit/2fd20f749e1058fcba5e7556cba18683eb39af2d))
* **slims:** Fix slims parser to serialize data properly ([2584667](https://github.com/OptimistikSAS/OIBus/commit/25846675979b9769f9b6de06b8b39e96f55fe984))
* **south:** Added a conditional position for the save button in the edit/display south/historyQuery pages ([1ba9df1](https://github.com/OptimistikSAS/OIBus/commit/1ba9df19164e6a08925db43ceae170a9dcec0fef))
* **south:** Fix custom cache table creation for South Connector (e.g. Folder Scanner) ([8c850f3](https://github.com/OptimistikSAS/OIBus/commit/8c850f307c70798ecc7eacfabc5a179ce9771a1f))
* **south:** Fix duplicating south items ([098c7d4](https://github.com/OptimistikSAS/OIBus/commit/098c7d4dab3b7b3f889999c67d169ffc15a3c1cd))
* **south:** Fix last max instant behavior on scan mode changes ([59f02fd](https://github.com/OptimistikSAS/OIBus/commit/59f02fd8a7e1fee51b669b5b043d133d3d881a7d))
* **south:** Increase request timeout of SQL South connectors ([412c2b3](https://github.com/OptimistikSAS/OIBus/commit/412c2b3b0eece79691d5ddd42a53f3498f130571))
* **south:** Remove mimetype check on item import ([16ee824](https://github.com/OptimistikSAS/OIBus/commit/16ee824b934022546259585df352821f77ae420a))
* **table:** fix cell size / add text-overflow: clip / minimize "type"/"mode"/"interval" column / define first/last cell size ([17d97b8](https://github.com/OptimistikSAS/OIBus/commit/17d97b8ba24b3d1591f9895319a40ed06c4755a1))
* use default property of JSON i18n module ([58b7bad](https://github.com/OptimistikSAS/OIBus/commit/58b7bad9994d47928ad6a2eb315b16277177021d))
* **web-server:** fix IP filter reloading on change ([844287c](https://github.com/OptimistikSAS/OIBus/commit/844287c9c202a34a00b9df5b8da288b49efa665e))

## [3.1.0](https://github.com/OptimistikSAS/OIBus/compare/v3.0.4...v3.1.0) (2023-11-07)


### Features

* **build:** Add Dockerfile for OIBus ([86c8a82](https://github.com/OptimistikSAS/OIBus/commit/86c8a821c249ac81a559a0dc0e1585d2520eb570))
* **history-query:** Add connector test to history queries ([16d153d](https://github.com/OptimistikSAS/OIBus/commit/16d153d3c2d58ac3caa2e44e4ec22bb8e55de2ae))
* **modbus:** Read Modbus single bit ([99b6a68](https://github.com/OptimistikSAS/OIBus/commit/99b6a689f10170d5c94f374f35462473439376f7))
* **north-cache:** Add north cache pagination ([99a9488](https://github.com/OptimistikSAS/OIBus/commit/99a9488096b1aa0a10db3d7d7bffe7405372a7b9))
* **north-cache:** Add ordering for cache tables ([d643bf4](https://github.com/OptimistikSAS/OIBus/commit/d643bf46717504fdcf7e1e2e2dfbb2e4850ce4c2))
* **north-cache:** Add refresh cache button ([5c464f4](https://github.com/OptimistikSAS/OIBus/commit/5c464f45cc06ece4cd772113d9256dab2f624794))
* **north-cache:** Show regular cache files ([2b9f7e4](https://github.com/OptimistikSAS/OIBus/commit/2b9f7e4c27767f6265ff188db534de3778a85a70))
* **north:** Add AAD auth in OIAnalytics North ([781cf56](https://github.com/OptimistikSAS/OIBus/commit/781cf56eeeb3621b22d11181069aefb02c16651a))
* **north:** Manage subscription from North edit ([79c5b0b](https://github.com/OptimistikSAS/OIBus/commit/79c5b0b4a098c5f78493f1d8698fc514d0e9f80e))
* **opchda:** Use OIBus Agent for OPCHDA queries ([5f19d30](https://github.com/OptimistikSAS/OIBus/commit/5f19d30c3daa4f3f60cc5d44a246b74df70c5a53))
* **south:** Add overlap for history capable South ([582bbdf](https://github.com/OptimistikSAS/OIBus/commit/582bbdfd3b8062f158c664210effa87dca150dc5))


### Bug Fixes

* Copy cache with connector id ([699c464](https://github.com/OptimistikSAS/OIBus/commit/699c464b9b4bd388399e3d9a352f02eede551140))
* **history-query:** Add history query duplicate button ([8f275b4](https://github.com/OptimistikSAS/OIBus/commit/8f275b435687ce584a383046a2b65008c00ae9a8))
* **history-query:** Paginate south items ([ce109aa](https://github.com/OptimistikSAS/OIBus/commit/ce109aa6da370e56220be1a6bf629ab51378f775))
* **north/south/history:** make appear the id for copy it ([fd772a6](https://github.com/OptimistikSAS/OIBus/commit/fd772a61ed51ce91448cb60113756c507120899c))
* **north:** Fix north creation with subscriptions ([3f3554b](https://github.com/OptimistikSAS/OIBus/commit/3f3554bee64ad53d35cc987a75284ae27bc798d2))
* Properly copy cache path into clipboard ([8f02d8f](https://github.com/OptimistikSAS/OIBus/commit/8f02d8f63ce6a713d1c514b564b48e11a249f082))
* **south:** Fix south reload on max instant update ([0ab93f2](https://github.com/OptimistikSAS/OIBus/commit/0ab93f290a359f80f7bae7dd0e8fd048942aab40))
* **South:** Paginate south items ([1ad8db1](https://github.com/OptimistikSAS/OIBus/commit/1ad8db1f482023156240afabd16da0942d5a3948))
* **south:** Properly manage run with history query and last point query ([441cf9c](https://github.com/OptimistikSAS/OIBus/commit/441cf9caa11decf2041faa9b08ddb6a4b013fa62))
* **South:** Update OPCHDA manifest ([50ad84d](https://github.com/OptimistikSAS/OIBus/commit/50ad84dd4932e034c88447734b563145adc8f84f))

## [3.0.4](https://github.com/OptimistikSAS/OIBus/compare/v3.0.3...v3.0.4) (2023-10-06)


### Bug Fixes

* **connector:** Reimplement timeout (s) in HTTP connectors ([4d6b54f](https://github.com/OptimistikSAS/OIBus/commit/4d6b54f2b5ca8abc9e34ecc71b6e8080d3b5d9bb))
* **file-writer:** Take CurrentDate and ConnectorName into account for prefix and suffix ([c6d5931](https://github.com/OptimistikSAS/OIBus/commit/c6d59318de6acccdc0d5e84c8cc0198f7e64fe73))
* **history-query:** Fix metrics loading and add details on creation ([89a9850](https://github.com/OptimistikSAS/OIBus/commit/89a9850033b0c472c5ded67379ed34307e9e92e9))
* **history-query:** Fix reloading of history query after update ([be1bd13](https://github.com/OptimistikSAS/OIBus/commit/be1bd1348dd55d9e69bacfe01a7ed3876a587e7c))
* **history-query:** Rearrange history form display ([c007fcf](https://github.com/OptimistikSAS/OIBus/commit/c007fcf9d2d82b7ba3ac7d312d31731a3d18ae57))
* **lists:** Add legend on connector and history query list ([3996b49](https://github.com/OptimistikSAS/OIBus/commit/3996b49f6ce78a31f37462a8a58b31f08f25ee15))
* **north-amazon-s3:** Fix test connection and proxy with S3 buckets ([fbef828](https://github.com/OptimistikSAS/OIBus/commit/fbef82843da88277941e231c75ccdb1fe6bf9674))
* **north:** Fix status display for north list ([468004a](https://github.com/OptimistikSAS/OIBus/commit/468004ade64476857eb38092c71f51569ea3c731))
* **south-items:** Fix import items after deletion in edit mode ([47fa976](https://github.com/OptimistikSAS/OIBus/commit/47fa9760b0eeff4aa1377dd3cba2ba2e76ee1f4c))
* **south:** Fix enabled update on south items ([a455db2](https://github.com/OptimistikSAS/OIBus/commit/a455db21c2d6b111f41b21f852f300ee1e724d00))
* **south:** Fix south connector reload on settings edition ([60588e8](https://github.com/OptimistikSAS/OIBus/commit/60588e81f893b8e82e33b582df525731e86e4360))
* **south:** Fix SQL queries to only count tables ([5490759](https://github.com/OptimistikSAS/OIBus/commit/54907596cfb3abf72b6f942fb1e03978fbf3a422))
* **styles:** better align connectors and engine on home screen ([b6e2b08](https://github.com/OptimistikSAS/OIBus/commit/b6e2b08b4564dc0dc9845ca448a2e12190fba570))
* **styles:** resize history query table + change "-&gt;" for "fa-arrow-right" ([454ab93](https://github.com/OptimistikSAS/OIBus/commit/454ab932894f6fe77e326f6f5f78a275044c07c8))
* **styles:** resize logs table + change badge pill for color text ([dda54de](https://github.com/OptimistikSAS/OIBus/commit/dda54de3fd8018f195a86f0fc6e40c42ef5ef63d))
* **styles:** resize table cell for connector lists and replace disabled/enabled by color dot red/green ([a7d280e](https://github.com/OptimistikSAS/OIBus/commit/a7d280e2f753959cb4ba26d0d443e399c21df855))
* **web-client:** Fix border display ([563f1a0](https://github.com/OptimistikSAS/OIBus/commit/563f1a0d80759b6cd33c23022c825e43bd5b7d0c))

## [3.0.3](https://github.com/OptimistikSAS/OIBus/compare/v3.0.2...v3.0.3) (2023-09-30)


### Bug Fixes

* display fields in file-writer and azure-blob north connectors ([b0276f9](https://github.com/OptimistikSAS/OIBus/commit/b0276f9e74854d6e7676824cb338468f406e4799))
* **history:** Export and import of items with scan mode names, remove ID and improve validation ([99d44b1](https://github.com/OptimistikSAS/OIBus/commit/99d44b123d54cd28e3268ab32be6907436d43058))
* **south-items:** Display a warning on item changes ([162939d](https://github.com/OptimistikSAS/OIBus/commit/162939d4c06a4cfea247cf213ae04374af297912))
* **south-items:** Remove south items id and scan mode ids when exporting ([5425e9f](https://github.com/OptimistikSAS/OIBus/commit/5425e9fe6d9836478e676b813da9411b5c6e97ae))
* **south-odbc:** Fix disconnection ([e721976](https://github.com/OptimistikSAS/OIBus/commit/e7219766b32a62e63d0cd148059accb0fda0843d))
* **south:** Export and import of items with scan mode names, remove ID and improve validation ([0c58a43](https://github.com/OptimistikSAS/OIBus/commit/0c58a43b8f930bfd106d377a856926571654cdce))
* **south:** Fix import / export of south items ([d7d5f8e](https://github.com/OptimistikSAS/OIBus/commit/d7d5f8ef8b9ad27d41c368a8d51bb06a6465304f))
* update connector manifest interfaces ([768fd73](https://github.com/OptimistikSAS/OIBus/commit/768fd73cfa839481f55b7485da501fc7245cd49f))

## [3.0.2](https://github.com/OptimistikSAS/OIBus/compare/v3.0.1...v3.0.2) (2023-09-17)


### Bug Fixes

* **connectors-oia:** Fix test command for South and North OIA connectors ([941792e](https://github.com/OptimistikSAS/OIBus/commit/941792e6f34e541cf7a5449e0fd2cab3216a7ecf))
* **connectors:** Fix connector metrics ([e26f334](https://github.com/OptimistikSAS/OIBus/commit/e26f3344e3325a8fed3495fb4e0d1141802dfa1b))
* **connectors:** Harmonize status display for connectors and history queries ([ce504b8](https://github.com/OptimistikSAS/OIBus/commit/ce504b8f2107e47fe799680ffee03dea2551b518))
* **proxy:** Fix HTTP(S) proxy with user ([8db1bff](https://github.com/OptimistikSAS/OIBus/commit/8db1bff4dc651d5f300efb1e460e56517396449c))
* **south:** Fix ODBC serialization ([ffade20](https://github.com/OptimistikSAS/OIBus/commit/ffade207599ea7c4340f29e49fdae38a577b7900))
* **south:** Fix south items deletion ([f1c8546](https://github.com/OptimistikSAS/OIBus/commit/f1c8546baddb4f1ec17813f67f6972d9b434face))
* **south:** Remove required attribute for form arrays ([9eb6f07](https://github.com/OptimistikSAS/OIBus/commit/9eb6f07d7a27800e211a56090bdf06342795131a))

## [3.0.1](https://github.com/OptimistikSAS/OIBus/compare/v3.0.0...v3.0.1) (2023-09-08)


### Bug Fixes

* **about:** Small rework of about page ([1d1eac5](https://github.com/OptimistikSAS/OIBus/commit/1d1eac592d6eee4b084181a991b08696eb653ba9))
* **connector:** Fix test connection modal wording ([8f04334](https://github.com/OptimistikSAS/OIBus/commit/8f04334f517fa663a17b11f639b7f872f23f3585))
* **connectors:** filter up-to-date connectors only ([0e5f40d](https://github.com/OptimistikSAS/OIBus/commit/0e5f40d9b83d4388c3973a40c71dc5b658cddfa0))
* **folder-scanner:** Do not need write access and test if directory ([c916046](https://github.com/OptimistikSAS/OIBus/commit/c916046f8be4ea2d88ae459811a0cc6062fc7ea9))
* **history-query:** Fix cache reset ([0bebc40](https://github.com/OptimistikSAS/OIBus/commit/0bebc408d94ac7f4fdb22991ac469e09a1afd432))
* **history-query:** Fix History Query metrics display ([b53822b](https://github.com/OptimistikSAS/OIBus/commit/b53822be3c45860c770298f675f8ee2161e87564))
* **history-query:** Fix history query status update in engine ([ee3c24a](https://github.com/OptimistikSAS/OIBus/commit/ee3c24a8d447d1b78ebe5e3f9737f855458cbf1d))
* **history-query:** Fix toggle button feedback ([6b44f85](https://github.com/OptimistikSAS/OIBus/commit/6b44f850abcd9eb0dcbee94f919fa622a7217b2c))
* **history-query:** Fix toggle button feedback on history queries list ([2e13a92](https://github.com/OptimistikSAS/OIBus/commit/2e13a924a89d303fe2b7fb56a4f27f5715c2f43d))
* **history-query:** update history query status ([f2492bd](https://github.com/OptimistikSAS/OIBus/commit/f2492bd10ead15c02f7e8ada9dced73b2e35e234))
* **item:** Fix item edit form when same name ([dee29b6](https://github.com/OptimistikSAS/OIBus/commit/dee29b6245cbcc84ea9931b9eb79e5c2c47f489a))
* **migration:** Migrate to latest ([d73b4d1](https://github.com/OptimistikSAS/OIBus/commit/d73b4d167b7efdeb32ed6e2738b20aa9157c52cb))
* **win-setup:** Fix Windows installer license ([6b2ae75](https://github.com/OptimistikSAS/OIBus/commit/6b2ae75212579cc59a7ae60103a3cb64b179603e))

## [3.0.0](https://github.com/OptimistikSAS/OIBus/compare/v2.9.1...v3.0.0) (2023-09-05)


### ⚠ BREAKING CHANGES

* release-please CI

### Features

* **about:** Create about page ([b1ceecf](https://github.com/OptimistikSAS/OIBus/commit/b1ceecffbc0e8f4f1a73673fbed065c1d42608cc))
* **about:** Retrieve OIBus info ([cb5179c](https://github.com/OptimistikSAS/OIBus/commit/cb5179ce81667a40f255d80f785c325bb2ef0166))
* Add manifest connector ID and split SQL connector ([7f1f74a](https://github.com/OptimistikSAS/OIBus/commit/7f1f74ab7a86dc083434f928fadb0fb60141dc96))
* Add test connection modal ([78e7e08](https://github.com/OptimistikSAS/OIBus/commit/78e7e08af6bda6bb7ae34b3436de123de8a9a9ec))
* **api:** Add south controller settings test endpoint ([7b2b8de](https://github.com/OptimistikSAS/OIBus/commit/7b2b8dea4125559e283927f6fa9473f9728cf536))
* **archive:** added get/retry/remove functionality for archived files ([ff38437](https://github.com/OptimistikSAS/OIBus/commit/ff38437fa930459d1e7acd5489ad0c28defa52ca))
* **azure:** Add Azure Blob North ([b9f8887](https://github.com/OptimistikSAS/OIBus/commit/b9f8887491048f61487cbbad97b44e6afb823ec5))
* **cache:** Fix values push performance and stack exceeded ([9b6de42](https://github.com/OptimistikSAS/OIBus/commit/9b6de42306e336d995b23cd0e5ece8a41af2ce49))
* **cache:** Store values in chunk when caching them from big buffer ([a12f6ef](https://github.com/OptimistikSAS/OIBus/commit/a12f6ef635f3aab27b26600f529c58e7f092e77f))
* **connector:** Harmonize south and north oianalytics and add north connection test ([23e83d5](https://github.com/OptimistikSAS/OIBus/commit/23e83d53026087eb994531d0677e6199d504a49d))
* **connectors:** Remove http timeout not properly taken into account by fetch spec ([00878f3](https://github.com/OptimistikSAS/OIBus/commit/00878f34594742f225644f091a09c95012e983d3))
* **connector:** Start and stop connectors from list and display ([a50603d](https://github.com/OptimistikSAS/OIBus/commit/a50603dd7be4dd3c3ab56ee845067bca5d05c7cc))
* **connector:** Test connection for North OIConnect ([46c8cf8](https://github.com/OptimistikSAS/OIBus/commit/46c8cf830c4c180a378b9b53d347130d539dea9a))
* **design:** apply design principles of optimistik and make some code adjustments ([4400689](https://github.com/OptimistikSAS/OIBus/commit/440068932ee5e23eb06daaccf5093721d00ac05b))
* **engine:** Activate/deactivate connectors ([5623ef1](https://github.com/OptimistikSAS/OIBus/commit/5623ef15452f7fff5c9c7f167a0b530c9443ee6a))
* **engine:** Add a settings to keep a max instant per item or per scan mode ([b49ff51](https://github.com/OptimistikSAS/OIBus/commit/b49ff516944ef42b149eddf06c634bad67a48b2b))
* **engine:** Add engine metrics into repository ([9af7f77](https://github.com/OptimistikSAS/OIBus/commit/9af7f77806c925c5588404049cf1928c9bf09708))
* **engine:** Add engine metrics to the frontend ([de204b4](https://github.com/OptimistikSAS/OIBus/commit/de204b4c3896524b8fbfca5157f0052570dfd245))
* **engine:** Add history settings for South connectors with history capabilities ([66a3702](https://github.com/OptimistikSAS/OIBus/commit/66a37024948b48f070570c0a271bbc65a6ddb5cb))
* **engine:** Add OIBusDataValue interface ([16d58d6](https://github.com/OptimistikSAS/OIBus/commit/16d58d63f8a732bc4af896104c1bb8914d9be14a))
* **engine:** add scan modes, external sources, and ip filters list ([18fde83](https://github.com/OptimistikSAS/OIBus/commit/18fde83023bdd73a9f52ae1a69925a47349782b2))
* **engine:** Add values, add file and health signal endpoints ([6760ffc](https://github.com/OptimistikSAS/OIBus/commit/6760ffc0844fd89ae63e40c2566d9e931e5ffe59))
* **engine:** Create a shared cache database for south connectors ([0f31e82](https://github.com/OptimistikSAS/OIBus/commit/0f31e82bf8b5d691d6c98ec63918f6653ba77b92))
* **engine:** create reload and health-signal services ([6cf9fd6](https://github.com/OptimistikSAS/OIBus/commit/6cf9fd654094d8421df8e5e50a27bd763a49c957))
* **engine:** Do not send secrets to frontend and encrypt secrets properly only when changed ([2c46006](https://github.com/OptimistikSAS/OIBus/commit/2c46006ef54aebb96c059ca32eefc932d13e9153))
* **engine:** Improve connectors startup and connection ([cf6e7a1](https://github.com/OptimistikSAS/OIBus/commit/cf6e7a1b353116d21b67673ce38b310912bce24c))
* **engine:** Populate database with scan mode ([68dc682](https://github.com/OptimistikSAS/OIBus/commit/68dc682ad904b1071738c38b8382447500ecf562))
* **engine:** Reload connectors on settings or items changes ([dec3b19](https://github.com/OptimistikSAS/OIBus/commit/dec3b1982f0c29cf24e211f936aa1c5d6033c3e0))
* **engine:** Reload cron after scan mode cron change ([aa1a23c](https://github.com/OptimistikSAS/OIBus/commit/aa1a23c9f506220a6b0d241bb7d4c1c414c0b353))
* **engine:** Routes for enabling / disabling items for south and history query ([5950b49](https://github.com/OptimistikSAS/OIBus/commit/5950b49d832d3e8f7a572f34c89403fcbf38009b))
* **engine:** Separate crypto settings from engine settings ([7a833be](https://github.com/OptimistikSAS/OIBus/commit/7a833bed84091e0ac49390da70af362f7cb767d9))
* **engine:** Shutdown and restart OIBus ([d7274ec](https://github.com/OptimistikSAS/OIBus/commit/d7274eca2e20e11903ca9b13edd4c7739fd2df72))
* **folder-scanner:** Add connection test ([c855283](https://github.com/OptimistikSAS/OIBus/commit/c855283e9ecd2b6bfb42278bd36bfaf55e3f08f1))
* **folder-scanner:** add custom database for south cache in folder scanner ([eac1842](https://github.com/OptimistikSAS/OIBus/commit/eac1842cad5e02ca1613d009631eadefe59d7b6b))
* **folder-scanner:** Add Folder Scanner connection test ([85a016c](https://github.com/OptimistikSAS/OIBus/commit/85a016c8484e037bc080b53d81c442b87d3ab7cc))
* **frontend:** create form for engine settings ([df9225c](https://github.com/OptimistikSAS/OIBus/commit/df9225cd58bdfde4c2c9cc99120276614b69bda4))
* **health-signal:** create health signal for logging only ([6c68d23](https://github.com/OptimistikSAS/OIBus/commit/6c68d23b00c8405f563b8c114c2250a17e0f058f))
* **history-query:** add backend endpoint and repository for history queries ([b7ffefd](https://github.com/OptimistikSAS/OIBus/commit/b7ffefde51bc72394709e3de0df811d2186f51fe))
* **history-query:** basic skeleton for history query engine ([b9b7750](https://github.com/OptimistikSAS/OIBus/commit/b9b775009920030910b5544cede16a638e5b87fb))
* **history-query:** create and edit history query (frontend) ([d8b1e22](https://github.com/OptimistikSAS/OIBus/commit/d8b1e22f5ef78588a1f6d29cadf181e60b4b4a2f))
* **history-query:** crud for history queries ([afe34b9](https://github.com/OptimistikSAS/OIBus/commit/afe34b90bc5750f94ced3c5f9c1f0557e2968c0e))
* **history-query:** edit and display a history query ([98e3e5d](https://github.com/OptimistikSAS/OIBus/commit/98e3e5dc44cbdb768233343a3f96556143c5654d))
* **history-query:** Enable history query from list and display ([9174565](https://github.com/OptimistikSAS/OIBus/commit/917456526f3470e7afe25bd1ee822a0645ff1984))
* **history-query:** frontend list and service for history queries ([c26cc9d](https://github.com/OptimistikSAS/OIBus/commit/c26cc9d465b3e278678342d1d749a8722f98714f))
* **history-query:** improve design for History Query ([ba910b5](https://github.com/OptimistikSAS/OIBus/commit/ba910b5224be720f212419b4f94d9fc326516add))
* **history-query:** Manage items from history query backend ([54dcf97](https://github.com/OptimistikSAS/OIBus/commit/54dcf977bdb126fb180eec39f8c81b4619aac184))
* **history-query:** Manage items from history query frontend ([b1f2081](https://github.com/OptimistikSAS/OIBus/commit/b1f2081831856f666d7816a98f7ce7af6cde5baf))
* **history-query:** reset cache on history query (item) update ([2263e9e](https://github.com/OptimistikSAS/OIBus/commit/2263e9ee97e9ca806b9eb0730e1bd6b6970c7236))
* **history-query:** separate start/stop action from creation/edition ([a53a4e0](https://github.com/OptimistikSAS/OIBus/commit/a53a4e0e9b51131b766c525bb988b1cd4bb0946b))
* **home:** Add engine metrics in home page ([c664d72](https://github.com/OptimistikSAS/OIBus/commit/c664d72e12bb4d23cc832abf817913c043c7e209))
* **home:** Add south and north metrics ([60a7ba9](https://github.com/OptimistikSAS/OIBus/commit/60a7ba98ea505d71e169fa5ce7f67ef3983dc790))
* **home:** Create OIBus Home page ([697a851](https://github.com/OptimistikSAS/OIBus/commit/697a8513174d69364952f1362388e0467eeb8872))
* **IP21:** Add IP21 south connector ([a5afba5](https://github.com/OptimistikSAS/OIBus/commit/a5afba51212b7541dc22f10b44f5b2b5dafdaf52))
* **items:** Add enabled flag in model ([44d679a](https://github.com/OptimistikSAS/OIBus/commit/44d679a4c199527dc4a051562833b151790dae68))
* **items:** Enable / disable items from the frontend ([787b582](https://github.com/OptimistikSAS/OIBus/commit/787b582fc553ef29c60da88aaca9f03f2e7d13fd))
* **log:** Add OIBus name and OIBus ID in loki logs ([cd57a07](https://github.com/OptimistikSAS/OIBus/commit/cd57a075dd59a7139f98d444ed1fd46a388eac0e))
* **logger:** move to typescript and batch sqlite logs before storing them ([a574fae](https://github.com/OptimistikSAS/OIBus/commit/a574fae3815f2a2df68de5e216c43ec7909616c8))
* **logs:** logs backend repository ([38c162e](https://github.com/OptimistikSAS/OIBus/commit/38c162e3704184ea6892b54886143e15dbd97ac5))
* **logs:** logs user interface ([066e522](https://github.com/OptimistikSAS/OIBus/commit/066e522c3192e8b7664c3709105929e67497029d))
* **logs:** Search by Scopes ([2c7ebb1](https://github.com/OptimistikSAS/OIBus/commit/2c7ebb17266352cc4cf9b7790ebdee6d89dc015b))
* **metrics:** Add an endpoint to reset connector metrics ([4f8d2b6](https://github.com/OptimistikSAS/OIBus/commit/4f8d2b66d9629de5e1bd96dc17eef8a97bc39f56))
* **metrics:** Add connector metrics for South connectors (backend) ([209995f](https://github.com/OptimistikSAS/OIBus/commit/209995fe4dd3914c239551fe21487971d82cb08d))
* **metrics:** Add reset metrics button for connectors ([a834977](https://github.com/OptimistikSAS/OIBus/commit/a8349770001d3f3586661006b7320498117821b2))
* **metrics:** Update cache size as a metric and take whole north cache into account ([b5a5263](https://github.com/OptimistikSAS/OIBus/commit/b5a52631e04e634208ba9bf4bb657a3c980ba52d))
* **migration:** initialize entities with knex ([1281a73](https://github.com/OptimistikSAS/OIBus/commit/1281a73cc421fd8ac08e4e1c77a8d9ec5acc06e5))
* **migration:** initialize logs and crypto with knex. Update logs payload with scope ([9883bf0](https://github.com/OptimistikSAS/OIBus/commit/9883bf042d7c02fe4600472dfd2012782116575a))
* **migration:** manage connector metrics in one table ([91ebf0a](https://github.com/OptimistikSAS/OIBus/commit/91ebf0a6a0e1e0186e2e7a8dc2681200c3b320d7))
* **modbus:** Add Modbus connection test ([894ccef](https://github.com/OptimistikSAS/OIBus/commit/894ccefec7e81b8cb4ff6d422988b789bed478ee))
* **mssql:** Add MSSQL connection test ([71a0b2a](https://github.com/OptimistikSAS/OIBus/commit/71a0b2a77c2221e7676b3f07562fb3e33db6f0d0))
* **mysql:** Add MYSQL connection test ([44ee46a](https://github.com/OptimistikSAS/OIBus/commit/44ee46ada478a457d289144a10498bf418147318))
* **north-connector:** added endpoint and method to test north connector settings ([8ff5bee](https://github.com/OptimistikSAS/OIBus/commit/8ff5bee62212ce289801e3dd083034e5f6d10352))
* **north-console:** Add NorthConsole connection test ([c98e3a0](https://github.com/OptimistikSAS/OIBus/commit/c98e3a014c6c8d7ae6925b8b6af58c5c448ab073))
* **north-file-writer:** Add NorthFileWriter connection test ([614a13d](https://github.com/OptimistikSAS/OIBus/commit/614a13d76cb70ad7527d6107cc82748cd191a60b))
* **north:** Add a sendFileImmediately for North connectors ([826eabb](https://github.com/OptimistikSAS/OIBus/commit/826eabb0fdada0821f27266611b3b3a8ecd74948))
* **north:** Add North FileWriter connector ([2d51a1d](https://github.com/OptimistikSAS/OIBus/commit/2d51a1d95b5bca2248ce6541633d555d057be63c))
* **north:** Add North OIConnect and accept unauthorized certificates ([53651c3](https://github.com/OptimistikSAS/OIBus/commit/53651c30baef958fe2d97c36c26073b4f99e4b5f))
* **north:** Add test connection button ([290f07e](https://github.com/OptimistikSAS/OIBus/commit/290f07eaa009506b5a654169cfc098f59fac5b2a))
* **north:** add tests for north console and north oianalytics ([1610629](https://github.com/OptimistikSAS/OIBus/commit/16106295596ed76f0cee2bac12c39fe5dad65220))
* **north:** Amazon S3 North connector ([3169c43](https://github.com/OptimistikSAS/OIBus/commit/3169c430b21d3b5408a3199de64339ca95a098f2))
* **north:** backend repository and endpoints ([e915bd8](https://github.com/OptimistikSAS/OIBus/commit/e915bd889bc1caa0a354841e318df9806f8c1af5))
* **north:** Create a specific OIConnect (for another OIBus) north connector ([59a4f5c](https://github.com/OptimistikSAS/OIBus/commit/59a4f5ce0186bff55c39ec492158cfed8291bdb5))
* **north:** create and edit north connectors ([8f1f3e5](https://github.com/OptimistikSAS/OIBus/commit/8f1f3e51b82c2da35f3b500d11ddfa18759c2bc1))
* **north:** Display North connector metrics ([b36e967](https://github.com/OptimistikSAS/OIBus/commit/b36e967c65e7fcd72fa286c2ed7f989e0e307783))
* **north:** Implement group count and send file immediately ([ff9173c](https://github.com/OptimistikSAS/OIBus/commit/ff9173c64fa9757da8d567be63d01302472883e9))
* **north:** Manage retries and custom OIBus connector errors ([755d5d1](https://github.com/OptimistikSAS/OIBus/commit/755d5d1c0982725a46d566180cb77658a1621611))
* **north:** Manage South subscriptions ([9c7bb20](https://github.com/OptimistikSAS/OIBus/commit/9c7bb20965c63a8acb9da2f312c919357f31c949))
* **north:** Retry or remove cache error files (frontend) ([fc22108](https://github.com/OptimistikSAS/OIBus/commit/fc22108344e2a8697fd3fda92ea7b14cc929c396))
* **north:** Subscribe from an external source ([abca666](https://github.com/OptimistikSAS/OIBus/commit/abca66646dde9562dc779d1d4d9df0a5acbf2f50))
* **north:** Subscribe to external sources ([d9eb7d8](https://github.com/OptimistikSAS/OIBus/commit/d9eb7d8ce09117c63c88f3529f8c09336d5efe47))
* **north:** Test Amazon S3 connection ([96164da](https://github.com/OptimistikSAS/OIBus/commit/96164dad7a75b05c2d7b49da4ed42125fd6bd97d))
* **north:** Test Azure Blob connection ([5cfb61d](https://github.com/OptimistikSAS/OIBus/commit/5cfb61d73ac36fa7feea184b1b57653b43e96a49))
* **north:** Use interfaces to force proper method implementations ([e94ee0a](https://github.com/OptimistikSAS/OIBus/commit/e94ee0a7488db8b5b237db931fc40acb97ca4b18))
* **odbc:** Add ODBC connection test ([a7dc26e](https://github.com/OptimistikSAS/OIBus/commit/a7dc26ef682d42a4180e4d0ddd8265f29abe39e3))
* **odbc:** Add remote agent option in ODBC south connector and replace params by connection string ([5a8f151](https://github.com/OptimistikSAS/OIBus/commit/5a8f1517ebf789b3ceb3beb2ae58b6e79a0218b0))
* **opchda:** Add OPCHDA connection test ([44a6aff](https://github.com/OptimistikSAS/OIBus/commit/44a6aff93a1ba8d60a1d3e25bfc2e15a701661b4))
* **opchda:** Connect to OIBus agent for OPCHDA read ([f3feab3](https://github.com/OptimistikSAS/OIBus/commit/f3feab31077b3d08e6677930bbfce84136cda992))
* **opcua-da:** Add OPCUA-DA connection test ([cbb95a0](https://github.com/OptimistikSAS/OIBus/commit/cbb95a086239e2cae8325276d322e58ad599834a))
* **opcua-ha:** Add OPCUA-HA connection test ([7569430](https://github.com/OptimistikSAS/OIBus/commit/75694300e2dae6bdf793743c1c14ad739891278b))
* **opcua-ha:** Fix values push ([43a34a6](https://github.com/OptimistikSAS/OIBus/commit/43a34a69648149dd16d82564d45f6bf963251f7f))
* **opcua:** Manage aggregates, resampling (HA) and subscription (DA) ([d58099d](https://github.com/OptimistikSAS/OIBus/commit/d58099d222ef23f67ac53513b2b76bac10bb7013))
* **opcua:** Merge OPCUA DA and HA mode into a single connector ([2a1ef26](https://github.com/OptimistikSAS/OIBus/commit/2a1ef26abdc5069d7f8eedbfa190ce5945706389))
* **opcua:** opcua da connector ([5ab38c8](https://github.com/OptimistikSAS/OIBus/commit/5ab38c8b04224a0cbcd2e06eef139bce76a00f0b))
* **oracle:** Add Oracle connection test ([705aa53](https://github.com/OptimistikSAS/OIBus/commit/705aa532a43c8b3523a426318aa658ba990c3535))
* **oracle:** Fix library import ([8f92bc4](https://github.com/OptimistikSAS/OIBus/commit/8f92bc44e89ca9301144d697a352764b188067aa))
* **postgresql:** Add PostgreSQL connection test ([c394669](https://github.com/OptimistikSAS/OIBus/commit/c3946694e38b1ae134a585e41d3adf64a9ee7aaf))
* **proxy:** add a proxy list component and retrieve created proxy entity at creation ([0edecb3](https://github.com/OptimistikSAS/OIBus/commit/0edecb360737d24ade605426f829bb397c6e12d5))
* **proxy:** CRUD frontend operations for proxy with modal ([f793a3f](https://github.com/OptimistikSAS/OIBus/commit/f793a3faa6befaff9c96d2daf8229411c3f82fe3))
* Remove deprecated connectors from lists ([e57d17e](https://github.com/OptimistikSAS/OIBus/commit/e57d17e617b36e0c8ef052741b6e1ab199c063bb))
* **scheduler:** create scheduler ([626d6d2](https://github.com/OptimistikSAS/OIBus/commit/626d6d256be58e821fac359cda97f5f3bbe4b99c))
* **setup:** Update OIBus setup for Linux platform ([0d2e4d7](https://github.com/OptimistikSAS/OIBus/commit/0d2e4d7fb6fe785d816453df101dc417f9011d43))
* **setup:** Update windows install and add bat scripts ([6e50077](https://github.com/OptimistikSAS/OIBus/commit/6e500779423d2f7f62d99888281512f5da7bbbbc))
* **south-ads:** Migrate South ADS connector into typescript connector ([a9e9610](https://github.com/OptimistikSAS/OIBus/commit/a9e96108fefd6e19007b63a0ba0605261dbafd8f))
* **south-ads:** Test connection ([a9a204e](https://github.com/OptimistikSAS/OIBus/commit/a9a204ebb964b3cab7e79dbdbe9d66ada5a1ae27))
* **south-modbus:** Migrate South Modbus connector into typescript connector ([0c6ac98](https://github.com/OptimistikSAS/OIBus/commit/0c6ac98fbad3779e4cbce3a217b2bc3b04acbadd))
* **south-mqtt:** Migrate South MQTT connector into typescript connector and fix subscriptions ([0d10d2a](https://github.com/OptimistikSAS/OIBus/commit/0d10d2a9ae0e1fba01561c13e75c688b972e876b))
* **south-oiconnect:** Migrate South Rest connector into South OIConnect typescript connector ([af4a238](https://github.com/OptimistikSAS/OIBus/commit/af4a238d59a1e83d99ad12c7676c3cc9b4b2a407))
* **south-opchda:** Migrate South OPCHDA connector into typescript connector ([06dc719](https://github.com/OptimistikSAS/OIBus/commit/06dc719d016701767e54aaa425155322895d1c20))
* **south-sql:** Migrate odbc driver and fix item/connector settings ([837be2d](https://github.com/OptimistikSAS/OIBus/commit/837be2df437bf22097bbc90a6897c245e310c800))
* **south-sql:** Migrate South SQL connector into typescript connector ([14f5bd6](https://github.com/OptimistikSAS/OIBus/commit/14f5bd650d6c77c797ce2e4a2722e694ddd8adca))
* **south+north:** Check interface implementation instead of manifest configuration ([376ca5f](https://github.com/OptimistikSAS/OIBus/commit/376ca5f62f45185c9273c722103f63185df09c69))
* **south:** Adapt OIConnect to serialization item manifest ([398c2ea](https://github.com/OptimistikSAS/OIBus/commit/398c2ea0e0cd21d5f70dc2c1663b10dad0a5250a))
* **south:** add a local south cache for max instant and interval id when querying history in chunk intervals ([a74b90f](https://github.com/OptimistikSAS/OIBus/commit/a74b90fecce705fe664f07e8f5afbabc194406f2))
* **south:** Add a max instant per item field on south form ([152cfc6](https://github.com/OptimistikSAS/OIBus/commit/152cfc6ddf30da5c231c3178bbc5243b59cd58dd))
* **south:** Add ADS structure filtering ([7c89148](https://github.com/OptimistikSAS/OIBus/commit/7c89148a8df2a5242c0b1357be6e3d6ae52229ed))
* **south:** Add proxy for slims south connector ([cd2f9d6](https://github.com/OptimistikSAS/OIBus/commit/cd2f9d6ce6ff98f55bbd38b6a045ef6b9870bb2f))
* **south:** Add south item duplicate feature ([ca035e7](https://github.com/OptimistikSAS/OIBus/commit/ca035e7ea0f616530804fcad001033c32565ba03))
* **south:** Add South test connection button ([bf29db8](https://github.com/OptimistikSAS/OIBus/commit/bf29db8c95f293925b1be73f9c994ff0e73398e3))
* **south:** Add testConnection method to SouthConnector class and subclasses ([e32836f](https://github.com/OptimistikSAS/OIBus/commit/e32836fd5fbbaad18f2d2937a216ef8e28bf2a27))
* **south:** create and edit south connectors ([e6c762b](https://github.com/OptimistikSAS/OIBus/commit/e6c762bcff4cb19b6471238bf87b034e7b6fe549))
* **south:** create backend endpoint and repository for generic south connector ([c95f95f](https://github.com/OptimistikSAS/OIBus/commit/c95f95f9f836fa7f9c14e052bfe615d4296b71fc))
* **south:** Create OibSerialization form component ([5802a91](https://github.com/OptimistikSAS/OIBus/commit/5802a910e108c2250c681df3dd8e7a11f948efdb))
* **south:** Create serialization builder with serialization types ([f256c85](https://github.com/OptimistikSAS/OIBus/commit/f256c85a0e28cf9bc6d1f929eadc42c310a58b92))
* **south:** Delete all south items ([78b4709](https://github.com/OptimistikSAS/OIBus/commit/78b4709bd7a2e805415524a9c820a532f3b07d8d))
* **south:** Display South connector metrics ([1638f2e](https://github.com/OptimistikSAS/OIBus/commit/1638f2e4abf5f403ecd0b6af9d235339f79f0933))
* **south:** Import and export south items with CSV ([58c9647](https://github.com/OptimistikSAS/OIBus/commit/58c96474548e787168bcaf49d74b5591e0400c91))
* **south:** Instantiate connector to test it (and remove static method) ([17815fd](https://github.com/OptimistikSAS/OIBus/commit/17815fd128eb192bbec4904b787d0c50b7e71e02))
* **south:** manage MQTT payloads ([89d97d2](https://github.com/OptimistikSAS/OIBus/commit/89d97d28a2a91cdfd85e4959dcc1613d1322cc68))
* **south:** manage south items ([2c13b87](https://github.com/OptimistikSAS/OIBus/commit/2c13b87380474ce672768b734e9ae55e53afcb82))
* **south:** south items repository ([de6819c](https://github.com/OptimistikSAS/OIBus/commit/de6819c3428c238a0bf433c625005d7f87e40feb))
* **south:** Split south oiconnect into south-oianalytics and south-slims ([dbc6b98](https://github.com/OptimistikSAS/OIBus/commit/dbc6b9823cc0509b1ea48ede55ea40f57eddce08))
* **south:** Test OIAnalytics connection ([17888f7](https://github.com/OptimistikSAS/OIBus/commit/17888f7ada97c1552cdf4e9a5cc541fafc243cf0))
* **south:** Test SLIMS connection ([42dc731](https://github.com/OptimistikSAS/OIBus/commit/42dc731ec1974d3f36220711e1291de2bac8a8f9))
* **south:** Use interface to force proper method implementations ([6886aff](https://github.com/OptimistikSAS/OIBus/commit/6886aff0309e014809e62629aa0e5cc96d829963))
* **south:** Use OibSerialization component for datetime reference ([7040a8b](https://github.com/OptimistikSAS/OIBus/commit/7040a8b5456b18d0f1812947129b940663c1846b))
* **sql:** Add frontend field for datetime format ([b9f093e](https://github.com/OptimistikSAS/OIBus/commit/b9f093ef3b39d363f8f21438c0caa0c4c727d87d))
* **sql:** Convert DateTime with timezone, format and locale ([96208cc](https://github.com/OptimistikSAS/OIBus/commit/96208cc0322188eeecfed9b9d89975c568cd63b6))
* **sqlite:** Add SQLite connection test ([9a6eb3d](https://github.com/OptimistikSAS/OIBus/commit/9a6eb3d1959b33823e8dee2aba66c0f5fcd03cda))
* start implementing knex migration ([598f59a](https://github.com/OptimistikSAS/OIBus/commit/598f59a9b3b8feb537869a6253e84f9677345afb))
* **subscriptions:** Add subscriptions and external subscriptions tables with knex ([72a2fda](https://github.com/OptimistikSAS/OIBus/commit/72a2fdae0985017ed2e1d143d40199a003f39885))
* **subscription:** South subscription in North ([b73bca0](https://github.com/OptimistikSAS/OIBus/commit/b73bca06db6258deb9ff39f3599189a5bffde2a3))
* **tests:** add typescript tests for backend repositories ([9d4c255](https://github.com/OptimistikSAS/OIBus/commit/9d4c2553c6588c9c465f6c1a3b601a6484162311))
* **timezone:** Add UTC timezone and format datetime on the frontend according to the user timezone ([915ce27](https://github.com/OptimistikSAS/OIBus/commit/915ce27f68d962a317fe9ba962a564b752ff0df1))
* **ui:** Add History query metrics ([25c0aa8](https://github.com/OptimistikSAS/OIBus/commit/25c0aa8c23c0ae0483a360328d3e69a6721d29cf))
* **ui:** create new oib-auth and oib-proxy components ([f54a386](https://github.com/OptimistikSAS/OIBus/commit/f54a3863c16343d96e2159a96886f78c134d15a6))
* **ui:** created ui component for archived files inside explore-cache ([053be6b](https://github.com/OptimistikSAS/OIBus/commit/053be6b0ea55e84967ebfb37fbda163c8375b333))
* **users:** manage user authentication and guards in frontend ([1ea756f](https://github.com/OptimistikSAS/OIBus/commit/1ea756fa2a7b4dc61d405a444175aed560bcbf91))
* **users:** manage user in config database and rework user authentication ([c1c453d](https://github.com/OptimistikSAS/OIBus/commit/c1c453de0c22ea23cbe62dd5acb68a39012202df))
* **user:** Update user settings and change password page ([c207c2c](https://github.com/OptimistikSAS/OIBus/commit/c207c2c2074d9090f6f5e5d5445bd34e3e8ed8a2))
* **version:** Retrieve version from backend in navbar ([130b09e](https://github.com/OptimistikSAS/OIBus/commit/130b09ecc15764c0caa938646e42be8afedd4b6e))
* **web-server:** Accept 0/1 as boolean ([f3a2f63](https://github.com/OptimistikSAS/OIBus/commit/f3a2f6331b32bbdc015a0beef898dad8d84ee1ad))
* **web-server:** Controller tests ([563326f](https://github.com/OptimistikSAS/OIBus/commit/563326f50d817d36d195b02cee3b498af569ca0a))
* **web-server:** external source + proxy validator ([98e172e](https://github.com/OptimistikSAS/OIBus/commit/98e172e630b604eaa1fae567900bb6c9ac5985bc))
* **web-server:** Inject a ValidatorInterface into the controller's constructor ([120d860](https://github.com/OptimistikSAS/OIBus/commit/120d860546810bff5e40c49d3d58010b06fb8ce7))
* **web-server:** Refactor schema import in IpFilterValidator ([e410f4b](https://github.com/OptimistikSAS/OIBus/commit/e410f4bc0a8fb79d52faed988a998a3c8ac0c2e0))
* **web-server:** Refactor using validators ([2610389](https://github.com/OptimistikSAS/OIBus/commit/261038955a488f24c60dd6aa70d855b650dff8d6))
* **web-server:** Scan mode validator + small refactor ([ba592a4](https://github.com/OptimistikSAS/OIBus/commit/ba592a4b3c0d4ce467184f3bc5d9a60ede12e7a1))
* **web-server:** Test IpFilterValidator without mocking Joi ([8902692](https://github.com/OptimistikSAS/OIBus/commit/89026923738c5b366b9c39a3bba9873c5dadb9ad))
* **web-server:** Unit test for IpFilterValidator ([dfbe049](https://github.com/OptimistikSAS/OIBus/commit/dfbe049f8c614c86d78638f3d693d087133e9d6d))
* **web-server:** Unit test for joi validator ([8147bba](https://github.com/OptimistikSAS/OIBus/commit/8147bba4c03ceecc632938c3db8f2e83eca942fb))
* **web-server:** Validate engine parameters ([c8b4c12](https://github.com/OptimistikSAS/OIBus/commit/c8b4c1237c176f8a1b3a048cf944321e0fd5e973))
* **web-server:** Validate north/south ([50064aa](https://github.com/OptimistikSAS/OIBus/commit/50064aabe3f89b534d16726f5d36b29e32fcb2de))
* **web-server:** Validate north/south based on manifest file settings ([e4cba50](https://github.com/OptimistikSAS/OIBus/commit/e4cba5054372dfe79081e3179cc47b74018de6ab))
* **web-server:** Validate payload for IP filters ([4d9f06f](https://github.com/OptimistikSAS/OIBus/commit/4d9f06f6881cb34cbe277aba78e52f4d0368fc1e))
* **web-server:** Validation rules for north/south ([b911a0c](https://github.com/OptimistikSAS/OIBus/commit/b911a0cdb1ae4f93fbd330c90d8d085c0708e145))
* **web-server:** Validator tests ([ffeb5cc](https://github.com/OptimistikSAS/OIBus/commit/ffeb5cc94c3ba2fbaca60e56a935b5e2ff2136fb))
* **web:** Improve home page design ([4b4a306](https://github.com/OptimistikSAS/OIBus/commit/4b4a3068facf50f7ebe411d4d017c525230e8598))


### Bug Fixes

* Adapt form settings display ([d327f0c](https://github.com/OptimistikSAS/OIBus/commit/d327f0cace45ebc89c109d5cb4d36d129f427d76))
* Add ts-ignore flag for dynamic sql library loading ([351b571](https://github.com/OptimistikSAS/OIBus/commit/351b5710cec8f4d8e8f351f936619b6417cc4caf))
* add type safety to connectors ([bc86038](https://github.com/OptimistikSAS/OIBus/commit/bc86038bc16307fb45875c04191fa2eefd77490c))
* adjust north azure blob ([4175ad3](https://github.com/OptimistikSAS/OIBus/commit/4175ad3525032e51d63554656ee2f7026775faeb))
* adjust the way the model is generated with regard to optional fields ([1043dcc](https://github.com/OptimistikSAS/OIBus/commit/1043dcc6413a25221b5cbd41a1d73550ff20a80c))
* **ads:** Fix ADS display settings ([20fb8d8](https://github.com/OptimistikSAS/OIBus/commit/20fb8d8c0dec220913793f510686f1b9b80adde0))
* **ads:** Improve ADS connector tests ([e6135b7](https://github.com/OptimistikSAS/OIBus/commit/e6135b70f77cb009fe4640f946e26f36f80ed611))
* **ads:** Update ADS labels in manifest ([bbba8f5](https://github.com/OptimistikSAS/OIBus/commit/bbba8f5d3344bf2434b690033a603d70df44fe9d))
* Allow empty secret for connector updates ([74753f8](https://github.com/OptimistikSAS/OIBus/commit/74753f83112b2652635db56991597e4de4eda8b2))
* **cache:** Avoid multiple asynchronous call of value flush method ([5500843](https://github.com/OptimistikSAS/OIBus/commit/55008438b5e6b1000405562a8652572badcce17d))
* **cache:** fix after rebase and replace timeout by maxSize in cache ([d13ad3a](https://github.com/OptimistikSAS/OIBus/commit/d13ad3a7085f7589164b645bfbb24dde5a2a8409))
* **cache:** fix after rebase and replace timeout by maxSize in cache ([d233063](https://github.com/OptimistikSAS/OIBus/commit/d233063591e26d269b9e50aef7427e9da90b7d1b))
* **cache:** Fix remove south cache rows on south or item delete ([e2b3f3b](https://github.com/OptimistikSAS/OIBus/commit/e2b3f3b257e3803592ca095f1a229e59b8048cbd))
* **cache:** Update cache on scan mode or max instant per item change ([562243a](https://github.com/OptimistikSAS/OIBus/commit/562243af35182fe32c231aa64a1dc0fa7e5b571b))
* **chore:** create log folder at startup ([18b2503](https://github.com/OptimistikSAS/OIBus/commit/18b25036c5c0991829e4235a077b48033309f184))
* **ci:** adapt CI to linux arm64 ([6771323](https://github.com/OptimistikSAS/OIBus/commit/677132372da10cddaf3ccc9a12d8c79cdd33a35b))
* **ci:** Fix release yaml ci ([3114647](https://github.com/OptimistikSAS/OIBus/commit/311464769673df829d374212a62ea93b128a8ecc))
* **ci:** install shared dependencies ([3d9b50f](https://github.com/OptimistikSAS/OIBus/commit/3d9b50f7eb2afb9895c3a2371c90b26ba11e710d))
* **config:** Manage back navigation when canceling edition ([ce3e477](https://github.com/OptimistikSAS/OIBus/commit/ce3e477b6485f6ca77a47f82899c45c58f0ab4d5))
* **connector:** Fix encryption of array fields ([c5f1a04](https://github.com/OptimistikSAS/OIBus/commit/c5f1a0405463efbf1674b2cf1848e68e8ad869bd))
* **connector:** Fix start and stop connector reload ([a657c4d](https://github.com/OptimistikSAS/OIBus/commit/a657c4d334fddd0be8c7283c0306081dac963e04))
* **connectors:** Fix use of proxy in north and south connectors ([f5083d9](https://github.com/OptimistikSAS/OIBus/commit/f5083d90799309586d1d53a56d2f621449bf7288))
* **deps:** adapt tests with joi schema in manifests ([459d1c7](https://github.com/OptimistikSAS/OIBus/commit/459d1c70afb29b610a23a5d8cc671942e86dc853))
* **deps:** allowSyntheticDefaultImports to tru for shared models ([a6ae6db](https://github.com/OptimistikSAS/OIBus/commit/a6ae6db473404898c768f975051eebcf23539bd0))
* **deps:** specific joi deps ([6662512](https://github.com/OptimistikSAS/OIBus/commit/6662512df9b75787f2871da2865dfc4c873db61e))
* **doc:** Adapt README.md to OIBus v3 ([4703436](https://github.com/OptimistikSAS/OIBus/commit/470343690d9602ffd752dbefc307dba1ea75bb56))
* **documentation:** Fix broken links (linux download) and dev command ([8f1632d](https://github.com/OptimistikSAS/OIBus/commit/8f1632d08e260ac33564714df8852919230b81e2))
* **encryption:** switch to AES encryption of secrets and mutualize OIBus cert ; each OPCUA south has its cert folder in its cache ([0ba6867](https://github.com/OptimistikSAS/OIBus/commit/0ba6867cd2825e8881a7aeb771785daec2f2b41d))
* **engine-settings:** adjust required fields and add units ([0caddea](https://github.com/OptimistikSAS/OIBus/commit/0caddeaa20864460dfe27d46d635bdfe3913d98c))
* **engine:** adapt metrics initialisation ([22f03f0](https://github.com/OptimistikSAS/OIBus/commit/22f03f04a4ae04870bf13c75ae8e944acc1c32ba))
* **engine:** Bad request if external source is not found ([90526ba](https://github.com/OptimistikSAS/OIBus/commit/90526baaa796f37271ec3087ddb5fc7dc606567a))
* **engine:** Fix passing settings object only to testConnection method ([7381f34](https://github.com/OptimistikSAS/OIBus/commit/7381f349fb889a81c1d2bcc8eb196ca6dde38b17))
* **engine:** Fix remove cache folder when deleting connectors ([1a3cf56](https://github.com/OptimistikSAS/OIBus/commit/1a3cf56882d75ffaef8bf2f695ec4664a8b6c3e3))
* **engine:** Stop history engine before web server ([2a2b6be](https://github.com/OptimistikSAS/OIBus/commit/2a2b6be7b180b4bd8aa35be3bb67a984fa2f477a))
* **file-cache:** retry error files queue update ([5558306](https://github.com/OptimistikSAS/OIBus/commit/55583062bc2f36ead0351dbdc9f07e369d5885cb))
* Fix code refactor lint and tests ([415c0cc](https://github.com/OptimistikSAS/OIBus/commit/415c0cc6c85d8c009cf38d4673edf962c36b48ae))
* Fix fetch connection when host ends with / ([4b6a815](https://github.com/OptimistikSAS/OIBus/commit/4b6a8150315472465b07cd32f28ee556a9dfc401))
* Fix UI feedback when testing connector connection from creation ([6760f71](https://github.com/OptimistikSAS/OIBus/commit/6760f715ab28870d66d047131b97ada1484fd872))
* **folder-scanner:** Compress file locally instead of input folder ([05dde39](https://github.com/OptimistikSAS/OIBus/commit/05dde3997c3bb86218347e946cb6b1336945160b))
* **folder-scanner:** fix schema and preserve file ([d5b0fe2](https://github.com/OptimistikSAS/OIBus/commit/d5b0fe2344900d51a78f9193acd5b16440af9833))
* **form:** Adapt form input creation to include condition on OIbAuthentication ([7ccfdd3](https://github.com/OptimistikSAS/OIBus/commit/7ccfdd360aeb96b7c10c9414664d1fd3946cd2ba))
* **form:** Adapt form input creation to include condition on OIbAuthentication ([e0a2f12](https://github.com/OptimistikSAS/OIBus/commit/e0a2f12bbb78284b917714b97a3c9600d994ff62))
* **form:** do not recreate array to avoid recreating the whole component ([deb0e55](https://github.com/OptimistikSAS/OIBus/commit/deb0e55c1518c09aa24c254a748417278a25aebc))
* **form:** Fix form update within form groups ([9836058](https://github.com/OptimistikSAS/OIBus/commit/98360581b644a91004357b734439e6648a5c2f64))
* **forms:** simplify form components and fix validation ([3969b43](https://github.com/OptimistikSAS/OIBus/commit/3969b4353c1739e25509eb0fbc1fee7a0ab15d5f))
* **frontend:** Fix datetimepicker format value ([397553e](https://github.com/OptimistikSAS/OIBus/commit/397553e27cbcc65a618582da71a0e7d5507bda0e))
* **history-query:** delete all items on connector/history deletion ([faa315d](https://github.com/OptimistikSAS/OIBus/commit/faa315d741d40abcba768d50ad49632e8073be7e))
* **history-query:** Fix creation form fill ([d8d0e7b](https://github.com/OptimistikSAS/OIBus/commit/d8d0e7bdd10ea857ebecbd190863d55120ba2171))
* **history-query:** Fix history query creation step by sending items at creation ([9b7c041](https://github.com/OptimistikSAS/OIBus/commit/9b7c041dcce8b36f787f2b2ac72d106d5c619e90))
* **history-query:** Fix remove cache folder when deleting history query ([a0c3541](https://github.com/OptimistikSAS/OIBus/commit/a0c3541d36d42a022594d34dde78dd12fa68ad57))
* **history-query:** manage encryption of secrets and filtering secrets when sending history queries to frontend ([0fc3aa9](https://github.com/OptimistikSAS/OIBus/commit/0fc3aa9aed0de2fb5433d4e9cde3630a17a9c295))
* **home:** Fix home SSE ([ebb28f9](https://github.com/OptimistikSAS/OIBus/commit/ebb28f903b2752d32441f26bb1d70735b0b2e116))
* **home:** Fix metrics display links ([be09b18](https://github.com/OptimistikSAS/OIBus/commit/be09b18859505efdac6fa1e0f48f797ddabe6c6d))
* **home:** Fix navigation from home component with ngZone ([ad7eb9f](https://github.com/OptimistikSAS/OIBus/commit/ad7eb9f7806beef999f332dd17e94c47553f10a3))
* **items:** Do not enable item of disabled connectors ([6691a62](https://github.com/OptimistikSAS/OIBus/commit/6691a62bbc1e8124c530ce66cfa7896f4818e84b))
* **items:** Edit South items in memory on the frontend ([7830ee1](https://github.com/OptimistikSAS/OIBus/commit/7830ee156902c497b3ea77b3acddaed5cb4ac060))
* **items:** Manage edit with items command backend ([5be44f8](https://github.com/OptimistikSAS/OIBus/commit/5be44f82f52a79d0bd7679e2a9fb0b3d84ff30bf))
* **linux:** adapt install and uninstall scripts ([27375af](https://github.com/OptimistikSAS/OIBus/commit/27375af66af039c3ffa12a205ed10e3191b1ef13))
* **list:** Update list properly after south/north/history removal ([575205a](https://github.com/OptimistikSAS/OIBus/commit/575205a1d1b172633c3e790b92000f64932369df))
* **logger:** Fix log db filename ([19c2e08](https://github.com/OptimistikSAS/OIBus/commit/19c2e085d496628d90c02fe9e21c52cfdcd0296e))
* **logger:** Keep loki password secret ([b8df8ff](https://github.com/OptimistikSAS/OIBus/commit/b8df8ffe08c727be90ffaba9c02f067a30015d57))
* **logger:** Move delete log by scope method into repository ([d151661](https://github.com/OptimistikSAS/OIBus/commit/d1516612b3563950a6b8a1334def3594d881dcf0))
* **logger:** Switch to LogController Class and create log schema ([7652ca8](https://github.com/OptimistikSAS/OIBus/commit/7652ca8cbeb502a289718cb3976d467e0f9454b6))
* **logger:** Update cache services logger in North connector ([2fb4864](https://github.com/OptimistikSAS/OIBus/commit/2fb4864d90ba085dd0d56119888c2b0b8e39bd21))
* **logs:** adapt table style and move message content to the left ([e11abc9](https://github.com/OptimistikSAS/OIBus/commit/e11abc9bbe5457bef899ff41dd42665ecda12806))
* **logs:** Fix remove logs on south, north and history delete ([4646e05](https://github.com/OptimistikSAS/OIBus/commit/4646e058433a15ddd41fc9b14241a864de388426))
* **logs:** Remove console log ([42d29c7](https://github.com/OptimistikSAS/OIBus/commit/42d29c72bb5815a4a07320505805c292f63de95a))
* **logs:** Search logs with scope and message fix ([6f326a8](https://github.com/OptimistikSAS/OIBus/commit/6f326a8cba5790884b1471e6d73fc126683856e8))
* **metrics:** Remove metrics on north and south delete ([b7744e4](https://github.com/OptimistikSAS/OIBus/commit/b7744e4fef917ef7aee8f6edf6ab161258c01ac8))
* **migration:** fix cache db with undefined foreign keys ([d9c1bbf](https://github.com/OptimistikSAS/OIBus/commit/d9c1bbf9d03d6ebd2462a622cb39a9cea1eb3f4d))
* **migration:** Fix item uniqueness and log database filename ([7c9e9f2](https://github.com/OptimistikSAS/OIBus/commit/7c9e9f292807a7e29a56a9bc35091bbee40ce0a3))
* **migration:** Remove ID for subscriptions and external subscriptions ([fadd879](https://github.com/OptimistikSAS/OIBus/commit/fadd879e63248f1fdc263b978cc1f3edbc828bca))
* **modbus:** Improve Modbus connector tests ([9c5bb6e](https://github.com/OptimistikSAS/OIBus/commit/9c5bb6ed1826f61f4131b4f148a1dfa834deb725))
* **modbus:** Update modbus item manifest ([c9b5719](https://github.com/OptimistikSAS/OIBus/commit/c9b5719d21fb97b9071b0867d64c031bb7260bb7))
* **mqtt:** Fix MQTT connection with cert auth ([c8f9c9c](https://github.com/OptimistikSAS/OIBus/commit/c8f9c9c382186dab74a5823d21ac93b2a53a7eb0))
* **north-oia:** adjust fields default and layout ([ac74ae9](https://github.com/OptimistikSAS/OIBus/commit/ac74ae99f53ea4b8392696009ac8702d1999cf30))
* **north-oiconnect:** Simplify North OIConnect authentication model ([bfe68c5](https://github.com/OptimistikSAS/OIBus/commit/bfe68c5171d6ea09031f52128ed39645850b58ee))
* **north:** Fix Azure Blob AAD authentication ([1902d31](https://github.com/OptimistikSAS/OIBus/commit/1902d318e68dd41fb675ee001908b34526e00943))
* **north:** Fix HTTP timeout of read stream when file does not exist ([d5ba373](https://github.com/OptimistikSAS/OIBus/commit/d5ba373492444373e3d937890cb3c9714668c404))
* **north:** Fix Maximum call stack size exceeded error in flush method ([0dfce83](https://github.com/OptimistikSAS/OIBus/commit/0dfce83d02ebacc4976ae7e8deb8802a23d1283d))
* **north:** Fix North cache congestion when adding several files ([8110d25](https://github.com/OptimistikSAS/OIBus/commit/8110d25fa692723193ae0cf4060f523ef2bc316d))
* **north:** fix north connector creation ([dc4ac9d](https://github.com/OptimistikSAS/OIBus/commit/dc4ac9d23c5a1e13d1faa39c4a06fc218cce2525))
* **north:** Migrate caches file endpoints into typescript ([a5cfcf2](https://github.com/OptimistikSAS/OIBus/commit/a5cfcf206cb46ac3893a3992e95abcf507e5f3bb))
* **north:** Rename North oiconnect into oibus ([cba3420](https://github.com/OptimistikSAS/OIBus/commit/cba342076a0a9951d3bcf0fd78fdae3cf920d125))
* **odbc:** Fix ODBC connection lost ([6c405a3](https://github.com/OptimistikSAS/OIBus/commit/6c405a3af56bdce5f4cbe57df00f441defa2ec03))
* **oianalytics:** Manage more HTTP error codes to retry data sends ([feb8f5c](https://github.com/OptimistikSAS/OIBus/commit/feb8f5c728838b12d6804daa1f26a58653c309d5))
* **opchda:** Fix disconnect deadlock when stopping connector ([554a36f](https://github.com/OptimistikSAS/OIBus/commit/554a36f2054b1e6bb7e26d4f3c718ea5f5bd09af))
* **opchda:** Fix init message and unit tests ([a3478d3](https://github.com/OptimistikSAS/OIBus/commit/a3478d3bcd6bc14ffdd7b0b6b34a190b2b6e94f4))
* **opchda:** remove unused connection timeout ([c05406a](https://github.com/OptimistikSAS/OIBus/commit/c05406a6282bb90b9c6293d13e462efacdc947f8))
* **opcua:** Properly stop connector ([a7eef11](https://github.com/OptimistikSAS/OIBus/commit/a7eef11d6477ba83e8abe4e656042004e4a4b441))
* proxy errors in tests ([470053e](https://github.com/OptimistikSAS/OIBus/commit/470053e01807ba735195192a6ead39a60cb75000))
* **proxy:** remove proxyId of joi schema ([1602692](https://github.com/OptimistikSAS/OIBus/commit/16026921dcb98f918142d606b2845360e75b6ed5))
* remove proxy entity ([7813fc3](https://github.com/OptimistikSAS/OIBus/commit/7813fc36625fda1c0a9c18d64e2cdefa19e18614))
* remove unused method ([051c2cb](https://github.com/OptimistikSAS/OIBus/commit/051c2cba5d78eb89758e817c3fe869f08e4b84b4))
* **scan-mode:** Fix remove south cache rows on scan mode delete ([51d5327](https://github.com/OptimistikSAS/OIBus/commit/51d5327041a2ea480819b76207dae0b6f045ddc8))
* **setup:** Add windows scripts in zip ([095ad2f](https://github.com/OptimistikSAS/OIBus/commit/095ad2f4aac5818f75b81348f5606c367aea1453))
* **south-cache:** Add tests for deletion methods ([33ef762](https://github.com/OptimistikSAS/OIBus/commit/33ef762c50b0667228066126767d5c425d69e640))
* **south-modbus:** Fix Modbus client creation ([c192506](https://github.com/OptimistikSAS/OIBus/commit/c192506be76f754991763b35ae2180e5a09d50fd))
* **south-sql:** Fix updated max instant ([3e644d1](https://github.com/OptimistikSAS/OIBus/commit/3e644d1e55d7eb2a08ea6aa99415a7fb371bf2ab))
* **south:** Add a forceMaxInstantPerItem field in manifest for some connectors ([64fb96a](https://github.com/OptimistikSAS/OIBus/commit/64fb96aebe32c19f41246aad69a02304211faa9d))
* **south:** Add an output datetime format section in sql items ([6f561b6](https://github.com/OptimistikSAS/OIBus/commit/6f561b68f86ba3f8946978169d16951586d50072))
* **south:** Add connector specific date object types ([b9098d1](https://github.com/OptimistikSAS/OIBus/commit/b9098d16b622573c1abd2a3954257d4db77970ef))
* **south:** Created abstract class with static testConnection method ([8aabae0](https://github.com/OptimistikSAS/OIBus/commit/8aabae03908d065f2cd4f8cbfe203abb346861b2))
* **south:** Disable toggle on South edit page and enable/disable from item edition ([20773c4](https://github.com/OptimistikSAS/OIBus/commit/20773c4b7daf54ed51c003d9e6967ce26689b238))
* **south:** Fix convertDateTimeToInstant in sql connectors ([35f03fb](https://github.com/OptimistikSAS/OIBus/commit/35f03fb149bdba59ff887db457c2e034a213c8e9))
* **south:** Fix font loading and fix monaco editor form ([aecf2a0](https://github.com/OptimistikSAS/OIBus/commit/aecf2a00b319d8e5f35a937e137fb47210b24ea3))
* **south:** Fix ODBC and Oracle library loading when client not installed ([ef4fe47](https://github.com/OptimistikSAS/OIBus/commit/ef4fe4784fbcf57d39bd41559495bb7289952c0e))
* **south:** Fix search south items ([e526194](https://github.com/OptimistikSAS/OIBus/commit/e5261941f050594416be81539bb78c3f7c751480))
* **south:** Fixed south test connection unit tests ([97403b1](https://github.com/OptimistikSAS/OIBus/commit/97403b1b4b78ca7b1d394ef1c12e8b8cb1c6f6d6))
* **south:** Format oia and slims values into oibus values ([60defcf](https://github.com/OptimistikSAS/OIBus/commit/60defcfe8c5dc23f0c45d9c2d8d683c8d289ead1))
* **south:** Manage testing of connector with secrets ([19eb051](https://github.com/OptimistikSAS/OIBus/commit/19eb051b0c285c32d8304a39532b8549d1994428))
* **south:** Move some folder scanner settings into item settings ([3feccdc](https://github.com/OptimistikSAS/OIBus/commit/3feccdca9ee0cb85b61cd4ccc7f6e28e4e5d0db7))
* **south:** MQTT point ID from payload and array payloads ([27d9b15](https://github.com/OptimistikSAS/OIBus/commit/27d9b15f032f9b9a019807dcf2701b460ef08777))
* **south:** Remove TestConnection interface ([4891a3e](https://github.com/OptimistikSAS/OIBus/commit/4891a3e5f7ffcc85c09476035267eb7ad7340b79))
* **south:** SQL timeouts into items when possible ([74952e4](https://github.com/OptimistikSAS/OIBus/commit/74952e414ae909ab4fa76d0880b92b4d00891185))
* **south:** Test MQTT connection ([12890aa](https://github.com/OptimistikSAS/OIBus/commit/12890aaea62d8dd61862f9760fadc2b6c252e812))
* **south:** validate serialization form and payload ([cf1aef7](https://github.com/OptimistikSAS/OIBus/commit/cf1aef71252f1128deb0a6b3892b83ac9946a9e4))
* **south:** Validate uniqueness of item name ([b02bcbc](https://github.com/OptimistikSAS/OIBus/commit/b02bcbc3b9388cedccd59a528cc87bb864bb12d7))
* **sql:** Add connection timeout to Postgre options ([f713922](https://github.com/OptimistikSAS/OIBus/commit/f7139221a4212b5df520bc21136ee4f9953cd5e0))
* **sql:** Fix SQL connectors manifest and add unit tests ([22e110b](https://github.com/OptimistikSAS/OIBus/commit/22e110bd624928645fc97f0cae332355e74069bd))
* **sqlite:** Improve SQLite connection test ([613c107](https://github.com/OptimistikSAS/OIBus/commit/613c10768040d9c61989de8d67e0783378714551))
* **styles:** fix(styles):  ([d8232b5](https://github.com/OptimistikSAS/OIBus/commit/d8232b57c951655ec9879e0c5a4123545b5d6489))
* **styles:** add 'has-grey-container' to the list of delete classes ([2a09a08](https://github.com/OptimistikSAS/OIBus/commit/2a09a08d790365aa90f9031d6f64605b14482c36))
* **styles:** change of south/north/history-query icon ([f6e9cb9](https://github.com/OptimistikSAS/OIBus/commit/f6e9cb9bbbb111a88eb1892f77e1860b7726d8a9))
* **styles:** fix padding bug ([508982e](https://github.com/OptimistikSAS/OIBus/commit/508982e8bb8c6c19cf14a81cf1dbc862981fef28))
* **styles:** fix padding bug ([1bbbef0](https://github.com/OptimistikSAS/OIBus/commit/1bbbef06be6ef840c2234d27fb44f4400d2bab29))
* **styles:** Fix test on connector / history query lists ([664d162](https://github.com/OptimistikSAS/OIBus/commit/664d1624025a22f48987e56e7c29ba6e125d85b1))
* **styles:** history display items modal ([fdca24b](https://github.com/OptimistikSAS/OIBus/commit/fdca24b575cba014b9ef271049a1accdb3d00f78))
* **styles:** little ui and ux change ([64a8cc6](https://github.com/OptimistikSAS/OIBus/commit/64a8cc666c490482197b1ecb1aedb706236283b4))
* **styles:** New icon for title (engine/logs) ([46544ad](https://github.com/OptimistikSAS/OIBus/commit/46544adbec0120f0aece2f37c7a8717c1cfd62f0))
* **styles:** oib-array fix ([29f1eba](https://github.com/OptimistikSAS/OIBus/commit/29f1eba059438273005c2acb5b72cecec3080bbf))
* **styles:** Replace old checkbox by stylish checkbox and edit logs and engine icons ([f807909](https://github.com/OptimistikSAS/OIBus/commit/f8079094ef6c7fdf2edc76f21e8cf0aae7d6b62c))
* **styles:** Replace old table by oib-table ([186d53c](https://github.com/OptimistikSAS/OIBus/commit/186d53c8fcf0580303c8ed163f75bdf7d378108c))
* **styles:** resize column of logs ([ad32f74](https://github.com/OptimistikSAS/OIBus/commit/ad32f7490fabf3ee7eccdb94e6fadc221caec3dc))
* **styles:** south north history-query list rework ([823158e](https://github.com/OptimistikSAS/OIBus/commit/823158e6836759e411d5c050980ecf309af0a749))
* **tests:** adapt test after rebase ([9a1fb4d](https://github.com/OptimistikSAS/OIBus/commit/9a1fb4d1b072f4e5a4b8cf5c5c806ba1bc90dd5b))
* typo ([bbbd9a3](https://github.com/OptimistikSAS/OIBus/commit/bbbd9a33ad5289323ece5072b541fcc45f42cb75))
* typo in scan mode names ([1e7c1f3](https://github.com/OptimistikSAS/OIBus/commit/1e7c1f307fc80e7ef129d80fca110f2c2f9e6fcc))
* **ui:** Fix metrics display ([4592dd0](https://github.com/OptimistikSAS/OIBus/commit/4592dd072d72796ae928a3fc80739e31ad27050c))
* **ui:** Improve OIBus CSS ([2d255a2](https://github.com/OptimistikSAS/OIBus/commit/2d255a219d443aa76b83f99f1da4681760437215))
* **ui:** Split serialization and dateTimeFields form components ([c6236f5](https://github.com/OptimistikSAS/OIBus/commit/c6236f5a68abf73e6702c48a61e56264bbdb0ad8))
* **user-settings:** remove hr and adjust style in the edit user settings page ([81679fa](https://github.com/OptimistikSAS/OIBus/commit/81679fa7e98f09eb031f85bdec504fff939811cc))
* **user:** change password endpoint and switch to argon2id hash ([27898f8](https://github.com/OptimistikSAS/OIBus/commit/27898f8a8c3d293c9929cd7c17fb00ee426df12d))
* **user:** Fix user settings update routes ([2ec33bc](https://github.com/OptimistikSAS/OIBus/commit/2ec33bc79b3aedef535d14357b56d71e0491dd37))
* **validators:** Adapt validators after typescript and eslint rebase ([273177e](https://github.com/OptimistikSAS/OIBus/commit/273177e585bbc4b57378679bc902f66006de4d64))
* various other fixes ([0cb551b](https://github.com/OptimistikSAS/OIBus/commit/0cb551b177cb366aa453e53051fb5e47451b36a2))
* **web-client:** Fix archive and error files box ([a58a1a3](https://github.com/OptimistikSAS/OIBus/commit/a58a1a363034c51813a4ac40ca580b521c8fe278))
* **web-client:** Fix checkbox style ([36aa920](https://github.com/OptimistikSAS/OIBus/commit/36aa9201cfd2aa71b3e31d62f2ac060a70477e18))
* **web-server:** move validators ([21130aa](https://github.com/OptimistikSAS/OIBus/commit/21130aa687c14f738a58544c5fed2bc2f5e8d41f))
* **web-server:** Reorganize web server middlewares ([8707885](https://github.com/OptimistikSAS/OIBus/commit/8707885fd111c3302f14171e7acc5bdd22727ec3))
* **windows:** adapt install and uninstall scripts ([102fd51](https://github.com/OptimistikSAS/OIBus/commit/102fd517c4f6d9eb8a325c831b507b421e6224d0))


### Miscellaneous Chores

* release-please CI ([c5392c2](https://github.com/OptimistikSAS/OIBus/commit/c5392c2f0f9fa0903a94cb00a277d879f7e64d65))
