---
displayed_sidebar: developerSidebar
sidebar_position: 6
---

import DownloadButton from '../../../../../src/components/DownloadButton';

# 本地测试环境

仓库根目录下的 `docker-compose.yml` 会启动一整套协议服务器和模拟器，让您无需
接触真实的工业设备即可开发和测试 OIBus 连接器。本页记录了每一项服务、它模拟的
内容、如何配置它，以及如何启动它。

## 快速开始 {#quick-start}

启动该测试环境最简单的方式是使用 `backend/package.json` 中定义的 npm 脚本。
请在 `backend/` 目录下运行它们：

```bash
# IoT protocol servers only (OPC UA, Modbus, MQTT)
npm run docker:iot

# IoT servers + database servers + simulator (recommended for connector development)
npm run docker:simulator

# PostgreSQL + InfluxDB
npm run docker:database

# FTP / SFTP servers only
npm run docker:ftp

# Syslog test receiver only
npm run docker:logging

# Squid forward proxy (with auth) only
npm run docker:proxy

# Full development stack: IoT + simulator + database
npm run docker:dev

# Everything including OIBus runtime and nginx
npm run docker:all

# Tear down all containers
npm run docker:down
```

如果需要自定义 profile 组合，您也可以直接调用 Docker Compose：

```bash
docker compose --profile iot --profile database --profile simulator up -d
```

各服务被划分为多个 **Docker Compose profile**：

| Profile     | 服务                                            |
| ----------- | ----------------------------------------------- |
| `iot`       | `opcua-server`、`modbus-server`、`mqtt-broker`  |
| `simulator` | `simulator`                                     |
| `database`  | `postgres`、`influxdb`                          |
| `ftp`       | `ftp-server`、`sftp-server`                     |
| `logging`   | `syslog-server`                                 |
| `proxy`     | `squid-proxy`                                   |
| `oibus`     | `oibus`、`nginx`                                |

:::note Profile independence
`simulator` profile 需要 `iot` 和 `database` profile 中的服务同时运行（Modbus
服务器、MQTT broker、InfluxDB 和 PostgreSQL）。请始终一起启动它们：`--profile iot --profile
database --profile simulator`（或者使用 `npm run docker:simulator`，它会自动完成这一点）。
:::

所有服务共享内部桥接网络 `oibus-network`。各端口被转发到 `localhost`，因此在
Docker 外部运行的 OIBus（即在 `backend/` 目录下执行 `npm start`）可以直接访问它们。

---

## 服务 {#services}

### OPC UA 服务器 — `opcua-server` {#opc-ua-server--opcua-server}

