export ZSH=/home/jose/.oh-my-zsh

ZSH_THEME="pygmalion"

plugins=(git rbenv bundler docker)

source $ZSH/oh-my-zsh.sh

#fix stupid npm shit
NPM_PACKAGES="${HOME}/.npm-packages"

PATH="$NPM_PACKAGES/bin:$PATH"

unset MANPATH
export MANPATH="$NPM_PACKAGES/share/man:$(manpath)"
export GOPATH="$HOME/.go"

alias update_system="sudo apt-get update && sudo apt-get upgrade"
alias py_activate="source env/bin/activate"
 
