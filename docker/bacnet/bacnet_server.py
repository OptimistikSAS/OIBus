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
integer-value 1      Occupancy     -     people in the room, 0 - 30, changes every 30 s
large-analog-value 1 Energy        kWh   meter index, +0.01 kWh per second
characterstring-value 1 StatusText -     "Normal", or "Pressure sensor fault" while Pressure is in fault
trend-log 1          TemperatureLog      Temperature logged every BACNET_TREND_LOG_INTERVAL seconds (real values)
trend-log 2          DoorLog             Door logged every BACNET_TREND_LOG_INTERVAL seconds (enumerated values)

Both trend logs start with 2 hours of records and hold up to 1000 records, the oldest dropped first.

Services: Who-Is, ReadProperty, ReadPropertyMultiple and SubscribeCOV come with BACpypes3. SubscribeCOVProperty
and ReadRange (trend log buffers), which BACpypes3 does not implement as a server, are added here in a minimal
form (see RoomApplication).

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
BACNET_TREND_LOG_INTERVAL seconds between two trend log records (default: 10)

Trend log timestamps are the container's local time, UTC unless TZ is set.
"""

import asyncio
import collections
import datetime
import math
import os
import time

from bacpypes3.apdu import (
    ReadPropertyMultipleRequest,
    ReadPropertyRequest,
    ReadRangeACK,
    ReadRangeRequest,
    SimpleAckPDU,
    SubscribeCOVPropertyRequest,
    UnconfirmedCOVNotificationRequest,
)
import ifaddr
from bacpypes3.app import Application
from bacpypes3.basetypes import DateTime, LogRecord, LogRecordLogDatum, PropertyValue, ResultFlags, StatusFlags
from bacpypes3.constructeddata import Any, ListOf
from bacpypes3.errors import ExecutionError, SegmentationNotSupported, UnrecognizedService
from bacpypes3.local.analog import AnalogInputObject, AnalogOutputObject, AnalogValueObject
from bacpypes3.local.binary import BinaryInputObject, BinaryOutputObject, BinaryValueObject
from bacpypes3.local.multistate import MultiStateInputObject, MultiStateValueObject
from bacpypes3.object import CharacterStringValueObject, IntegerValueObject, LargeAnalogValueObject, TrendLogObject
from bacpypes3.pdu import Address
from bacpypes3.primitivedata import Date, Time
from bacpypes3.vlan import VirtualNetwork

HOST = os.environ.get("BACNET_HOST", "host")
PORT = int(os.environ.get("BACNET_PORT", "47808"))
UPDATE_INTERVAL = float(os.environ.get("BACNET_UPDATE_INTERVAL", "1"))
TREND_LOG_INTERVAL = int(os.environ.get("BACNET_TREND_LOG_INTERVAL", "10"))
TREND_LOG_HISTORY = 7200  # seconds of records a trend log starts with
TREND_LOG_BUFFER_SIZE = 1000
MAX_RECORDS_PER_RESPONSE = 50  # a ReadRange reply carries at most this many records, flagged "more items"

NORMAL = [0, 0, 0, 0]  # status flags: in-alarm, fault, overridden, out-of-service
IN_ALARM = [1, 0, 0, 0]
FAULT = [0, 1, 0, 0]

IP_NETWORK = 1
ROUTED_NETWORK = 2
ROUTED_NETWORK_NAME = "mstp"
ROUTER_MAC = 1
AHU_MAC = 5


def to_bacnet_datetime(when: datetime.datetime) -> DateTime:
    return DateTime(
        date=Date((when.year - 1900, when.month, when.day, when.isoweekday())),
        time=Time((when.hour, when.minute, when.second, when.microsecond // 10000)),
    )


def from_bacnet_datetime(value: DateTime) -> datetime.datetime:
    year, month, day, _ = value.date
    hour, minute, second, hundredth = value.time
    return datetime.datetime(year + 1900, month, day, hour, minute, second, hundredth * 10000)


class TrendLogBuffer:
    """The records of a trend log object, kept in memory and served by RoomApplication.do_ReadRangeRequest."""

    def __init__(self, trend_log: TrendLogObject):
        self.trend_log = trend_log
        # (sequence number, local timestamp, LogRecord), oldest first
        self.records = collections.deque(maxlen=TREND_LOG_BUFFER_SIZE)
        self.total = 0

    def log(self, when: datetime.datetime, datum: LogRecordLogDatum) -> None:
        self.total += 1
        record = LogRecord(timestamp=to_bacnet_datetime(when), logDatum=datum, statusFlags=StatusFlags(NORMAL))
        self.records.append((self.total, when, record))
        self.trend_log.recordCount = len(self.records)
        self.trend_log.totalRecordCount = self.total


class RoomApplication(Application):
    """
    Adds two services BACpypes3 only implements as a client:
    - SubscribeCOVProperty: a subscription to one property of one object. A notification, carrying that
      property and the object's status flags, is sent whenever the property value changes - on each update
      tick, not on a COV increment. Unconfirmed notifications only; a lifetime of 0 never expires.
    - ReadRange of a trend log's log-buffer, by position, sequence number or time.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # (subscriber address, process id, object id, property attribute) -> [expiry or None, last value sent]
        self.property_subscriptions = {}
        # trend log object identifier -> TrendLogBuffer
        self.trend_logs = {}

    async def do_ReadRangeRequest(self, apdu: ReadRangeRequest) -> None:
        trend_log = self.trend_logs.get(apdu.objectIdentifier)
        if trend_log is None:
            raise ExecutionError(errorClass="object", errorCode="unknownObject")
        if apdu.propertyIdentifier.attr != "logBuffer":
            raise ExecutionError(errorClass="services", errorCode="propertyIsNotAList")
        records = list(trend_log.records)
        by_position = apdu.range is None or apdu.range.byPosition is not None

        # 0-based [start, stop) slice of the buffer, and the count asked for (its sign gives the direction)
        if apdu.range is None:
            start, stop, count = 0, len(records), len(records)
        else:
            if apdu.range.byPosition is not None:
                reference, count = apdu.range.byPosition.referenceIndex - 1, apdu.range.byPosition.count
            elif apdu.range.bySequenceNumber is not None:
                sequence = apdu.range.bySequenceNumber.referenceSequenceNumber
                count = apdu.range.bySequenceNumber.count
                reference = next((i for i, record in enumerate(records) if record[0] == sequence), None)
            else:
                reference_time = from_bacnet_datetime(apdu.range.byTime.referenceTime)
                count = apdu.range.byTime.count
                if count > 0:
                    reference = next((i for i, record in enumerate(records) if record[1] > reference_time), None)
                else:
                    reference = next((i for i in range(len(records) - 1, -1, -1) if records[i][1] < reference_time), None)
            if reference is None or not 0 <= reference < len(records):
                start = stop = 0
            elif count > 0:
                start, stop = reference, min(len(records), reference + count)
            else:
                start, stop = max(0, reference + count + 1), reference + 1

        # Too many records for one reply: keep those closest to the reference, flag "more items".
        more_items = stop - start > MAX_RECORDS_PER_RESPONSE
        if more_items and count < 0:
            start = stop - MAX_RECORDS_PER_RESPONSE
        elif more_items:
            stop = start + MAX_RECORDS_PER_RESPONSE
        selected = records[start:stop]

        ack = ReadRangeACK(
            context=apdu,
            objectIdentifier=apdu.objectIdentifier,
            propertyIdentifier="logBuffer",
            resultFlags=ResultFlags([int(bool(selected) and start == 0), int(bool(selected) and stop == len(records)), int(more_items)]),
            itemCount=len(selected),
            itemData=Any(ListOf(LogRecord)([record for _, _, record in selected])),
        )
        if selected and not by_position:
            ack.firstSequenceNumber = selected[0][0]
        await self.response(ack)

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
        if apdu.propertyIdentifier.attr == "objectList" and apdu.propertyArrayIndex is None:
            raise SegmentationNotSupported()
        await super().do_ReadPropertyRequest(apdu)


