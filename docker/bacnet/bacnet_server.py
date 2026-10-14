#!/usr/bin/env python3
"""
OIBus demo BACnet network.

Two BACnet devices built on BACpypes3, exposing objects whose values change over time, so OIBus's BACnet
south can be exercised end to end: Who-Is/I-Am discovery, ReadProperty/ReadPropertyMultiple polling, COV
subscriptions, Explore, and devices reached through a BACnet router:

    OIBus ── BACnet/IP, network 1 ── room device 1001 (also a router) ── virtual network 2 ── AHU device 1002, MAC 5

The room device is a BACnet/IP controller that also routes to a virtual network, standing in for the
MS/TP trunk of a building controller. The AHU sits on that network: it has no IP address of its own and is
reached through the room device, with network number 2 and MAC address 5.

Room device - a full-featured controller and router (device 1001, oibus-bacnet-room)
────────────────────────────────────────────────────────────────────────────────────
analog-input 1       Temperature   °C    sine wave, 20 ± 5, period ~190 s           COV increment 0.1
analog-input 2       Pressure      hPa   sine wave, 1013 ± 3, period ~280 s         COV increment 0.5
                                         in fault 15 s every minute: status flags fault bit set and
                                         reliability unreliable-other
analog-value 1       Setpoint      °C    fixed 21.5                                 COV increment 0.1
binary-input 1       Door          -     square wave, period 20 s
binary-value 1       Fan           -     fixed active
multi-state-value 1  Mode          -     cycles Off / Eco / Comfort every 15 s

Services: Who-Is, ReadProperty, ReadPropertyMultiple and SubscribeCOV come with BACpypes3. SubscribeCOVProperty,
which BACpypes3 does not implement, is added here in a minimal form (see RoomApplication).

AHU device - a constrained air handling unit, like a small MS/TP controller (device 1002, oibus-bacnet-ahu)
─────────────────────────────────────────────────────────────────────────────────────────────────────────────
analog-input 1        SupplyAirTemp  °C    sine wave, 16 ± 2, period ~125 s          COV increment 0.1
analog-input 2        ReturnAirTemp  °C    sine wave, 22 ± 1, period ~250 s          COV increment 0.1
analog-output 1       DamperPosition %     sawtooth 0 - 99, period 100 s             COV increment 1
binary-output 1       SupplyFan      -     square wave, period 40 s
binary-input 1        FilterAlarm    -     active 20 s every 90 s, with the in-alarm status flag
multi-state-input 1   UnitState      -     cycles Off / Starting / Running / Stopping every 10 s

Services: Who-Is, ReadProperty and SubscribeCOV only. ReadPropertyMultiple and SubscribeCOVProperty are
rejected (unrecognized service), and the object list cannot be read whole (abort, segmentation not
supported): it must be read one array index at a time.

Environment variables
─────────────────────
BACNET_HOST               local IPv4 address, "host" for the container's own interface (default: host)
BACNET_PORT               BACnet/IP UDP port of the room device (default: 47808)
BACNET_UPDATE_INTERVAL    seconds between value updates (default: 1)
"""

import asyncio
import math
import os
import time

from bacpypes3.apdu import (
    ReadPropertyMultipleRequest,
    ReadPropertyRequest,
    SimpleAckPDU,
    SubscribeCOVPropertyRequest,
    UnconfirmedCOVNotificationRequest,
)
import ifaddr
from bacpypes3.app import Application
from bacpypes3.basetypes import PropertyValue
from bacpypes3.constructeddata import Any
from bacpypes3.errors import ExecutionError, SegmentationNotSupported, UnrecognizedService
from bacpypes3.local.analog import AnalogInputObject, AnalogOutputObject, AnalogValueObject
from bacpypes3.local.binary import BinaryInputObject, BinaryOutputObject, BinaryValueObject
from bacpypes3.local.multistate import MultiStateInputObject, MultiStateValueObject
from bacpypes3.pdu import Address
from bacpypes3.vlan import VirtualNetwork

HOST = os.environ.get("BACNET_HOST", "host")
PORT = int(os.environ.get("BACNET_PORT", "47808"))
UPDATE_INTERVAL = float(os.environ.get("BACNET_UPDATE_INTERVAL", "1"))

