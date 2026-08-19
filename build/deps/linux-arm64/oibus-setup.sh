#!/bin/bash

while [[ $# -gt 0 ]]; do
  case "$1" in
    -b) install_dir="$2"; shift 2;;
    -c) my_data_directory="$2"; shift 2;;
    -k) keep_conf="$2"; shift 2;;
    -n) engine_name="$2"; shift 2;;
    -u) admin_username="$2"; shift 2;;
    -p) admin_password="$2"; shift 2;;
    -port) oibus_port="$2"; shift 2;;
    *) shift;;
  esac
done

# The instance name (-n) doubles as the systemd unit name and a registry key filename, so
# anything outside this safe set could corrupt those commands or collide with an unrelated
# file. Reject it outright rather than trying to escape it differently for every consumer.
# (Unlike the JSON engineName default below, this is used as a file/unit name, hence the
# lowercase "oibus" default and no spaces allowed.)
service_name="${engine_name:-oibus}"
if [[ ! "$service_name" =~ ^[A-Za-z0-9._-]+$ ]]; then
  printf 'ERROR: Instance name "%s" contains characters that are not allowed.\n' "$service_name"
  printf 'Allowed characters: letters, digits, dots, hyphens and underscores (no spaces).\n'
  exit 1
fi

# -port is embedded as a raw (unquoted) JSON number below, so it must be digits only.
if [[ -n "$oibus_port" ]] && [[ ! "$oibus_port" =~ ^[0-9]+$ ]]; then
  printf 'ERROR: Port "%s" must contain digits only.\n' "$oibus_port"
  exit 1
fi

# The default instance keeps the classic "oibus" unit name (sudo systemctl status oibus,
# etc.) for a clean upgrade story; any other name gets its own oibus-<name>.service unit so
# multiple instances can run side by side.
if [[ "${service_name,,}" == "oibus" ]]; then
  unit_name="oibus"
else
  unit_name="oibus-$service_name"
fi
service_file="/etc/systemd/system/$unit_name.service"

if [[ ! "$install_dir" ]]; then
  # Setup work directory
  read -rp "Enter the directory in which you want to install the OIBus binary (default: ./OIBus): " install_dir
  install_dir="${install_dir:=./OIBus}"
fi
if [[ ! -d "$install_dir" ]]; then
  if ! mkdir "$install_dir"; then
    printf "ERROR: Could not set OIBus binary directory properly. Terminating installation process."
    exit 1
  fi
fi

if [[ ! "$my_data_directory" ]]; then
  # Setup data directory
  read -rp "Enter the directory in which you want to save all your OIBus related data, caches, and logs (default: ./OIBusData): " my_data_directory
  my_data_directory="${my_data_directory:=./OIBusData}"
fi
if [[ ! -d "$my_data_directory" ]]; then
  if ! mkdir "$my_data_directory"; then
    printf "ERROR: Could not create data directory. Terminating installation process."
    exit 1
  fi
fi

install_path=$(readlink -m "$install_dir")
conf_path=$(readlink -m "$my_data_directory")

