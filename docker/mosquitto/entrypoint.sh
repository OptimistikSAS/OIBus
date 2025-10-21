#!/bin/sh

# Create password file if it doesn't exist
if [ ! -f /mosquitto/config/password.txt ]; then
    echo "Creating password file..."
    touch /mosquitto/config/password.txt
    chmod 700 /mosquitto/config/password.txt
    mosquitto_passwd -b /mosquitto/config/password.txt "$MQTT_USER" "$MQTT_PASSWORD"
    echo "Password file created!"
fi

# Start Mosquitto
exec "$@"
