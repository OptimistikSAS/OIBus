#!/bin/bash

function is_number() {
  re='^[0-9]+$'
  if ! [[ $1 =~ $re ]]; then
    return 0
  else
    return 1
  fi
}

# Check for admin permissions
read -p 'Administrative permissions are required to proceed. Do you wish to continue? (Y/n) ' admin_run
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

# Setup work directory
read -p "Enter the directory in which you want to install the OIBus binary (default: ./OIBus): " install_dir
install_dir="${install_dir:=./OIBus}"
if [[ ! -d "$install_dir" ]]; then
  mkdir "$install_dir"
  if [ $? -eq -1 ]; then
    printf "ERROR: Could not set OIBus binary directory properly. Terminating installation process."
    exit 1
  fi
fi

# Setup data directory
read -p "Enter the directory in which you want to save all your OIBus related data, caches, and logs (default: ./OIBusData): " my_data_directory
my_data_directory="${my_data_directory:=./OIBusData}"
if [[ ! -d "$my_data_directory" ]]; then
  if ! mkdir "$my_data_directory"; then
    printf "ERROR: Could not create data directory. Terminating installation process."
    rm "$install_dir/oibus"
    exit 1
  fi
fi

# Check if the configuration file must be kept
keep_conf="${keep_conf:=N}"
if [[ -f "$my_data_directory/oibus.json" ]] && [[ -f default-config.json ]]; then
  read -p "An oibus.json file was found. Do you want to use it for this OIBus? (Y/n) " keep_conf
  keep_conf="${keep_conf:=Y}"
  while [[ "$keep_conf" != "Y" && "$keep_conf" != "y" ]] && [[ "$keep_conf" != "N" && "$keep_conf" != "n" ]]; do
    read -p "Invalid input. Please type in Y/y (for yes) or N/n (for no): " keep_conf
  done
  if [[ "$keep_conf" == "N" ]] || [[ "$keep_conf" == "n" ]]; then
    read -p "WARNING: Overwriting the current setup will delete all logins, passwords and data you saved so far. Are you sure you want to proceed? (y/N) " confirm
    confirm="${confirm:=N}"
    while [[ "$confirm" != "Y" && "$confirm" != "y" ]] && [[ "$confirm" != "N" && "$confirm" != "n" ]]; do
      read -p "Invalid input. Please type in Y/y (for yes) or N/n (for no): " confirm
    done
    if [[ "$confirm" == "N" ]] || [[ "$confirm" == "n" ]]; then
      keep_conf="Y"
    fi
  fi
fi
if [[ "$keep_conf" == "N" ]] || [[ "$keep_conf" == "n" ]]; then
  cp default-config.json "$my_data_directory/oibus.json"
fi
rm default-config.json
conf_file=$(readlink -m "$my_data_directory")
conf_file+='/oibus.json'

if [[ "$keep_conf" == "N" ]] || [[ "$keep_conf" == "n" ]]; then
  read -p "Enter a username for your session. It will be used every time you log into OIBus (default: admin): " my_user_name
  my_user_name="${my_user_name:=admin}"
  read -p "Enter a name for your OIBus. It will help to identify your OIBus, and assist in potential troubleshooting (default: OIBus): " my_oibus_name
  my_oibus_name="${my_oibus_name:=OIBus}"
  read -p "Enter the port on which you want OIBus to run (default 2223): " my_port
  my_port="${my_port:=2223}"
  is_number $my_port
  while ! [ $? -eq 1 ]; do
    read -p "ERROR: The operating port MUST be a number. Please enter a new one: " my_port
    is_number "$my_port"
  done
  while [ "$my_port" -lt 0 ] || [ "$my_port" -gt 65535 ]; do
    read -p "ERROR: The specified port must be a number between 0 and 65535. Please enter a valid number: " my_port
  done

  sed -i "s@\"user\": \"admin\"@\"user\": \"$my_user_name\"@" $conf_file
  sed -i "s@\"engineName\": \"OIBus\"@\"engineName\": \"$my_oibus_name\"@" $conf_file
  sed -i "s@\"port\": 2223@\"port\": $my_port@" $conf_file
fi

