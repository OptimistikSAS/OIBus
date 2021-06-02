# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [1.2.0](https://github.com/OptimistikSAS/OIBus/compare/v1.1.0...v1.2.0) (2021-06-02)


### Features

* **columns:** column width percent can be determined from the schema.points ([ab2fb40](https://github.com/OptimistikSAS/OIBus/commit/ab2fb404370890e9364c2f8903921825eb7564e7))
* **engine:** Added safe mode status warning on navbar and overview screen. ([abb97a0](https://github.com/OptimistikSAS/OIBus/commit/abb97a02e58c2b1f9c5fbf4414916a38fd93ea63))
* **home-ui:** show blocks with node view ([4348fbb](https://github.com/OptimistikSAS/OIBus/commit/4348fbb217385f7f6d522c74ecd7f2a2e4ca19a4))
* **overview:** Safe mode status warning. ([94fb4db](https://github.com/OptimistikSAS/OIBus/commit/94fb4db98b43ad525d4cf64c73e7db08323da55c))
* **points:** added table help section on south points and removed help for individual rows ([e097a35](https://github.com/OptimistikSAS/OIBus/commit/e097a35a98b4f54be0a569168d881da32482c3af))
* **south-ads:** add south handler for ads protocol with limited settings ([c77dbf9](https://github.com/OptimistikSAS/OIBus/commit/c77dbf9392be5f21b887f61348b4ad633bac3ca7))
* **south-ads:** improve tests for ads ([d78382a](https://github.com/OptimistikSAS/OIBus/commit/d78382ad595740f27dc25d0ba8c489f2d3fdf78a))
* **south-ads:** manage different data types automatically and add an optional prefix in front of the pointID ([34d329e](https://github.com/OptimistikSAS/OIBus/commit/34d329ee434b49aa50d902830b09f0a4f2354ca7))
* **south-ads:** manage distant connections ([9ef6872](https://github.com/OptimistikSAS/OIBus/commit/9ef687208be82bf198c84cbb0f2f23e48885fc62))
* **south-ads:** structure filter ([7203c85](https://github.com/OptimistikSAS/OIBus/commit/7203c85f82873bb0b13d6b55f9bd70a4b03a711c))
* **south-folderScanner:** ignored modified time files of folder scanner when preserved ([43cc91d](https://github.com/OptimistikSAS/OIBus/commit/43cc91d4b934975a7ee7abf1aef5fb2e6ee232be))
* **south-live:** Changed live screen icon to “Status” button on protocol settings screen. ([7c666f6](https://github.com/OptimistikSAS/OIBus/commit/7c666f60af0d1d31df259f8e3b8f4a3954cd20cd))
* **south-live:** Removed Last completed At from Configure Protocol setting screen. Created a Live screen for live info for each Protocol. ([18260a6](https://github.com/OptimistikSAS/OIBus/commit/18260a6adc62e9378fbc455a530e81f54786f61a))
* **south-live:** Show points and lastCompletedAt related info ([6bb82ab](https://github.com/OptimistikSAS/OIBus/commit/6bb82ab4b7acf4045e58f194f1a6c411c6f98f4d))
* **south-live:** Update points related information on addValues() call ([69d9984](https://github.com/OptimistikSAS/OIBus/commit/69d9984adb706cad7a1de75450985298699c9185))
* **south-live:** Use onScanImplementation() ([3e431d7](https://github.com/OptimistikSAS/OIBus/commit/3e431d7e2d9c82f8dc8e3601f96e0f2224fed2e6))
* **south-live-stat:** Simple version for live stat ([33f7116](https://github.com/OptimistikSAS/OIBus/commit/33f7116d16c40bb7048c64c6639fcea2a3eca602))
* **south-modbus:** Add multiplier coefficient for retreived data ([ffe92de](https://github.com/OptimistikSAS/OIBus/commit/ffe92debe5bf0d6f101fc398290c77457e74f54c))
* **south-modbus:** Add possibility to do swapping operation ([5474675](https://github.com/OptimistikSAS/OIBus/commit/54746751d8de5ae80f2bfcf9193a9c43d46ee39f))
* **south-modbus:** Add possibility to specify endianness and reorganize UI for points configuration ([f0ccdc5](https://github.com/OptimistikSAS/OIBus/commit/f0ccdc58a8156e0b51780d2f0884a17548f9d9b5))
* **south-modbus:** Add possibility to specify the data type of a point. Integer or Decimal, Signed or Unsigned and on how many bits the value is stored ([ad6135c](https://github.com/OptimistikSAS/OIBus/commit/ad6135c30b065138bb675a0505bec38d8eb2fd7f))
* **south-modbus:** Added option to choose which slave id to use during modbus request ([08cc359](https://github.com/OptimistikSAS/OIBus/commit/08cc359d2cf338d8df182e0da4e730299dca589c))
* **south-modbus:** Added the possibility to define an offset address for all points ([eea65ed](https://github.com/OptimistikSAS/OIBus/commit/eea65ed16187164fd008019d249dcae551f460e0))
* **south-modbus:** Change addressOffset config field to display Modbus/Jbus instead of 0/-1 for better readability ([4d04ff9](https://github.com/OptimistikSAS/OIBus/commit/4d04ff919fc787c0d5888da28fb68cfe45fa1969))
* **south-modbus:** improve Modbus help ([6aab5fd](https://github.com/OptimistikSAS/OIBus/commit/6aab5fde1f85d0cacc65075d8e82a5cee28e47d2))
* **south-modbus:** manage reconnection and retry on connection failure ([2df4243](https://github.com/OptimistikSAS/OIBus/commit/2df42432c9e8e0fa3d42a04ec291f8083afbe37d))
* **south-modbus:** Use two different fields for modbus points: 1 for modbusType (Register) and the other for the point address in the register ([2096beb](https://github.com/OptimistikSAS/OIBus/commit/2096bebdcc39be7251afe6d87a40430e61d35d12))
* **south-sqldbtofile:** add sqlite driver for local sqlite db file ([189a8ec](https://github.com/OptimistikSAS/OIBus/commit/189a8ecaff2132334922015960ac79de00861ca6))
* **south-sqldbtofile:** changing settings depending on driver ([5588c2a](https://github.com/OptimistikSAS/OIBus/commit/5588c2a1e56023f750ce5e16391451e4a18bdcf6))
* **south-ui:** Added Last completed At on Configure Protocol setting page where historian support is available. ([35f6452](https://github.com/OptimistikSAS/OIBus/commit/35f6452f64b21a7684c11d9bc03885f01720ed29))
* **south-ui:** Show lastCompletedAt ([518d144](https://github.com/OptimistikSAS/OIBus/commit/518d1442bddaf8c2744ea4b54a61ddbb05bc6a6b))


### Bug Fixes

* **ads:** manage null structure filtering ([32f07ea](https://github.com/OptimistikSAS/OIBus/commit/32f07ea0f3121b65b5c44be5532ca87f7ce1d684))
* **Console:** a test was duplicated ([4476cf3](https://github.com/OptimistikSAS/OIBus/commit/4476cf3086d9de854bff44dbf104a2cbe191bd5e))
* **deps:** downgrade pkg dependency to fix win build ([89a573d](https://github.com/OptimistikSAS/OIBus/commit/89a573d4d2c657a669e07d90e8400fb62d72e7c2))
* **deps:** update dependency @fortawesome/fontawesome-free to v5.15.3 ([2f25fdc](https://github.com/OptimistikSAS/OIBus/commit/2f25fdc915ac530fd1ac6b800590c5593a5c6fd2))
* **deps:** update dependency aws-sdk to v2.863.0 ([2905a65](https://github.com/OptimistikSAS/OIBus/commit/2905a65d75b21a25ce3b9d3eb13b5e737f39830b))
* **deps:** update dependency aws-sdk to v2.869.0 ([e8be2f0](https://github.com/OptimistikSAS/OIBus/commit/e8be2f0cbe7767cfeefcc22d99817f08381fa3df))
* **deps:** update dependency aws-sdk to v2.875.0 ([fa50df1](https://github.com/OptimistikSAS/OIBus/commit/fa50df17ad0e3d93e4845d0a1d752498fd12f2e2))
* **deps:** update dependency aws-sdk to v2.880.0 ([b6e19cf](https://github.com/OptimistikSAS/OIBus/commit/b6e19cf2593f3a2e0abcd52632fbb3bb6b19ab7f))
* **deps:** update dependency koa-helmet to v6.1.0 ([593c380](https://github.com/OptimistikSAS/OIBus/commit/593c380f8a65be902cab561d618f6569a16d809d))
* **deps:** update dependency mongodb to v3.6.5 ([406155d](https://github.com/OptimistikSAS/OIBus/commit/406155dfab7ecd46975e2053e2d44657013cebf1))
* **deps:** update dependency react-json-view to v1.21.3 ([f613269](https://github.com/OptimistikSAS/OIBus/commit/f61326936b6d4bbd3b25bc10689abdafd3e3a674))
* **deps:** update dependency timexe to v1.0.4 ([2994624](https://github.com/OptimistikSAS/OIBus/commit/29946248a5a87cc8b38a656e5f7d10edcc640b3f))
* **deps:** update react monorepo to v17.0.2 ([f2743ba](https://github.com/OptimistikSAS/OIBus/commit/f2743ba9187230bdc03c6c63222c3ddff5b35734))
* **engine:** forbid to run a on scan function when the previous one is not over ([7f2a115](https://github.com/OptimistikSAS/OIBus/commit/7f2a11541e8110b7f294901a0bd11a831ea90130))
* **FileWriter:** fix handling files ([6bd55b8](https://github.com/OptimistikSAS/OIBus/commit/6bd55b8b231b7a3353ac75cd283b5b00e08ea9d9))
* **points-help:** fixed incorrect value for help section if no help text is provided. ([08d2178](https://github.com/OptimistikSAS/OIBus/commit/08d21786a228217274ee41ab91b336a3f8ce6e0a))
* **safe-mode:** improve safe mode display to make text more visible ([f0c372a](https://github.com/OptimistikSAS/OIBus/commit/f0c372af45f45db6a4d20a222aa7d2836cf9ad2e))
* **south-folderScanner:** add try catch per file ([e5b7f24](https://github.com/OptimistikSAS/OIBus/commit/e5b7f243e054c141db65b3533670347f425e503d))
* **south-modbus:** regroup all modbus migrations ([b0a0424](https://github.com/OptimistikSAS/OIBus/commit/b0a04240099ff9d8245eff5a4fab89ec8b47e8ee))
* **south-modbus:** Removed 64 bits swap support because of poor JS 64 bits implementation & add unit tests ([cedf632](https://github.com/OptimistikSAS/OIBus/commit/cedf632c62275dc3eeae672975f5a83225e49f40))
* **south-sql:** replace all occurrence of a request variable in sql connector ([1610b32](https://github.com/OptimistikSAS/OIBus/commit/1610b32b3209e1752603eaac5146578a710d3ea1))
* **south-sqldbtofile:** fix @LastCompletedDate usage in sqlite ([e2eecc7](https://github.com/OptimistikSAS/OIBus/commit/e2eecc77b871a6ae57129c268674eb2ba34f1ec1))
* **south-sqldbtofile:** fix @LastCompletedDate usage in sqlite with string or integer date format ([029b334](https://github.com/OptimistikSAS/OIBus/commit/029b3341eae788387d7e5bdc730bbadd0d421ba5))
* **south-sqldbtofile:** Fix tests ([159093e](https://github.com/OptimistikSAS/OIBus/commit/159093eacdbab41fd5e4bf480c71679ab9b1a560))
* **south-sqldbtofile:** Update documentation for readonly user access ([599ba4c](https://github.com/OptimistikSAS/OIBus/commit/599ba4cd8ae312801ea3a2964a33f36ac6fc09d6))

## [1.1.0](https://github.com/OptimistikSAS/OIBus/compare/v1.0.1...v1.1.0) (2021-03-11)


### Features

* **folderscanner:** improve folderscanner help and log messages ([#1114](https://github.com/OptimistikSAS/OIBus/issues/1114)) ([d2fa2b7](https://github.com/OptimistikSAS/OIBus/commit/d2fa2b7cc61bb720d166c44c4e84694243c9fd75))
* **north-csvToHttp:** add getOnlyValidMappingValue ([dae8a7f](https://github.com/OptimistikSAS/OIBus/commit/dae8a7f1f2c21d1f58fc20fcec45db8228251b8d))
* **north-csvToHttp:** enable template strings in inputs ([353a0bb](https://github.com/OptimistikSAS/OIBus/commit/353a0bbc58bddd3de5fcc6a0fa3eff012e49c02e))
* **north-csvToHttp:** improve documentation, test and refactor code ([437883f](https://github.com/OptimistikSAS/OIBus/commit/437883f6dc3ef5d6811598c973537e6dc0c0ce2d))
* **OPCUA:** allow maxNode and timeout ([d0fc5ed](https://github.com/OptimistikSAS/OIBus/commit/d0fc5edaa7a1a4c627ab94044d55b078690f1529))
* **south-mqtt:** [#1021](https://github.com/OptimistikSAS/OIBus/issues/1021) - Add option to use persistent connection ([2e30b2c](https://github.com/OptimistikSAS/OIBus/commit/2e30b2c78392ea2f59cc64ccfbfb1f96eb431cc4))
* **south-mqtt:** On South MQTT config page Persistent checkbox is visible/enabled depending on Qos value. ([22bb630](https://github.com/OptimistikSAS/OIBus/commit/22bb63000e60a5f6098aa8c2ccea09242ab060e5))
* **south-opcua:** Add configurable delay between read interval iterations ([bc42465](https://github.com/OptimistikSAS/OIBus/commit/bc42465b8b9207b5b32ad1df2fc9e157b4d3c519))
* **south-opcua:** Add configurable delay between read interval iterations ([45305f9](https://github.com/OptimistikSAS/OIBus/commit/45305f9f0a87ca87d7358c69494649dd8e91df49))
* **south-opcua:** opcua user/pass authentication ([6480585](https://github.com/OptimistikSAS/OIBus/commit/648058583396f7796ab50f3965149c399eb7e6d0))
* **south-opcua:** Rename OPCUA to OPCUA_HA ([da8a5e7](https://github.com/OptimistikSAS/OIBus/commit/da8a5e72225d09ca38d6c044b902d7c3c37f446f))
* **south-opcua-da:** Add UI ([32acdec](https://github.com/OptimistikSAS/OIBus/commit/32acdecf8fb6d7c73208491e2adc061109965be5))
* **south-opcua-da:** basic working skeleton ([d4add31](https://github.com/OptimistikSAS/OIBus/commit/d4add31fa381a87efb341b680faf939385000018))
* **south-opcua-da:** Unit tests ([eb1405d](https://github.com/OptimistikSAS/OIBus/commit/eb1405deaf4e5f543347d4600af70e5aa8619c08))
* **south-opcua-ha:** Fix UI ([1307bbd](https://github.com/OptimistikSAS/OIBus/commit/1307bbd0b67429b037cf6492544ed1b544296fda))
* **south-sql:** add startDate to initiate LastCompletedDate from config file and tests improvements ([b2a6707](https://github.com/OptimistikSAS/OIBus/commit/b2a670746beeb0e4951358f385a3f96c17dce8c3))


### Bug Fixes

* **deps:** update babel runtime to fix client failure ([1ba165e](https://github.com/OptimistikSAS/OIBus/commit/1ba165e89bf9931d718f420d8747e729665bd2d7))
* **deps:** update dependency aws-sdk to v2.838.0 ([cc797e8](https://github.com/OptimistikSAS/OIBus/commit/cc797e85bc1515fc5023f4aa87cd771bf2ec7e9d))
* **deps:** update dependency aws-sdk to v2.840.0 ([6da8029](https://github.com/OptimistikSAS/OIBus/commit/6da802975cbec3316d30bbecab7d40ff662cda2d))
* **deps:** update dependency aws-sdk to v2.845.0 ([833e8ca](https://github.com/OptimistikSAS/OIBus/commit/833e8cacce5cfe3ced208f6ab1bfd5055db29ddc))
* **deps:** update dependency aws-sdk to v2.849.0 ([9f4bffb](https://github.com/OptimistikSAS/OIBus/commit/9f4bffbaa526e8aab80c9f7f9a898a0146f12aeb))
* **deps:** update dependency aws-sdk to v2.853.0 ([195097a](https://github.com/OptimistikSAS/OIBus/commit/195097a9890481580ef2d58fcb56aa188d003321))
* **deps:** update dependency aws-sdk to v2.859.0 ([53a08c1](https://github.com/OptimistikSAS/OIBus/commit/53a08c1ee8cae51f3c0dcb496b779fcea4865aa8))
* **deps:** update dependency form-data to v4 ([54d1bfb](https://github.com/OptimistikSAS/OIBus/commit/54d1bfbaf5b814253b8fb2ce84c99c19db20e337))
* **deps:** update dependency moment-timezone to v0.5.33 ([9a26973](https://github.com/OptimistikSAS/OIBus/commit/9a269732ff842cfad97fb56952e5e77dd0612510))
* **deps:** update dependency mongodb to v3.6.4 ([e4fb5b5](https://github.com/OptimistikSAS/OIBus/commit/e4fb5b59e871e6e29d1f9b7b28ca47644bf4fc2c))
* **deps:** update dependency node-opcua to v2.32.0 ([48af14d](https://github.com/OptimistikSAS/OIBus/commit/48af14d1a5a70bd4b271ad147f1641e5107c6085))
* **deps:** update dependency node-opcua to v2.33.0 ([8c9a0ec](https://github.com/OptimistikSAS/OIBus/commit/8c9a0ec041943472232d9199d83ca2bab46cbf33))
* **deps:** update dependency node-opcua to v2.36.0 ([145a7f2](https://github.com/OptimistikSAS/OIBus/commit/145a7f24b41e29a98713476b5747172140c720d1))
* **deps:** update dependency react-icons to v4.2.0 ([5f3a43c](https://github.com/OptimistikSAS/OIBus/commit/5f3a43c2f11f4d9dbaf49674688b7228e2808129))
* **deps:** update dependency react-json-view to v1.21.1 ([1f4f89f](https://github.com/OptimistikSAS/OIBus/commit/1f4f89fa4226ce4e1cd40ba994aad43ca65e8611))
* **deps:** update dependency sqlite3 to v5.0.2 ([f47b32d](https://github.com/OptimistikSAS/OIBus/commit/f47b32d6eff3a86d25f747bdbfa546457c3bcc98))
* **deps:** update dependency timexe to v1.0.3 ([e6b8a93](https://github.com/OptimistikSAS/OIBus/commit/e6b8a93e789de3acf207b4179788cb745391e781))
* **FileWriter:** add debug traces ([cad97dd](https://github.com/OptimistikSAS/OIBus/commit/cad97dd5b5ab345c8285b781f513ff9e45811740))
* **OPCUA:** do not ignore read error ([4456e4c](https://github.com/OptimistikSAS/OIBus/commit/4456e4c17848cf3a2661a9adc705bb8d4fb5d09e))
* **OPCUA:** make timeout and numValuesToRead configurable ([1dcb4b6](https://github.com/OptimistikSAS/OIBus/commit/1dcb4b6d1009021fad68ae736250beb59c8a8c50))
* **OPCUA:** release continuationPoints ([d658963](https://github.com/OptimistikSAS/OIBus/commit/d65896313417d6bdef7f0bd7e8bf91b258f8b66f))
* **south-mqtt:** [#1050](https://github.com/OptimistikSAS/OIBus/issues/1050) - Make keepalive, connectPeriod and connectTimeout configurable ([76bb3c1](https://github.com/OptimistikSAS/OIBus/commit/76bb3c17df19e46cf1cf451a3d858ab10d500334))
* **south-opcua:** add help for opcua settings ([552978a](https://github.com/OptimistikSAS/OIBus/commit/552978a8f2021fe29ec5c30b4dc0f6a4fd56264f))
* **validation:** fix issue when string was empty ([d3354b6](https://github.com/OptimistikSAS/OIBus/commit/d3354b6dd9573db8f9ca5047bcdfd16ded110faf))

### [1.0.1](https://github.com/OptimistikSAS/OIBus/compare/v1.0.0...v1.0.1) (2021-01-20)

## [1.0.0](https://github.com/OptimistikSAS/OIBus/compare/v0.8.1...v1.0.0) (2021-01-20)

### [0.8.1](https://github.com/OptimistikSAS/OIBus/compare/v0.8.0...v0.8.1) (2021-01-20)


### Features

* **North-fileWriter:** Add filewritter module ([ec8a10b](https://github.com/OptimistikSAS/OIBus/commit/ec8a10b892232d4273dd57988b3d843773ea8051))


### Bug Fixes

* **filewriter:** move to async syntax ([15b3cdc](https://github.com/OptimistikSAS/OIBus/commit/15b3cdc5b0c514c013a01cfff9c7259cc02a0409))
* **south-sqldbtofile:** Added unit for connection and request timeout. ([306b565](https://github.com/OptimistikSAS/OIBus/commit/306b565ed2bca06e46a06c5fdbcdb370e4152abf))

## [0.8.0](https://github.com/OptimistikSAS/OIBus/compare/v0.7.9...v0.8.0) (2021-01-18)


### ⚠ BREAKING CHANGES

* **south-mqtt:** fix timestamp key payload

### Features

* **client:** add the About menu ([4ba8404](https://github.com/OptimistikSAS/OIBus/commit/4ba8404014837f3cf2ba1dfe132a662c80dfaec6))
* **north:** Add API Key auth in OIbAuthentication component ([b1c6df9](https://github.com/OptimistikSAS/OIBus/commit/b1c6df91ed8cdb8eb21641210964d073f68d5a33))
* **north-CsvToHttp:** Add new North CsvToHttp ([d891f57](https://github.com/OptimistikSAS/OIBus/commit/d891f57c1f0d4ba242d30b160156ebcdb4105e0a))
* **south-mqtt:** Add point in the error callback subscription ([5f1a91a](https://github.com/OptimistikSAS/OIBus/commit/5f1a91af4071321a58123ce31c3964e3efddadbc))
* **south, north:** Added list sorting by column on south and north listing. ([b82c9ea](https://github.com/OptimistikSAS/OIBus/commit/b82c9ea5adf9675515a62643ca4ea1f14f00e9f2))


### Bug Fixes

* **engine:** listen mode should not generate error for each dataSource point and remove unused variable ([39835b4](https://github.com/OptimistikSAS/OIBus/commit/39835b49af1eae3a72889db364aedbd72c721cf2))
* **south:** handled if val is null ([1410ae4](https://github.com/OptimistikSAS/OIBus/commit/1410ae44d92528ba72ba3f56841abe61d0de1bd2))
* **south:** increased width on Scan Groups in OPCUA  and OPCHDA . Increased width in OPCUA settings. ([01cf190](https://github.com/OptimistikSAS/OIBus/commit/01cf1900e02868b077c3f9ee58f8bf25e3aa3459))
* **south-mqtt:** fix timestamp key payload ([89fcf07](https://github.com/OptimistikSAS/OIBus/commit/89fcf07adce7e3189595944fe666b85b2bbe487e))
* **test:** add testConfig.js ([f13a966](https://github.com/OptimistikSAS/OIBus/commit/f13a96676aeed31dc127b50647cc4d184b490bbe))

### [0.7.9](https://github.com/OptimistikSAS/OIBus/compare/v0.7.8...v0.7.9) (2021-01-06)


### Bug Fixes

* **south-mqtt:** optional password and more example for timestamp format ([36169aa](https://github.com/OptimistikSAS/OIBus/commit/36169aa527fb02ce8344505025351fb54d2bef14))

### [0.7.8](https://github.com/OptimistikSAS/OIBus/compare/v0.7.7...v0.7.8) (2021-01-06)


### Bug Fixes

* **deps:** update oracledb dep to 5.1.0 ([ba3e1f5](https://github.com/OptimistikSAS/OIBus/commit/ba3e1f52774415ce51e7db691f9d5dcf3df704c0))

### [0.7.7](https://github.com/OptimistikSAS/OIBus/compare/v0.7.6...v0.7.7) (2021-01-06)


### Bug Fixes

* **doc:** README History removal ([a9966da](https://github.com/OptimistikSAS/OIBus/commit/a9966daf77d77463da26ee8c2217644bc3eefa5f))
* **south-mqtt:** allow no user for authentication ([fdea603](https://github.com/OptimistikSAS/OIBus/commit/fdea6034bdea707a2fbb005d91dbf2c21ebc0824))

### [0.7.6](https://github.com/OptimistikSAS/OIBus/compare/v0.7.5...v0.7.6) (2021-01-04)


### Bug Fixes

* **deps:** add OPC Foundation Agreement of Use ([48c87c0](https://github.com/OptimistikSAS/OIBus/commit/48c87c08ac1d8a8f7c811ecd0e1a0e4c02644dfc))

### [0.7.5](https://github.com/OptimistikSAS/OIBus/compare/v0.7.4...v0.7.5) (2021-01-04)

### [0.7.4](https://github.com/OptimistikSAS/OIBus/compare/v0.7.2...v0.7.4) (2021-01-04)


### Bug Fixes

* **encryption:** bug was causing OIbus to fail on start ([9aa8f9c](https://github.com/OptimistikSAS/OIBus/commit/9aa8f9cfe5fc365b3c33887694c0117e591d195a))
* **engine:** fix rebase conflict ([4fb8642](https://github.com/OptimistikSAS/OIBus/commit/4fb864237c576c1e749b8cb75e6b6d58ba054e11))
* **engine:** fix rebase conflict and adapt tests ([fa62c27](https://github.com/OptimistikSAS/OIBus/commit/fa62c2777ee8c69e45e2e78b4ccdf80680426b3a))
* **Engine:** es6 check for empty value ([b959353](https://github.com/OptimistikSAS/OIBus/commit/b959353bb54c097dbab232841ebd3777a994c73d))
* **Engine:** es6 check for empty value and add test ([68b986c](https://github.com/OptimistikSAS/OIBus/commit/68b986c3eaaf21c8dcf9626132afd061da1743ab))
* **Engine:** fix test for config file in engine ([33a9695](https://github.com/OptimistikSAS/OIBus/commit/33a96954a560375f0d79f8a5688cfeec121826ca))
* **Engine:** fix test for config file in engine ([e9d8e38](https://github.com/OptimistikSAS/OIBus/commit/e9d8e389af77826b55b550000854b6d166399dac))
* **Engine:** remove engine snapshot ([7e219aa](https://github.com/OptimistikSAS/OIBus/commit/7e219aafa7055e342f499f8cac91e02b8c00082f))
* **Engine:** sanitizedValues with 'zero' value is accepted and correctly parsed [#932](https://github.com/OptimistikSAS/OIBus/issues/932) ([5300178](https://github.com/OptimistikSAS/OIBus/commit/5300178640528c7edb7e5378c675e53e0997083d))
* **Engine:** sanitizedValues with 'zero' value is accepted and correctly parsed [#932](https://github.com/OptimistikSAS/OIBus/issues/932) ([08e2755](https://github.com/OptimistikSAS/OIBus/commit/08e275568e43a19e3baeea9e806e54dd9e921200))
* **modbus:** add test and modbus format address in hexadecimal only (with 5 or 6 digit notation) ([ec4f591](https://github.com/OptimistikSAS/OIBus/commit/ec4f5917b2e74cd4b9b32bcd8028d3c8731dcb8c))
* **modbus:** fix validations on modbus points ([aab64d6](https://github.com/OptimistikSAS/OIBus/commit/aab64d6db0b52d8b0da51387d145db7021d2c24e))
* **ModBus:** add ip address validator and use it for ModBus without any protocol in front of it ([4db18ce](https://github.com/OptimistikSAS/OIBus/commit/4db18ce00b5a24f44a75781258b7104f83e2fadb))
* **ModBus:** change form for modbus host and fix a bug with scan modes on points ([039d1b1](https://github.com/OptimistikSAS/OIBus/commit/039d1b1bc99e3c22ba78b6440b0caaa13f337254))
* **ModBus:** communication with modbus slave ok ([5524ad4](https://github.com/OptimistikSAS/OIBus/commit/5524ad4201546a70960846f50836da272ed13b75))
* **MQTT:** manage listen mode only on MQTT front points settings ([b598188](https://github.com/OptimistikSAS/OIBus/commit/b598188f5b99bc8b0f852f77e5e08c4dcbee7d1c))
* **test:** adapt tests with hostname ([0b097bf](https://github.com/OptimistikSAS/OIBus/commit/0b097bf29cf4857dc1eaa572379de562aea171f7))
* **test:** testConfig file updated ([6e1f570](https://github.com/OptimistikSAS/OIBus/commit/6e1f570c8b9f3e17272423edd60d23c8dc9839f1))
