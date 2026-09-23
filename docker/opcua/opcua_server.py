#!/usr/bin/env python3
"""
OIBus demo OPC UA server.

Replaces the opc-plc image, whose nodes file supports none of what OIBus's OPC UA south needs to be
exercised end to end: its "Simulation" settings are ignored (values never change), it has no history
(HistoryRead returns BadHistoryOperationUnsupported) and its nodes carry no EngineeringUnits/EURange.

Every node declared in nodes_config.json is created under Objects/<Folder> as an AnalogItem (when it has
EngineeringUnits/EURange) with:
  - its Description attribute,
  - an EngineeringUnits property (EUInformation, OPC UA Part 8 - unitId from its UNECE code),
  - an EURange property (Range: the normal operating range),
  - a simulated value (RandomWalk / SineWave / SquareWave), updated every `Interval` ms,
  - history (HistoryRead raw), kept in SQLite and capped per node - see OPCUA_HISTORY_* below.

Node ids are kept as ns=3;i=<NodeId> - what opc-plc exposed - so existing OIBus configurations still resolve.

Environment variables
─────────────────────
OPCUA_PORT                        listening port (default: 50000)
OPCUA_HOSTNAME                    host name advertised in the endpoint URL (default: opcua-server)
OPCUA_ADMIN_USER / _PASSWORD      admin credentials (default: admin / pass)
OPCUA_DEFAULT_USER / _PASSWORD    user credentials (default: oibus / pass)
OPCUA_ALLOW_NO_SECURITY           also offer the None security policy (default: true)
OPCUA_NODES_FILE                  node definitions (default: /app/nodes_config.json)
OPCUA_PKI_DIR                     where the self-signed server certificate is generated (default: /app/pki)
OPCUA_HISTORY_DB                  SQLite history file (default: /data/history.db)
OPCUA_HISTORY_MAX_VALUES          max values kept per node - the history size limit (default: 100000)
OPCUA_HISTORY_RETENTION_HOURS     values older than this are dropped too, 0 to disable (default: 168)
OPCUA_HISTORY_MAX_RESPONSE_SIZE   max values returned per HistoryRead response before a continuation
                                  point is used (default: 10000)
"""

import asyncio
import json
import logging
import math
import os
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

from asyncua import Server, ua
from asyncua.crypto.cert_gen import setup_self_signed_certificate
from asyncua.crypto.permission_rules import User, UserRole
from asyncua.server.history_sql import HistorySQLite
from asyncua.server.user_managers import UserManager
from cryptography.x509.oid import ExtendedKeyUsageOID

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logging.getLogger("asyncua").setLevel(logging.WARNING)
logger = logging.getLogger("oibus-opcua")

PORT = int(os.getenv("OPCUA_PORT", "50000"))
HOSTNAME = os.getenv("OPCUA_HOSTNAME", "opcua-server")
USERS = {
    os.getenv("OPCUA_ADMIN_USER", "admin"): (os.getenv("OPCUA_ADMIN_PASSWORD", "pass"), UserRole.Admin),
    os.getenv("OPCUA_DEFAULT_USER", "oibus"): (os.getenv("OPCUA_DEFAULT_PASSWORD", "pass"), UserRole.User),
}
ALLOW_NO_SECURITY = os.getenv("OPCUA_ALLOW_NO_SECURITY", "true").lower() == "true"
NODES_FILE = Path(os.getenv("OPCUA_NODES_FILE", "/app/nodes_config.json"))
PKI_DIR = Path(os.getenv("OPCUA_PKI_DIR", "/app/pki")) / "oibus-simulator"
HISTORY_DB = Path(os.getenv("OPCUA_HISTORY_DB", "/data/history.db"))
HISTORY_MAX_VALUES = int(os.getenv("OPCUA_HISTORY_MAX_VALUES", "100000"))
HISTORY_RETENTION_HOURS = float(os.getenv("OPCUA_HISTORY_RETENTION_HOURS", "168"))
HISTORY_MAX_RESPONSE_SIZE = int(os.getenv("OPCUA_HISTORY_MAX_RESPONSE_SIZE", "10000"))

APPLICATION_URI = "urn:oibus:opcua-simulator"
NAMESPACE_URI = "urn:oibus:opcua-simulator:nodes"

VARIANT_TYPES = {"Double": ua.VariantType.Double, "Int32": ua.VariantType.Int32, "Boolean": ua.VariantType.Boolean}
UNECE_NAMESPACE = "http://www.opcfoundation.org/UA/units/un/cefact"


