#!/bin/bash

# Check if domain and email arguments are provided
if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <domain> <email>"
    exit 1
fi

DOMAIN=$1
EMAIL=$2

# Install Certbot if not already installed
if ! command -v certbot &> /dev/null; then
    echo "Installing Certbot..."
    sudo yum install -y certbot
fi

# Obtain SSL certificates
echo "Obtaining SSL certificates for $DOMAIN..."
sudo certbot certonly --standalone -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL"

# Create the directory for Nginx certs
mkdir -p ./docker/nginx/certs

# Copy the SSL certificates to the Nginx certs directory
sudo cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ./docker/nginx/certs/
sudo cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" ./docker/nginx/certs/
sudo chmod -R 644 ./docker/nginx/certs/

# Add the cron job for automatic renewal
echo "Setting up Certbot renewal cron job for $DOMAIN..."
(crontab -l 2>/dev/null; echo "0 0 * * * certbot renew --quiet --post-hook \"docker exec oibus_nginx nginx -s reload\"") | crontab -

# Print confirmation
echo "Certbot setup and cron job creation for $DOMAIN completed."
