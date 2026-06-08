---
displayed_sidebar: developerSidebar
sidebar_position: 6
---

# Local Test Stack

The repository ships a `docker-compose.yml` at its root that spins up a complete set of protocol
servers and simulators so you can develop and test OIBus connectors without access to real industrial
equipment. This page documents every service, what it simulates, how to configure it, and how to bring
it up.

## Quick Start

The easiest way to start the stack is via the npm scripts defined in `backend/package.json`.
Run them from the `backend/` directory:

```bash
# IoT protocol servers only (OPC UA, Modbus, MQTT)
npm run docker:iot

# IoT servers + simulator (recommended for connector development)
npm run docker:simulator

# PostgreSQL only
npm run docker:database

# FTP / SFTP servers only
npm run docker:ftp

# Full development stack: IoT + simulator + database
npm run docker:dev

# Everything including OIBus runtime and nginx
npm run docker:all

# Tear down all containers
npm run docker:down
```

You can also invoke Docker Compose directly if you need a custom combination of profiles:

```bash
docker compose --profile iot --profile simulator up -d
```

Services are grouped into **Docker Compose profiles**:

| Profile     | Services                                       |
| ----------- | ---------------------------------------------- |
| `iot`       | `opcua-server`, `modbus-server`, `mqtt-broker` |
| `simulator` | `simulator`                                    |
| `database`  | `postgres`                                     |
| `ftp`       | `ftp-server`, `sftp-server`                    |
| `oibus`     | `oibus`, `nginx`                               |

:::note Profile independence
The `simulator` profile requires the `iot` profile services to be running (Modbus server and MQTT
broker). Always start both profiles together: `--profile iot --profile simulator` (or use
`npm run docker:simulator` which does this automatically).
:::

All services share the internal bridge network `oibus-network`. Ports are forwarded to `localhost` so
OIBus running outside Docker (i.e. `npm start` in the `backend/` directory) can reach them directly.

---

## Services

### OPC UA Server — `opcua-server`

