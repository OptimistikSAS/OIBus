<p align="center">
  <img src="frontend/public/oibus.png" alt="OIBus">
</p>

# OIBus - Industrial Data Integration Platform

OIBus is a cross-platform industrial data integration solution that simplifies data collection from various industrial
sources and transmits it to enterprise applications.

## 🌍 Platform Support

✅ Windows | ✅ Linux | ✅ macOS

## 🔗 Key Features

| Feature                    | Description                                                       |
|----------------------------|-------------------------------------------------------------------|
| **Multi-protocol Support** | OPC UA, OPC Classic, Modbus, MQTT, SQL, Folder Scanning, and more |
| **Cross-platform**         | Runs on Windows, Linux, and macOS                                 |
| **High Performance**       | Handles 10 to 10,000+ data points with second-level sampling      |
| **No-code Configuration**  | Set up in minutes without development skills                      |
| **Enterprise Integration** | Seamless connection to applications like OIAnalytics              |

## 🏗 Architecture

OIBus follows a modular 3-layer architecture:

1. **Engine Layer**
    - Core orchestration system
    - Web-based administration interface
    - Configuration management

2. **South Connectors**
    - Protocol-specific data collection modules
    - Supported protocols: OPC UA, OPC Classic, Modbus, MQTT, SQL, Folder Scanning, etc.
    - Extensible architecture for new protocols

3. **North Connectors**
    - Data transmission to enterprise systems
    - Supported destinations: OIAnalytics, folders, databases, APIs
    - Customizable output formats

## 🚀 Getting Started

### Quick Setup Guide

