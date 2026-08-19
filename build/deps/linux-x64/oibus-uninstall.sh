#!/bin/bash

dir=OIBUS_INSTALL_FLAG_DIR
# Check if dir default value (OIBUS_INSTALL_FLAG_DIR) has been replaced during the OIBus installation step
check='OIBUS_INSTALL'
check+='_FLAG_DIR'
if [[ "$dir" == "$check" ]]; then
  echo 'ERROR: Uninstall script not initialized. Please remove OIBus related files manually. Exiting uninstall process.'
  exit 1
fi

unit_name=OIBUS_INSTALL_FLAG_UNIT_NAME
instance_name=OIBUS_INSTALL_FLAG_INSTANCE_NAME

# Removing OIBus service
service_file=OIBUS_INSTALL_FLAG_SERVICE_FILE
if [[ -f "$service_file" ]]; then
  if ! sudo systemctl stop "$unit_name"; then
    printf "ERROR: Could not stop OIBus service. Exiting uninstall process."
    exit 1
  fi
  if ! sudo systemctl disable "$unit_name"; then
    printf "ERROR: Could not disable OIBus service. Exiting uninstall process."
    exit 1
  fi
  sudo rm "$service_file"
  if ! sudo systemctl daemon-reload; then
    printf "ERROR: Could not reload daemon. Exiting uninstall process."
    exit 1
  fi
  if ! sudo systemctl reset-failed; then
    printf "ERROR: Exiting uninstall process."
    exit 1
  fi
  echo 'OIBus service was successfully removed.'
else
  echo 'OIBus service does not exist. Exiting uninstall process.'
  exit 1
fi

# Remove this instance from the machine-wide instance registry, so its folder/data
# directory becomes available for reuse (this does not touch actual data - only the
# conflict-tracking registration written by oibus-setup.sh).
rm -f "/etc/oibus/instances/$instance_name"

# Removing OIBus binary and script
if [[ -f "$dir/oibus-launcher" ]]; then
  rm -f "$dir/oibus-launcher"
fi
if [[ -d "$dir/binaries" ]]; then
  rm -rf "$dir/binaries"
fi
if [[ -d "$dir/update" ]]; then
  rm -rf "$dir/update"
fi
if [[ -d "$dir/backup" ]]; then
  rm -rf "$dir/backup"
fi
if [[ -f "$dir/oibus-env" ]]; then
  rm -f "$dir/oibus-env"
fi
if [[ -f "$dir/go.sh" ]]; then
  rm -f "$dir/go.sh"
fi

# Remove OIBus Data
read -rp "Do you wish to remove all OIBus data (cache, logs...)? All data, credentials and logs about your current OIBus will be permanently erased. (y/N) " delete_data
delete_data="${delete_data:=N}"
while [[ "$delete_data" != "Y" && "$delete_data" != "y" ]] && [[ "$delete_data" != "N" && "$delete_data" != "n" ]]; do
  read -rp "Invalid input. Please type in Y/y (for yes) or N/n (for no): " delete_data
done

if [[ "$delete_data" == "Y" || "$delete_data" == "y" ]]; then
  data_directory=OIBUS_INSTALL_FLAG_DATA_DIR
  if [[ -f "$data_directory/oibus.db" ]]; then
    sudo rm -f "$data_directory/oibus.db"
  fi
  if [[ -f "$data_directory/crypto.db" ]]; then
    sudo rm -f "$data_directory/crypto.db"
  fi
  # cache/error/archive are independent top-level folders (not nested under each other),
  # and logs/ bundles both logs.db and metrics.db.
  if [[ -d "$data_directory/cache/" ]]; then
    sudo rm -rf "$data_directory/cache/"
  fi
  if [[ -d "$data_directory/error/" ]]; then
    sudo rm -rf "$data_directory/error/"
  fi
  if [[ -d "$data_directory/archive/" ]]; then
    sudo rm -rf "$data_directory/archive/"
  fi
  if [[ -d "$data_directory/logs/" ]]; then
    sudo rm -rf "$data_directory/logs/"
  fi
  if [[ -d "$data_directory/certs/" ]]; then
    sudo rm -rf "$data_directory/certs/"
  fi
fi
