#!/bin/bash

function is_number()
{
    re='^[0-9]+$'
    if ! [[ $1 =~ $re ]] ; then
        return 0
    else
        return 1
    fi
}

function check_admin_rights ()
{
    read -p 'Administrative permissions are required to proceed. Do you wish to continue ? (Y/n) ' admin_run
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

function setup_workdir ()
{
    read -p "Enter the directory in which you want to install OIBus (default: ./OIBus/): " install_dir
    install_dir="${install_dir:=./OIBus/}"
    if [[ ! -d "$install_dir" ]]; then
        mkdir "$install_dir"
        if [ $? -eq -1 ]; then
            printf "ERROR: Could not set install-directory properly. Terminating install-process."
            exit 1
        fi
    fi
    if [[ -f "/etc/systemd/system/oibus.service" ]]; then
        sudo systemctl stop oibus
        sudo systemctl disable oibus
        sudo systemctl daemon-reload
        sudo systemctl reset-failed
    fi
    cp oibus "$install_dir"
    if [[ ! $? -eq 0 ]] ; then
       printf "ERROR: Could not set install-directory properly. Terminating install-process."
       exit 1
    fi
}

function setup_datadir ()
{
    read -p "Enter the directory in which you want to save all your OIBus-related data, caches, and logs (default: ./OIBusData/): " my_datadir
    my_datadir="${my_datadir:=./OIBusData/}"
    if [[ ! -d "$my_datadir" ]]; then
        mkdir "$my_datadir"
        if [ $? -eq -1 ]; then
            printf "ERROR: Could not create data-directory. Terminating install-process."
            rm "$install_dir/oibus"
            exit 1
        fi
    fi
    overwrite_conf="${overwrite_conf:=Y}"
    if [[ -f "$my_datadir/oibus.json" ]]; then
        read -p "A previous oibus.json file was found. Do you want to overwrite it with a new one for your upcoming session? (y/N) " overwrite_conf
        overwrite_conf="${overwrite_conf:=N}"
        while [[ "$overwrite_conf" != "Y" && "$overwrite_conf" != "y" ]] && [[ "$overwrite_conf" != "N" && "$overwrite_conf" != "n" ]]
        do
            read -p "Invalid input. Please type in Y/y (for yes) or N/n (for no): " overwrite_conf
        done
        if [[ "$overwrite_conf" == "Y" ]] || [[ "$overwrite_conf" == "y" ]] ; then
            read -p "WARNING: Overwriting your current oibus.json file will replace your setup with a new one. Are you sure you want to proceed? (Y/n) " overwrite_conf
            overwrite_conf="${overwrite_conf:=Y}"
            while [[ "$overwrite_conf" != "Y" && "$overwrite_conf" != "y" ]] && [[ "$overwrite_conf" != "N" && "$overwrite_conf" != "n" ]]
            do
                read -p "Invalid input. Please type in Y/y (for yes) or N/n (for no): " overwrite_conf
            done
        fi
    fi
    if [[ "$overwrite_conf" == "Y" ]] || [[ "$overwrite_conf" == "y" ]] ; then
        cp default-config.json "$my_datadir/oibus.json"
    fi
}

function setup_config ()
{
    read -p "Enter a username for your session. It will be used every time you log into OIBus (default: admin): " my_user_name
    my_user_name="${my_user_name:=admin}"
    read -p "Enter a name for your OIBus. It will help us identify your OIBus, and assist in potential troubleshooting (default: OIBus): " my_oibus_name
    my_oibus_name="${my_oibus_name:=OIBus}"
    read -p "Enter the port on which you want OIBus to run (default 2223): " my_port
    my_port="${my_port:=2223}"
    is_number $my_port
    while ! [ $? -eq 1 ]
    do
        read -p "ERROR: the operating port MUST be a number. Please enter a new one: " my_port
        is_number $my_port
    done
    while [ $my_port -lt 0 -o $my_port -gt 65535 ]
    do
        read -p "ERROR: the specified port must be a number between 0 and 65535. Please enter a valid number: " my_port
    done
}

function change_config_values ()
{
    conf_file=$(readlink -m "$my_datadir")
    conf_file+='/oibus.json'
    sed -i "s@\"user\": \"admin\"@\"user\": \"$1\"@" $conf_file
    sed -i "s@\"engineName\": \"OIBus\"@\"engineName\": \"$2\"@" $conf_file
    sed -i "s@\"port\": 2223@\"port\": $3@" $conf_file
}

function create_service_file ()
{
    install_path=$(readlink -m "$install_dir")
    touch oibus.service
    printf "[Unit]\nDescription=OIBus Client\nAfter=network-online.target\n\n" >> oibus.service
    printf "[Service]\nWorkingDirectory=%s\nEnvironmentFile=%s/oibus_env\n" "$install_path" "$install_path" >> oibus.service
    printf "ExecStart=%s/oibus %s %s\nRestart=on-failure\n\n" "$install_path" '$ARG1' '$ARG2'>> oibus.service
    printf "[Install]\nWantedBy=default.target" >> oibus.service

    conf_path=$(readlink -m "$conf_file")
    touch oibus_env
    printf "ARG1=--config\nARG2=%s" "$conf_path" >> oibus_env
    sudo mv oibus.service /etc/systemd/system/
    if ! [ $? -eq 0 ] ; then
        printf "ERROR: Could not create OIBus service-file. Terminating install-process."
        rm oibus.service
        exit 1
    fi
    sudo mv oibus_env $install_dir
    if ! [ $? -eq 0 ] ; then
        printf "ERROR: Could not create OIBus service-file. Terminating install-process."
        rm oibus_env
        exit 1
    fi
}

function install_service ()
{
    echo 'OIBus setup completed. Installing oibus service...'
    if [[ -f '/etc/systemd/system/oibus.service' ]]; then
        sudo systemctl stop oibus
    fi
    create_service_file

    echo 'System-files successfully created. Enabling OIBus startup on system boot...'
    sudo systemctl enable oibus.service
    if ! [ $? -eq 0 ] ; then
        printf "ERROR: Could not enable OIBus service launch on boot. Terminating install-process."
        exit 1
    fi

    echo 'Starting OIBus service...'
    sudo systemctl start oibus.service
    if ! [ $? -eq 0 ] ; then
        printf "ERROR: Could not launch OIBus. Terminating install-process."
        exit 1
    fi
}

function generate_go_sh ()
{
    touch go.sh
    if ! [ $? -eq 0 ] ; then
        echo 'ERROR: could not create go.sh debug-script. Terminating install-process.'
        exit 1
    fi
    chmod 755 go.sh
    if ! [ $? -eq 0 ] ; then
        echo 'ERROR: Could not set go.sh debug-script properly. Terminating install-process.'
        rm go.sh
        exit 1
    fi

    dir=$(readlink -m "$install_dir")
    datadir=$(readlink -m "$my_datadir")

    printf '#!/bin/bash\n\n' >> go.sh
    printf "echo 'Stopping OIBus service...'\n" >> go.sh
    printf 'sudo systemctl stop oibus\n' >> go.sh
    printf "%s/oibus --config '%s/oibus.json'" "$dir" "$datadir" >> go.sh
    mv go.sh "$dir"
}

function setup_uninstall ()
{
    if [[ ! -f './defaultOibus_uninstall.sh' ]]; then
        echo 'ERROR : could not find oibus_uninstall.sh for setup. oibus_uninstall.sh should be in the SAME FOLDER as oibus_setup.sh. Terminating install-process'
        exit 1
    fi
    echo 'setting oibus_uninstall.sh...'
    cp ./defaultOibus_uninstall.sh ./oibus_uninstall.sh

    service_file="/etc/systemd/system/oibus.service"
    flag_dir=$(readlink -m "$dir")
    flag_datadir=$(readlink -m "$datadir")

    sed -i "s@\[OIBUS_INSTALL_FLAG\:DIR\]@$flag_dir@" ./oibus_uninstall.sh
    sed -i "s@\[OIBUS_INSTALL_FLAG\:DATADIR\]@$flag_datadir@" ./oibus_uninstall.sh
    sed -i "s@\[OIBUS_INSTALL_FLAG\:SERVICEFILE\]@$service_file@" ./oibus_uninstall.sh

    mv oibus_uninstall.sh "$install_dir"
    if [[ ! $? -eq 0 ]] ; then
        echo 'ERROR: Could not set uninstall-script properly. Terminating install-process.'
        rm oibus_uninstall.sh
        exit 1
    fi
}

check_admin_rights
setup_workdir
setup_datadir
if [[ "$overwrite_conf" == "Y" ]] || [[ "$overwrite_conf" == "y" ]] ; then
    setup_config
    change_config_values $my_user_name $my_oibus_name $my_port
fi
install_service
generate_go_sh
setup_uninstall
echo 'Installation procedure completed !'
printf "\nUseful commands:\n\tCheck service status:\tsudo systemctl status\n\tCheck service-logs:\tsudo journalctl -u oibus -f\n\n"
if [[ "$overwrite_conf" == "Y" ]] || [[ "$overwrite_conf" == "y" ]] ; then
    printf "Access OIBus: %s \n" "http://localhost:$my_port/"
fi
