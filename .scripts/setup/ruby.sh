#!/bin/bash

cd
command curl -sSL https://rvm.io/mpapis.asc | gpg2 --import -
gpg --keyserver hkp://keys.gnupg.net --recv-keys 409B6B1796C275462A1703113804BB82D39DC0E3
curl -sSL https://get.rvm.io | bash -s stable
source ~/.rvm/scripts/rvm
rvm install 2.4.0
rvm use 2.4.0 --default
ruby -v

gem install bundler
gem install rails
gem install github