# Every OIBus instance must have its own binaries folder and its own data folder. Check the
# machine-wide instance registry before touching anything, so two instances can never end
# up sharing either one. Reinstalling/upgrading the SAME instance into its own existing
# folder is fine (an entry matching our own instance name is skipped).
instances_dir="/etc/oibus/instances"
if [[ -d "$instances_dir" ]]; then
  for instance_file in "$instances_dir"/*; do
    [[ -f "$instance_file" ]] || continue
    other_name=$(basename "$instance_file")
    if [[ "${other_name,,}" == "${service_name,,}" ]]; then
      continue
    fi
    mapfile -t other_lines < "$instance_file"
    other_app_dir="${other_lines[0]}"
    other_data_dir="${other_lines[1]}"
    if [[ "$other_app_dir" == "$install_path" ]]; then
      printf 'ERROR: The installation folder "%s" is already used by OIBus instance "%s".\n' "$install_path" "$other_name"
      printf 'Each OIBus instance must have its own installation folder and its own data directory.\n'
      exit 1
    fi
    if [[ "$other_data_dir" == "$conf_path" ]]; then
      printf 'ERROR: The data directory "%s" is already used by OIBus instance "%s".\n' "$conf_path" "$other_name"
      printf 'Each OIBus instance must have its own installation folder and its own data directory.\n'
      exit 1
    fi
  done
fi

# Create env file to store the data directory path, used at OIBus startup
touch "$install_dir/oibus-env"
printf "ARG1=--config\nARG2=%s" "$conf_path" > "$install_dir/oibus-env"

if [[ -f "$my_data_directory/oibus.db" ]]; then
  if [[ ! "$keep_conf" ]]; then
    read -rp "An OIBus configuration was found. Do you want to keep it? (Y/n) " keep_conf
    keep_conf="${keep_conf:=Y}"
    while [[ "$keep_conf" != "Y" && "$keep_conf" != "y" ]] && [[ "$keep_conf" != "N" && "$keep_conf" != "n" ]]; do
      read -rp "Invalid input. Please type in Y/y (for yes) or N/n (for no): " keep_conf
    done
  fi
  if [[ "$keep_conf" == "N" ]] || [[ "$keep_conf" == "n" ]]; then
    read -rp "WARNING: Removing the current configuration will delete all credentials, logs and cache data. Are you sure you want to proceed? (y/N) " confirm
    confirm="${confirm:=N}"
    while [[ "$confirm" != "Y" && "$confirm" != "y" ]] && [[ "$confirm" != "N" && "$confirm" != "n" ]]; do
      read -rp "Invalid input. Please type in Y/y (for yes) or N/n (for no): " confirm
    done
    if [[ "$confirm" == "N" ]] || [[ "$confirm" == "n" ]]; then
      keep_conf="Y"
    fi

    if [[ "$keep_conf" == "N" ]] || [[ "$keep_conf" == "n" ]]; then
    #  Remove configuration, cache, logs and certs. They will be created at first OIBus startup
      rm "$conf_path/oibus.db"
      rm "$conf_path/crypto.db"
      rm -rf "$conf_path/cache"
      rm -rf "$conf_path/logs"
      rm -rf "$conf_path/certs"
      rm -rf "$conf_path/keys"
    fi
  fi
fi

# Escape a string for safe embedding in a JSON value (backslash then double-quote).
json_escape() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  printf '%s' "$s"
}

# If no existing database, write provided initial settings to oibus.init.json.
# Only fields explicitly passed as flags are included; omitted flags are left out
# so OIBus applies its own built-in defaults for those values.
if [[ ! -f "$conf_path/oibus.db" ]]; then
  json_fields="\"engineName\":\"$(json_escape "${engine_name:-OIBus}")\""
  if [[ -n "$admin_username" ]]; then
    json_fields="$json_fields,\"adminUsername\":\"$(json_escape "$admin_username")\""
  fi
  if [[ -n "$admin_password" ]]; then
    json_fields="$json_fields,\"adminPassword\":\"$(json_escape "$admin_password")\""
  fi
  if [[ -n "$oibus_port" ]]; then
    json_fields="$json_fields,\"port\":$oibus_port"
  fi
  printf '{%s}' "$json_fields" > "$conf_path/oibus.init.json"
  chmod 600 "$conf_path/oibus.init.json"
fi

# Stop this SAME instance if it is already installed and running. Each instance has its own
# unit file, so this can never touch a different, still-wanted instance's service.
if [[ -f "$service_file" ]]; then
  echo "Stopping $unit_name service..."
  sudo systemctl stop "$unit_name"
  sudo systemctl disable "$unit_name"
  sudo systemctl daemon-reload
  sudo systemctl reset-failed
  echo "OIBus service ($unit_name) has been stopped and disabled."
fi

# Move binary file into install dir
if ! mv binaries "$install_dir"; then
  printf "ERROR: Could not move OIBus into binary directory. Terminating installation process."
  exit 1
fi
# Move binary file into install dir
if ! mv oibus-launcher "$install_dir"; then
  printf "ERROR: Could not move OIBus launcher into binary directory. Terminating installation process."
  exit 1
fi

# Installing service file
echo "Installing $unit_name service..."
{
  printf "[Unit]\nDescription=OIBus Client\nAfter=network-online.target\n\n"
  printf "[Service]\nWorkingDirectory=%s\nEnvironmentFile=%s/oibus-env\n" "$install_path" "$install_path"
  printf "ExecStart=%s/oibus-launcher %s %s\nRestart=always\nRestartSec=5s\n\n" "$install_path" '$ARG1' '$ARG2'
  printf "[Install]\nWantedBy=default.target"
} > "$service_file"

echo 'Service file successfully created. Enabling OIBus service startup on system boot...'
if ! sudo systemctl enable "$unit_name"; then
  printf "ERROR: Could not enable OIBus service launch on system startup. Terminating installation process."
  exit 1
fi

echo 'Starting OIBus service...'
if ! sudo systemctl start "$unit_name"; then
  printf "ERROR: Could not launch OIBus. Terminating installation process."
  exit 1
fi

# Creating go.sh file
{
  printf '#!/bin/bash\n\n'
  printf "echo 'Stopping %s service... To restart it, enter the following command once this script is over: sudo systemctl start %s'\n" "$unit_name" "$unit_name"
  printf 'sudo systemctl stop %s\n' "$unit_name"
  printf "%s/oibus-launcher --config '%s'" "$install_path" "$conf_path"
} > "$install_path"/go.sh

if ! chmod 755 "$install_path"/go.sh; then
  echo 'ERROR: Could not set go.sh debug script properly. Terminating installation process.'
  rm "$install_path"/go.sh
  exit 1
fi

# Escape a string for safe embedding as a sed replacement with an @ delimiter: backslash,
# then the delimiter itself, then &  (which sed would otherwise expand to "the whole
# match"). Without this, a folder/data path containing @, \ or & could corrupt the sed
# script below - or, via a crafted value ending in the right sequence, make sed execute
# arbitrary shell commands through its "e" flag.
sed_escape() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//@/\\@}"
  s="${s//&/\\&}"
  printf '%s' "$s"
}

# Updating uninstall script
if [[ -f './oibus-uninstall.sh' ]]; then
  echo 'Setting oibus-uninstall.sh...'

  sed -i "s@OIBUS_INSTALL_FLAG_DIR@$(sed_escape "$install_path")@" ./oibus-uninstall.sh
  sed -i "s@OIBUS_INSTALL_FLAG_DATA_DIR@$(sed_escape "$conf_path")@" ./oibus-uninstall.sh
  sed -i "s@OIBUS_INSTALL_FLAG_SERVICE_FILE@$(sed_escape "$service_file")@" ./oibus-uninstall.sh
  sed -i "s@OIBUS_INSTALL_FLAG_UNIT_NAME@$(sed_escape "$unit_name")@" ./oibus-uninstall.sh
  sed -i "s@OIBUS_INSTALL_FLAG_INSTANCE_NAME@$(sed_escape "$service_name")@" ./oibus-uninstall.sh

  if ! mv ./oibus-uninstall.sh "$install_dir"/oibus-uninstall.sh; then
    echo 'ERROR: Could not set uninstall script properly. Terminating install process.'
    exit 1
  fi
fi

# Record this instance (name -> binaries/data folder) so future installs (this script or a
# rerun of it) can detect folder/data clashes against it, and so the uninstaller knows what
# to remove.
mkdir -p "$instances_dir"
printf '%s\n%s\n' "$install_path" "$conf_path" > "$instances_dir/$service_name"

echo 'Installation procedure completed!'
printf "\nUseful commands:\n\tCheck service status:\tsudo systemctl status %s\n\tCheck service-logs:\tsudo journalctl -u %s -n 200 -f\n\n" "$unit_name" "$unit_name"

rm ./oibus-setup.sh
