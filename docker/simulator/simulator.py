#!/usr/bin/env python3
"""
Unified OIBus demo simulator.

Each protocol runs in its own daemon thread with an independent retry loop so
that a failure in one source does not affect the other.

Environment variables
─────────────────────
RETRY_INTERVAL          seconds between reconnection attempts (default: 10)

Modbus:
  MODBUS_HOST             (default: modbus-server)
  MODBUS_PORT             (default: 5020)
  MODBUS_SLAVE_ID         (default: 1)
  MODBUS_UPDATE_INTERVAL  seconds between writes (default: 2)

MQTT:
  MQTT_BROKER             (default: mqtt-broker)
  MQTT_PORT               (default: 1883)
  MQTT_USER               (default: oibus)
  MQTT_PASSWORD           (default: pass)
  MQTT_UPDATE_INTERVAL    seconds between publishes (default: 2)
"""

import math
import os
import random
import struct
import time
import threading

# ─── Shared ──────────────────────────────────────────────────────────────────
RETRY_INTERVAL = int(os.getenv("RETRY_INTERVAL", 10))

# ─── Modbus configuration ────────────────────────────────────────────────────
MODBUS_HOST = os.getenv("MODBUS_HOST", "modbus-server")
MODBUS_PORT = int(os.getenv("MODBUS_PORT", 5020))
MODBUS_SLAVE_ID = int(os.getenv("MODBUS_SLAVE_ID", 1))
MODBUS_UPDATE_INTERVAL = int(os.getenv("MODBUS_UPDATE_INTERVAL", 2))

# ── Holding registers uint16 (1 word): (addr, name, base, amplitude, period_s)
HOLDING_REGISTERS_UINT16 = [
    (0, "temperature",       250,  50,   60),
    (1, "humidity",          600, 200,  120),
    (2, "pressure",          100,  30,  180),
    (3, "vibration",         250, 200,   30),
    (4, "co2",               600, 200,  300),
    (5, "flow_rate",         150,  80,   90),
]

# ── Holding registers int16 (1 word, signed): (addr, name, base, amplitude, period_s)
HOLDING_REGISTERS_INT16 = [
    (6, "outdoor_temp",        5,  25,  240),  # range ≈ –20 … +30 °C
]

# ── Holding registers uint32 (2 words): (addr, name, base, amplitude, period_s)
HOLDING_REGISTERS_UINT32 = [
    (7, "production_count", 50000, 40000, 600),  # words at addr 7 & 8
]

# ── Holding registers float (2 words): (addr, name, base, amplitude, period_s)
HOLDING_REGISTERS_FLOAT = [
    (9, "power_kw", 75.5, 45.0, 180),           # words at addr 9 & 10
]

# ── Holding registers int32 (2 words, signed): (addr, name, base, amplitude, period_s)
HOLDING_REGISTERS_INT32 = [
    (11, "energy_balance", 0, 5000, 360),        # words at addr 11 & 12
]

# ── Holding registers double (4 words): (addr, name, base, amplitude, period_s)
HOLDING_REGISTERS_DOUBLE = [
    (13, "shaft_speed", 1500.0, 300.0, 120),     # words at addr 13–16
]

# ── Bitfield holding register (1 word, each bit is a boolean flag)
STATUS_FLAGS_ADDR = 17
STATUS_FLAGS_BITS = [
    (0, "motor_running",   60),
    (1, "fault_detected", 300),
    (2, "maintenance_due", 600),
    (3, "overload",        120),
]

# ── Coils (protocol_address, name, period_s)
COILS = [
    (0, "pump_running",  30),
    (1, "valve_open",    45),
    (2, "alarm_active", 120),
    (3, "machine_on",    20),
]

# ─── MQTT configuration ──────────────────────────────────────────────────────
MQTT_BROKER = os.getenv("MQTT_BROKER", "mqtt-broker")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
MQTT_USER = os.getenv("MQTT_USER", "oibus")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "pass")
MQTT_UPDATE_INTERVAL = int(os.getenv("MQTT_UPDATE_INTERVAL", 2))

# MQTT sensors: (workshop, sensor, type, base, amplitude, period_s)
MQTT_SENSORS = [
    ("workshop1", "sensor1", "temperature",   30.0,  10.0,  60),
    ("workshop1", "sensor2", "humidity",      55.0,  25.0, 120),
    ("workshop1", "sensor3", "pressure",    1000.0,  50.0, 180),
    ("workshop1", "sensor4", "vibration",      5.0,   5.0,  30),
    ("workshop2", "sensor1", "temperature",   28.0,   8.0,  90),
    ("workshop2", "sensor2", "humidity",      50.0,  20.0, 150),
    ("workshop2", "sensor3", "pressure",     990.0,  40.0, 210),
    ("workshop2", "sensor4", "vibration",      4.0,   4.0,  45),
]


