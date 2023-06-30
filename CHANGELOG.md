# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [2.5.10-node-windows7.3](https://github.com/OptimistikSAS/OIBus/compare/v2.5.10-node-windows7.2...v2.5.10-node-windows7.3) (2023-06-30)


### Bug Fixes

* downgrade to node 16.6.2 ([e650a23](https://github.com/OptimistikSAS/OIBus/commit/e650a237e4f40cfa2e50ac3361069fb165a18167))

### [2.5.10-node-windows7.2](https://github.com/OptimistikSAS/OIBus/compare/v2.5.10-node-windows7.1...v2.5.10-node-windows7.2) (2023-06-30)


### Bug Fixes

* downgrade to node 16.6.2 ([fc68e47](https://github.com/OptimistikSAS/OIBus/commit/fc68e47b83887baaa0a5ef81b5e410bf20352fa3))

### [2.5.10-node-windows7.1](https://github.com/OptimistikSAS/OIBus/compare/v2.5.10-node-windows7.0...v2.5.10-node-windows7.1) (2023-06-30)


### Bug Fixes

* downgrade to node 16.6.2 ([7819865](https://github.com/OptimistikSAS/OIBus/commit/781986558758f6f2f90b9d38f83ced735bc218e4))
* downgrade to node 16.6.2 ([cc969ac](https://github.com/OptimistikSAS/OIBus/commit/cc969ac8df0f7ef4d0d97784bec92c9c136478fd))

### [2.5.10-node-windows7.0](https://github.com/OptimistikSAS/OIBus/compare/v2.5.10...v2.5.10-node-windows7.0) (2023-06-30)


### Bug Fixes

* **cache:** fix concurrent access to flush value method ([bd79200](https://github.com/OptimistikSAS/OIBus/commit/bd79200f310f0419c1b9247ca9b27413b5776b54))
* **cache:** Remove file from queue when file has been moved to error cache ([73cf865](https://github.com/OptimistikSAS/OIBus/commit/73cf865912a20b4db4a67e0807ccbe038950ff38))
* downgrade to node 16.6.2 ([e98c253](https://github.com/OptimistikSAS/OIBus/commit/e98c253493d507eacd94f654515d66ba9f6a852b))
* **http:** Check if file exists before creating read stream ([22d4831](https://github.com/OptimistikSAS/OIBus/commit/22d4831a216384be516329f4905b14b53344411a))
* **ip21:** fix date format ([5201bf3](https://github.com/OptimistikSAS/OIBus/commit/5201bf33253d663cccd654c06c7d9b4a279e113c))
* **north-oia:** adjust retriable status codes ([c155867](https://github.com/OptimistikSAS/OIBus/commit/c155867fc556481422af6a85c8db03918e0542b8))
* **opchda:** Change log to debug and update agent ([89473bc](https://github.com/OptimistikSAS/OIBus/commit/89473bcf4069a7e0953d0b6603e42bcc7cd42995))
* **opchda:** Fix warning agent log level ([25e5339](https://github.com/OptimistikSAS/OIBus/commit/25e53399c0f1aa454ae66a49d63fa412c3dae9b0))
* **opchda:** update agent deps ([bef1a71](https://github.com/OptimistikSAS/OIBus/commit/bef1a71933bdf6a5110b090717028982d52840df))
* **opchda:** update hda agent deps ([ded4c9b](https://github.com/OptimistikSAS/OIBus/commit/ded4c9b2b2249e9dd32f60f4edbab5e9d077bec3))
* **opchda:** Update OPCHDA agent to fix ReadRaw items ([fed6311](https://github.com/OptimistikSAS/OIBus/commit/fed6311ebfa4c82c698d24c72f87bc73cdbfa7f0))
* **ui:** Fix log color display ([3a21b6c](https://github.com/OptimistikSAS/OIBus/commit/3a21b6cd493c7c5e404186ff1ec569126f11c681))
* **ui:** Fix removal of text input value ([e97a97c](https://github.com/OptimistikSAS/OIBus/commit/e97a97c5e1a69632de9560215716908da69c00b0))
* update hda agent ([2c35b1b](https://github.com/OptimistikSAS/OIBus/commit/2c35b1ba3ce979655d7c6f22b9d211b56f58a55a))

### [2.5.10](https://github.com/OptimistikSAS/OIBus/compare/v2.5.9...v2.5.10) (2023-06-16)


### Bug Fixes

* **south-sql:** Fix oracle library loading ([1dfed23](https://github.com/OptimistikSAS/OIBus/commit/1dfed23c02315d20b84097433fb07d6c93a9aa24))

### [2.5.9](https://github.com/OptimistikSAS/OIBus/compare/v2.5.8...v2.5.9) (2023-06-14)


### Bug Fixes

* **cache:** Fix chunk push values ([18266fa](https://github.com/OptimistikSAS/OIBus/commit/18266faa7ada989d31b3f11cb7a4bbbccd033f5d))
* **history-query:** Fix file history query ([5b201c2](https://github.com/OptimistikSAS/OIBus/commit/5b201c29e8b8680e4e1c30bf30ebe0555025bab2))
* **history:** Fix new history when no history capable south are set ([83af113](https://github.com/OptimistikSAS/OIBus/commit/83af1131485d05962f032cf204098ca7d4b88256))
* **ip21:** Fix StartTime/EndTime format ('dd-MMM-yy HH:mm:ss.SSS') for sqlite query ([9bc7527](https://github.com/OptimistikSAS/OIBus/commit/9bc7527eb80aca45fb9a75f820e24a006924ba69))
* **odbc:** Add IP21 ODBC support in South SQL connector ([a3d1633](https://github.com/OptimistikSAS/OIBus/commit/a3d16335aa90e281e001f371693361d8f8a29d64))
* **odbc:** Username not mandatory ([eed243d](https://github.com/OptimistikSAS/OIBus/commit/eed243d89bb66300299a88913a45c1224f7d7bb0))
* **south-opchda:** Fix disconnection when losing HDA Agent connection ([00130a9](https://github.com/OptimistikSAS/OIBus/commit/00130a991c1be117e2d6e4b6054a55c20b2d68a1))
* **sql:** Improve log for IP21 odbc driver ([e14d329](https://github.com/OptimistikSAS/OIBus/commit/e14d3296b7edbd7cc080ad0e01b7c0666d71437d))

### [2.5.8](https://github.com/OptimistikSAS/OIBus/compare/v2.5.7...v2.5.8) (2023-05-22)


### Bug Fixes

* **odbc:** Fix port settings on ODBC connection string ([6985b96](https://github.com/OptimistikSAS/OIBus/commit/6985b961093811c4d942e8525dd160f33836dfd9))

### [2.5.7](https://github.com/OptimistikSAS/OIBus/compare/v2.5.6...v2.5.7) (2023-05-22)


### Bug Fixes

* **history-query:** Fix History Query edition and run ([5f8f06a](https://github.com/OptimistikSAS/OIBus/commit/5f8f06a36156f11c80b18fdc62d351b63c517d77))
* **south-rest:** Fix Rest authentication and improve logs ([2d36489](https://github.com/OptimistikSAS/OIBus/commit/2d3648952460ed8e4cd888d7fd304d8d0b158e3d))
* **sql-south:** improve logging and send raw values if formatted result is not an array ([96d38cf](https://github.com/OptimistikSAS/OIBus/commit/96d38cfb266ae29da0b75309c06eabb9cd5bb2d3))

### [2.5.6](https://github.com/OptimistikSAS/OIBus/compare/v2.5.5...v2.5.6) (2023-05-11)


### Bug Fixes

* **south-sql:** Fix integration test for MSSQL ([5468db6](https://github.com/OptimistikSAS/OIBus/commit/5468db67d54304a359e1f0791447d41517b59356))
* **sql-south:** adjust test following change ([7dcad0d](https://github.com/OptimistikSAS/OIBus/commit/7dcad0df027ecb9661420b07f7b467c832469af1))
* **sql-south:** use string in the timezone specified to interpolate start and end time ([71b2c44](https://github.com/OptimistikSAS/OIBus/commit/71b2c44b5c7a88041d6a3093859e46ba21c5caa7))

### [2.5.5](https://github.com/OptimistikSAS/OIBus/compare/v2.5.4...v2.5.5) (2023-05-02)


### Bug Fixes

* **endpoint:** Fix addFile endpoint when receiving from legacy OIbus ([00f9c49](https://github.com/OptimistikSAS/OIBus/commit/00f9c494bfdc6e58630b633162d3edde7557a105))

### [2.5.4](https://github.com/OptimistikSAS/OIBus/compare/v2.5.3...v2.5.4) (2023-04-24)


### Bug Fixes

* **ci:** fix node version ([4de4103](https://github.com/OptimistikSAS/OIBus/commit/4de4103ef86b82431858a4a9e8b3cda1f40be99d))
* **endpoint:** Fix addValues endpoint when receiving from legacy OIbus ([45113fb](https://github.com/OptimistikSAS/OIBus/commit/45113fbecce340e322fabffc0a5658574c480f91))
* **engine:** fix async startup for connectors ([6e3148c](https://github.com/OptimistikSAS/OIBus/commit/6e3148c1e7545e162f241c54e105e6e48ce5351c))
* **migration:** Fix proxies and OPCHDA migration ([ea1888f](https://github.com/OptimistikSAS/OIBus/commit/ea1888f9375cba4a81ee0ca586fe5c8929538368))
* **mysql:** fix mysql package ([cf7391b](https://github.com/OptimistikSAS/OIBus/commit/cf7391bc224fe5bb967b28d4b35e4a231100fc68))
* **north:** add acceptUnauthorized field in OIAnalytics and OIConnect north connectors ([8ec6800](https://github.com/OptimistikSAS/OIBus/commit/8ec68008953927cd419ebb3455e12d82ceb1dd06))

### [2.5.3](https://github.com/OptimistikSAS/OIBus/compare/v2.5.2...v2.5.3) (2023-04-07)


### Bug Fixes

* **points:** fix points change update ([8d715cb](https://github.com/OptimistikSAS/OIBus/commit/8d715cb71380f506bf7e06ee6035a4edcb82df4a))

### [2.5.2](https://github.com/OptimistikSAS/OIBus/compare/v2.5.1...v2.5.2) (2023-04-06)


### Bug Fixes

* **modbus:** fix points creation / changes and modbus client library ([ed663b2](https://github.com/OptimistikSAS/OIBus/commit/ed663b25f89a6fa4f0cbe156f621671be08740f9))

### [2.5.1](https://github.com/OptimistikSAS/OIBus/compare/v2.5.0...v2.5.1) (2023-04-04)


### Bug Fixes

* **config:** fix async call to update config ([40441d1](https://github.com/OptimistikSAS/OIBus/commit/40441d1e8e9c0221954264bc6caa853b34071cfb))
* **migration:** fix migration for S3 authentication and encryption keys migration ([b59517f](https://github.com/OptimistikSAS/OIBus/commit/b59517fa926527a1774037a3f9d7db9c02be39d6))

## [2.5.0](https://github.com/OptimistikSAS/OIBus/compare/v2.4.0...v2.5.0) (2023-04-03)


### Features

* **build:** Generate arm64 build for Mac M1 ([af6e5cb](https://github.com/OptimistikSAS/OIBus/commit/af6e5cb3906788f5feed43d8e2238f3a6a564f26))
* **cache:** add a max size limit ([9622f75](https://github.com/OptimistikSAS/OIBus/commit/9622f75b4d9a07331888ef78567cf88b7ab7f2dc))
* **config:** add nanoid for scan modes, proxies and points and retrieve specific south/north from api call ([e995f28](https://github.com/OptimistikSAS/OIBus/commit/e995f28a073a03fdc31bfc43be1ec48413872be0))
* **connector:** use a manifest for category and modes of south and north connectors ([684ce95](https://github.com/OptimistikSAS/OIBus/commit/684ce95baeaf4318c009ce9956584091799084c2))
* **deps:** remove humanize string dependency ([439fb9a](https://github.com/OptimistikSAS/OIBus/commit/439fb9a57299e6dc1be2f9d8d439f03dea63127c))
* **esm:** adapt frontend bundle with global esm ([235be85](https://github.com/OptimistikSAS/OIBus/commit/235be851befbe0b25fd68fb0bc5f6a8b2dbf7ee4))
* **esm:** move backend code to ECMA script modules ([a192b48](https://github.com/OptimistikSAS/OIBus/commit/a192b48d2cafdd6a390eaaa25b7049cd6ffc2db5))
* **proxy:** use a proxy service to manage proxy in connectors ([bd4925a](https://github.com/OptimistikSAS/OIBus/commit/bd4925a754349ea0f6960118f128ea13a59596b8))
* **sql-odbc:** Fix date binding for MSSQL ([ed14285](https://github.com/OptimistikSAS/OIBus/commit/ed142856417a22188899d40b404c695d2c24e8b0))
* **sql:** Support for ODBC connection ([24bd6ed](https://github.com/OptimistikSAS/OIBus/commit/24bd6edabfe693e4e0d98381c2149ab4eb632fe4))
* **typescript:** adapt tests with esm ([0ee300d](https://github.com/OptimistikSAS/OIBus/commit/0ee300df63e0ad68e2ea10cf0a30f88302b4b388))
* **typescript:** use tsc to transpile into commonJS ([ee0aaa8](https://github.com/OptimistikSAS/OIBus/commit/ee0aaa8944631493408357bc28de902f415155b7))
* **ui:** Adapt tests for logs ([0b012d3](https://github.com/OptimistikSAS/OIBus/commit/0b012d3ffa8f3af8c31bde2b449aa1df54f4cca5))
* **ui:** Logs pagination final design ([bd32014](https://github.com/OptimistikSAS/OIBus/commit/bd32014d32f96bf7675bb7dcf79e186bad7e8c1c))
* **ui:** Logs Pagination fully functional state ([a9b2792](https://github.com/OptimistikSAS/OIBus/commit/a9b2792e71e2c24d8741fab93d2565210ab05dba))
* **ui:** Paginate Logs Initial test version ([169262d](https://github.com/OptimistikSAS/OIBus/commit/169262d902319cfd47d293a471f75180f86e0b85))


### Bug Fixes

* **about:** change oibus site address ([a64e0db](https://github.com/OptimistikSAS/OIBus/commit/a64e0dbac3e3f37345e8ef29b5859566d5e321f7))
* **ci:** do not copy useless file in win/bin and fix config path ([5a56bde](https://github.com/OptimistikSAS/OIBus/commit/5a56bde76bf6b74d4b93c0d07a486345dd757cb5))
* **config:** Fix default oibus.json not created on first start ([b0c547f](https://github.com/OptimistikSAS/OIBus/commit/b0c547f1982a7b2afd7ba32bcd38bcfcb1a1d186))
* **connectors:** add modes in connectors manifest ([307da96](https://github.com/OptimistikSAS/OIBus/commit/307da96893a9a9fea78b03ca4e2fdcca2e2b6b20))
* **doc:** refactor js doc to reflect global logger ([a994998](https://github.com/OptimistikSAS/OIBus/commit/a99499875c6fe706a265d24dcd0801974dc3a13c))
* **esm:** access package version and remove file line in logs ([2235dd5](https://github.com/OptimistikSAS/OIBus/commit/2235dd5c6f6b5e27d468f5ca58a3012f6ff34391))
* **esm:** update some dependencies with tsc compiler ([be959e0](https://github.com/OptimistikSAS/OIBus/commit/be959e09db5aab650024fa07cc239ad4f7512711))
* **logs:** add a button to refresh the logs ([5363a72](https://github.com/OptimistikSAS/OIBus/commit/5363a7204c833fd69d7ee336ac3781e908ad93a8))
* **log:** sort log in descending order (by timestamp) ([688d7e0](https://github.com/OptimistikSAS/OIBus/commit/688d7e0e9f56595d7bd1b8480a869921ac5bd439))
* **mqtt-south:** Fix retrieving timestamp from payload ([26b7cc6](https://github.com/OptimistikSAS/OIBus/commit/26b7cc6e1441a98122f50aa51be5eecf11ffa5ab))
* **odbc:** fix import of odbc library ([951abec](https://github.com/OptimistikSAS/OIBus/commit/951abec6306fd1058ce8a5f0064b9008534b6454))
* **tests:** fix packages mock names ([592e03a](https://github.com/OptimistikSAS/OIBus/commit/592e03adb26081bfe3b361ddbed84602841ddece))

## [2.4.0](https://github.com/OptimistikSAS/OIBus/compare/v2.3.4...v2.4.0) (2022-11-28)


### Features

* **cache:** create specific archive service for north connectors ([069e0f1](https://github.com/OptimistikSAS/OIBus/commit/069e0f1550cdb71977d63f747185e52bea13875f))
* **cache:** improve file cache service ([0618d65](https://github.com/OptimistikSAS/OIBus/commit/0618d656bccdf386e5369de3747f7cc3b2a2995f))
* **file-cache:** Add tests ([8a18c20](https://github.com/OptimistikSAS/OIBus/commit/8a18c20963d2365c5ae67910c05937846e09039b))
* **file-cache:** Endpoints to remove/retry file cache errors ([f023a7e](https://github.com/OptimistikSAS/OIBus/commit/f023a7ec09f1b6075ee028ffa9d78e83d7f440ab))
* **logs:** rotate log file ([f865dec](https://github.com/OptimistikSAS/OIBus/commit/f865dec411c5995864c41995dbce17c8620de3fa))


### Bug Fixes

* **cache:** do not log error when buffer file does not exist ([0542c54](https://github.com/OptimistikSAS/OIBus/commit/0542c5477183a79c7e9a42ecb1c9f0d336f777f9))
* **cache:** file cache fix queue ([e3eec3c](https://github.com/OptimistikSAS/OIBus/commit/e3eec3c850b772a488aac38beecdc0125f910baf))
* **cache:** Fix tests ([e76df96](https://github.com/OptimistikSAS/OIBus/commit/e76df96ca214d1424ed68c33f0ccfef646ada749))
* **cache:** fix time flush reload ([e10a8e2](https://github.com/OptimistikSAS/OIBus/commit/e10a8e2dcd66d0992c71de9101dbc3c0cb5cfd5e))
* **cache:** fix value cache when concurrent access to the buffer file ([0fb6799](https://github.com/OptimistikSAS/OIBus/commit/0fb6799546e95a2dba67530cfe88aad4b1d118d7))
* **cache:** migrate values cache and file errors folder ([99b1792](https://github.com/OptimistikSAS/OIBus/commit/99b17925289b355e2a85a01c73dc018e63ecd752))
* **cache:** refactor values cache ([b5fb0e6](https://github.com/OptimistikSAS/OIBus/commit/b5fb0e6989c5e6574aa4f9c35603475b19aef1bf))
* **cache:** Remove cache folder when removing connector ([9b55546](https://github.com/OptimistikSAS/OIBus/commit/9b555464980c93d99d27822df3422b383d8adbc0))
* **cache:** Use promise syntax instead of for in ([1e8f1b2](https://github.com/OptimistikSAS/OIBus/commit/1e8f1b22a5b52772c473a202d5bd0f16cbb9e4c2))
* **config:** do not throw error when removing orphan cache if data stream folder does not exist ([70e32c5](https://github.com/OptimistikSAS/OIBus/commit/70e32c530fbe68fede8e2f0f8f6fdef7d1194fba))
* **engine:** remove engine circular dependencies in connectors ([57f6389](https://github.com/OptimistikSAS/OIBus/commit/57f6389944ba8167d2508ef9a785dc601cd4135c))
* **http-request:** fix naming issue and create a http request static functions file ([11ad229](https://github.com/OptimistikSAS/OIBus/commit/11ad22922a22272c222609ec5b18b74aa188f8a4))
* **logs:** do not set toDate in log screen ([e5151aa](https://github.com/OptimistikSAS/OIBus/commit/e5151aa7406303afeb8b90749679d1e40feea9b5))
* **logs:** fix log reload when calling logger from log endpoint ([7521e53](https://github.com/OptimistikSAS/OIBus/commit/7521e5368646037b7a551bb626019999671835eb))
* **logs:** fix logs ui test ([b4a84c3](https://github.com/OptimistikSAS/OIBus/commit/b4a84c39ca1d362dc8d2c306f240e26b595b2be6))
* **logs:** fix oibus initialisation with common logger ([d7dd830](https://github.com/OptimistikSAS/OIBus/commit/d7dd83033fa64224660c79dbdd6c4929a0cbb355))
* **logs:** roll files and remove the oldest file periodically ([a0b47d0](https://github.com/OptimistikSAS/OIBus/commit/a0b47d020172479b2e8149bbfadb424b828238ee))
* **logs:** use one global logger for settings and children logger for connectors ([cc720c5](https://github.com/OptimistikSAS/OIBus/commit/cc720c585c85e46914923d388a3b74adfd6c575a))
* **migration:** migrate north settings authentication properly ([584c291](https://github.com/OptimistikSAS/OIBus/commit/584c29107d655b6539298cbf5d90fff754f6b3c6))
* **opcua:** Add tests for internalDisconnect ([2e1fa48](https://github.com/OptimistikSAS/OIBus/commit/2e1fa483074c428d92310ab8f4c81ca94f246665))
* **opcua:** Prevent duplicate session creation ([bd3f140](https://github.com/OptimistikSAS/OIBus/commit/bd3f1408f765d0596c5769c050ecc757e49dcea7))
* **release:** fix release oibus running test path ([be4b3bf](https://github.com/OptimistikSAS/OIBus/commit/be4b3bfea9147d1789776f06cda364d99d5c7070))
* **setup:** change favicon and setup file name ([0ad1a99](https://github.com/OptimistikSAS/OIBus/commit/0ad1a99dc0bbb5d4361c5052cb229bf75a34a99f))
* **south/north:** rename init into start and create stop method ([753cd6b](https://github.com/OptimistikSAS/OIBus/commit/753cd6b3fb9867a77e095ea772df6962526aac56))
* **tests:** add data-folder in repo for tests and oibus start ([0252635](https://github.com/OptimistikSAS/OIBus/commit/02526358e58c16cd2dafc38199f86f7f363c44d2))
* **tests:** fix integration test for sql south connector ([654cc62](https://github.com/OptimistikSAS/OIBus/commit/654cc6258c2bb49ab48850960035d7fda41d1776))
* **ui:** Rework OiDate Picker ([53102ce](https://github.com/OptimistikSAS/OIBus/commit/53102ce897bea3f573f845d743484fac4e96acdf))
* **win-setup:** update setup images ([9a33a9e](https://github.com/OptimistikSAS/OIBus/commit/9a33a9ec1fe248c31ea388d6cd0666e24072fcc1))

### [2.3.4](https://github.com/OptimistikSAS/OIBus/compare/v2.3.3...v2.3.4) (2022-10-28)


### Bug Fixes

* **cache:** improve perf on values query in sqlite cache ([51e8f9a](https://github.com/OptimistikSAS/OIBus/commit/51e8f9aa0f2aa344fcf5202f5b68ecbf3d7fcb5c))
* **setup:** improve setup ([9ad71fe](https://github.com/OptimistikSAS/OIBus/commit/9ad71febb62b726b57411d245faa8d46eac4584d))

### [2.3.3](https://github.com/OptimistikSAS/OIBus/compare/v2.3.2...v2.3.3) (2022-10-25)


### Bug Fixes

* **http-request:** fix readStream close on http error ([821f951](https://github.com/OptimistikSAS/OIBus/commit/821f9518e7dc1d6bbe44617afa22a726c1a3b629))
* **north:** fix file cache stat eperm error ([91ac4fc](https://github.com/OptimistikSAS/OIBus/commit/91ac4fc86ef2934ce1527aa3542301ef3050a004))

### [2.3.2](https://github.com/OptimistikSAS/OIBus/compare/v2.3.1...v2.3.2) (2022-10-21)


### Bug Fixes

* **north:** fix north retrieve file when file being written ([f0c8117](https://github.com/OptimistikSAS/OIBus/commit/f0c81172b627eb7f14f6b46cbe2436c1291b0017))

### [2.3.1](https://github.com/OptimistikSAS/OIBus/compare/v2.3.0...v2.3.1) (2022-10-21)


### Bug Fixes

* **archive:** fix form validation for archive retention duration and http retry count ([3442882](https://github.com/OptimistikSAS/OIBus/commit/344288250fe55f75cda8fd2481eece26fd352d58))

## [2.3.0](https://github.com/OptimistikSAS/OIBus/compare/v2.2.2...v2.3.0) (2022-10-21)


### Features

* **cache:** File cache uses folder scan to get file list instead of DB ([62f3d0b](https://github.com/OptimistikSAS/OIBus/commit/62f3d0bf064fffafcdb215c87d76e008fa29a504))
* **cache:** Remove old file cache DBs ([7fec671](https://github.com/OptimistikSAS/OIBus/commit/7fec671085fb8c2b2b5190f248a808b234b62e14))


### Bug Fixes

* **cache:** Add tests for file and value caches ([5858f26](https://github.com/OptimistikSAS/OIBus/commit/5858f269c6d9ecab52415e99ea6ca20e5a80c56f))
* **cache:** Fix retrieving file from cache ([eb6e3fd](https://github.com/OptimistikSAS/OIBus/commit/eb6e3fd0f7f450237e5db32296eec55e2a3f974a))
* **ui:** History date time input fix ([49320a8](https://github.com/OptimistikSAS/OIBus/commit/49320a80cb5bc119bd0a844f29ce486f38db6d49))

### [2.2.2](https://github.com/OptimistikSAS/OIBus/compare/v2.2.1...v2.2.2) (2022-10-19)


### Bug Fixes

* **north:** switch HTTP request error from Promise reject to Error thrown ([baf9c1a](https://github.com/OptimistikSAS/OIBus/commit/baf9c1a3a689393e1a9aca1b817eac492a8473c3))
* **south:** reinitialize properly south currently on scan after error ([637dcc5](https://github.com/OptimistikSAS/OIBus/commit/637dcc544f9e6f1e7f20f34094211028955827c6))

### [2.2.1](https://github.com/OptimistikSAS/OIBus/compare/v2.2.0...v2.2.1) (2022-10-18)


### Bug Fixes

* **front:** refactor datasource/protocol into south/southType and application/api into north/northType ([74e789f](https://github.com/OptimistikSAS/OIBus/commit/74e789f1eccb5fb334fe918ff20c910cfe035aaf))

## [2.2.0](https://github.com/OptimistikSAS/OIBus/compare/v2.1.2...v2.2.0) (2022-10-18)


### Features

* **cache:** refactor the cache ([fca1ae4](https://github.com/OptimistikSAS/OIBus/commit/fca1ae488a6b59885b3f728ebc0392baf31daedd))
* **installer:** sign Windows installer with sign tool ([481b619](https://github.com/OptimistikSAS/OIBus/commit/481b6199d3e62ad4888611ff43a4a0cfba989525))
* **logs:** create paginated logs database query ([52e46be](https://github.com/OptimistikSAS/OIBus/commit/52e46be2f3a26d60ae0f871a7a8277753d2cb284))
* **logs:** standard log path in oibus folder ([4e24752](https://github.com/OptimistikSAS/OIBus/commit/4e2475242e5ce85a3aa88c999fa9ee8cb026bd41))
* **north:** specific cache folders for each connector ([fb91f83](https://github.com/OptimistikSAS/OIBus/commit/fb91f8355ba8b9e154ff49f32522c88701262c1d))


### Bug Fixes

* **cache:** add group count for values caching ([64deb5f](https://github.com/OptimistikSAS/OIBus/commit/64deb5fb578f386c27e209ab11a5f4f047e35b5c))
* **cache:** clean up and move cache files ([531e752](https://github.com/OptimistikSAS/OIBus/commit/531e75276f06696d05b8928c2754585548c38291))
* **config:** refactor config service ([7233dc4](https://github.com/OptimistikSAS/OIBus/commit/7233dc4735ce95ff6f052b5cbba56a53a0cf1814))
* **encryption:** refactor encryption with fs/promises and improve testing ([940aa39](https://github.com/OptimistikSAS/OIBus/commit/940aa3925ee4867d6a6c00c4b64013515bb12d4b))
* **history:** add an interval to retrieve history queries to run and fix history query initialisation ([fde01d8](https://github.com/OptimistikSAS/OIBus/commit/fde01d85e0b84e9f49bbc938ac033d98c329cf67))
* **logger:** fix logger type and level ([4e6ce76](https://github.com/OptimistikSAS/OIBus/commit/4e6ce76eb42c9bdda0dc0bbf77ca40150d88082c))
* **migration:** fix logger in migration ([edb5b10](https://github.com/OptimistikSAS/OIBus/commit/edb5b106a419f47c278906112286cf863e6b1d9b))
* **north:** archive disabled by default ([5062806](https://github.com/OptimistikSAS/OIBus/commit/5062806e999a736ed245fc432061fa3c91f3f37b))
* **north:** fix North retry error and catch init/connect error ([a8dca57](https://github.com/OptimistikSAS/OIBus/commit/a8dca57e93cb9daa3524c915f0925276331e7677))
* **oibus:** refactor code to harmonize connectors and live status ([2bde86f](https://github.com/OptimistikSAS/OIBus/commit/2bde86f59398a1333b5acf584a5f1c1aa392e063))
* **south:** fix South doc and tests ([b0fe496](https://github.com/OptimistikSAS/OIBus/commit/b0fe496883d25f7f080a034309b367aadde70dae))
* **sql:** fix sql integration test ([d587023](https://github.com/OptimistikSAS/OIBus/commit/d58702319cb1f800757488a12d1bcf2abc0182ea))
* **tests:** improve tests coverage and fix Modbus utils tools ([0580bbe](https://github.com/OptimistikSAS/OIBus/commit/0580bbe2fc4cecd9337a1bfd3c3c730d868f6c64))
* **ui:** 1807 solved button display problem when renaming connector ([369f913](https://github.com/OptimistikSAS/OIBus/commit/369f91338d7c1e3fbd0fe0cbe99c06e54bebed13))
* **ui:** align save button with edit field ([c6ef14b](https://github.com/OptimistikSAS/OIBus/commit/c6ef14b7834a2408e108dc8e434c82e0ab414d9f))
* **ui:** Disable ui connection to disabled north and south nodes ([b396b32](https://github.com/OptimistikSAS/OIBus/commit/b396b32bf66e5e095104789d366c936c608db769))

### [2.1.2](https://github.com/OptimistikSAS/OIBus/compare/v2.1.1...v2.1.2) (2022-09-27)


### Bug Fixes

* **logs:** fix loki addLogs engine method with koa ctx ([94ac8c3](https://github.com/OptimistikSAS/OIBus/commit/94ac8c34e74f6b8b4c5f866f5d1110eb1a5ffd4d))

### [2.1.1](https://github.com/OptimistikSAS/OIBus/compare/v2.1.0...v2.1.1) (2022-09-26)


### Bug Fixes

* **health-signal:** log signal when forwarding with disabled http ([c92bdfd](https://github.com/OptimistikSAS/OIBus/commit/c92bdfdf4bf039d7d79ef0c9fdba392d4be8b99f))

## [2.1.0](https://github.com/OptimistikSAS/OIBus/compare/v2.0.6...v2.1.0) (2022-09-09)


### Features

* **sqlite:** only use better-sqlite3 ([ed7c258](https://github.com/OptimistikSAS/OIBus/commit/ed7c2584d1d8a0b2d5eafeea4ecce5b49cbeac99))
* **tests:** add integration test for MySQL, PostgreSQL and MSSQL ([79d783f](https://github.com/OptimistikSAS/OIBus/commit/79d783fc40bd9e00c626cac65d63d31a6d106bb8))


### Bug Fixes

* **ci:** adapt release ci ([362bd20](https://github.com/OptimistikSAS/OIBus/commit/362bd20157819b4df2cf27eef00bfbccb04ed4ac))
* **installer:** do not skip config settings if new install ([29ccdf5](https://github.com/OptimistikSAS/OIBus/commit/29ccdf5da64897ad5b05c7574e1296d3b4e841ce))
* **oia:** adapt OIAnalytics North connector help with the latest API key gen feature [#1820](https://github.com/OptimistikSAS/OIBus/issues/1820) ([d6593f1](https://github.com/OptimistikSAS/OIBus/commit/d6593f1f8b2a952fbecf199e88df24609581af92))
* **opchda:** fix blocking history read and fix [#1411](https://github.com/OptimistikSAS/OIBus/issues/1411) ([633a49d](https://github.com/OptimistikSAS/OIBus/commit/633a49d2001e95cd6a0a9f9c3f8f7871fd4f1ee2))
* **opcua:** fix certificate management and reconnection ; switch to node-opcua-client (lighter) ([fcfe8e7](https://github.com/OptimistikSAS/OIBus/commit/fcfe8e75d6ba5bcbdb9d493e3e4b1d2aecb9e6db))
* **release:** fix release version and improve npm script names ([8d9728c](https://github.com/OptimistikSAS/OIBus/commit/8d9728c9019fee091dbdc6e6cc3c1ac823c2d31c))
* **south-opchda:** fix opchda reconnection ([3bd8181](https://github.com/OptimistikSAS/OIBus/commit/3bd8181031a25e25eae73e8234726ef88159832c))
* **south-sql:** fix sqlite param query with better-sqlite3 ([783e11d](https://github.com/OptimistikSAS/OIBus/commit/783e11d30a7fa954e2e60bc098435b100e9a4e6f))
* **sqlite:** add tests and remove async ([fcc924f](https://github.com/OptimistikSAS/OIBus/commit/fcc924ff373837c324ce427f08bdf894941658bb))
* **status:** rework statusData for live update ([e569611](https://github.com/OptimistikSAS/OIBus/commit/e56961198bf2167d8ca612e630fff7045ab8b619))
* **tests:** reorganise tests with tests config ([8ab9d80](https://github.com/OptimistikSAS/OIBus/commit/8ab9d80959aa2f0b65ac5a11f1a032d991d79302))
* **ui:** fix switch buttons to show up properly and make them default checkbox type [#1805](https://github.com/OptimistikSAS/OIBus/issues/1805) ([e004a52](https://github.com/OptimistikSAS/OIBus/commit/e004a52a1b194183a58181d93c42eead21ae3532))
* **win-setup:** fix permissions issues on OIBus windows update ([0a9e2a4](https://github.com/OptimistikSAS/OIBus/commit/0a9e2a4f645b726f8d5ef5edd6cf908be00671d7))

# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.