| 属性       | 值                                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------------------- |
| **镜像**   | [`mcr.microsoft.com/iotedge/opc-plc`](https://mcr.microsoft.com/en-us/artifact/mar/iotedge/opc-plc/about) |
| **端口**   | `50000`（OPC UA TCP）                                                                                      |
| **配置**   | `docker/opcua/nodes_config.json`                                                                          |

微软的 [OPC PLC 模拟器](https://github.com/Azure-Samples/iot-edge-opc-plc)。它暴露了一个
标准的 OPC UA 服务器，其中包含在 `nodes_config.json` 中定义的自定义节点，以及一组
内置节点（锅炉模拟、快/慢变化变量等）。

**自定义节点**（位于 `OIBus` 文件夹中，全部设置了 `Historizing: true`）：

| 节点 ID | 描述           | 数据类型 | 模拟方式    | 参数                                   |
| ------- | -------------- | -------- | ----------- | --------------------------------------- |
| `1023`  | 温度（°C）     | `Double` | 随机游走    | 18 – 28 °C，步进 0.5，每 2 秒          |
| `1024`  | 压力（hPa）    | `Double` | 正弦波      | 1013.25 ± 10 hPa，周期 10 秒            |
| `1025`  | 流量（L/min）  | `Double` | 随机游走    | 40 – 60 L/min，步进 1，每 3 秒          |
| `1026`  | 湿度（%）      | `Double` | 正弦波      | 65 ± 15 %，周期 15 秒                   |
| `1027`  | 转速（RPM）    | `Int32`  | 随机游走    | 1 200 – 1 800，步进 50，每 2.5 秒       |
| `1028`  | 泵状态         | `Boolean`| 方波        | 周期 20 秒                              |
| `1029`  | 电压（V）      | `Double` | 随机游走    | 210 – 230 V，步进 0.5，每 2 秒          |
| `1030`  | 电流（A）      | `Double` | 正弦波      | 15.2 ± 2 A，周期 12 秒                  |

节点 ID 遵循 OPC UA 命名空间 `ns=3;i=<NodeId>`。例如，温度的 OPC UA 地址
是 `ns=3;i=1023`。

**历史归档支持：** `Historizing: true` 会在每个自定义节点上启用 OPC UA 历史数据访问
（HA）功能。该服务器会响应 `HistoryRead` 请求，因此适合用来测试 OIBus 的历史查询
模式。

:::caution In-memory history only
历史数据存储在内存中——不会持久化到磁盘。容器重启时，所有历史数据都会丢失。
需要在长时间间隔（数天/数周）之后进行数据补齐的场景，无法使用该模拟器复现。
:::

**身份验证：** 匿名访问已被禁用。请使用通过环境变量配置的凭据
`OPCUA_DEFAULT_PASSWORD`（默认为 `pass`）和 `OPCUA_ADMIN_PASSWORD`（默认为 `pass`），
对应的用户名分别为 `oibus` 和 `admin`（在 `docker-compose.yml` 中设置）。

**从 OIBus 连接：** 创建一个 South OPC UA 连接器，使用以下设置：

| 设置            | 值                                     |
| --------------- | -------------------------------------- |
| **URL**         | `opc.tcp://localhost:50000`            |
| **安全模式**    | `none`                                 |
| **安全策略**    | `none`                                 |
| **身份验证**    | `basic`                                |
| **用户名**      | `oibus`                                |
| **密码**        | `pass`（或 `$OPCUA_DEFAULT_PASSWORD`） |

<div style={{ display: 'flex', justifyContent: 'center' }}>
  <DownloadButton link="/files/opcua-item-list.csv">Download item list (CSV)</DownloadButton>
</div>

---

### Modbus 服务器 — `modbus-server` {#modbus-server--modbus-server}

| 属性       | 值                                                                   |
| ---------- | --------------------------------------------------------------------- |
| **镜像**   | [`oitc/modbus-server`](https://hub.docker.com/r/oitc/modbus-server)  |
| **端口**   | `5020`（Modbus TCP）                                                  |
| **配置**   | `docker/modbus/server_config.json`                                    |

一个轻量级的 Modbus TCP 服务器。其寄存器映射在 `server_config.json` 中声明。该
服务器接受来自任意 Modbus TCP 客户端的写操作，因此[模拟器](#unified-simulator--simulator)
可以实时动态更新保持寄存器和线圈。

:::note server_config.json key numbering vs OIBus Address offset
该配置文件使用**从 1 开始的寄存器 key**（`"1"`、`"2"` ……），因为该服务器配置了
`"zeroMode": false`。这只是服务器配置文件格式的一个细节——在线路层面，Modbus TCP
始终是从 0 开始编号的，因此映射关系就是简单的
`配置 key = 协议地址 + 1`。

这与 OIBus 中的[**地址偏移**](../guide/south-connectors/modbus.mdx#connection-configuration)
设置（Modbus 与 JBus）无关。将 OIBus 连接到该服务器时，保持默认的
**Modbus** 偏移（无偏移）：OIBus 发送从 0 开始的协议地址，服务器会在内部将其
解析为对应的从 1 开始的 key。JBus 偏移仅在设备本身在 Modbus 协议层面就暴露
从 1 开始的地址时才需要使用。
:::

**初始寄存器值**（模拟器连接后会覆盖这些值）：

| 寄存器类型     | 协议地址          | 初始值        | 描述                       |
| -------------- | :---------------: | :-----------: | -------------------------- |
| 输入寄存器     |        0           |     `314`     | 固件版本（uint16）          |
| 输入寄存器     |        1           |    `22136`    | 序列号 — 低位字            |
| 输入寄存器     |        2           |    `4660`     | 序列号 — 高位字            |
| 离散输入       |        0           |    `true`     | 面板门已关闭                |
| 离散输入       |        1           |    `true`     | 安全继电器正常              |
| 离散输入       |        2           |    `false`    | 网络已连接                  |
| 离散输入       |        3           |    `false`    | 急停已按下                  |

从 Modbus 客户端的角度看，输入寄存器和离散输入是**只读**的，因此它们的值是静态
的，来自 `server_config.json`。保持寄存器和线圈则由模拟器每 2 秒更新一次。

**从 OIBus 连接：** 创建一个 South Modbus 连接器，使用以下设置：

| 设置          | 值          |
| ------------- | ----------- |
| **主机**      | `localhost` |
| **端口**      | `5020`      |
| **从站 ID**   | `1`         |
| **地址偏移**  | `Modbus`    |

<div style={{ display: 'flex', justifyContent: 'center' }}>
  <DownloadButton link="/files/modbus-item-list.csv">Download item list (CSV)</DownloadButton>
</div>

---

### MQTT Broker — `mqtt-broker` {#mqtt-broker--mqtt-broker}

| 属性       | 值                                                                 |
| ---------- | -------------------------------------------------------------------- |
| **镜像**   | [`eclipse-mosquitto`](https://hub.docker.com/_/eclipse-mosquitto)    |
| **端口**   | `1883`（MQTT）、`9001`（WebSocket）                                  |
| **配置**   | `docker/mosquitto/config/`                                           |

带有自定义入口脚本（`docker/mosquitto/entrypoint.sh`）的 Eclipse Mosquitto，该脚本
会在启动时注入 `MQTT_USER` / `MQTT_PASSWORD` 凭据。匿名访问已被禁用。

`9001` WebSocket 端口可供基于浏览器的 MQTT 客户端使用（如有需要）。

**从 OIBus 连接：** 创建一个 South MQTT 连接器，使用以下设置：

| 设置            | 值                             |
| --------------- | ------------------------------- |
| **URL**         | `mqtt://localhost:1883`         |
| **QoS**         | `1`                              |
| **身份验证**    | `basic`                          |
| **用户名**      | `oibus`                          |
| **密码**        | `pass`（或 `$MQTT_PASSWORD`）    |

条目订阅模拟器发布的[标量主题](#scalar-topics)（JSON 主题则用于
`any-content` / 自定义转换器测试，不适合作为逐点数值条目）：

<div style={{ display: 'flex', justifyContent: 'center' }}>
  <DownloadButton link="/files/mqtt-item-list.csv">Download item list (CSV)</DownloadButton>
</div>

---

### Syslog 服务器 — `syslog-server` _（profile：`logging`）_ {#syslog-server--syslog-server-_profile-logging_}

| 属性       | 值                                                    |
| ---------- | ------------------------------------------------------ |
| **镜像**   | [`python:3.14-slim`](https://hub.docker.com/_/python)  |
| **端口**   | `514`（UDP）、`514`（TCP）                              |
| **脚本**   | `docker/syslog/syslog_server.py`                       |

一个最小化的 syslog 接收器，用于测试 OIBus 的 Syslog logger（引擎设置 → 日志 →
Syslog）。它同时监听同一端口的 UDP 和 TCP，并将收到的每一行打印到 stdout——不做
任何解析或身份验证，其存在的唯一目的就是让您清楚地看到 OIBus 通过网络发送的
确切内容：

```bash
docker compose logs -f syslog-server
```

**从 OIBus 连接**：在引擎设置 → 日志 → Syslog 中，设置**主机**为 `localhost`，
**端口**为 `514`，**协议**为 `udp4`（或 `tcp`），然后启用您要测试的日志级别。

---

### Squid 代理 — `squid-proxy` _（profile：`proxy`）_ {#squid-proxy--squid-proxy-_profile-proxy_}

| 属性       | 值                                                             |
| ---------- | ---------------------------------------------------------------- |
| **镜像**   | [`ubuntu/squid`](https://hub.docker.com/r/ubuntu/squid)         |
| **端口**   | `3128`（HTTP/HTTPS 正向代理）                                    |
| **配置**   | `docker/squid/conf.d/auth.conf`、`docker/squid/entrypoint.sh`    |

一个需要 HTTP 基本身份验证的真实 Squid 正向代理，用于测试 OIBus 的
[代理服务器](../guide/engine/engine-settings.mdx#proxy-server) ——特别是
[“转发到上游代理”](../guide/engine/engine-settings.mdx#forward-to-an-upstream-proxy)
功能。`docker/squid/entrypoint.sh` 会在容器启动时根据 `SQUID_USER`（默认为
`oibus`）/ `SQUID_PASSWORD`（默认为 `pass`）环境变量，使用 `openssl passwd -6`
生成 `/etc/squid/passwords`；`docker/squid/conf.d/auth.conf` 会被默认 squid.conf 中的
`include /etc/squid/conf.d/*.conf` 加载，并要求每个请求都携带 `proxy_auth`。

要测试正向代理功能：先启用 OIBus 自身的代理服务器，然后启用
**转发到上游代理**，**URL** 设为 `http://localhost:3128`，并使用上述凭据。
只有当 OIBus 的代理正确附加了上游的 `Proxy-Authorization` 头时，通过该代理的
请求才会成功——可以查看 `docker compose logs -f squid-proxy`，或尝试使用错误的
凭据来验证这一点。

---

### PostgreSQL — `postgres` {#postgresql--postgres}

| 属性     | 值                                              |
| -------- | ------------------------------------------------ |
| **镜像** | [`postgres`](https://hub.docker.com/_/postgres)   |
| **端口** | `5432`                                            |

一个原生的 PostgreSQL 实例，用于测试 South-PostgreSQL 连接器。凭据如下：

| 变量                 | 默认值      |
| -------------------- | ----------- |
| `POSTGRES_USER`      | `oibus`     |
| `POSTGRES_PASSWORD`  | `pass`      |
| `POSTGRES_DB`        | `oibus-db`  |

可以通过 `.env` 文件或 shell 环境变量覆盖密码（例如
`POSTGRES_PASSWORD=secret docker compose up`）。

[模拟器](#unified-simulator--simulator)每 `POSTGRES_UPDATE_INTERVAL` 秒（默认 10 秒）
向 `sensor_readings` 表写入若干行数据，该表在首次连接时自动创建：

```sql
CREATE TABLE IF NOT EXISTS sensor_readings (
    id SERIAL PRIMARY KEY,
    "timestamp" TIMESTAMPTZ NOT NULL,
    workshop TEXT NOT NULL,
    sensor_id TEXT NOT NULL,
    measurement TEXT NOT NULL,
    value DOUBLE PRECISION NOT NULL
);
```

---

### InfluxDB — `influxdb` {#influxdb--influxdb}

| 属性     | 值                                                 |
| -------- | ---------------------------------------------------- |
| **镜像** | [`influxdb:2`](https://hub.docker.com/_/influxdb)    |
| **端口** | `8088`（主机）→ `8086`（容器）                        |

一个 InfluxDB 2.x 实例，用于测试 South-InfluxDB 连接器，通过镜像内置的初始化模式
在首次启动时完成配置。凭据 / 连接详情如下：

| 变量                              | 默认值               |
| --------------------------------- | -------------------- |
| `DOCKER_INFLUXDB_INIT_USERNAME`   | `oibus`               |
| `INFLUXDB_PASSWORD`               | `oibuspassword`       |
| `DOCKER_INFLUXDB_INIT_ORG`        | `oibus`               |
| `DOCKER_INFLUXDB_INIT_BUCKET`     | `oibus-bucket`        |
| `INFLUXDB_TOKEN`                  | `oibus-admin-token`   |

:::note Why not `pass`?
该测试环境中的其他每一项服务都默认使用 `oibus` / `pass` 凭据，但 InfluxDB 2 在
初始化设置时会拒绝少于 8 个字符的密码，因此这里不能使用 `pass`。如有需要，
请通过 `INFLUXDB_PASSWORD` 覆盖为您自己的值（8 位以上字符）。
:::

[模拟器](#unified-simulator--simulator)每 `INFLUXDB_UPDATE_INTERVAL` 秒（默认 10 秒）
向该 bucket 写入数据点。容器重建时数据不会被持久化（未挂载卷），这与 `postgres`
服务的临时性设置一致。

该容器内部监听 `8086` 端口，映射到主机端口 `8088`，以避免与本地安装的 InfluxDB
冲突。`oibus-network` 上的其他容器（如模拟器）通过 `http://influxdb:8086` 访问它；
从主机（例如通过 `npm start` 运行的 OIBus，或浏览器中的 InfluxDB UI）则使用
`http://localhost:8088`。

可以通过 `.env` 文件或 shell 环境变量覆盖密码/令牌（例如
`INFLUXDB_PASSWORD=secret docker compose up`）。

**条目查询示例（`version: 2`，Flux）：** OIBus 会将 `@StartTime` / `@EndTime` 直接
（不加引号）替换到条目的 `query` 设置中，因此它们可以在 `range()` 中用作 Flux 的
时间字面量。以下查询模拟器写入的 `temperature` measurement，并通过标签筛选出
单个传感器：

```flux title="South-InfluxDB item query"
from(bucket: "oibus-bucket")
  |> range(start: @StartTime, stop: @EndTime)
  |> filter(fn: (r) => r._measurement == "temperature")
  |> filter(fn: (r) => r._field == "value")
  |> filter(fn: (r) => r.workshop == "workshop1" and r.sensor_id == "sensor1")
  |> keep(columns: ["_time", "_value", "workshop", "sensor_id"])
```

去掉最后两个 `filter()` 调用（或调整标签值），即可拉取某个 measurement 下所有
车间/传感器的数据，或者将 `"temperature"` 换成模拟器写入的其他任意 measurement
（`humidity`、`pressure`、`vibration`、`co2` — 参见[下方的传感器表](#influxdb-thread)）。

:::tip Excluding the start of the range
Flux 的 `range()` 对 `start` 是闭区间（`start <= _time < stop`）。由于 OIBus 的下一次
轮询恰好从上一次 `@EndTime` 结束的地方开始，一个恰好落在该边界上的数据点会被
返回两次。添加一个针对 `_time` 的显式过滤条件，使起点也变为开区间：

```flux
from(bucket: "oibus-bucket")
  |> range(start: @StartTime, stop: @EndTime)
  |> filter(fn: (r) => r._time > @StartTime)
  |> filter(fn: (r) => r._measurement == "temperature")
  |> filter(fn: (r) => r._field == "value")
```

:::

---

### FTP 服务器 — `ftp-server` _（profile：`ftp`）_ {#ftp-server--ftp-server-_profile-ftp_}

| 属性     | 值                                                        |
| -------- | ----------------------------------------------------------- |
| **镜像** | [`fauria/vsftpd`](https://hub.docker.com/r/fauria/vsftpd)   |
| **端口** | `20`、`21`、`21100–21110`（被动模式）                        |

被动模式的 vsftpd。凭据：`oibus` / `pass`（可通过 `FTP_PASSWORD` 覆盖密码）。文件
存放在 `docker/ftp/data/`。

---

### SFTP 服务器 — `sftp-server` _（profile：`ftp`）_ {#sftp-server--sftp-server-_profile-ftp_}

| 属性     | 值                                                   |
| -------- | ------------------------------------------------------ |
| **镜像** | [`atmoz/sftp`](https://hub.docker.com/r/atmoz/sftp)    |
| **端口** | `2222`（SSH）                                          |

单用户的 SFTP 服务器。凭据：`oibus` / `pass`（可通过 `SFTP_PASSWORD` 覆盖密码）。
上传目录：`docker/sftp/data/`。

---

### OIBus 运行时 — `oibus` _（profile：`oibus`）_ {#oibus-runtime--oibus-_profile-oibus_}

| 属性     | 值                                                                                        |
| -------- | -------------------------------------------------------------------------------------------- |
| **镜像** | [`ghcr.io/optimistiksas/oibus`](https://github.com/OptimistikSAS/OIBus/pkgs/container/oibus)|
| **端口** | `2223`（Web UI / API）                                                                        |
| **数据** | `./data-folder` → `/app/OIBus/OIBusData`                                                     |

OIBus 运行时本身，适用于您希望在 Docker 内测试完整技术栈，而不是通过 `npm start`
运行后端的场景。有关该镜像的详细信息，请参见 [Docker 镜像](./docker.mdx)。

---

### Nginx — `nginx` _（profile：`oibus`）_ {#nginx--nginx-_profile-oibus_}

| 属性       | 值                                     |
| ---------- | ---------------------------------------- |
| **镜像**   | [`nginx`](https://hub.docker.com/_/nginx)|
| **端口**   | `80`（HTTP）、`443`（HTTPS）              |
| **配置**   | `docker/nginx/`                           |

位于 OIBus 容器前面的反向代理。需要设置 `DOMAIN` 环境变量，并在
`docker/nginx/certs/` 中提供 TLS 证书。仅在测试完整的 TLS / 反向代理设置时才需要。

---

### 统一模拟器 — `simulator` {#unified-simulator--simulator}

| 属性       | 值                                                                    |
| ---------- | ------------------------------------------------------------------------ |
| **镜像**   | [`python:3.14-slim`](https://hub.docker.com/_/python)                    |
| **脚本**   | `docker/simulator/simulator.py`                                          |
| **库**     | `pymodbus==3.6.9`、`paho-mqtt`、`influxdb-client`、`psycopg2-binary`     |

一个单一的 Python 脚本，驱动 Modbus 服务器、MQTT broker、InfluxDB 和 PostgreSQL。
它为每个数据源运行一个独立的守护线程，每个线程都有自己独立的重试循环，因此
某一个数据源的故障不会影响其他数据源。

#### Modbus 线程 {#modbus-thread}

每 `MODBUS_UPDATE_INTERVAL` 秒（默认 2 秒）向 Modbus 服务器写入数据。除非另有
说明，所有数值均为带有 5% 随机噪声的正弦波。

**保持寄存器 — uint16（1 个字）：**

| 协议地址 | 名称         | 基准值 | 振幅 | 周期    |
| :------: | ------------ | -----: | ---: | ------: |
|    0     | temperature  |   250  |   50 |   60 秒 |
|    1     | humidity     |   600  |  200 |  120 秒 |
|    2     | pressure     |   100  |   30 |  180 秒 |
|    3     | vibration    |   250  |  200 |   30 秒 |
|    4     | co2          |   600  |  200 |  300 秒 |
|    5     | flow_rate    |   150  |   80 |   90 秒 |

**保持寄存器 — 扩展数据类型（多字）：**

| 协议地址 | 名称               | 数据类型 |    基准值 |  振幅   | 周期    |
| :------: | ------------------ | -------- | --------: | ------: | ------: |
|    6     | outdoor_temp       | int16    |        5  |      25 |  240 秒 |
|   7 – 8  | production_count   | uint32   |   50 000  |  40 000 |  600 秒 |
|  9 – 10  | power_kw           | float    |     75.5  |    45.0 |  180 秒 |
| 11 – 12  | energy_balance     | int32    |        0  |   5 000 |  360 秒 |
| 13 – 16  | shaft_speed        | double   |  1 500.0  |   300.0 |  120 秒 |
|    17    | status_flags       | bitfield |        —  |       — |       — |

`status_flags` 是一个 16 位寄存器，其各个独立位分别是独立的方波：

| 位  | 名称              | 周期    |
| :-: | ----------------- | ------: |
|  0  | motor_running      |   60 秒 |
|  1  | fault_detected     |  300 秒 |
|  2  | maintenance_due    |  600 秒 |
|  3  | overload           |  120 秒 |

**线圈（方波，1 = 周期前半段为开）：**

| 协议地址 | 名称          | 周期    |
| :------: | ------------- | ------: |
|    0     | pump_running  |   30 秒 |
|    1     | valve_open    |   45 秒 |
|    2     | alarm_active  |  120 秒 |
|    3     | machine_on    |   20 秒 |

:::info Multi-word encoding
OIBus 在读取多字数值之前会无条件地对其应用 `swap32() + swap16()`。模拟器对此
的处理方式是，在每个 32 位双字中**先写入低 16 位字，再写入高 16 位字**。这与
OIBus 的默认设置一致（`swapWordsInDWords: false`、`endianness: big-endian`）。
:::

#### MQTT 线程 {#mqtt-thread}

每 `MQTT_UPDATE_INTERVAL` 秒（默认 2 秒）向 MQTT broker 发布数据。每个发布周期
发送**两类**主题：

- **标量主题** — 单个数字，用于基于数值的条目。
- **JSON 主题**（位于 `<workshop>/json/<shape>` 下）— 不同形状的结构化负载。OIBus
  的 MQTT South 将这些内容作为 `any-content` 摄取，非常适合用来测试自定义转换器。

##### 标量主题 {#scalar-topics}

主题遵循 `<workshop>/<sensor>/<type>` 的模式，携带一个裸数字（例如 `23.5`）。所有
数值均为带有 5% 随机噪声的正弦波。

| 主题                             |     基准值 |  振幅  | 周期    |
| -------------------------------- | ---------: | -----: | ------: |
| `workshop1/sensor1/temperature`  |       30.0 |   10.0 |   60 秒 |
| `workshop1/sensor2/humidity`     |       55.0 |   25.0 |  120 秒 |
| `workshop1/sensor3/pressure`     |    1 000.0 |   50.0 |  180 秒 |
| `workshop1/sensor4/vibration`    |        5.0 |    5.0 |   30 秒 |
| `workshop2/sensor1/temperature`  |       28.0 |    8.0 |   90 秒 |
| `workshop2/sensor2/humidity`     |       50.0 |   20.0 |  150 秒 |
| `workshop2/sensor3/pressure`     |      990.0 |   40.0 |  210 秒 |
| `workshop2/sensor4/vibration`    |        4.0 |    4.0 |   45 秒 |

##### JSON 主题 {#json-topics}

每个主题发布不同的 JSON **形状**，因此连接器和自定义转换器可以针对 OIBus 通过
MQTT 可能收到的全部负载类型进行测试。数值每个周期都会变化（带噪声的正弦波）。

| 主题                     | 形状                                     |
| ------------------------ | ------------------------------------------ |
| `workshop1/json/flat`    | 扁平对象（单条读数）                       |
| `workshop1/json/nested`  | 嵌套对象                                    |
| `workshop1/json/array`   | 读数数组（一批数据）                       |
| `workshop2/json/mixed`   | 每种 JSON 标量类型 + 数组 + 对象           |
| `workshop2/json/string`  | 一个 JSON 字符串                           |
| `workshop2/json/number`  | 一个裸 JSON 数字                           |

负载示例：

```json title="workshop1/json/flat"
{ "value": 35.17, "unit": "celsius", "timestamp": "2026-06-04T08:15:06.673+00:00", "quality": "good" }
```

```json title="workshop1/json/nested"
{
  "sensor": { "id": "sensor-42", "type": "temperature", "location": { "workshop": "workshop1", "line": 3 } },
  "reading": { "value": 34.9, "timestamp": "2026-06-04T08:15:06.673+00:00" }
}
```

```json title="workshop1/json/array"
[
  { "timestamp": "2026-06-04T08:15:06.673+00:00", "value": 34.95 },
  { "timestamp": "2026-06-04T08:15:08.673+00:00", "value": 35.48 },
  { "timestamp": "2026-06-04T08:15:10.673+00:00", "value": 37.16 }
]
```

```json title="workshop2/json/mixed"
{
  "int": 116,
  "float": 3.741,
  "bool": true,
  "string": "ok",
  "null": null,
  "tags": ["alpha", "beta"],
  "nested": { "a": 1, "b": [1, 2, 3] }
}
```

```json title="workshop2/json/string"
"reading-12"
```

```json title="workshop2/json/number"
42.7
```

:::tip Testing custom transformers
`nested`、`array` 和 `mixed` 负载中包含本身就是对象或数组的字段。它们非常适合
用来测试某个从负载字段派生输出文件名或内容的自定义转换器——如果该处返回了
非字符串值，就绝不能让其进入指标数据库，而这些主题正好可以轻松复现这类边界
情况。
:::

#### InfluxDB 线程 {#influxdb-thread}

每 `INFLUXDB_UPDATE_INTERVAL` 秒（默认 **10 秒**）向 InfluxDB 写入数据。每个写入
周期为每个传感器写入一个数据点，每个点都带有 `workshop` 和 `sensor_id` 标签，
并携带单个 `value` 字段，分布在多个 measurement 中，以便 OIBus 的 InfluxDB South
连接器有多个 measurement/标签可供查询：

| Measurement  | Workshop  | Sensor id | 基准值  |  振幅  | 周期    |
| ------------ | --------- | --------- | ------: | -----: | ------: |
| temperature  | workshop1 | sensor1   |    22.0 |    5.0 |   60 秒 |
| humidity     | workshop1 | sensor2   |    45.0 |   15.0 |   90 秒 |
| pressure     | workshop1 | sensor3   |  1010.0 |   20.0 |  120 秒 |
| temperature  | workshop2 | sensor1   |    20.0 |    4.0 |   75 秒 |
| vibration    | workshop2 | sensor2   |     3.0 |    2.0 |   40 秒 |
| co2          | workshop2 | sensor3   |   500.0 |  150.0 |  200 秒 |

#### PostgreSQL 线程 {#postgresql-thread}

每 `POSTGRES_UPDATE_INTERVAL` 秒（默认 **10 秒**）向 PostgreSQL 写入数据，为每个
传感器向 `sensor_readings` 表插入一行（参见上方的 [PostgreSQL](#postgresql--postgres)）。
它使用与 InfluxDB 线程完全相同的传感器列表，用 `workshop`/`sensor_id`/`measurement`
列来对应 InfluxDB 的标签——因此两个数据库最终会拥有相同的数据，只是针对各自的
查询模型进行了相应的形状调整（Flux/InfluxQL 标签 vs SQL 的 `WHERE` 子句）。

#### 环境变量 {#environment-variables}

| 变量                          | 默认值                   | 描述                                                    |
| ----------------------------- | ------------------------ | -------------------------------------------------------- |
| `RETRY_INTERVAL`              | `10`                      | 重连尝试之间的间隔秒数                                    |
| `MODBUS_HOST`                 | `modbus-server`           | Modbus 服务器的主机名                                     |
| `MODBUS_PORT`                 | `5020`                    | Modbus TCP 端口                                           |
| `MODBUS_SLAVE_ID`             | `1`                       | Modbus 从站 / 单元 ID                                     |
| `MODBUS_UPDATE_INTERVAL`      | `2`                       | Modbus 写入周期之间的间隔秒数                              |
| `MQTT_BROKER`                 | `mqtt-broker`             | MQTT broker 的主机名                                       |
| `MQTT_PORT`                   | `1883`                    | MQTT 端口                                                  |
| `MQTT_USER`                   | `oibus`                   | MQTT 用户名                                                |
| `MQTT_PASSWORD`               | `pass`                    | MQTT 密码（也可通过 `$MQTT_PASSWORD` 设置）                 |
| `MQTT_UPDATE_INTERVAL`        | `2`                       | MQTT 发布周期之间的间隔秒数                                 |
| `INFLUXDB_URL`                | `http://influxdb:8086`    | InfluxDB 基础 URL                                           |
| `INFLUXDB_TOKEN`              | `oibus-admin-token`       | InfluxDB API 令牌（也可通过 `$INFLUXDB_TOKEN` 设置）        |
| `INFLUXDB_ORG`                | `oibus`                   | InfluxDB 组织                                               |
| `INFLUXDB_BUCKET`             | `oibus-bucket`            | InfluxDB bucket                                              |
| `INFLUXDB_UPDATE_INTERVAL`    | `10`                      | InfluxDB 写入周期之间的间隔秒数                              |
| `POSTGRES_HOST`               | `postgres`                | PostgreSQL 服务器的主机名                                    |
| `POSTGRES_PORT`               | `5432`                    | PostgreSQL 端口                                              |
| `POSTGRES_USER`               | `oibus`                   | PostgreSQL 用户名                                            |
| `POSTGRES_PASSWORD`           | `pass`                    | PostgreSQL 密码（也可通过 `$POSTGRES_PASSWORD` 设置）        |
| `POSTGRES_DB`                 | `oibus-db`                | PostgreSQL 数据库名称                                        |
| `POSTGRES_UPDATE_INTERVAL`    | `10`                      | PostgreSQL 写入周期之间的间隔秒数                             |

---

## 密码和密钥 {#passwords-and-secrets}

每项服务都使用相同的默认凭据 `oibus` / `pass`，因此在将 OIBus 连接到其中任何
一项服务时，只需记住这一对凭据即可。唯一的例外是 InfluxDB，其密码必须至少
8 个字符（参见[上方的说明](#influxdb--influxdb)）。敏感值均从环境变量中读取——
在仓库根目录创建一个 `.env` 文件，即可在不修改 `docker-compose.yml` 的情况下
在本地覆盖它们：

```dotenv title=".env"
MQTT_PASSWORD=my_mqtt_secret
POSTGRES_PASSWORD=my_pg_secret
INFLUXDB_PASSWORD=my_influx_secret
INFLUXDB_TOKEN=my_influx_token
FTP_PASSWORD=my_ftp_secret
SFTP_PASSWORD=my_sftp_secret
OPCUA_DEFAULT_PASSWORD=my_opcua_secret
OPCUA_ADMIN_PASSWORD=my_admin_secret
SQUID_PASSWORD=my_squid_secret
DOMAIN=oibus.example.com
```

`.env` 已列入 `.gitignore`——它永远不会被提交。

---

## 常用命令 {#useful-commands}

```bash
# Start the recommended development stack (IoT servers + simulator + database)
npm run docker:dev

# Tail simulator logs (Modbus + MQTT writes)
docker compose logs -f simulator

# Restart the simulator after changing docker/simulator/simulator.py
docker compose --profile simulator up -d --force-recreate simulator

# Restart the Modbus server after changing docker/modbus/server_config.json
docker compose --profile iot up -d --force-recreate modbus-server

# Stop everything and remove containers (data volumes are kept)
npm run docker:down
```
