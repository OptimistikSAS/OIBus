<div style="text-align: center;">
  ![OIBus](frontend/public/oibus.png)
</div>

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
