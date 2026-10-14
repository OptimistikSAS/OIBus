#!/usr/bin/env python3
"""
OIBus demo BACnet/IP device.

A single BACnet device built on BACpypes3, exposing analog, binary and multi-state objects whose values
change over time, so OIBus's BACnet south can be exercised end to end: Who-Is/I-Am discovery,
ReadProperty/ReadPropertyMultiple polling, COV subscriptions and Explore.

Objects
───────
analog-input 1       Temperature   °C    sine wave, 20 ± 5, period ~190 s           COV increment 0.1
analog-input 2       Pressure      hPa   sine wave, 1013 ± 3, period ~280 s         COV increment 0.5
                                         in fault 15 s every minute: status flags fault bit set and
                                         reliability unreliable-other
analog-value 1       Setpoint      °C    fixed 21.5                                 COV increment 0.1
binary-input 1       Door          -     square wave, period 20 s
binary-value 1       Fan           -     fixed active
multi-state-value 1  Mode          -     cycles Off / Eco / Comfort every 15 s

Environment variables
─────────────────────
BACNET_DEVICE_INSTANCE    device instance number (default: 1001)
BACNET_DEVICE_NAME        device object name (default: oibus-bacnet-sim)
BACNET_ADDRESS            local address, "host" to use the container's own interface (default: host)
BACNET_UPDATE_INTERVAL    seconds between value updates (default: 1)
"""

import asyncio
import math
import os
import time

from bacpypes3.argparse import SimpleArgumentParser
from bacpypes3.app import Application
from bacpypes3.local.analog import AnalogInputObject, AnalogValueObject
from bacpypes3.local.binary import BinaryInputObject, BinaryValueObject
from bacpypes3.local.multistate import MultiStateValueObject

DEVICE_INSTANCE = int(os.environ.get("BACNET_DEVICE_INSTANCE", "1001"))
DEVICE_NAME = os.environ.get("BACNET_DEVICE_NAME", "oibus-bacnet-sim")
ADDRESS = os.environ.get("BACNET_ADDRESS", "host")
UPDATE_INTERVAL = float(os.environ.get("BACNET_UPDATE_INTERVAL", "1"))

NORMAL = [0, 0, 0, 0]  # status flags: in-alarm, fault, overridden, out-of-service
FAULT = [0, 1, 0, 0]


async def main() -> None:
    args = SimpleArgumentParser().parse_args(
        ["--name", DEVICE_NAME, "--instance", str(DEVICE_INSTANCE), "--address", ADDRESS]
    )
    app = Application.from_args(args)

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
    for obj in (temperature, pressure, setpoint, door, fan, mode):
        app.add_object(obj)

    print(f"BACnet device {DEVICE_INSTANCE} ({DEVICE_NAME}) listening on {ADDRESS}", flush=True)
    start = time.monotonic()
    while True:
        await asyncio.sleep(UPDATE_INTERVAL)
        elapsed = time.monotonic() - start
        temperature.presentValue = round(20 + 5 * math.sin(elapsed / 30), 2)
        pressure.presentValue = round(1013 + 3 * math.cos(elapsed / 45), 2)
        in_fault = elapsed % 60 >= 45
        pressure.statusFlags = FAULT if in_fault else NORMAL
        pressure.reliability = "unreliableOther" if in_fault else "noFaultDetected"
        door.presentValue = "active" if elapsed % 20 < 10 else "inactive"
        mode.presentValue = int(elapsed / 15) % 3 + 1


if __name__ == "__main__":
    asyncio.run(main())
