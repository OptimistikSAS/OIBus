---
sidebar_position: 1
---

# OIBus security

OIBus is usually installed on a dedicated machine (which can be a virtual machine) located at the customer site. The 
OIBus behavior is fully managed by the OIBus configuration SQLite database (oibus.db). It is important to consider several 
aspects to protect OIBus:
- Access to the machine
- Access to the OIBus administration interface
- Protection of passwords, secret keys, etc…
 

## Access to the OIBus machine
Of course, local or remote access (using RDP - Remote Desktop Protocol - or disk sharing for example) to the machine 
where OIBus is installed is a risk to consider. Indeed, a local user could delete OIBus files or directly modify the 
configuration file.

It is important to limit access to the OIBus machine so that no one can access it except the OIBus administrator.

## Access to the OIBus administration interface
The OIBus administration interface is web-based and can be launched locally or from any remote PC with a 
web browser. We recommend to use the interface using the local URL `http://localhost:2223`.

To use it from a remote PC, you must configure the [IP Filters](docs/guide/engine/access.md#ip-filters) section of the OIBus 
Engine. 

Access to the administration interface requires a user/password. The default username is **admin**. The default 
password is **pass**.

Changing the default password is strongly recommended.

## HTTP protocol and Basic Auth
OIBus uses the Basic Auth method in addition to the HTTP protocol supported by most web browsers. This method
**does not provide any privacy protection** for the transmitted credentials sent in the header at each HTTP request. 

The **filters** in the OIBus Engine can mitigate this risk by limiting the IP addresses allowed, but this is not a 100% 
guaranteed protection as impersonating another computer system with a fake IP address is not difficult for hackers.
In addition, the privacy of the network over which the HTTP request is passing through must be respected to be sure 
that the credentials will not leak.

Therefore, remote access to the OIBus administration interface should be limited to within the customer’s LAN and 
should not be accessible over the Internet. The use of a VPN is strongly advised.

OIBus does not store the user passwords. Instead, it hashes the password with the argon2 algorithm, and only the hash
is stored. When logging into OIBus, the hash of the password is compared with the stored hash.

## Protection of passwords and secrets
OIBus needs to access multiple sources of information (Histories, DCS, LIMS, MES, Databases, etc.). Many of these 
sources require a username/password pair or a secret key to grant access.

This information is also stored in the OIBus database configuration (`oibus.db`), but it is all encrypted with the AES-256 
(CBC mode) algorithm. This adds a level of protection that prevents anyone from reading this information unencrypted.

The AES symmetric key is stored in the `crypto.db` SQLite database. We choose to use a separate database in case the 
`oibus.db` database file is sent for debugging or replicating a configuration. Since the secrets are encrypted with a 
key stored in a separate database, it won't be possible to access the encrypted secrets. Of course, it implies to never
send both files together.

If the `crypto.db` SQLite database is deleted, it will be impossible for OIBus to decrypt the encrypted secrets. A new 
AES key will be generated when OIBus is restarted. In this case it will be necessary to use the administration interface 
and re-enter all secrets.