NORMAL = [0, 0, 0, 0]  # status flags: in-alarm, fault, overridden, out-of-service
IN_ALARM = [1, 0, 0, 0]
FAULT = [0, 1, 0, 0]

IP_NETWORK = 1
ROUTED_NETWORK = 2
ROUTED_NETWORK_NAME = "mstp"
ROUTER_MAC = 1
AHU_MAC = 5


class RoomApplication(Application):
    """
    Adds SubscribeCOVProperty: a subscription to one property of one object. A notification, carrying that
    property and the object's status flags, is sent whenever the property value changes - on each update
    tick, not on a COV increment. Unconfirmed notifications only; a lifetime of 0 never expires.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # (subscriber address, process id, object id, property attribute) -> [expiry or None, last value sent]
        self.property_subscriptions = {}

    async def do_SubscribeCOVPropertyRequest(self, apdu: SubscribeCOVPropertyRequest) -> None:
        obj = self.get_object_id(apdu.monitoredObjectIdentifier)
        attr = apdu.monitoredPropertyIdentifier.propertyIdentifier.attr
        key = (apdu.pduSource, apdu.subscriberProcessIdentifier, apdu.monitoredObjectIdentifier, attr)
        if apdu.issueConfirmedNotifications is None and apdu.lifetime is None:
            self.property_subscriptions.pop(key, None)
        elif not obj:
            raise ExecutionError(errorClass="object", errorCode="unknownObject")
        elif getattr(obj, attr, None) is None:
            raise ExecutionError(errorClass="property", errorCode="unknownProperty")
        else:
            expiry = time.monotonic() + apdu.lifetime if apdu.lifetime else None
            # None as last value: the current value is sent on the next tick, as SubscribeCOV does.
            self.property_subscriptions[key] = [expiry, None]
        await self.response(SimpleAckPDU(context=apdu))

    def notify_property_subscriptions(self) -> None:
        now = time.monotonic()
        for key, subscription in list(self.property_subscriptions.items()):
            address, process_id, object_id, attr = key
            expiry, last_value = subscription
            obj = self.get_object_id(object_id)
            if obj is None or (expiry is not None and expiry <= now):
                del self.property_subscriptions[key]
                continue
            value = getattr(obj, attr)
            if value == last_value:
                continue
            subscription[1] = value
            request = UnconfirmedCOVNotificationRequest(
                subscriberProcessIdentifier=process_id,
                initiatingDeviceIdentifier=self.device_object.objectIdentifier,
                monitoredObjectIdentifier=object_id,
                timeRemaining=max(1, int(expiry - now)) if expiry is not None else 0,
                listOfValues=[
                    PropertyValue(propertyIdentifier=attr, value=Any(value)),
                    PropertyValue(propertyIdentifier="statusFlags", value=Any(obj.statusFlags)),
                ],
                destination=address,
            )
            self.request(request)


class ConstrainedApplication(Application):
    """A device without ReadPropertyMultiple, SubscribeCOVProperty nor segmentation."""

    async def do_ReadPropertyMultipleRequest(self, apdu: ReadPropertyMultipleRequest) -> None:
        raise UnrecognizedService()

    async def do_SubscribeCOVPropertyRequest(self, apdu: SubscribeCOVPropertyRequest) -> None:
        raise UnrecognizedService()

    async def do_ReadPropertyRequest(self, apdu: ReadPropertyRequest) -> None:
        # The whole object list would need a segmented reply: only one entry at a time is served.
        if apdu.propertyIdentifier == "objectList" and apdu.propertyArrayIndex is None:
            raise SegmentationNotSupported()
        await super().do_ReadPropertyRequest(apdu)


def room_objects():
    temperature = AnalogInputObject(
        objectIdentifier=("analogInput", 1),
        objectName="Temperature",
        description="Room temperature",
        presentValue=20.0,
        units="degreesCelsius",
        covIncrement=0.1,
        statusFlags=NORMAL,
        reliability="noFaultDetected",
    )
    pressure = AnalogInputObject(
        objectIdentifier=("analogInput", 2),
        objectName="Pressure",
        description="Atmospheric pressure",
        presentValue=1013.0,
        units="hectopascals",
        covIncrement=0.5,
        statusFlags=NORMAL,
        reliability="noFaultDetected",
    )
    setpoint = AnalogValueObject(
        objectIdentifier=("analogValue", 1),
        objectName="Setpoint",
        description="Temperature setpoint",
        presentValue=21.5,
        units="degreesCelsius",
        covIncrement=0.1,
        statusFlags=NORMAL,
    )
    door = BinaryInputObject(
        objectIdentifier=("binaryInput", 1),
        objectName="Door",
        description="Door contact",
        presentValue="inactive",
        statusFlags=NORMAL,
    )
    fan = BinaryValueObject(
        objectIdentifier=("binaryValue", 1),
        objectName="Fan",
        description="Fan command",
        presentValue="active",
        statusFlags=NORMAL,
    )
    mode = MultiStateValueObject(
        objectIdentifier=("multiStateValue", 1),
        objectName="Mode",
        description="Operating mode",
        presentValue=1,
        numberOfStates=3,
        stateText=["Off", "Eco", "Comfort"],
        statusFlags=NORMAL,
    )

    def update(elapsed: float) -> None:
        temperature.presentValue = round(20 + 5 * math.sin(elapsed / 30), 2)
        pressure.presentValue = round(1013 + 3 * math.cos(elapsed / 45), 2)
        in_fault = elapsed % 60 >= 45
        pressure.statusFlags = FAULT if in_fault else NORMAL
        pressure.reliability = "unreliableOther" if in_fault else "noFaultDetected"
        door.presentValue = "active" if elapsed % 20 < 10 else "inactive"
        mode.presentValue = int(elapsed / 15) % 3 + 1

    return [temperature, pressure, setpoint, door, fan, mode], update


def ahu_objects():
    supply_air = AnalogInputObject(
        objectIdentifier=("analogInput", 1),
        objectName="SupplyAirTemp",
        description="Supply air temperature",
        presentValue=16.0,
        units="degreesCelsius",
        covIncrement=0.1,
        statusFlags=NORMAL,
    )
    return_air = AnalogInputObject(
        objectIdentifier=("analogInput", 2),
        objectName="ReturnAirTemp",
        description="Return air temperature",
        presentValue=22.0,
        units="degreesCelsius",
        covIncrement=0.1,
        statusFlags=NORMAL,
    )
    damper = AnalogOutputObject(
        objectIdentifier=("analogOutput", 1),
        objectName="DamperPosition",
        description="Outside air damper position",
        presentValue=0.0,
        relinquishDefault=0.0,
        units="percent",
        covIncrement=1.0,
        statusFlags=NORMAL,
    )
    supply_fan = BinaryOutputObject(
        objectIdentifier=("binaryOutput", 1),
        objectName="SupplyFan",
        description="Supply fan command",
        presentValue="inactive",
        relinquishDefault="inactive",
        statusFlags=NORMAL,
    )
    filter_alarm = BinaryInputObject(
        objectIdentifier=("binaryInput", 1),
        objectName="FilterAlarm",
        description="Dirty filter alarm",
        presentValue="inactive",
        statusFlags=NORMAL,
    )
    unit_state = MultiStateInputObject(
        objectIdentifier=("multiStateInput", 1),
        objectName="UnitState",
        description="Unit state",
        presentValue=1,
        numberOfStates=4,
        stateText=["Off", "Starting", "Running", "Stopping"],
        statusFlags=NORMAL,
    )

    def update(elapsed: float) -> None:
        supply_air.presentValue = round(16 + 2 * math.sin(elapsed / 20), 2)
        return_air.presentValue = round(22 + math.sin(elapsed / 40), 2)
        damper.presentValue = float(int(elapsed) % 100)
        supply_fan.presentValue = "active" if elapsed % 40 < 20 else "inactive"
        alarm = elapsed % 90 >= 70
        filter_alarm.presentValue = "active" if alarm else "inactive"
        filter_alarm.statusFlags = IN_ALARM if alarm else NORMAL
        unit_state.presentValue = int(elapsed / 10) % 4 + 1

    return [supply_air, return_air, damper, supply_fan, filter_alarm, unit_state], update


def device_json(instance: int, name: str, segmentation: str, max_apdu: int) -> dict:
    return {
        "object-identifier": f"device,{instance}",
        "object-name": name,
        "object-type": "device",
        "apdu-segment-timeout": 1000,
        "apdu-timeout": 3000,
        "application-software-version": "1.0",
        "database-revision": 1,
        "firmware-revision": "N/A",
        "max-apdu-length-accepted": max_apdu,
        "model-name": "OIBus simulator",
        "number-of-apdu-retries": 3,
        "protocol-revision": 22,
        "protocol-version": 1,
        "segmentation-supported": segmentation,
        "system-status": "operational",
        "vendor-identifier": 999,
        "vendor-name": "OIBus",
    }


def host_ipv4() -> tuple:
    """The IPv4 address and network prefix length to bind to."""
    address = str(Address(HOST)).split(":")[0] if HOST == "host" else HOST
    for adapter in ifaddr.get_adapters():
        for ip in adapter.ips:
            if ip.is_IPv4 and ip.ip == address:
                return address, ip.network_prefix
    return address, 24


def mask(prefix: int) -> str:
    bits = (0xFFFFFFFF << (32 - prefix)) & 0xFFFFFFFF
    return ".".join(str((bits >> shift) & 0xFF) for shift in (24, 16, 8, 0))


def start_network():
    """Starts the room device (BACnet/IP, routing to the virtual network) and the AHU behind it."""
    VirtualNetwork(ROUTED_NETWORK_NAME)
    ip, prefix = host_ipv4()

    room = RoomApplication.from_json(
        [
            device_json(1001, "oibus-bacnet-room", "segmented-both", 1476),
            {
                "object-identifier": "network-port,1",
                "object-name": "NetworkPort-1",
                "object-type": "network-port",
                "network-type": "ipv4",
                "protocol-level": "bacnet-application",
                "bacnet-ip-mode": "normal",
                "bacnet-ip-udp-port": PORT,
                "ip-address": ip,
                "ip-subnet-mask": mask(prefix),
                "mac-address": f"{ip}:{PORT}",
                "network-number": IP_NETWORK,
                "network-number-quality": "configured",
                "changes-pending": False,
                "link-speed": 0.0,
                "out-of-service": False,
                "reliability": "no-fault-detected",
            },
            {
                "object-identifier": "network-port,2",
                "object-name": "NetworkPort-2",
                "object-type": "network-port",
                "network-type": "virtual",
                "protocol-level": "bacnet-application",
                "network-interface-name": ROUTED_NETWORK_NAME,
                "mac-address": f"0x{ROUTER_MAC:02x}",
                "network-number": ROUTED_NETWORK,
                "network-number-quality": "configured",
                "changes-pending": False,
                "out-of-service": False,
                "reliability": "no-fault-detected",
            },
        ]
    )
    ahu = ConstrainedApplication.from_json(
        [
            device_json(1002, "oibus-bacnet-ahu", "no-segmentation", 480),
            {
                "object-identifier": "network-port,1",
                "object-name": "NetworkPort-1",
                "object-type": "network-port",
                "network-type": "virtual",
                "protocol-level": "bacnet-application",
                "network-interface-name": ROUTED_NETWORK_NAME,
                "mac-address": f"0x{AHU_MAC:02x}",
                "changes-pending": False,
                "out-of-service": False,
                "reliability": "no-fault-detected",
            },
        ]
    )

    updates = []
    for app, build_objects in ((room, room_objects), (ahu, ahu_objects)):
        objects, update = build_objects()
        for obj in objects:
            app.add_object(obj)
        updates.append(update)
    print(
        f"BACnet device 1001 (oibus-bacnet-room) on {ip}:{PORT}, network {IP_NETWORK}, routing to network "
        f"{ROUTED_NETWORK}; BACnet device 1002 (oibus-bacnet-ahu) on network {ROUTED_NETWORK}, MAC {AHU_MAC}",
        flush=True,
    )

    def update(elapsed: float) -> None:
        for update_objects in updates:
            update_objects(elapsed)
        room.notify_property_subscriptions()

    return update


async def main() -> None:
    update = start_network()
    start = time.monotonic()
    while True:
        await asyncio.sleep(UPDATE_INTERVAL)
        update(time.monotonic() - start)


if __name__ == "__main__":
    asyncio.run(main())