# ─── Simulation helpers ───────────────────────────────────────────────────────

def simulate_value(t: float, base: float, amplitude: float, period: float) -> float:
    """Sinusoidal value with 5 % noise."""
    value = base + amplitude * math.sin(2 * math.pi * t / period)
    noise = random.uniform(-amplitude * 0.05, amplitude * 0.05)
    return value + noise


def simulate_coil(t: float, period: float) -> bool:
    """Square-wave: on for first half of period, off for second."""
    return (int(t) % period) < (period // 2)


# ─── Encoding helpers ─────────────────────────────────────────────────────────

def int16_to_uint16(v: float) -> int:
    """Clamp to int16 range and encode as two's-complement uint16."""
    return max(-32768, min(32767, int(v))) & 0xFFFF


def words_from_struct(fmt: str, value: object) -> list:
    """
    Pack value with the given big-endian struct format and produce the Modbus
    wire word sequence expected by OIBus with:
      endianness='big-endian', swapWordsInDWords=false, swapBytesInWords=false.

    OIBus applies an unconditional swap32()+swap16() before reading multi-word
    values, which means it expects the LOW 16-bit word before the HIGH 16-bit
    word within each 32-bit dword on the wire.
    Concretely: [w0, w1, w2, w3] must be written as [w1, w0, w3, w2].
    """
    b = struct.pack(fmt, value)
    words = [int.from_bytes(b[i:i + 2], 'big') for i in range(0, len(b), 2)]
    # Swap adjacent pairs: index i gets words[i XOR 1]
    return [words[i ^ 1] for i in range(len(words))]


# ─── Modbus worker ────────────────────────────────────────────────────────────

def modbus_worker() -> None:
    from pymodbus.client import ModbusTcpClient

    t = 0.0
    while True:
        client = ModbusTcpClient(host=MODBUS_HOST, port=MODBUS_PORT)
        print(f"[modbus] Connecting to {MODBUS_HOST}:{MODBUS_PORT} ...")
        if not client.connect():
            print(f"[modbus] Connection failed. Retrying in {RETRY_INTERVAL}s ...")
            client.close()
            time.sleep(RETRY_INTERVAL)
            continue

        print("[modbus] Connected.")
        try:
            while True:
                # ── uint16 ──────────────────────────────────────────────────
                for addr, name, base, amplitude, period in HOLDING_REGISTERS_UINT16:
                    value = max(0, min(65535, int(simulate_value(t, base, amplitude, period))))
                    result = client.write_register(addr, value, slave=MODBUS_SLAVE_ID)
                    if result.isError():
                        raise RuntimeError(f"Error writing {name} (addr={addr}): {result}")
                    print(f"[modbus]   [HR uint16] {name:20s}  addr={addr:2d}  value={value}")

                # ── int16 ───────────────────────────────────────────────────
                for addr, name, base, amplitude, period in HOLDING_REGISTERS_INT16:
                    raw = int(simulate_value(t, base, amplitude, period))
                    value = int16_to_uint16(raw)
                    result = client.write_register(addr, value, slave=MODBUS_SLAVE_ID)
                    if result.isError():
                        raise RuntimeError(f"Error writing {name} (addr={addr}): {result}")
                    print(f"[modbus]   [HR int16 ] {name:20s}  addr={addr:2d}  raw={raw:+d}  encoded={value}")

                # ── uint32 (2 words) ─────────────────────────────────────────
                for addr, name, base, amplitude, period in HOLDING_REGISTERS_UINT32:
                    raw = max(0, min(0xFFFFFFFF, int(simulate_value(t, base, amplitude, period))))
                    words = words_from_struct('>I', raw)
                    result = client.write_registers(addr, words, slave=MODBUS_SLAVE_ID)
                    if result.isError():
                        raise RuntimeError(f"Error writing {name} (addr={addr}): {result}")
                    print(f"[modbus]   [HR uint32] {name:20s}  addr={addr:2d}  value={raw}")

                # ── float (2 words) ──────────────────────────────────────────
                for addr, name, base, amplitude, period in HOLDING_REGISTERS_FLOAT:
                    raw = simulate_value(t, base, amplitude, period)
                    words = words_from_struct('>f', raw)
                    result = client.write_registers(addr, words, slave=MODBUS_SLAVE_ID)
                    if result.isError():
                        raise RuntimeError(f"Error writing {name} (addr={addr}): {result}")
                    print(f"[modbus]   [HR float ] {name:20s}  addr={addr:2d}  value={raw:.3f}")

                # ── int32 (2 words) ──────────────────────────────────────────
                for addr, name, base, amplitude, period in HOLDING_REGISTERS_INT32:
                    raw = max(-0x80000000, min(0x7FFFFFFF, int(simulate_value(t, base, amplitude, period))))
                    words = words_from_struct('>i', raw)
                    result = client.write_registers(addr, words, slave=MODBUS_SLAVE_ID)
                    if result.isError():
                        raise RuntimeError(f"Error writing {name} (addr={addr}): {result}")
                    print(f"[modbus]   [HR int32 ] {name:20s}  addr={addr:2d}  value={raw:+d}")

                # ── double (4 words) ─────────────────────────────────────────
                for addr, name, base, amplitude, period in HOLDING_REGISTERS_DOUBLE:
                    raw = simulate_value(t, base, amplitude, period)
                    words = words_from_struct('>d', raw)
                    result = client.write_registers(addr, words, slave=MODBUS_SLAVE_ID)
                    if result.isError():
                        raise RuntimeError(f"Error writing {name} (addr={addr}): {result}")
                    print(f"[modbus]   [HR double] {name:20s}  addr={addr:2d}  value={raw:.3f}")

                # ── bitfield (status flags) ──────────────────────────────────
                flags = 0
                for bit_idx, bit_name, bit_period in STATUS_FLAGS_BITS:
                    if simulate_coil(t, bit_period):
                        flags |= 1 << bit_idx
                result = client.write_register(STATUS_FLAGS_ADDR, flags, slave=MODBUS_SLAVE_ID)
                if result.isError():
                    raise RuntimeError(f"Error writing status_flags (addr={STATUS_FLAGS_ADDR}): {result}")
                print(f"[modbus]   [HR flags ] status_flags          addr={STATUS_FLAGS_ADDR:2d}  value=0b{flags:04b}")

                # ── coils ────────────────────────────────────────────────────
                for addr, name, period in COILS:
                    value = simulate_coil(t, period)
                    result = client.write_coil(addr, value, slave=MODBUS_SLAVE_ID)
                    if result.isError():
                        raise RuntimeError(f"Error writing coil {name} (addr={addr}): {result}")
                    print(f"[modbus]   [coil     ] {name:20s}  addr={addr:2d}  value={value}")

                t += MODBUS_UPDATE_INTERVAL
                time.sleep(MODBUS_UPDATE_INTERVAL)

        except Exception as exc:
            print(f"[modbus] Write error: {exc}. Reconnecting in {RETRY_INTERVAL}s ...")
            client.close()
            time.sleep(RETRY_INTERVAL)


# ─── MQTT worker ──────────────────────────────────────────────────────────────

def mqtt_worker() -> None:
    import paho.mqtt.client as mqtt

    t = 0.0
    while True:
        print(f"[mqtt] Connecting to {MQTT_BROKER}:{MQTT_PORT} ...")
        client = mqtt.Client(
            client_id="oibus_simulator",
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
        )
        client.username_pw_set(MQTT_USER, MQTT_PASSWORD)

        connected = threading.Event()

        def on_connect(c, userdata, flags, reason_code, properties):  # noqa: ANN001
            if reason_code == 0:
                connected.set()
            else:
                print(f"[mqtt] Connection refused, reason={reason_code}")

        def on_disconnect(c, userdata, flags, reason_code, properties):  # noqa: ANN001
            connected.clear()

        client.on_connect = on_connect
        client.on_disconnect = on_disconnect

        try:
            client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
            client.loop_start()

            if not connected.wait(timeout=RETRY_INTERVAL):
                print(f"[mqtt] Connection timeout. Retrying in {RETRY_INTERVAL}s ...")
                client.loop_stop()
                client.disconnect()
                time.sleep(RETRY_INTERVAL)
                continue

            print("[mqtt] Connected.")
            while connected.is_set():
                for workshop, sensor, sensor_type, base, amplitude, period in MQTT_SENSORS:
                    value = round(simulate_value(t, base, amplitude, period), 2)
                    topic = f"{workshop}/{sensor}/{sensor_type}"
                    client.publish(topic, value)
                    print(f"[mqtt]   {topic} = {value}")

                t += MQTT_UPDATE_INTERVAL
                time.sleep(MQTT_UPDATE_INTERVAL)

            client.loop_stop()
            print(f"[mqtt] Disconnected. Reconnecting in {RETRY_INTERVAL}s ...")
            time.sleep(RETRY_INTERVAL)

        except Exception as exc:
            print(f"[mqtt] Error: {exc}. Retrying in {RETRY_INTERVAL}s ...")
            try:
                client.loop_stop()
                client.disconnect()
            except Exception:
                pass
            time.sleep(RETRY_INTERVAL)


# ─── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    workers = [
        threading.Thread(target=modbus_worker, name="modbus", daemon=True),
        threading.Thread(target=mqtt_worker,   name="mqtt",   daemon=True),
    ]
    for w in workers:
        w.start()
        print(f"[main] Started {w.name} worker.")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("[main] Stopping simulator.")
