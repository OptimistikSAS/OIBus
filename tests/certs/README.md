This repository is used to store local certificates for testing connections.

## Using certificates with Prosys OPC UA Simulation Server
1. Create a private key and certificate using the cert.conf:
`openssl req -new -x509 -keyout oibus.key -out oibus.pem -config cert.conf`

2. Remove private key passphrase: 
`openssl rsa -in oibus.key -out oibus.key` 

3. Create DER cert for prosys:
`openssl x509 -inform PEM -outform DER -in oibus.pem -out oibus.der` 

4. Copy the DER cert in prosys USERS_PKI certificate folder :
`prosys-opc-ua-simulation-server\USERS_PKI\CA\certs`