class SimulatorUserManager(UserManager):
    """Username/password only - anonymous access is disabled, as it was with opc-plc."""

    def get_user(self, iserver, username=None, password=None, certificate=None):  # noqa: ANN001
        expected = USERS.get(username)
        if expected is None or expected[0] != password:
            return None
        return User(role=expected[1])


def unece_unit_id(code: str) -> int:
    """OPC UA Part 8 encoding of a UNECE Recommendation 20 code into EUInformation.UnitId."""
    unit_id = 0
    for char in code.strip()[:3]:
        unit_id = (unit_id << 8) | ord(char)
    return unit_id


class Simulation:
    def __init__(self, config: dict, initial: object, data_type: str) -> None:
        self.config = config
        self.value = initial
        self.data_type = data_type
        self.started = datetime.now(timezone.utc).timestamp()

    @property
    def interval(self) -> float:
        return self.config.get("Interval", 1000) / 1000

    def next(self) -> object:
        kind = self.config["Type"]
        elapsed_ms = (datetime.now(timezone.utc).timestamp() - self.started) * 1000
        if kind == "RandomWalk":
            step = random.choice([-1, 1]) * self.config["StepSize"]
            value = min(self.config["MaxValue"], max(self.config["MinValue"], float(self.value) + step))
        elif kind == "SineWave":
            value = self.config["Offset"] + self.config["Amplitude"] * math.sin(2 * math.pi * elapsed_ms / self.config["Period"])
        elif kind == "SquareWave":
            value = (elapsed_ms % self.config["Period"]) < self.config["Period"] / 2
        else:
            raise ValueError(f"Unknown simulation type {kind}")
        if self.data_type == "Int32":
            value = int(round(value))
        elif self.data_type == "Double":
            value = round(value, 3)
        self.value = value
        return value


async def setup_certificate(server: Server) -> None:
    PKI_DIR.mkdir(parents=True, exist_ok=True)
    cert_file, key_file = PKI_DIR / "server_cert.der", PKI_DIR / "server_key.pem"
    # No-op when both files already exist - the certificate survives restarts, so clients that pinned it
    # keep trusting it.
    await setup_self_signed_certificate(
        key_file,
        cert_file,
        APPLICATION_URI,
        HOSTNAME,
        [ExtendedKeyUsageOID.SERVER_AUTH, ExtendedKeyUsageOID.CLIENT_AUTH],
        {"countryName": "FR", "organizationName": "OIBus", "commonName": "OIBus OPC UA simulator"},
    )
    await server.load_certificate(str(cert_file))
    await server.load_private_key(str(key_file))


async def add_node(server: Server, folder, namespace: int, definition: dict):  # noqa: ANN001
    data_type = definition["DataType"]
    node_id = ua.NodeId(definition["NodeId"], namespace)
    variable = await folder.add_variable(node_id, ua.QualifiedName(definition["Name"], namespace), definition["Value"], VARIANT_TYPES[data_type])
    await variable.write_attribute(ua.AttributeIds.Description, ua.DataValue(ua.Variant(ua.LocalizedText(definition["Description"]))))

    def property_id(name: str) -> ua.NodeId:
        # Explicit string ids: auto-generated numeric ones would collide with the variables' own i=<NodeId>.
        return ua.NodeId(f"{definition['NodeId']}.{name}", namespace)

    if "EngineeringUnits" in definition or "EURange" in definition:
        # Typed as an AnalogItem - the information model OPC UA clients expect these properties on.
        await variable.delete_reference(ua.NodeId(ua.ObjectIds.BaseDataVariableType), ua.ObjectIds.HasTypeDefinition)
        await variable.add_reference(ua.NodeId(ua.ObjectIds.AnalogItemType), ua.ObjectIds.HasTypeDefinition)
    if "EngineeringUnits" in definition:
        units = definition["EngineeringUnits"]
        eu_information = ua.EUInformation(
            NamespaceUri=UNECE_NAMESPACE,
            UnitId=unece_unit_id(units["UneceCode"]),
            DisplayName=ua.LocalizedText(units["DisplayName"]),
            Description=ua.LocalizedText(units["Description"]),
        )
        await variable.add_property(property_id("EngineeringUnits"), ua.QualifiedName("EngineeringUnits", 0), eu_information, datatype=ua.NodeId(ua.ObjectIds.EUInformation))
    if "EURange" in definition:
        eu_range = ua.Range(Low=float(definition["EURange"]["Low"]), High=float(definition["EURange"]["High"]))
        await variable.add_property(property_id("EURange"), ua.QualifiedName("EURange", 0), eu_range, datatype=ua.NodeId(ua.ObjectIds.Range))

    # Historizing flag + HistoryRead access, so clients see the node as historized, not just the server.
    await variable.write_attribute(ua.AttributeIds.Historizing, ua.DataValue(ua.Variant(True, ua.VariantType.Boolean)))
    access = ua.AccessLevel.CurrentRead.mask | ua.AccessLevel.HistoryRead.mask
    await variable.write_attribute(ua.AttributeIds.AccessLevel, ua.DataValue(ua.Variant(access, ua.VariantType.Byte)))
    await variable.write_attribute(ua.AttributeIds.UserAccessLevel, ua.DataValue(ua.Variant(access, ua.VariantType.Byte)))
    return variable


