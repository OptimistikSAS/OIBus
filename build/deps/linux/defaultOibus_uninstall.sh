#!/bin/bash

function admin_rights ()
{
	read -p 'Administrative permissions are required to proceed with uninstall. Do you wish to continue ? (Y/n) ' admin_run
    admin_run="${admin_run:=Y}"
	while [[ "$admin_run" != "Y" && "$admin_run" != "y" ]] && [[ "$admin_run" != "N" && "$admin_run" != "n" ]]
	do
		read -p "Invalid input. Please type in Y/y (for yes) or N/n (for no): " admin_run
	done
	if [[ "$admin_run" == "N" ]] || [[ "$admin_run" == "n" ]] ; then
		echo 'Permissions not granted. Exiting installation process.'
		exit 0
	else
		sudo echo 'Administrative permissions granted.'
	fi
}

function check_init ()
{
	check='[OIBUS_INSTALL_FLAG:DIR'
	check+=']'
	if [[ "$dir" == "$check" ]]; then
		echo 'ERROR : uninstall-script not initialized. Please remove OIBus-related files manually, or run oibus_setup.sh first. Exiting uninstall-process.'
		exit 1
	fi
}

function delete_data ()
{
	read -p "Do you want to erase all your OIBus-related Data? NOT doing so will allow you to keep your data, logs and credentials for an eventual future OIBus session (y/N) " delete_data
	delete_data="${delete_data:=N}"
	while [[ "$delete_data" != "Y" && "$delete_data" != "y" ]] && [[ "$delete_data" != "N" && "$delete_data" != "n" ]]
	do
		read -p "Invalid input. Please type in Y/y (for yes) or N/n (for no): " delete_data
	done

	if [[ "$delete_data" == "Y" || "$delete_data" == "y" ]]; then
		datadir=[OIBUS_INSTALL_FLAG:DATADIR]
		if [[ -f "$datadir/oibus.json" ]]; then
			sudo rm -f "$datadir/oibus.json"
		fi
		if [[ -d "$datadir/cache/" ]]; then
			sudo rm -rf "$datadir/cache/"
		fi
		if [[ -d "$datadir/logs/" ]]; then
			sudo rm -rf "$datadir/logs/"
		fi
	fi
}

function delete_service ()
{
	service_file=[OIBUS_INSTALL_FLAG:SERVICEFILE]
	if [[ -f "$service_file" ]]; then
		sudo systemctl stop oibus
		if ! [ $? -eq 0 ] ; then
			printf "ERROR: Could not stop OIBus service. Exiting uninstall-process."
			exit 1
		fi
		sudo systemctl disable oibus
		if ! [ $? -eq 0 ] ; then
			printf "ERROR: Could not disable OIBus service. Exiting uninstall-process."
			exit 1
		fi
		sudo rm "$service_file"
		sudo systemctl daemon-reload
		if ! [ $? -eq 0 ] ; then
			printf "ERROR: Could not reload daemon. Exiting uninstall-process."
			exit 1
		fi
		sudo systemctl reset-failed
		if ! [ $? -eq 0 ] ; then
			printf "ERROR: Exiting uninstall-process."
			exit 1
		fi
		echo 'OIBus service was successfully removed.'
	else
		echo 'OIBus service does not exist. Exiting uninstall-process'
	fi
}

admin_rights
dir=[OIBUS_INSTALL_FLAG:DIR]
check_init
if [[ -f "$dir/oibus" ]]; then
	rm -f "$dir/oibus"
fi
if [[ -f "$dir/oibus_env" ]]; then
	rm -f "$dir/oibus_env"
fi
if [[ -f "$dir/go.sh" ]]; then
	rm -f "$dir/go.sh"
fi
delete_data
delete_service
if [[ -f "$dir/oibus_uninstall.sh" ]]; then
	rm -f "$dir/oibus_uninstall.sh"
fi
