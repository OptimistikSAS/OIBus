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