| Property   | Value                                                                                                     |
| ---------- | --------------------------------------------------------------------------------------------------------- |
| **Image**  | [`mcr.microsoft.com/iotedge/opc-plc`](https://mcr.microsoft.com/en-us/artifact/mar/iotedge/opc-plc/about) |
| **Port**   | `50000` (OPC UA TCP)                                                                                      |
| **Config** | `docker/opcua/nodes_config.json`                                                                          |

Microsoft's [OPC PLC simulator](https://github.com/Azure-Samples/iot-edge-opc-plc). It exposes a
standard OPC UA server with custom nodes defined in `nodes_config.json` as well as a set of built-in
nodes (boiler simulation, fast/slow changing variables, etc.).

**Custom nodes** (folder `OIBus`, all with `Historizing: true`):

| Node ID | Description       | Data type | Simulation  | Parameters                          |
| ------- | ----------------- | --------- | ----------- | ----------------------------------- |
| `1023`  | Temperature (°C)  | `Double`  | Random Walk | 18 – 28 °C, step 0.5, every 2 s     |
| `1024`  | Pressure (hPa)    | `Double`  | Sine Wave   | 1013.25 ± 10 hPa, period 10 s       |
| `1025`  | Flow rate (L/min) | `Double`  | Random Walk | 40 – 60 L/min, step 1, every 3 s    |
| `1026`  | Humidity (%)      | `Double`  | Sine Wave   | 65 ± 15 %, period 15 s              |
| `1027`  | RPM               | `Int32`   | Random Walk | 1 200 – 1 800, step 50, every 2.5 s |
| `1028`  | Pump status       | `Boolean` | Square Wave | period 20 s                         |
| `1029`  | Voltage (V)       | `Double`  | Random Walk | 210 – 230 V, step 0.5, every 2 s    |
| `1030`  | Current (A)       | `Double`  | Sine Wave   | 15.2 ± 2 A, period 12 s             |

Node IDs follow the OPC UA namespace `ns=2;i=<NodeId>`. The OPC UA address of temperature, for
example, is `ns=2;i=1023`.

**Historian support:** `Historizing: true` enables OPC UA Historical Data Access (HA) on every custom
node. The server answers `HistoryRead` requests, making it suitable to test OIBus history-query mode.

:::caution In-memory history only
History is stored in RAM — it is not persisted to disk. All historical data is lost when the container
restarts. Scenarios that require catch-up after a long gap (days/weeks) cannot be reproduced with this
simulator.
:::

**Authentication:** anonymous access is disabled. Use the credentials configured via the environment
variables `OPCUA_DEFAULT_PASSWORD` (default `pass`) and `OPCUA_ADMIN_PASSWORD` (default `pass`), with
the usernames `oibus` and `admin` respectively (set in `docker-compose.yml`).

---

### Modbus Server — `modbus-server`

| Property   | Value                                                               |
| ---------- | ------------------------------------------------------------------- |
| **Image**  | [`oitc/modbus-server`](https://hub.docker.com/r/oitc/modbus-server) |
| **Port**   | `5020` (Modbus TCP)                                                 |
| **Config** | `docker/modbus/server_config.json`                                  |

A lightweight Modbus TCP server. Its register map is declared in `server_config.json`. The server
accepts writes from any Modbus TCP client, so the [Simulator](#unified-simulator--simulator)
can dynamically update holding registers and coils in real time.

:::note server_config.json key numbering vs OIBus Address offset
The configuration file uses **1-based register keys** (`"1"`, `"2"`, …) because the server is
configured with `"zeroMode": false`. This is a detail of the server's config file format only —
Modbus TCP at the wire level is always 0-based, so the mapping is simply
`config key = protocol address + 1`.

This is independent of the [**Address offset**](../guide/south-connectors/modbus.mdx#connection-configuration)
setting in OIBus (Modbus vs JBus). When connecting OIBus to this server, keep the default
**Modbus** offset (no offset): OIBus sends 0-based protocol addresses, and the server resolves
them against its 1-based keys internally. The JBus offset would only be needed for devices that
expose 1-based addresses at the Modbus protocol level itself.
:::

**Initial register values** (overwritten by the simulator after it connects):

| Register type  | Protocol address | Initial value | Description               |
| -------------- | :--------------: | :-----------: | ------------------------- |
| Input Register |        0         |     `314`     | Firmware version (uint16) |
| Input Register |        1         |    `22136`    | Serial number — low word  |
| Input Register |        2         |    `4660`     | Serial number — high word |
| Discrete Input |        0         |    `true`     | Panel door closed         |
| Discrete Input |        1         |    `true`     | Safety relay OK           |
| Discrete Input |        2         |    `false`    | Network connected         |
| Discrete Input |        3         |    `false`    | E-stop pressed            |

Input registers and discrete inputs are **read-only** from a Modbus client's perspective, so their
values are static and come from `server_config.json`. Holding registers and coils are updated every
2 seconds by the simulator.

---

### MQTT Broker — `mqtt-broker`

| Property   | Value                                                             |
| ---------- | ----------------------------------------------------------------- |
| **Image**  | [`eclipse-mosquitto`](https://hub.docker.com/_/eclipse-mosquitto) |
| **Ports**  | `1883` (MQTT), `9001` (WebSocket)                                 |
| **Config** | `docker/mosquitto/config/`                                        |

Eclipse Mosquitto with a custom entrypoint (`docker/mosquitto/entrypoint.sh`) that injects the
`MQTT_USER` / `MQTT_PASSWORD` credentials at startup. Anonymous access is disabled.

The `9001` WebSocket port is available for browser-based MQTT clients if needed.

---

### PostgreSQL — `postgres`

| Property  | Value                                           |
| --------- | ----------------------------------------------- |
| **Image** | [`postgres`](https://hub.docker.com/_/postgres) |
| **Port**  | `5432`                                          |

A vanilla PostgreSQL instance for testing the South-PostgreSQL connector. Credentials are:

| Variable            | Default    |
| ------------------- | ---------- |
| `POSTGRES_USER`     | `oibus`    |
| `POSTGRES_PASSWORD` | `pass`     |
| `POSTGRES_DB`       | `oibus-db` |

Override passwords via the `.env` file or shell environment (e.g. `POSTGRES_PASSWORD=secret docker compose up`).

---

### FTP Server — `ftp-server` _(profile: `ftp`)_

| Property  | Value                                                     |
| --------- | --------------------------------------------------------- |
| **Image** | [`fauria/vsftpd`](https://hub.docker.com/r/fauria/vsftpd) |
| **Ports** | `20`, `21`, `21100–21110` (passive)                       |

Passive-mode vsftpd. Credentials: `oibus` / `oibuspass`. Files land in `docker/ftp/data/`.

---

### SFTP Server — `sftp-server` _(profile: `ftp`)_

| Property  | Value                                               |
| --------- | --------------------------------------------------- |
| **Image** | [`atmoz/sftp`](https://hub.docker.com/r/atmoz/sftp) |
| **Port**  | `2222` (SSH)                                        |

Single-user SFTP server. Credentials: `oibus` / `pass`. Upload directory: `docker/sftp/data/`.

---

### OIBus Runtime — `oibus` _(profile: `oibus`)_

| Property  | Value                                                                                        |
| --------- | -------------------------------------------------------------------------------------------- |
| **Image** | [`ghcr.io/optimistiksas/oibus`](https://github.com/OptimistikSAS/OIBus/pkgs/container/oibus) |
| **Port**  | `2223` (web UI / API)                                                                        |
| **Data**  | `./data-folder` → `/app/OIBus/OIBusData`                                                     |

The OIBus runtime itself, useful when you want to test the full stack inside Docker rather than running
the backend with `npm start`. See [Docker Image](./docker.mdx) for details about this image.

---

### Nginx — `nginx` _(profile: `oibus`)_

| Property   | Value                                     |
| ---------- | ----------------------------------------- |
| **Image**  | [`nginx`](https://hub.docker.com/_/nginx) |
| **Ports**  | `80` (HTTP), `443` (HTTPS)                |
| **Config** | `docker/nginx/`                           |

Reverse proxy in front of the OIBus container. Requires the `DOMAIN` environment variable and TLS
certificates in `docker/nginx/certs/`. Only needed when testing the full TLS / reverse-proxy setup.

---

### Unified Simulator — `simulator`

| Property      | Value                                                 |
| ------------- | ----------------------------------------------------- |
| **Image**     | [`python:3.14-slim`](https://hub.docker.com/_/python) |
| **Script**    | `docker/simulator/simulator.py`                       |
| **Libraries** | `pymodbus==3.6.9`, `paho-mqtt`                        |

A single Python script that drives both the Modbus server and the MQTT broker. It runs two daemon
threads — one per protocol — each with its own independent retry loop so a failure in one source does
not affect the other.

#### Modbus thread

Writes to the Modbus server every `MODBUS_UPDATE_INTERVAL` seconds (default 2 s). All values are
sinusoidal with 5 % random noise unless stated otherwise.

**Holding registers — uint16 (1 word):**

| Protocol addr | Name        | Base | Amplitude | Period |
| :-----------: | ----------- | ---: | --------: | -----: |
|       0       | temperature |  250 |        50 |   60 s |
|       1       | humidity    |  600 |       200 |  120 s |
|       2       | pressure    |  100 |        30 |  180 s |
|       3       | vibration   |  250 |       200 |   30 s |
|       4       | co2         |  600 |       200 |  300 s |
|       5       | flow_rate   |  150 |        80 |   90 s |

**Holding registers — extended data types (multi-word):**

| Protocol addr | Name             | Data type |    Base | Amplitude | Period |
| :-----------: | ---------------- | --------- | ------: | --------: | -----: |
|       6       | outdoor_temp     | int16     |       5 |        25 |  240 s |
|     7 – 8     | production_count | uint32    |  50 000 |    40 000 |  600 s |
|    9 – 10     | power_kw         | float     |    75.5 |      45.0 |  180 s |
|    11 – 12    | energy_balance   | int32     |       0 |     5 000 |  360 s |
|    13 – 16    | shaft_speed      | double    | 1 500.0 |     300.0 |  120 s |
|      17       | status_flags     | bitfield  |       — |         — |      — |

`status_flags` is a 16-bit register whose individual bits are independent square waves:

| Bit | Name            | Period |
| :-: | --------------- | -----: |
|  0  | motor_running   |   60 s |
|  1  | fault_detected  |  300 s |
|  2  | maintenance_due |  600 s |
|  3  | overload        |  120 s |

**Coils (square wave, 1 = on for first half of period):**

| Protocol addr | Name         | Period |
| :-----------: | ------------ | -----: |
|       0       | pump_running |   30 s |
|       1       | valve_open   |   45 s |
|       2       | alarm_active |  120 s |
|       3       | machine_on   |   20 s |

:::info Multi-word encoding
OIBus applies an unconditional `swap32() + swap16()` on multi-word values before reading them. The
simulator accounts for this by writing the **low 16-bit word before the high 16-bit word** within each
32-bit dword. This matches the default OIBus settings (`swapWordsInDWords: false`,
`endianness: big-endian`).
:::

#### MQTT thread

Publishes to the MQTT broker every `MQTT_UPDATE_INTERVAL` seconds (default 2 s). Each publish cycle
sends **two families** of topics:

- **Scalar topics** — a single number, for value-based items.
- **JSON topics** (under `<workshop>/json/<shape>`) — structured payloads of different shapes. OIBus's
  MQTT south ingests these as `any-content`, which makes them ideal for exercising custom transformers.

##### Scalar topics

Topics follow the pattern `<workshop>/<sensor>/<type>` and carry a bare number (e.g. `23.5`). All
values are sinusoidal with 5 % random noise.

| Topic                           |    Base | Amplitude | Period |
| ------------------------------- | ------: | --------: | -----: |
| `workshop1/sensor1/temperature` |    30.0 |      10.0 |   60 s |
| `workshop1/sensor2/humidity`    |    55.0 |      25.0 |  120 s |
| `workshop1/sensor3/pressure`    | 1 000.0 |      50.0 |  180 s |
| `workshop1/sensor4/vibration`   |     5.0 |       5.0 |   30 s |
| `workshop2/sensor1/temperature` |    28.0 |       8.0 |   90 s |
| `workshop2/sensor2/humidity`    |    50.0 |      20.0 |  150 s |
| `workshop2/sensor3/pressure`    |   990.0 |      40.0 |  210 s |
| `workshop2/sensor4/vibration`   |     4.0 |       4.0 |   45 s |

##### JSON topics

Each topic publishes a different JSON **shape**, so connectors and custom transformers can be tested
against the full range of payloads OIBus may receive over MQTT. Numeric values vary every cycle
(sinusoidal with noise).

| Topic                   | Shape                                   |
| ----------------------- | --------------------------------------- |
| `workshop1/json/flat`   | Flat object (single reading)            |
| `workshop1/json/nested` | Nested objects                          |
| `workshop1/json/array`  | Array of readings (a batch)             |
| `workshop2/json/mixed`  | Every JSON scalar type + array + object |
| `workshop2/json/string` | A JSON string                           |
| `workshop2/json/number` | A bare JSON number                      |

Example payloads:

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
The `nested`, `array` and `mixed` payloads contain fields that are themselves objects or arrays. They
are useful to test a custom transformer that derives the output filename or content from a payload
field — returning a non-string value there must never reach the metrics database, and these topics
make that edge case easy to reproduce.
:::

#### Environment variables

| Variable                 | Default         | Description                                   |
| ------------------------ | --------------- | --------------------------------------------- |
| `RETRY_INTERVAL`         | `10`            | Seconds between reconnection attempts         |
| `MODBUS_HOST`            | `modbus-server` | Hostname of the Modbus server                 |
| `MODBUS_PORT`            | `5020`          | Modbus TCP port                               |
| `MODBUS_SLAVE_ID`        | `1`             | Modbus slave / unit ID                        |
| `MODBUS_UPDATE_INTERVAL` | `2`             | Seconds between Modbus write cycles           |
| `MQTT_BROKER`            | `mqtt-broker`   | Hostname of the MQTT broker                   |
| `MQTT_PORT`              | `1883`          | MQTT port                                     |
| `MQTT_USER`              | `oibus`         | MQTT username                                 |
| `MQTT_PASSWORD`          | `pass`          | MQTT password (also set via `$MQTT_PASSWORD`) |
| `MQTT_UPDATE_INTERVAL`   | `2`             | Seconds between MQTT publish cycles           |

---

## Passwords and Secrets

Sensitive values are read from environment variables and default to `pass` if not set. Create a `.env`
file at the repository root to override them locally without touching `docker-compose.yml`:

```dotenv title=".env"
MQTT_PASSWORD=my_mqtt_secret
POSTGRES_PASSWORD=my_pg_secret
OPCUA_DEFAULT_PASSWORD=my_opcua_secret
OPCUA_ADMIN_PASSWORD=my_admin_secret
DOMAIN=oibus.example.com
```

`.env` is listed in `.gitignore` — it will never be committed.

---

## Useful Commands

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
