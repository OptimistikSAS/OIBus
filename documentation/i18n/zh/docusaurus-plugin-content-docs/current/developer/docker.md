---
displayed_sidebar: developerSidebar
sidebar_position: 4
---

# OIBus with Docker
OIBus can be incorporated into a Docker image.

:::caution
This section is currently under development, and OIBus docker images will be made accessible shortly.
:::

## Docker image
The image below takes two parameters:
- arch (default: x64)
- version

This enables the creation of a Docker image with a particular OIBus version and architecture.

### Dependencies
This image requires an `oibus-init.sh` script for sending _curl_ commands to OIBus endpoints. If you don't want to include
this file, you will need to run a [curl command](#curl-command) from inside the docker.

```bash title="oibus-init.sh"
#!/bin/bash

curl --location --request POST 'http://localhost:2223/api/ip-filters' \
--header 'Content-Type: application/json' \
--data-raw '{
    "address": "*",
    "description": "All"
}' \
-u "admin:pass"
```

### Dockerfile
```docker title="Dockerfile"
FROM ubuntu

ARG arch="x64"
ARG version="v3.0.4"

# Install git
RUN apt update -y && apt install -y curl unzip

# Create app directory
WORKDIR /app

RUN curl -LO https://github.com/OptimistikSAS/OIBus/releases/download/${version}/oibus-linux_${arch}-${version}.zip
RUN unzip -a oibus-linux_${arch}-${version}.zip -d OIBus/
WORKDIR /app/OIBus
COPY ./oibus-init.sh .
RUN mkdir OIBusData

# Expose port 2223 for OIBus
EXPOSE 2223

# Start OIBus
CMD ["./oibus", "--config", "./OIBusData"]
```

### Docker commands
Build the docker image:
`docker build -t oibus .`

Build the docker image with specific architecture and version:
`docker build -t oibus --build-arg arch="arm64" --build-arg version="v3.0.4" .`

Run a container:
`docker run --name oibus -d -p 2223:2223 -v ./OIBusData:/app/OIBus/OIBusData oibus`

The volume is not mandatory, but can be useful to access cache, logs, configuration database...

## Specifics settings in Docker
### Web server port
When using OIBus within a container, the default HTTP port 2223 is exposed. If you wish to access OIBus from a different 
port, you can modify the [docker run](#docker-commands) command accordingly.

:::danger
Do not change the HTTP port from the OIBus configuration. You will not be able to access the web page again if you 
change it.
:::

### IP filters
By default, OIBus accepts connections only from localhost by [filtering IP](../guide/engine/ip-filters.md). When inside
a docker, the IP filter list must be updated.

You can either use the curl command or the bash script.
#### Curl command
```
docker exec -it oibus curl --location --request POST 'http://localhost:2223/api/ip-filters' \
--header 'Content-Type: application/json' \
--data-raw '{
    "address": "*",
    "description": "All"
}' \
-u "admin:pass"

```

#### Bash script
`docker exec -it oibus ./oibus-init.sh`