def temperature_at(elapsed: float) -> float:
    return round(20 + 5 * math.sin(elapsed / 30), 2)


def door_at(elapsed: float) -> str:
    return "active" if elapsed % 20 < 10 else "inactive"


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
    occupancy = IntegerValueObject(
        objectIdentifier=("integerValue", 1),
        objectName="Occupancy",
        description="People in the room",
        presentValue=0,
        units="noUnits",
        statusFlags=NORMAL,
    )
    energy = LargeAnalogValueObject(
        objectIdentifier=("largeAnalogValue", 1),
        objectName="Energy",
        description="Energy meter index",
        presentValue=12500.0,
        units="kilowattHours",
        statusFlags=NORMAL,
    )
    status_text = CharacterStringValueObject(
        objectIdentifier=("characterstringValue", 1),
        objectName="StatusText",
        description="Room status",
        presentValue="Normal",
        statusFlags=NORMAL,
    )
    trend_logs = []
    for instance, name, description in ((1, "TemperatureLog", "Temperature history"), (2, "DoorLog", "Door history")):
        trend_logs.append(
            TrendLogBuffer(
                TrendLogObject(
                    objectIdentifier=("trendLog", instance),
                    objectName=name,
                    description=description,
                    enable=True,
                    stopWhenFull=False,
                    bufferSize=TREND_LOG_BUFFER_SIZE,
                    logBuffer=[],
                    recordCount=0,
                    totalRecordCount=0,
                    loggingType="polled",
                    logInterval=TREND_LOG_INTERVAL * 100,
                    statusFlags=NORMAL,
                    reliability="noFaultDetected",
                )
            )
        )
    temperature_log, door_log = trend_logs

    def log(when: datetime.datetime, elapsed: float) -> None:
        temperature_log.log(when, LogRecordLogDatum(realValue=temperature_at(elapsed)))
        door_log.log(when, LogRecordLogDatum(enumValue=1 if door_at(elapsed) == "active" else 0))

    # Start with TREND_LOG_HISTORY seconds of records, as if the device had been logging for a while.
    started_at = datetime.datetime.now()
    for back in range(TREND_LOG_HISTORY // TREND_LOG_INTERVAL, -1, -1):
        log(started_at - datetime.timedelta(seconds=back * TREND_LOG_INTERVAL), -back * TREND_LOG_INTERVAL)
    next_log = [TREND_LOG_INTERVAL]

    def update(elapsed: float) -> None:
        temperature.presentValue = temperature_at(elapsed)
        pressure.presentValue = round(1013 + 3 * math.cos(elapsed / 45), 2)
        in_fault = elapsed % 60 >= 45
        pressure.statusFlags = FAULT if in_fault else NORMAL
        pressure.reliability = "unreliableOther" if in_fault else "noFaultDetected"
        status_text.presentValue = "Pressure sensor fault" if in_fault else "Normal"
        door.presentValue = door_at(elapsed)
        mode.presentValue = int(elapsed / 15) % 3 + 1
        occupancy.presentValue = int(15 + 15 * math.sin(int(elapsed / 30)))
        energy.presentValue = round(12500 + elapsed * 0.01, 2)
        if elapsed >= next_log[0]:
            log(started_at + datetime.timedelta(seconds=elapsed), elapsed)
            next_log[0] += TREND_LOG_INTERVAL

    objects = [temperature, pressure, setpoint, door, fan, mode, occupancy, energy, status_text]
    return objects + [trend_log.trend_log for trend_log in trend_logs], update, trend_logs


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

    return [supply_air, return_air, damper, supply_fan, filter_alarm, unit_state], update, []


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
        objects, update, trend_logs = build_objects()
        for obj in objects:
            app.add_object(obj)
        for trend_log in trend_logs:
            app.trend_logs[trend_log.trend_log.objectIdentifier] = trend_log
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