async def simulate(variable, simulation: Simulation, variant_type: ua.VariantType) -> None:  # noqa: ANN001
    while True:
        await asyncio.sleep(simulation.interval)
        now = datetime.now(timezone.utc)
        await variable.write_value(ua.DataValue(Value=ua.Variant(simulation.next(), variant_type), SourceTimestamp=now, ServerTimestamp=now))


async def main() -> None:
    config = json.loads(NODES_FILE.read_text(encoding="utf-8"))

    server = Server(user_manager=SimulatorUserManager())
    # Must be set before init(), which opens the storage. On restart, the existing file (and its history)
    # is reused as-is.
    HISTORY_DB.parent.mkdir(parents=True, exist_ok=True)
    server.iserver.history_manager.set_storage(HistorySQLite(str(HISTORY_DB), max_history_data_response_size=HISTORY_MAX_RESPONSE_SIZE))
    await server.init()
    server.set_endpoint(f"opc.tcp://{HOSTNAME}:{PORT}/")
    # Bind every interface, whatever host name is advertised in the endpoint URL (e.g. "opcua-server"
    # inside the compose network, reached as localhost:50000 from the host).
    server.socket_address = ("0.0.0.0", PORT)
    server.set_server_name("OIBus OPC UA simulator")
    await server.set_application_uri(APPLICATION_URI)

    policies = [
        ua.SecurityPolicyType.Basic256Sha256_Sign,
        ua.SecurityPolicyType.Basic256Sha256_SignAndEncrypt,
        ua.SecurityPolicyType.Aes128Sha256RsaOaep_Sign,
        ua.SecurityPolicyType.Aes128Sha256RsaOaep_SignAndEncrypt,
        ua.SecurityPolicyType.Aes256Sha256RsaPss_Sign,
        ua.SecurityPolicyType.Aes256Sha256RsaPss_SignAndEncrypt,
    ]
    if ALLOW_NO_SECURITY:
        policies.insert(0, ua.SecurityPolicyType.NoSecurity)
    server.set_security_policy(policies)
    server.set_identity_tokens([ua.UserNameIdentityToken])
    await setup_certificate(server)

    # Namespace index 2 is reserved so the nodes land in ns=3, as they did with opc-plc.
    await server.register_namespace(f"{NAMESPACE_URI}:reserved")
    namespace = await server.register_namespace(NAMESPACE_URI)
    if namespace != 3:
        logger.warning("Nodes registered in ns=%d instead of ns=3 - existing OIBus item node ids will not resolve", namespace)
    folder = await server.nodes.objects.add_folder(ua.NodeId(config["Folder"], namespace), ua.QualifiedName(config["Folder"], namespace))

    nodes = []
    for definition in config["NodeList"]:
        variable = await add_node(server, folder, namespace, definition)
        nodes.append((variable, definition))

    async with server:
        retention = timedelta(hours=HISTORY_RETENTION_HOURS) if HISTORY_RETENTION_HOURS > 0 else None
        for variable, _definition in nodes:
            await server.historize_node_data_change(variable, period=retention, count=HISTORY_MAX_VALUES)
        logger.info(
            "OPC UA server listening on opc.tcp://%s:%d/ (ns=%d, %d nodes, history: %d values/node, retention %sh, db %s)",
            HOSTNAME,
            PORT,
            namespace,
            len(nodes),
            HISTORY_MAX_VALUES,
            HISTORY_RETENTION_HOURS or "unlimited",
            HISTORY_DB,
        )
        await asyncio.gather(
            *(
                simulate(variable, Simulation(definition["Simulation"], definition["Value"], definition["DataType"]), VARIANT_TYPES[definition["DataType"]])
                for variable, definition in nodes
            )
        )


if __name__ == "__main__":
    asyncio.run(main())
