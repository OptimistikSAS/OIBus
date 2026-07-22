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

  The MQTT worker publishes two families of topics:
    - scalar topics (e.g. "workshop1/sensor1/temperature") carrying a bare number,
    - JSON topics under ".../json/..." carrying different payload SHAPES (flat object,
      nested object, array of readings, mixed types, a JSON string, a bare number).
  The JSON topics feed OIBus's MQTT south as `any-content` and exercise custom
  transformers — including payloads whose fields are themselves objects/arrays, which is
  what surfaces bugs where a non-string value (e.g. a JSON payload used as a filename)
  reaches the metrics database.

InfluxDB:
  INFLUXDB_URL              (default: http://influxdb:8086)
  INFLUXDB_TOKEN            (default: oibus-admin-token)
  INFLUXDB_ORG              (default: oibus)
  INFLUXDB_BUCKET           (default: oibus-bucket)
  INFLUXDB_UPDATE_INTERVAL  seconds between writes (default: 10)

  The InfluxDB worker writes one point per sensor every cycle, each carrying several TAGS
  (workshop, sensor_id) alongside a single "value" field, spread across a handful of
  measurements (temperature, humidity, pressure, vibration, co2) so OIBus's InfluxDB south
  connector can be exercised with Flux/InfluxQL queries that filter/group by tag.

PostgreSQL:
  POSTGRES_HOST             (default: postgres)
  POSTGRES_PORT             (default: 5432)
  POSTGRES_USER             (default: oibus)
  POSTGRES_PASSWORD         (default: pass)
  POSTGRES_DB               (default: oibus-db)
  POSTGRES_UPDATE_INTERVAL  seconds between writes (default: 10)

  The PostgreSQL worker writes the same SENSOR_READINGS used by the InfluxDB worker into a
  single "sensor_readings" table (created on first connect if missing), one row per sensor
  every cycle, with workshop/sensor_id/measurement columns standing in for InfluxDB's tags so
  OIBus's SQL south connector has a realistic wide time-series table to query.
"""

import json
import math
import os
import random
import struct
import time
import threading
from datetime import datetime, timezone

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

# MQTT scalar sensors: (workshop, sensor, type, base, amplitude, period_s)
# These publish a bare number, e.g. topic "workshop1/sensor1/temperature" payload "23.5".
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

# ─── InfluxDB configuration ──────────────────────────────────────────────────
INFLUXDB_URL = os.getenv("INFLUXDB_URL", "http://influxdb:8086")
INFLUXDB_TOKEN = os.getenv("INFLUXDB_TOKEN", "oibus-admin-token")
INFLUXDB_ORG = os.getenv("INFLUXDB_ORG", "oibus")
INFLUXDB_BUCKET = os.getenv("INFLUXDB_BUCKET", "oibus-bucket")
INFLUXDB_UPDATE_INTERVAL = int(os.getenv("INFLUXDB_UPDATE_INTERVAL", 10))

# ─── PostgreSQL configuration ─────────────────────────────────────────────────
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "postgres")
POSTGRES_PORT = int(os.getenv("POSTGRES_PORT", 5432))
POSTGRES_USER = os.getenv("POSTGRES_USER", "oibus")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "pass")
POSTGRES_DB = os.getenv("POSTGRES_DB", "oibus-db")
POSTGRES_UPDATE_INTERVAL = int(os.getenv("POSTGRES_UPDATE_INTERVAL", 10))
POSTGRES_TABLE = "sensor_readings"

# Sensor readings shared by the InfluxDB and PostgreSQL workers: (workshop, sensor_id,
# measurement, base, amplitude, period_s). Each row becomes one InfluxDB point (measurement=
# <measurement>, tags={workshop, sensor_id}, field value=<simulated reading>) or one
# PostgreSQL row (same columns) per write cycle. Several sensors share the same measurement
# (e.g. "temperature") but are distinguished by workshop/sensor_id, so OIBus queries can
# filter/group by either.
SENSOR_READINGS = [
    ("workshop1", "sensor1", "temperature", 22.0,   5.0,   60),
    ("workshop1", "sensor2", "humidity",    45.0,  15.0,   90),
    ("workshop1", "sensor3", "pressure",  1010.0,  20.0,  120),
    ("workshop2", "sensor1", "temperature", 20.0,   4.0,   75),
    ("workshop2", "sensor2", "vibration",    3.0,   2.0,   40),
    ("workshop2", "sensor3", "co2",        500.0, 150.0,  200),
]


# ─── MQTT JSON payload builders ────────────────────────────────────────────────
# Each builder takes the simulation clock `t` and returns a Python value that is
# serialised with json.dumps() before publishing. They intentionally cover a range
# of JSON SHAPES so OIBus custom transformers can be exercised against each one.

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def json_flat(t: float) -> dict:
    """A flat object — the common "single reading" shape."""
    return {
        "value": round(simulate_value(t, 30.0, 10.0, 60), 2),
        "unit": "celsius",
        "timestamp": _now_iso(),
        "quality": "good",
    }


def json_nested(t: float) -> dict:
    """A nested object — fields that are themselves objects (e.g. `sensor`, `location`).
    A naive custom transformer doing `filename: payload.sensor` would yield a non-string."""
    return {
        "sensor": {"id": "sensor-42", "type": "temperature", "location": {"workshop": "workshop1", "line": 3}},
        "reading": {"value": round(simulate_value(t, 30.0, 10.0, 60), 2), "timestamp": _now_iso()},
    }


def json_array(t: float) -> list:
    """An array of readings — a "batch" payload."""
    return [
        {"timestamp": _now_iso(), "value": round(simulate_value(t + i, 30.0, 10.0, 60), 2)}
        for i in range(3)
    ]


def json_mixed_types(t: float) -> dict:
    """Every JSON scalar type plus a nested object/array — stresses type handling."""
    return {
        "int": int(simulate_value(t, 100.0, 50.0, 90)),
        "float": round(simulate_value(t, 3.14, 1.0, 45), 4),
        "bool": simulate_coil(t, 30),
        "string": "ok",
        "null": None,
        "tags": ["alpha", "beta"],
        "nested": {"a": 1, "b": [1, 2, 3]},
    }


def json_string(t: float) -> str:
    """A JSON string value (publishes a quoted string, e.g. "reading-12")."""
    return f"reading-{int(t)}"


def json_number(t: float) -> float:
    """A bare JSON number (publishes e.g. 42.7, no object wrapper)."""
    return round(simulate_value(t, 42.0, 5.0, 60), 2)


# MQTT JSON topics: (topic, builder)
MQTT_JSON_TOPICS = [
    ("workshop1/json/flat",   json_flat),
    ("workshop1/json/nested", json_nested),
    ("workshop1/json/array",  json_array),
    ("workshop2/json/mixed",  json_mixed_types),
    ("workshop2/json/string", json_string),
    ("workshop2/json/number", json_number),
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
                # Scalar topics: bare number payloads.
                for workshop, sensor, sensor_type, base, amplitude, period in MQTT_SENSORS:
                    value = round(simulate_value(t, base, amplitude, period), 2)
                    topic = f"{workshop}/{sensor}/{sensor_type}"
                    client.publish(topic, value)
                    print(f"[mqtt]   {topic} = {value}")

                # JSON topics: different payload shapes (object/array/string/number/...).
                for topic, builder in MQTT_JSON_TOPICS:
                    payload = json.dumps(builder(t))
                    client.publish(topic, payload)
                    preview = payload if len(payload) <= 80 else payload[:77] + "..."
                    print(f"[mqtt]   {topic} = {preview}")

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


# ─── InfluxDB worker ──────────────────────────────────────────────────────────

def influxdb_worker() -> None:
    from influxdb_client import InfluxDBClient, Point
    from influxdb_client.client.write_api import SYNCHRONOUS

    t = 0.0
    while True:
        print(f"[influxdb] Connecting to {INFLUXDB_URL} ...")
        client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
        try:
            health = client.health()
            if health.status != "pass":
                raise RuntimeError(f"health check failed: {health.message}")
            write_api = client.write_api(write_options=SYNCHRONOUS)
            print("[influxdb] Connected.")

            while True:
                points = []
                for workshop, sensor_id, measurement, base, amplitude, period in SENSOR_READINGS:
                    value = round(simulate_value(t, base, amplitude, period), 2)
                    point = (
                        Point(measurement)
                        .tag("workshop", workshop)
                        .tag("sensor_id", sensor_id)
                        .field("value", value)
                        .time(datetime.now(timezone.utc))
                    )
                    points.append(point)
                    print(f"[influxdb]   {measurement},workshop={workshop},sensor_id={sensor_id} value={value}")

                write_api.write(bucket=INFLUXDB_BUCKET, org=INFLUXDB_ORG, record=points)

                t += INFLUXDB_UPDATE_INTERVAL
                time.sleep(INFLUXDB_UPDATE_INTERVAL)

        except Exception as exc:
            print(f"[influxdb] Error: {exc}. Retrying in {RETRY_INTERVAL}s ...")
            client.close()
            time.sleep(RETRY_INTERVAL)


# ─── PostgreSQL worker ────────────────────────────────────────────────────────

def postgres_worker() -> None:
    import psycopg2

    t = 0.0
    while True:
        print(f"[postgres] Connecting to {POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB} ...")
        conn = None
        try:
            conn = psycopg2.connect(
                host=POSTGRES_HOST,
                port=POSTGRES_PORT,
                user=POSTGRES_USER,
                password=POSTGRES_PASSWORD,
                dbname=POSTGRES_DB,
            )
            conn.autocommit = True
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    CREATE TABLE IF NOT EXISTS {POSTGRES_TABLE} (
                        id SERIAL PRIMARY KEY,
                        "timestamp" TIMESTAMPTZ NOT NULL,
                        workshop TEXT NOT NULL,
                        sensor_id TEXT NOT NULL,
                        measurement TEXT NOT NULL,
                        value DOUBLE PRECISION NOT NULL
                    );
                    """
                )
            print("[postgres] Connected.")

            while True:
                now = datetime.now(timezone.utc)
                rows = []
                for workshop, sensor_id, measurement, base, amplitude, period in SENSOR_READINGS:
                    value = round(simulate_value(t, base, amplitude, period), 2)
                    rows.append((now, workshop, sensor_id, measurement, value))
                    print(f"[postgres]   {measurement},workshop={workshop},sensor_id={sensor_id} value={value}")

                with conn.cursor() as cur:
                    cur.executemany(
                        f'INSERT INTO {POSTGRES_TABLE} ("timestamp", workshop, sensor_id, measurement, value) '
                        f"VALUES (%s, %s, %s, %s, %s);",
                        rows,
                    )

                t += POSTGRES_UPDATE_INTERVAL
                time.sleep(POSTGRES_UPDATE_INTERVAL)

        except Exception as exc:
            print(f"[postgres] Error: {exc}. Retrying in {RETRY_INTERVAL}s ...")
            if conn is not None:
                conn.close()
            time.sleep(RETRY_INTERVAL)


# ─── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    workers = [
        threading.Thread(target=modbus_worker,   name="modbus",   daemon=True),
        threading.Thread(target=mqtt_worker,     name="mqtt",     daemon=True),
        threading.Thread(target=influxdb_worker, name="influxdb", daemon=True),
        threading.Thread(target=postgres_worker, name="postgres", daemon=True),
    ]
    for w in workers:
        w.start()
        print(f"[main] Started {w.name} worker.")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("[main] Stopping simulator.")
