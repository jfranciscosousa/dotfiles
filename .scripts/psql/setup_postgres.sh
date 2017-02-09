#!/bin/bash

DIR="$(dirname "$(readlink -f "$0")")"

sudo apt-get install -y postgresql
sudo cp $DIR/pg_hba.conf /etc/postgresql/9.5/main/pg_hba.conf 
sudo service postgresql restart