# Stop OIBus if already installed and running
if [[ -f "/etc/systemd/system/oibus.service" ]]; then
  echo 'Stopping oibus service...'
  sudo systemctl stop oibus
  sudo systemctl disable oibus
  sudo systemctl daemon-reload
  sudo systemctl reset-failed
  echo 'The oibus service has been stopped and disabled!'
fi
if ! mv oibus "$install_dir"; then
  printf "ERROR: Could not move oibus into binary directory. Terminating installation process."
  exit 1
fi

# Installing service file
echo 'Installing oibus service...'
install_path=$(readlink -m "$install_dir")
touch oibus.service
{
  printf "[Unit]\nDescription=OIBus Client\nAfter=network-online.target\n\n"
  printf "[Service]\nWorkingDirectory=%s\nEnvironmentFile=%s/oibus-env\n" "$install_path" "$install_path"
  printf "ExecStart=%s/oibus %s %s\nRestart=on-failure\n\n" "$install_path" '$ARG1' '$ARG2'
  printf "[Install]\nWantedBy=default.target"
} >>oibus.service

if ! sudo mv oibus.service /etc/systemd/system/; then
  printf "ERROR: Could not create OIBus service file. Terminating installation process."
  rm oibus.service
  exit 1
fi

conf_path=$(readlink -m "$conf_file")
touch oibus-env
printf "ARG1=--config\nARG2=%s" "$conf_path" >>oibus-env

if ! sudo mv oibus-env $install_dir; then
  printf "ERROR: Could not create OIBus service file. Terminating installation process."
  rm oibus-env
  exit 1
fi

echo 'Service file successfully created. Enabling oibus service startup on system boot...'
if ! sudo systemctl enable oibus.service; then
  printf "ERROR: Could not enable OIBus service launch on boot. Terminating installation process."
  exit 1
fi

echo 'Starting OIBus service...'
if ! sudo systemctl start oibus.service; then
  printf "ERROR: Could not launch OIBus. Terminating installation process."
  exit 1
fi

# Creating go.sh file
dir=$(readlink -m "$install_dir")
data_directory=$(readlink -m "$my_data_directory")

if ! touch "$dir"/go.sh; then
  echo 'ERROR: Could not create go.sh debug script. Terminating installation process.'
  exit 1
fi
if ! chmod 755 "$dir"/go.sh; then
  echo 'ERROR: Could not set go.sh debug script properly. Terminating installation process.'
  rm "$dir"/go.sh
  exit 1
fi

{
  printf '#!/bin/bash\n\n'
  printf "echo 'Stopping OIBus service...'\n"
  printf 'sudo systemctl stop oibus\n'
  printf "%s/oibus --config '%s/oibus.json'" "$dir" "$data_directory"
} >> "$dir"/go.sh

# Updating uninstall script
if [[ -f './oibus-uninstall.sh' ]]; then
  echo 'Setting oibus-uninstall.sh...'

  service_file="/etc/systemd/system/oibus.service"
  flag_dir=$(readlink -m "$dir")
  flag_data_directory=$(readlink -m "$data_directory")

  sed -i "s@OIBUS_INSTALL_FLAG_DIR@$flag_dir@" ./oibus-uninstall.sh
  sed -i "s@OIBUS_INSTALL_FLAG_DATA_DIR@$flag_data_directory@" ./oibus-uninstall.sh
  sed -i "s@OIBUS_INSTALL_FLAG_SERVICE_FILE@$service_file@" ./oibus-uninstall.sh

  if ! mv ./oibus-uninstall.sh "$install_dir"/oibus-uninstall.sh; then
    echo 'ERROR: Could not set uninstall script properly. Terminating install process.'
    exit 1
  fi
fi

echo 'Installation procedure completed!'
printf "\nUseful commands:\n\tCheck service status:\tsudo systemctl status oibus\n\tCheck service-logs:\tsudo journalctl -u oibus -n 200 -f\n\n"
if [[ "$keep_conf" == "N" ]] || [[ "$keep_conf" == "n" ]]; then
  printf "Access OIBus: %s \n" "http://localhost:$my_port/"
fi

rm ./oibus-setup.sh
