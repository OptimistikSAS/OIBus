#!/bin/bash

# Check for admin permissions
read -p 'Administrative permissions are required to proceed with uninstall. Do you wish to continue ? (Y/n) ' admin_run
admin_run="${admin_run:=Y}"
while [[ "$admin_run" != "Y" && "$admin_run" != "y" ]] && [[ "$admin_run" != "N" && "$admin_run" != "n" ]]; do
  read -p "Invalid input. Please type in Y/y (for yes) or N/n (for no): " admin_run
done
if [[ "$admin_run" == "N" ]] || [[ "$admin_run" == "n" ]]; then
  echo 'Permissions not granted. Exiting installation process.'
  exit 0
else
  sudo echo 'Administrative permissions granted.'
fi

dir=OIBUS_INSTALL_FLAG_DIR
# Check if dir default value (OIBUS_INSTALL_FLAG_DIR) has been replaced during the OIBus installation step
check='OIBUS_INSTALL'
check+='_FLAG_DIR'
if [[ "$dir" == "$check" ]]; then
  echo 'ERROR: uninstall script not initialized. Please remove OIBus related files manually, or run oibus_setup.sh first. Exiting uninstall process.'
  exit 1
fi
if [[ -f "$dir/oibus" ]]; then
  rm -f "$dir/oibus"
fi
if [[ -f "$dir/oibus-env" ]]; then
  rm -f "$dir/oibus-env"
fi
if [[ -f "$dir/go.sh" ]]; then
  rm -f "$dir/go.sh"
fi

# Remove OIBus Data
read -p "Do you wish to remove all OIBus data (cache, logs...)? All data, credentials and logs about your current OIBus will be permanently erased. (y/N) " delete_data
delete_data="${delete_data:=N}"
while [[ "$delete_data" != "Y" && "$delete_data" != "y" ]] && [[ "$delete_data" != "N" && "$delete_data" != "n" ]]; do
  read -p "Invalid input. Please type in Y/y (for yes) or N/n (for no): " delete_data
done

if [[ "$delete_data" == "Y" || "$delete_data" == "y" ]]; then
  data_directory=OIBUS_INSTALL_FLAG_DATA_DIR
  if [[ -f "$data_directory/oibus.json" ]]; then
    sudo rm -f "$data_directory/oibus.json"
  fi
  if [[ -d "$data_directory/cache/" ]]; then
    sudo rm -rf "$data_directory/cache/"
  fi
  if [[ -d "$data_directory/logs/" ]]; then
    sudo rm -rf "$data_directory/logs/"
  fi
fi

# Removing oibus service
service_file=OIBUS_INSTALL_FLAG_SERVICE_FILE
if [[ -f "$service_file" ]]; then
  if ! sudo systemctl stop oibus; then
    printf "ERROR: Could not stop OIBus service. Exiting uninstall process."
    exit 1
  fi
  if ! sudo systemctl disable oibus; then
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
  echo 'OIBus service does not exist. Exiting uninstall process'
  exit 1
fi
