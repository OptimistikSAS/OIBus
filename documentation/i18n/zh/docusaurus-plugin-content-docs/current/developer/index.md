---
displayed_sidebar: developerSidebar
sidebar_position: 1
---

# OIBus 开发者手册

欢迎加入 OIBus 开发者社区！本指南将帮助您开始为 OIBus 做贡献。

## 🚀 快速开始 {#-getting-started}

### 前置条件 {#prerequisites}

| 工具                       | 用途                                       | 是否必需     | 安装方式                                                                                 |
| -------------------------- | ------------------------------------------ | ------------ | ----------------------------------------------------------------------------------------- |
| Git                        | 版本控制                                    | ✅           | [git-scm.com](https://git-scm.com/downloads)                                             |
| Node.js                    | JavaScript 运行时（版本见 `.nvmrc`）        | ✅           | [nodejs.org](https://nodejs.org/)（或通过 `nvm` 安装）                                    |
| nvm                        | Node 版本管理器                             | 推荐         | [nvm 安装指南](https://github.com/nvm-sh/nvm)                                             |
| VS Code 或 IntelliJ        | 代码编辑器                                  | 推荐         | [VS Code](https://code.visualstudio.com/) · [IntelliJ](https://www.jetbrains.com/idea/)   |
| DBeaver 或 SQLite browser  | 数据库检视工具                              | 可选         | [DBeaver](https://dbeaver.io/) · [SQLite browser](https://sqlitebrowser.org/)             |

## 📥 搭建开发环境 {#-setting-up-your-development-environment}

### 1. 获取源代码 {#1-get-the-source-code}

OIBus 的源代码托管在 GitHub 上，地址是
[github.com/OptimistikSAS/OIBus](https://github.com/OptimistikSAS/OIBus)。您将使用 **Git**
将其克隆到本地，并通过 Pull Request 分享您的工作成果。

:::tip New to Git?
运行一次 [GitHub 的“配置 Git”指南](https://docs.github.com/en/get-started/getting-started-with-git/set-up-git)
来安装并配置它。添加一个
[SSH 密钥](https://docs.github.com/en/authentication/connecting-to-github-with-ssh) 以使用下面的
`git@github.com:…` 格式的 URL——或者将其替换为 `https://github.com/…`，Git 会提示您输入令牌。
[Pro Git 书籍](https://git-scm.com/book/en/v2)（免费在线阅读）是其他所有内容的参考资料。
:::

Git 安装并完成身份验证后，请选择以下选项之一：

**选项 A：适用于贡献者（推荐）**

```bash
# 1. Fork the repository on GitHub (use the "Fork" button on the repo page)
# 2. Clone YOUR fork locally:
git clone git@github.com:<your-username>/OIBus.git
cd OIBus
# 3. Register the OptimistikSAS repo as a second remote called "upstream"
#    so you can later pull in changes from the main project:
git remote add upstream git@github.com:OptimistikSAS/OIBus.git
# 4. Sanity-check both remotes are registered:
git remote -v
```

**选项 B：仅用于评估**

```bash
git clone git@github.com:OptimistikSAS/OIBus.git
cd OIBus
```

#### 日常 Git 工作流 {#day-to-day-git-workflow}

一次典型的贡献流程如下：

```bash
# Start from an up-to-date main
git checkout main
git pull upstream main

# Branch for your change — see "Branch Naming" further down
git checkout -b feat/my-new-feature#1234

# Edit files, then stage and commit
git add <files>
git commit -m "feat(south): describe what you did"

# Push to YOUR fork (origin)
git push -u origin feat/my-new-feature#1234

# Open a Pull Request from your fork's branch into OptimistikSAS/OIBus:main
```

如果在您开发期间 `main` 有了新的提交，请通过 rebase 保持历史记录线性：

```bash
git fetch upstream
git rebase upstream/main
# resolve any conflicts, then:
git push --force-with-lease
```

使用 `--force-with-lease`（而不是普通的 `--force`）——它会拒绝覆盖您不知道的
远程提交，因此不会意外地覆盖掉队友的 review 修复提交。

### 2. 安装依赖 {#2-install-dependencies}

```bash
# Install Node.js version specified in .nvmrc
nvm install
nvm use
```

### 3. 搭建后端 {#3-set-up-the-backend}

```bash
cd backend
npm install
npm start  # Starts on http://localhost:2223
```

### 4. 搭建前端 {#4-set-up-the-frontend}

```bash
cd frontend
npm install
npm start  # Builds and watches for changes
```

:::caution Frontend Note
前端由后端提供服务。虽然 `npm start` 会监听文件变化，但您仍需要**手动刷新**浏览器
才能看到更新。
:::

### 5. 搭建文档站点 {#5-set-up-documentation}

```bash
cd documentation
npm install
npm start  # Starts on http://localhost:3000
```

### 6.（可选）搭建 Launcher {#6-optional-set-up-the-launcher}

除非您正在处理监督进程 / 自动升级相关的工作，否则可以跳过此步骤。Launcher 是一个
独立的 Node 包，拥有自己的依赖和独立的 Node 版本限制（`node >= 24`，详见
`launcher/package.json`）。

```bash
cd launcher
npm install
npm test           # runs node --test on src/**/*.spec.ts
npm run lint
# Bundle a binary for your platform (e.g. macOS arm64):
npm run build:macos-arm64
```

打包生成的二进制文件位于 `build/bin/<platform>/oibus-launcher`，这也正是平台安装
程序中所包含的文件——它负责将 OIBus 运行时二进制文件作为子进程启动。

### 7. 验证您的环境 {#7-verify-your-setup}

- 后端：[http://localhost:2223](http://localhost:2223)
- 文档：[http://localhost:3000](http://localhost:3000)

## 🛠 开发流程 {#-development-workflow}

### 项目结构 {#project-structure}

```
OIBus/
├── backend/          # Backend server (Node.js + TypeScript)
├── frontend/         # Frontend application (Angular)
├── launcher/         # Process supervisor + auto-update (bundled to native binaries)
├── documentation/    # Project documentation (Docusaurus)
├── docker/           # docker-compose stack for simulating sources / destinations
└── data-folder/      # Runtime data (created automatically)
```

**launcher** 是一个小型 TypeScript 程序，在生产环境中监督 OIBus 二进制文件的运行：
它负责处理更新/回滚周期，管理 PID 文件，并且是平台安装程序中所提供的入口点。
它通过 [@yao-pkg/pkg](https://github.com/yao-pkg/pkg) 打包为各平台的可执行文件
（`win-x64`、`macos-x64`、`macos-arm64`、`linux-x64`、`linux-arm64`）。只有在您需要
修改监督进程本身、其管理的磁盘布局，或者更新流程时，才需要接触它。

### 快速测试搭建 {#quick-test-setup}

若要验证一切是否正常工作：

1. 创建一个 **FolderScanner** South 连接器（从目录读取文件）
2. 创建一个 **Console** North 连接器（输出到控制台）
3. 将它们配置为协同工作

## 🔧 开发规范 {#-development-guidelines}

### 分支命名 {#branch-naming}

```
<type>/<descriptive-name>#<issue-number>
```

示例：

- `feature/add-new-connector#1234`
- `fix/folder-scanner-bug#5678`
- `docs/update-readme#9101`

### 提交信息 {#commit-messages}

遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <description>

[optional body — explain the *why*, not the *what*]

[optional footer — e.g. "Closes #1234", "BREAKING CHANGE: ..."]
```

常见类型：`feat`、`fix`、`docs`、`style`、`refactor`、`perf`、`test`、`chore`、`build`、`ci`。

常见的 scope 对应顶层关注点：`south`、`north`、`engine`、`cache`、`transformer`、
`oianalytics`、`logger`、`web-server`、`migration`、`frontend`、`launcher`、`docs`。使用最贴合的
一个；如果变更是跨领域的，可以完全省略 scope。

#### 示例 {#examples}

```text title="Feature commit"
feat(south): add subscription support to south-rest

Extends the REST connector to maintain a long-lived SSE connection and push
events to the engine via addContent. Falls back to polling if the server
responds with anything other than text/event-stream on the subscribe call.

Closes #4231
```

```text title="Bug fix"
fix(cache): write the correct chunk content when maxNumberOfElements > 0

cacheWithoutTransform was JSON.stringify-ing the full content array for each
chunk file instead of the chunk itself, duplicating every payload.
```

```text title="Performance"
perf(north): fan out cacheContent in parallel across enabled Norths

Replaces the sequential await loop in data-stream-engine.addContent with
Promise.all + per-North .catch. A slow North no longer blocks healthy ones.
```

```text title="Refactor"
refactor(south-opcua): cache item-per-node lookup in HistoryRead loop

Replaces the O(N²) Array.find per response result with an item bundled into
the nodesToRead array, accessed by index.
```

```text title="Docs / chore"
docs(create-connector): rewrite outdated class and manifest pages
chore(deps): bump better-sqlite3 to 12.9.0
```

```text title="Breaking change"
feat(north)!: replace handleValues/handleFile with handleContent

BREAKING CHANGE: North subclasses must now implement a single
handleContent(fileStream, metadata) method and declare supportedTypes()
instead of canHandleValues / canHandleFiles flags.
```

合并到 `main` 时使用的是 squash-merge，PR 标题会作为提交信息，因此请确保**标题**
遵循此格式——您分支上的单个提交可以相对宽松一些。

### 测试要求 {#testing-requirements}

所有变更都必须包含测试：

- **后端**：Node 内置的 [`node:test`](https://nodejs.org/api/test.html) 测试运行器，
  TypeScript 通过 [`tsx`](https://tsx.is/) 即时转译。运行 `npm test` 时会自动收集覆盖率
  （排除列表见 `backend/package.json` 中的 `testRunner`）。
- **前端**：通过 Angular 测试工具使用 [Jasmine](https://jasmine.github.io/)。
- **Launcher**：与后端相同的 `node:test` 运行器。

运行测试的方式：

```bash
# Backend — runs all specs with coverage
cd backend
npm test

# Frontend tests
cd frontend
npm test

# Launcher tests (only if you touched launcher/)
cd launcher
npm test

# Linting (run in each package you touched)
npm run lint
```

## 📤 提交贡献 {#-submitting-contributions}

### 开始之前 {#before-you-start}

1. **检查现有 issue**，看是否有类似的工作
2. 如果要新增功能，**创建一个功能 issue**
3. 在编码之前**与维护者讨论您的方案**

### Pull Request 流程 {#pull-request-process}

1. 从 `main` 创建一个分支，遵循[规范命名](#branch-naming)。
2. 进行变更，并使用[清晰的提交信息](#commit-messages)进行提交。
3. 在推送之前，本地运行以下检查，逐项确认：
   - [ ] 代码遵循项目风格（在每个您改动过的包中运行 `npm run lint`）。
   - [ ] 所有测试通过（`npm test`）。
   - [ ] 新功能包含测试；现有覆盖率保持不变。
   - [ ] 如果变更对用户可见或改变了开发者工作流，已更新相应文档。
   - [ ] 变更向后兼容（否则在 PR 标题中用 `!` 标注破坏性变更，并在正文中添加
         `BREAKING CHANGE:` 脚注）。
4. 推送到您的 fork，并向 `OptimistikSAS/OIBus:main` 发起 Pull Request。
5. 等待代码审查并处理反馈。任何 rebase 后的推送都请使用 `--force-with-lease`（参见
   [Git 工作流](#1-get-the-source-code)）。

## 🤝 社区准则 {#-community-guidelines}

### 如何参与贡献 {#how-to-contribute}

1. **从小处着手**：修复拼写错误、改进文档，或处理带有“good first issue”标签的 issue
2. **提出问题**：使用 GitHub discussions 或 issue
3. **保持耐心**：我们会尽快审查您的 PR
4. **持续跟进**：及时响应反馈

### 行为准则 {#code-of-conduct}

我们遵循一份[行为准则](https://github.com/OptimistikSAS/OIBus/blob/main/DEVELOPER-GUIDELINES.md)，以确保社区的友好氛围。

## 📚 学习资源 {#-learning-resources}

### 使用的技术 {#technologies-used}

| 领域   | 技术                 | 学习资源                                                                                          |
| ------ | -------------------- | --------------------------------------------------------------------------------------------------- |
| 后端   | Node.js              | [Node.js 文档](https://nodejs.org/en/docs/)                                                          |
| 前端   | Angular              | [Angular 文档](https://angular.io/docs)                                                              |
| 文档   | Docusaurus           | [Docusaurus 文档](https://docusaurus.io/)                                                            |
| 测试   | node:test / Jasmine  | [node:test 文档](https://nodejs.org/api/test.html)、[Jasmine 文档](https://jasmine.github.io/)      |

### 推荐阅读 {#recommended-reading}

指向 OIBus 所依赖的各个库的官方文档深链接。每一个链接都指向在处理该代码库时
直接有用的具体章节——而非泛泛的落地页。

- [TypeScript 手册](https://www.typescriptlang.org/docs/handbook/intro.html) — 后端和前端
  都是严格模式的 TypeScript；手册中关于泛型和可判别联合类型的章节，与清单 /
  设置层尤其相关。
- [Angular 指南](https://angular.dev/overview) — 前端使用 Angular 构建，包括响应式
  表单（用于渲染清单）和独立（standalone）组件。
- [Node.js `node:stream` 模块](https://nodejs.org/api/stream.html) — 缓存管道、转换器，
  以及 North 的 `handleContent` 都使用流；理解背压（backpressure）和 `pipeline()` 很重要。
- [Pino 日志库](https://getpino.io/) — 每个连接器都使用 `this.logger`；其日志级别和
  子日志器（child-logger）模式是
  [连接器类指南](./create-connector/class.md)中约定的依据。
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md) — 本地
  缓存（实体、指标、日志、south-cache）全部使用 better-sqlite3；预编译语句和事务
  在每个 repository 中都会出现。
- [Knex migrations](https://knexjs.org/guide/migrations.html) — schema 变更都通过 Knex 完成；
  `backend/src/migration/` 下的迁移文件遵循此指南中的约定。
- [Node.js `node:test`](https://nodejs.org/api/test.html) — 后端和 launcher 共用的测试
  运行器。关键章节：[mocking](https://nodejs.org/api/test.html#mocking)、
  [mock timers](https://nodejs.org/api/test.html#class-mocktimers)，以及
  [覆盖率](https://nodejs.org/api/test.html#collecting-code-coverage)（两者在连接器
  测试中都被大量使用）。
- [Docusaurus](https://docusaurus.io/docs) — 用于编辑文档站点本身。
- [Conventional Commits](https://www.conventionalcommits.org/) 和
  [语义化版本控制（Semantic Versioning）](https://semver.org/) — OIBus 使用的提交信息
  格式与发布版本约定。

## 🎯 首次贡献 {#-first-contributions}

以下是一些具体的入门方向，按投入程度从低到高排列。请根据您的可用时间和对该
技术栈的熟悉程度选择合适的方向。

### 文档修复 {#documentation-fixes}

让您的第一个 PR 落地的最快方式。大多数页面都以 Markdown / MDX 形式存放在
`documentation/docs/` 中——拼写错误、缺失的示例、过时的截图和失效的链接都是有价值
的贡献。在 `documentation/` 中运行 `npm start` 即可在本地预览您的更改。

搜索[已开放的文档 issue](https://github.com/OptimistikSAS/OIBus/labels/documentation)，
或者直接修复您在阅读这些文档时注意到的问题。

### 缺陷修复 {#bug-fixes}

寻找带有 [`good first issue`](https://github.com/OptimistikSAS/OIBus/labels/good%20first%20issue)
标签的 issue——这些 issue 经过刻意限定范围，使新贡献者无需通读整个代码库
就能提交一个可用的 PR。如果没有符合您兴趣的，可以浏览更广泛的
[`bug` 标签](https://github.com/OptimistikSAS/OIBus/labels/bug)，选择一个可复现的问题。
**在开始之前请先在 issue 下留言**，以便我们确认没有其他人已经在处理它，并回答
任何前期问题。

### 改进现有连接器 {#improve-an-existing-connector}

OIBus 的 South / North 连接器是循序渐进学习代码库的好方式：每一个都是一个小型的
自包含类，配有清单和测试文件，并且都遵循相同的模式。适合入门的工作包括新增一个
设置项、改进错误信息，或者扩展 `testConnection()` 以展示更多诊断信息。

从 `backend/src/south/south-<type>/`（或对应的 North 文件夹）入手，浏览对应的
`.spec.ts` 文件，了解已覆盖的内容。每个 PR 都应保持 100% 的覆盖率。

### 新增一个连接器 {#add-a-new-connector}

对于较大规模的贡献，请参见专门的指南：
[创建一个新的 OIBus 连接器](./create-connector/presentation.md)。它详细介绍了文件
布局、四个注册步骤（类型列表、工厂、类型生成器、翻译），清单格式，以及带有完整
可运行示例的连接器类 API。

### 对产品进行基准测试 {#benchmark-the-product}

我们欢迎那些在真实负载下 _测量_ OIBus 行为的贡献，无论是提出有针对性的修复方案，
还是仅仅记录发现的结果。仓库提供了一个 `docker-compose.yml`，其中包含模拟的数据
源和目的地，专门用来让这类工作变得更易上手：

| 容器                          | Profile     | 用途                                                                                |
| ----------------------------- | ----------- | ------------------------------------------------------------------------------------- |
| `opcua-server`                | _（默认）_  | 微软的 `opc-plc` — 带有 8 个可配置节点及历史归档支持的 OPC UA 服务器                    |
| `modbus-server`                | _（默认）_  | `oitc/modbus-server` — Modbus TCP 服务器                                              |
| `simulator`                   | _（默认）_  | 一个向 Modbus 和 MQTT 同时写入正弦波数值的 Python 脚本                                |
| `mqtt-broker`                  | _（默认）_  | Eclipse Mosquitto broker（需身份验证，WebSocket 端口为 9001）                          |
| `postgres`                     | _（默认）_  | 用于 South-PostgreSQL 的 PostgreSQL                                                    |
| `ftp-server` / `sftp-server`   | `testing`   | 基于文件的数据源                                                                        |
| `oibus` / `nginx`              | `oibus`     | 完整的 OIBus 运行时 + 反向代理，用于端到端测试                                          |

使用 `docker compose up -d` 启动整个栈（部分服务位于 `testing` / `oibus` 的 Docker
Compose profile 之下——详见相关文件）。然后将 OIBus 配置指向这些模拟器，并在增加
条目数量、扫描模式频率或批量大小时观察其行为表现。

关于每项服务、其镜像、模拟信号及配置选项的完整说明，请参阅
[本地测试环境](./local-test-stack.md)页面。

**最有价值的测量内容：**

- **持续负载下的吞吐量** — South 在不产生队列背压的情况下每秒能摄取多少条目；
  North 在不在错误文件夹中堆积的情况下每秒能投递多少文件。
- **内存增长** — 在数小时的运行过程中观察堆内存和 RSS，寻找转换器或缓存路径中
  的缓慢内存泄漏。
- **启动时间** — 在存在数百万条日志 / 积压缓存的情况下的启动时间。这方面的改进
  对每个操作人员的每次重启都是显而易见的。
- **数据库热点路径** — 各个 SQLite 缓存（`south-cache.repository`、`log.repository`、
  各指标 repository）都运行在写线程上；一份指向具体某条查询的性能剖析记录是非常
  宝贵的。

在提出修复方案时，请在 PR 描述中附上一份前后对比的测量数据（哪怕只是粗略的
数据——一个用 `process.hrtime.bigint()` 包装的微基准测试，或一张正在运行的 OIBus
截图，都比完全没有数字要好）。这能让审查更快，也能为团队日后的回归检查提供
基线。

---

**准备好参与贡献了吗？** 我们非常期待您的加入！🎉
