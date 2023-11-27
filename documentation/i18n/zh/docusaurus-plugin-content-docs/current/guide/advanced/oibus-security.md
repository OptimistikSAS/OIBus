---
sidebar_position: 1
---

# OIBus security
Typically, OIBus is installed on a dedicated machine, which can also be a virtual machine, situated at the customer's site. 
The behavior of OIBus is entirely controlled through the OIBus configuration SQLite database (oibus.db). It is crucial 
to take into account various factors to safeguard OIBus, including:
- Controlling access to the machine.
- Managing access to the OIBus administration interface.
- Ensuring the security of sensitive information such as passwords and secret keys.

## Access to the OIBus machine
It is imperative to restrict access to the OIBus machine in such a way that only the designated OIBus administrator can 
gain access, thus preventing unauthorized individuals from reaching it. 

Certainly, local or remote access to the machine where OIBus is installed poses a significant risk. For instance, using
methods like RDP (Remote Desktop Protocol) or disk sharing could potentially enable a local user to delete OIBus files
or directly tamper with the configuration file.

## Access to the OIBus administration interface
The OIBus administration interface is web-based and can be accessed either locally or from any remote PC with a web browser. 
It is advisable to utilize the interface locally by accessing it through the URL http://localhost:2223.

For remote access, it is necessary to configure the [IP Filters](../engine/ip-filters.md) section of the OIBus Engine.

Accessing the administration interface mandates a valid user/password combination. The default username is `admin`, and 
the default password is `pass`.

We strongly recommend changing the default password for enhanced security from the user settings page..


## HTTP protocol and Basic Auth
OIBus employs the Basic Auth method in conjunction with the widely supported HTTP protocol in most web browsers. 
However, it's important to note that this method does not offer any encryption for the credentials transmitted in the 
header with each HTTP request.


To address this potential vulnerability, the OIBus Engine includes filters that can help mitigate the risk by restricting 
access to specific IP addresses. Nevertheless, this approach is not foolproof, as hackers can easily impersonate other 
computer systems by using fake IP addresses. Additionally, it's crucial to ensure the privacy of the network through 
which the HTTP requests pass to prevent credential leaks.

For this reason, it is advisable to limit remote access to the OIBus administration interface to within the customer's 
local area network (LAN) and not expose it to the Internet. The use of a Virtual Private Network (VPN) is strongly 
recommended for added security.

### Using HTTPS
To implement HTTPS for OIBus, you can establish it through a reverse proxy positioned in front of OIBus, such as nginx 
or Apache. By doing so, you can direct HTTPS queries to the HTTPS server, which will subsequently redirect them to the 
OIBus HTTP server.

This setup enhances the security of OIBus communication by encrypting data transmitted over the network (if HTTPS is 
correctly set up). It ensures that sensitive information, including credentials, remains confidential during transmission 
and minimizes the risk of interception or unauthorized access.

## Protection of passwords and secrets
It's important to highlight that OIBus does not store user passwords in plaintext. 

### Login password
The admin interface login password undergoes hashing using the argon2 algorithm, retaining solely the resulting hash. When 
a login attempt is made, the entered password's hash is verified against the stored hash to provide an additional security 
layer safeguarding user credentials.

### Connector credentials
OIBus requires access to various sources of information, including Histories, DCS, LIMS, MES, Databases, and more. Many 
of these sources necessitate a username/password combination or a secret key for authentication.

All this sensitive information is stored within the OIBus configuration database (`oibus.db`), but it is encrypted using 
the AES-256 algorithm in CBC mode. This encryption provides a strong security layer, ensuring that the information remains 
unreadable in its unencrypted form.

The AES symmetric key used for encryption is stored separately in the `crypto.db` SQLite database. The decision to maintain 
a separate database serves the purpose of preventing unauthorized access in case the `oibus.db` file is shared for debugging 
or configuration replication. By encrypting the secrets with a key stored in a separate database, it becomes infeasible 
to access the encrypted secrets unless both database files are available together. This separation is a security measure.

It's important to note that if the `crypto.db` SQLite database is deleted, OIBus will be unable to decrypt the encrypted 
secrets. In such an event, a new AES key will be generated upon restarting OIBus. Consequently, it will be necessary to 
use the administration interface to re-enter all the secrets to regain access to the encrypted data. This process ensures 
the security of the secrets even in the event of a database deletion.