1. **Installation**:
    - [Download OIBus](https://oibus.optimistik.com/docs/guide/installation)
    - Follow the [installation guide](https://oibus.optimistik.com/docs/guide/installation)

2**Example Workflow**:

- Create a Folder Scanner South connector
- Create a Console North connector
- Configure data flow between them

## 🛠 Development Setup

### Prerequisites

- Node.js (LTS version)
- npm (comes with Node.js)
- Git

### Build and Run from Source

1. **Fork and Clone**:
   ```bash
   git clone https://github.com/your-fork/OIBus.git
   cd OIBus
   ```

2. **Backend Setup**:
   ```bash
   cd backend
   npm install
   npm start  # Starts backend on port 2223
   ```

3. **Frontend Setup**:
   ```bash
   cd frontend
   npm install
   npm start  # Builds and serves frontend
   ```

4. **Access Application**:
    - Open [http://localhost:2223](http://localhost:2223)
    - Default credentials: `admin/pass`

### Docker Compose Development Environment

OIBus includes a Docker Compose setup with simulated industrial services for development and testing.

#### Starting Services

Start all development services:

```bash
docker-compose up -d
```

Start only specific services (e.g., OPC UA server):

```bash
docker-compose up -d opcua-server
```

View running services:

```bash
docker-compose ps
```

#### OPC UA Server with Simulated Data

The OPC UA server provides simulated industrial data for testing OIBus OPC UA connectors.

**Access Information:**

- **Endpoint URL**: `opc.tcp://localhost:50000`
- **Security Mode**: `Sign`
- **Security Policy**: `Basic256Sha256`
- **Authentication**: `Anonymous (None)`
- **Container Name**: `oibus_opcua-plc`

**Available Simulated Nodes:**

The server includes the following simulated nodes in the `OpcPlc > OIBus` folder:

| Node ID       | Description        | Data Type | Simulation Type | Range/Details       |
|---------------|--------------------|-----------|-----------------|---------------------|
| `ns=3;i=1023` | Temperature Sensor | Double    | RandomWalk      | 18.0 - 28.0 °C      |
| `ns=3;i=1024` | Pressure Sensor    | Double    | SineWave        | ~1013.25 hPa ± 10   |
| `ns=3;i=1025` | Flow Rate Sensor   | Double    | RandomWalk      | 40.0 - 60.0 L/min   |
| `ns=3;i=1026` | Humidity Sensor    | Double    | SineWave        | 65% ± 15%           |
| `ns=3;i=1027` | RPM Sensor         | Int32     | RandomWalk      | 1200 - 1800 RPM     |
| `ns=3;i=1028` | Pump Status        | Boolean   | SquareWave      | On/Off (20s period) |
| `ns=3;i=1029` | Voltage Sensor     | Double    | RandomWalk      | 210.0 - 230.0 V     | 
| `ns=3;i=1030` | Current Sensor     | Double    | SineWave        | 15.2 A ± 2.0        |

**Connecting OIBus to the OPC UA Server:**

The server is configured with **username/password authentication** (anonymous access is disabled for security).

**Default User Credentials:**

- **Admin user**: `admin` / `pass`
- **Default user**: `opcuser` / `pass`

**Custom Credentials:**
You can set custom credentials using environment variables:

```bash
OPCUA_ADMIN_USER=myadmin
OPCUA_ADMIN_PASSWORD=MySecurePassword
OPCUA_DEFAULT_USER=myuser
OPCUA_DEFAULT_PASSWORD=MyUserPassword
docker compose up -d opcua-server
```

**Connection Settings:**

1. **From Host Machine** (when OIBus runs outside Docker):
    - Endpoint URL: `opc.tcp://localhost:50000`
    - Security Mode: `Sign`
    - Security Policy: `Basic256Sha256`
    - Authentication: `Username/Password`
    - Username: `opcuser` (or `admin` for admin access)
    - Password: `UserPassword123!` (or `SecurePassword123!` for admin)

2. **From Docker Container** (when OIBus runs in Docker):
    - Endpoint URL: `opc.tcp://opcua-server:50000`
    - Security Mode: `Sign`
    - Security Policy: `Basic256Sha256`
    - Authentication: `Username/Password`
    - Username: `opcuser`
    - Password: `UserPassword123!`

**Example OIBus OPC UA South Connector Configuration (Authenticated):**

```json
{
  "name": "OPC UA Test Server",
  "url": "opc.tcp://localhost:50000",
  "securityMode": "Sign",
  "securityPolicy": "Basic256Sha256",
  "authentication": {
    "type": "basic",
    "username": "opcuser",
    "password": "UserPassword123!"
  },
  "keepSessionAlive": true,
  "retryInterval": 10000
}
```

**Security Note:**

- Anonymous authentication is **disabled** by default for security
- Change default passwords in production environments
- Use strong passwords and consider using environment variables for sensitive credentials

**Example Node Items:**

- Temperature: Node ID `ns=3;i=1023`, Mode `DA`
- Pressure: Node ID `ns=3;i=1024`, Mode `DA`
- Flow Rate: Node ID `ns=3;i=1025`, Mode `DA`
- Humidity: Node ID `ns=3;i=1026`, Mode `DA`

**Note:** The nodes are located in the `OpcPlc > OIBus` folder in the address space. For HA (Historical Access) mode,
use the same node IDs with aggregate `Raw` and resampling `None` or a specific interval.

**Alternative OPC UA Simulation Server:**

For more advanced simulation needs, you can also use
the [Prosys OPC UA Simulation Server](https://prosysopc.com/products/opc-ua-simulation-server/).

**Testing with OPC UA Client Tools:**

You can test the server using OPC UA client tools:

- [UaExpert](https://www.unified-automation.com/products/development-tools/uaexpert.html) (Windows/Linux)
- [Prosys OPC UA Client](https://prosysopc.com/products/opc-client/) (Cross-platform)
- [node-opcua](https://github.com/node-opcua/node-opcua) command-line tools

**Verifying Server Status:**

Check if the OPC UA server is running:

```bash
docker-compose ps opcua-server
```

View server logs:

```bash
docker-compose logs -f opcua-server
```

#### MQTT Broker with Simulated Data

The environment includes an Eclipse Mosquitto MQTT broker and a Python-based simulator that continuously publishes
simulated sensor data.

**Access Information:**

- **Broker Host**: `localhost` (when accessing from host) or `mqtt-broker` (when accessing from inside Docker)
- **TCP Port**: `1883`
- **WebSocket Port**: `9001`
- **Container Name**: `oibus_mqtt-broker`
- **Authentication:** The broker is configured with username/password authentication enabled.
  - **Username**: `oibus`
  - **Password**: `pass` (default, configurable via `MQTT_PASSWORD` environment variable)

**Available Simulated Topics:**

The simulator publishes data for two workshops (`workshop1`, `workshop2`), each containing four sensors. Data is
published continuously at specific intervals.

| Topic Path                      | Data Type | Interval (ws1 / ws2) | Range / Details    |
|---------------------------------|-----------|----------------------|--------------------|
| `workshopX/sensor1/temperature` | Double    | 2s / 4s              | 20.0 - 40.0 °C     |
| `workshopX/sensor2/humidity`    | Double    | 3s / 6s              | 30.0 - 80.0 %      |
| `workshopX/sensor3/pressure`    | Double    | 5s / 8s              | 950.0 - 1050.0 hPa |
| `workshopX/sensor4/vibration`   | Double    | 7s / 10s             | 0.0 - 10.0 mm/s    |


#### Other Development Services

- **Modbus Server**: Port `5020` - Simulated Modbus TCP server
- **PostgreSQL**: Port `5432` - Database for testing

## 🤝 Community and Support

- **Issues**: Report bugs on [GitHub Issues](https://github.com/OptimistikSAS/OIBus/issues)
- **Discussions**: Join the conversation on [GitHub Discussions](https://github.com/OptimistikSAS/OIBus/discussions)
- **Professional Support**: Contact [Optimistik](https://optimistik.io)

## 🔧 Extending OIBus

Developers can extend OIBus by:

- Creating custom South connectors for new protocols
- Developing custom North connectors for new destinations

## 🎯 Why Choose OIBus?

✅ **Simple Setup** - Configure in minutes without coding

✅ **Protocol Flexibility** - Support for all major industrial protocols

✅ **Cross-Platform** - Runs on Windows, Linux, and macOS

✅ **Enterprise Ready** - Scales from small deployments to enterprise solutions

✅ **Open Architecture** - Extensible for custom requirements
