---
sidebar_position: 2
---

# OPCUA
OPCUA, which stands for OPC Unified Architecture, is a protocol designed for accessing data in both read and write modes. 
The data is organized within a tree-like address space and is referenced using unique identifiers known as node IDs. 
OPCUA is a modern standard that is based on TCP/IP and has replaced older OPC HDA/DA technologies (refer to the 
[OPCHDA connector](./opc-hda.md)). It is often natively embedded in industrial controllers.

OPCUA incorporates two variants of the protocol: HA (Historical Access) and DA (Data Access). In HA mode, you can access 
a history of values over a specified time interval for the requested data points, whereas in DA mode, you can access the 
values at each request or listen to changes in the values.

OIBus integrates both OPCUA modes (HA and DA) in read-only mode, using the [node-opcua library](https://github.com/node-opcua/node-opcua).

## Specific settings
To establish a connection to an OPCUA server, OIBus requires several settings:
- **URL**: This is the string used to connect to the server, and it follows the format `opc.tcp://<host>:<port>/<server-name>`.
- **Retry interval** : The time to wait between reconnection attempts in the event of a connection failure.
- **Security Mode** : Communication can be secured using the security mode and security policy fields. Available security 
modes include: _None_, _Sign_, _SignAndEncrypt_.
- **Security Policy** (Applicable when Security mode is not None): Security policies define the level of security for communication. 
Available security policies include: None, Basic128, Basic192, Basic256, Basic128Rsa15, Basic192Rsa15, Basic256Rsa15, 
Basic256Sha256, Aes128_Sha256_RsaOaep, PubSub_Aes128_CTR, PubSub_Aes256_CTR.
- **Authentication**: Authentication options include None, Basic, and Certificate. Refer to the [security settings](#authentication)
for more details.

:::caution Compatibility with the OPCUA server
It's essential to choose a security mode and security policy that are supported by the OPCUA server you are connecting to. 
Ensuring compatibility is crucial for a successful connection.
:::

## Item settings
When configuring each item to retrieve data in JSON payload, you'll need to specify the following specific settings:
- **Node ID**: The Node ID corresponds to the path of the data within the appropriate namespace on the OPCUA server. 
It's essential to consider the supported node format of the server, which may use either numbers or strings. For example, 
on Prosys, `ns=3;i=1001` matches `ns=3;s=Counter`.
- **Mode**: You can select either HA (Historical Access) or DA (Data Access) mode, depending on your requirements.
- **Aggregate** (HA mode only): In HA mode, there is an option to aggregate the retrieved values over the requested interval.
- **Resampling** (HA mode only): Similarly, in HA mode, you can choose to resample the retrieved values at the requested 
interval.

:::caution Compatibility with the OPCUA server
It's important to note that not all aggregation and resampling options are supported by OPCUA servers. To avoid 
compatibility issues, it's recommended to use `Raw` aggregation and `None` resampling whenever possible. Additionally, 
ensure that the selected mode (HA or DA) is supported by the server you are connecting to.
:::

The name of the item will serve as a reference in JSON payloads, specifically in the `pointID` field for the North application. 

## Security settings
### Communication
When using a security mode other than _None_, a certificate is required to sign and potentially encrypt the communications. 
OIBus generates a self-signed certificate for securing communication with the OPCUA server during startup. You can locate 
the certificate used by OPCUA in the `opcua` folder of the South cache. This certificate must be trusted by the OPCUA 
server to enable secure communication.

:::info Example on Prosys OPCUA Simulation Server
![Prosys OPCUA Simulation Server Certificates](../../../static/img/guide/south/opcua/prosys-opcua-simulation-server-certificates.png)
If the certificate is not trusted by the OPCUA server, you may encounter an error with the message: `Error: The connection 
may have been rejected by the server`.
:::

### Authentication
The certificate used for client authentication must be added to the trusted user certificates list on the OPCUA server. 
It is managed separately from the self-signed certificate mentioned earlier, which is used for 
[securing communication](#communication).

:::info Example on Prosys OPCUA Simulation Server
For Prosys OPC UA servers, the certificate used to authenticate OIBus must be placed in the 
`.prosysopc\prosys-opc-ua-simulation-server\USERS_PKI\CA\certs` folder. Failure to do so may result in an error with the 
message: `Error: serviceResult = BadIdentityTokenRejected (0x80210000)`.

If a connection has previously been attempted and rejected, you should remove the certificate from the **rejected certificates** 
folder (`.prosysopc\prosys-opc-ua-simulation-server\USERS_PKI\CA\rejected`) and move it to the **trusted** folder 
(`.prosysopc\prosys-opc-ua-simulation-server\USERS_PKI\CA\certs`).
:::

### Use the same certificate for user authentication and secure communications
The same certificate can be used for both sign and encrypt operations and for authentication. To do that, the `cert.pem`
and `private.pem` file paths must be specified. They are located in the south cache data stream folder (inside the opcua 
directory).

On the OPCUA server side, the self-signed certificate (`cert.pem`) must be copied in the user certificates' folder.

For example, with Prosys OPCUA Simulation Server: `.prosysopc\prosys-opc-ua-simulation-server\USERS_PKI\CA\certs`.

## Using certificates with ProSys OPC UA Simulation Server
You can create your self-signed certificate to authenticate OIBus with the **Cert** method.

1. Create a cert.conf file:
```
[ req ]
default_bits = 2048
default_md = sha256
distinguished_name = subject
req_extensions = req_ext
x509_extensions = req_ext
string_mask = utf8only
prompt = no

[ req_ext ]
basicConstraints = CA:FALSE
nsCertType = client, server
keyUsage = nonRepudiation, digitalSignature, keyEncipherment, dataEncipherment, keyCertSign
extendedKeyUsage= serverAuth, clientAuth
nsComment = "OIBus User Cert"
subjectKeyIdentifier=hash
authorityKeyIdentifier=keyid,issuer
subjectAltName = URI:urn:opcua:user:oibus,IP: 127.0.0.1

[ subject ]
countryName = FR
stateOrProvinceName = FR
localityName = Chambéry
organizationName = OI
commonName = oibus
```
2. Create a private key and certificate using the `cert.conf`:
```
openssl req -new -x509 -keyout oibus.key -out oibus.pem -config cert.conf
```
2. Remove private key passphrase:
```
openssl rsa -in oibus.key -out oibus.key
```
3. Create DER cert for ProSys:
```
openssl x509 -inform PEM -outform DER -in oibus.pem -out oibus.der
```
4. Copy the DER cert in ProSys USERS_PKI certificate folder: `prosys-opc-ua-simulation-server\USERS_PKI\CA\certs`
