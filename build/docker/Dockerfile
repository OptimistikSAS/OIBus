FROM ubuntu

ARG TARGETARCH
# TARGETARCH is either amd64 or arm64
# amd64 is mapped to x64
ARG ARCH=${TARGETARCH/amd64/x64}
ARG VERSION="v3.3.2"

RUN echo "${ARCH}-${VERSION}"

# Install git
RUN apt update -y && apt install -y curl unzip

# Create app directory
WORKDIR /app

RUN curl -LO https://github.com/OptimistikSAS/OIBus/releases/download/${VERSION}/oibus-linux_${ARCH}-${VERSION}.zip
RUN unzip -a oibus-linux_${ARCH}-${VERSION}.zip -d OIBus/
WORKDIR /app/OIBus
RUN mkdir OIBusData

# Expose port 2223 for OIBus
EXPOSE 2223

# Start OIBus
CMD ["./oibus-launcher", "--config", "./OIBusData", "--ignoreIpFilters", "true", "--ignoreRemoteUpdate", "true"]