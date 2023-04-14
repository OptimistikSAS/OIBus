#!/bin/bash

# Setup work directory
read -rp "Enter the directory in which you want to install the OIBus binary (default: ./OIBus): " install_dir
install_dir="${install_dir:=./OIBus}"
if [[ ! -d "$install_dir" ]]; then
  if ! mkdir "$install_dir"; then
    printf "ERROR: Could not set OIBus binary directory properly. Terminating installation process."
    exit 1
  fi
fi

# Setup data directory
read -rp "Enter the directory in which you want to save all your OIBus related data, caches, and logs (default: ./OIBusData): " my_data_directory
my_data_directory="${my_data_directory:=./OIBusData}"
if [[ ! -d "$my_data_directory" ]]; then
  if ! mkdir "$my_data_directory"; then
    printf "ERROR: Could not create data directory. Terminating installation process."
    exit 1
  fi
fi

# Check if the configuration file must be kept
keep_conf="${keep_conf:=N}"
if [[ -f "$my_data_directory/oibus.db" ]]; then
  read -rp "An OIBus configuration was found. Do you want to keep it? (Y/n) " keep_conf
  keep_conf="${keep_conf:=Y}"
  while [[ "$keep_conf" != "Y" && "$keep_conf" != "y" ]] && [[ "$keep_conf" != "N" && "$keep_conf" != "n" ]]; do
    read -rp "Invalid input. Please type in Y/y (for yes) or N/n (for no): " keep_conf
  done
  if [[ "$keep_conf" == "N" ]] || [[ "$keep_conf" == "n" ]]; then
    read -rp "WARNING: Removing the current configuration will delete all credentials, logs and cache data. Are you sure you want to proceed? (y/N) " confirm
    confirm="${confirm:=N}"
    while [[ "$confirm" != "Y" && "$confirm" != "y" ]] && [[ "$confirm" != "N" && "$confirm" != "n" ]]; do
      read -rp "Invalid input. Please type in Y/y (for yes) or N/n (for no): " confirm
    done
    if [[ "$confirm" == "N" ]] || [[ "$confirm" == "n" ]]; then
      keep_conf="Y"
    fi
  fi
fi

# Stop OIBus if already installed and running
if [[ -f "/etc/systemd/system/oibus.service" ]]; then
  echo 'Stopping OIBus service...'
  sudo systemctl stop oibus
  sudo systemctl disable oibus
  sudo systemctl daemon-reload
  sudo systemctl reset-failed
  echo 'OIBus service has been stopped and disabled.'
fi

# Move binary file into install dir
if ! mv oibus "$install_dir"; then
  printf "ERROR: Could not move OIBus into binary directory. Terminating installation process."
  exit 1
fi

# Create env file to store the data directory path, used at OIBus startup
conf_path=$(readlink -m "$my_data_directory")
touch "$install_dir/oibus-env"
printf "ARG1=--config\nARG2=%s" "$conf_path" > "$install_dir/oibus-env"

if [[ "$keep_conf" == "N" ]] || [[ "$keep_conf" == "n" ]]; then
#  Remove configuration, cache, logs and certs. They will be created at first OIBus startup
  rm "$conf_path/oibus.db"
  rm -rf "$conf_path/cache"
  rm -rf "$conf_path/logs"
  rm -rf "$conf_path/certs"
fi

# Installing service file
echo 'Installing OIBus service...'
install_path=$(readlink -m "$install_dir")
{
  printf "[Unit]\nDescription=OIBus Client\nAfter=network-online.target\n\n"
  printf "[Service]\nWorkingDirectory=%s\nEnvironmentFile=%s/oibus-env\n" "$install_path" "$install_path"
  printf "ExecStart=%s/oibus %s %s\nRestart=on-failure\n\n" "$install_path" '$ARG1' '$ARG2'
  printf "[Install]\nWantedBy=default.target"
} > /etc/systemd/system/oibus.service

echo 'Service file successfully created. Enabling OIBus service startup on system boot...'
if ! sudo systemctl enable oibus.service; then
  printf "ERROR: Could not enable OIBus service launch on system startup. Terminating installation process."
  exit 1
fi

echo 'Starting OIBus service...'
if ! sudo systemctl start oibus.service; then
  printf "ERROR: Could not launch OIBus. Terminating installation process."
  exit 1
fi

# Creating go.sh file
{
  printf '#!/bin/bash\n\n'
  printf "echo 'Stopping OIBus service... To restart it, enter the following command once this script is over: sudo systemctl start oibus'\n"
  printf 'sudo systemctl stop oibus\n'
  printf "%s/oibus --config '%s'" "$install_path" "$conf_path"
} > "$install_path"/go.sh

if ! chmod 755 "$install_path"/go.sh; then
  echo 'ERROR: Could not set go.sh debug script properly. Terminating installation process.'
  rm "$install_path"/go.sh
  exit 1
fi

# Updating uninstall script
if [[ -f './oibus-uninstall.sh' ]]; then
  echo 'Setting oibus-uninstall.sh...'

  service_file="/etc/systemd/system/oibus.service"

  sed -i "s@OIBUS_INSTALL_FLAG_DIR@$install_path@" ./oibus-uninstall.sh
  sed -i "s@OIBUS_INSTALL_FLAG_DATA_DIR@$conf_path@" ./oibus-uninstall.sh
  sed -i "s@OIBUS_INSTALL_FLAG_SERVICE_FILE@$service_file@" ./oibus-uninstall.sh

  if ! mv ./oibus-uninstall.sh "$install_dir"/oibus-uninstall.sh; then
    echo 'ERROR: Could not set uninstall script properly. Terminating install process.'
    exit 1
  fi
fi

echo 'Installation procedure completed!'
printf "\nUseful commands:\n\tCheck service status:\tsudo systemctl status oibus\n\tCheck service-logs:\tsudo journalctl -u oibus -n 200 -f\n\n"

rm ./oibus-setup.sh
