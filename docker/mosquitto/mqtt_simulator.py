import os
import paho.mqtt.client as mqtt
import time
import random
import threading

# MQTT Broker settings (from environment variables)
MQTT_BROKER = os.getenv("MQTT_BROKER", "mqtt-broker")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
MQTT_USER = os.getenv("MQTT_USER", "your_mqtt_user")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "your_password")

# Simulated data ranges
SENSOR_RANGES = {
    "temperature": (20.0, 40.0),
    "humidity": (30.0, 80.0),
    "pressure": (950.0, 1050.0),
    "vibration": (0.0, 10.0)
}

# Workshop and sensor configurations
WORKSHOPS = {
    "workshop1": {
        "sensor1": {"type": "temperature", "interval": 2},
        "sensor2": {"type": "humidity", "interval": 3},
        "sensor3": {"type": "pressure", "interval": 5},
        "sensor4": {"type": "vibration", "interval": 7}
    },
    "workshop2": {
        "sensor1": {"type": "temperature", "interval": 4},
        "sensor2": {"type": "humidity", "interval": 6},
        "sensor3": {"type": "pressure", "interval": 8},
        "sensor4": {"type": "vibration", "interval": 10}
    }
}

def publish_sensor_data(client, workshop, sensor, sensor_type, interval):
    """Publish simulated data for a sensor at fixed intervals."""
    while True:
        value = random.uniform(*SENSOR_RANGES[sensor_type])
        topic = f"{workshop}/{sensor}/{sensor_type}"
        client.publish(topic, round(value, 2))
        print(f"Published: {topic} = {value}")
        time.sleep(interval)

def on_connect(client, userdata, flags, rc):
    print(f"Connected to MQTT broker with result code {rc}")

# Create MQTT client
client = mqtt.Client(client_id="mqtt_simulator", callback_api_version=mqtt.CallbackAPIVersion.VERSION2)
client.username_pw_set(MQTT_USER, MQTT_PASSWORD)
client.on_connect = on_connect
client.connect(MQTT_BROKER, MQTT_PORT, 60)

# Start a thread for each sensor
for workshop, sensors in WORKSHOPS.items():
    for sensor, config in sensors.items():
        sensor_type = config["type"]
        interval = config["interval"]
        threading.Thread(
            target=publish_sensor_data,
            args=(client, workshop, sensor, sensor_type, interval),
            daemon=True
        ).start()

# Keep the script running
try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print("Stopping simulator...")
    client.disconnect()
