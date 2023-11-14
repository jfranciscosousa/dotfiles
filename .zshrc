source "${HOME}/.zgen/zgen.zsh"

zmodload zsh/zprof

if ! zgen saved; then
  zgen prezto
  zgen load geometry-zsh/geometry

  zgen save
fi

# Direnv
eval "$(direnv hook zsh)"
# ASDF
source $HOME/.asdf/asdf.sh
# Yarn global packages
export PATH="$HOME/.yarn/bin:$PATH"
# Golang
export GOPATH="$HOME/.go"
export PATH="$PATH:$GOROOT/bin:$GOPATH/bin"
# Local python
export PATH=~/.local/bin:$PATH
# Geometry stuff
GEOMETRY_PROMPT_PREFIX="%F{$GEOMETRY_COLOR_DIR}$USER"
# Custom aliases
source "$HOME/.zsh/aliases.sh"
# Add my custom scripts to path
export PATH="$PATH:$HOME/.scripts/git"
export PATH="$PATH:$HOME/.scripts/bin"

# Linux exclusive
if [[ "$OSTYPE" == "linux-gnu" ]]; then
  "$HOME/.scripts/startup/linux.sh"
fi

# WSL exclusive
if grep -q WSL /proc/version; then
  "$HOME/.scripts/startup/wsl.sh"
fi
