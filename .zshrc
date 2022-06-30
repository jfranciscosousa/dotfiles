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

# Linux stuff
if [[ "$OSTYPE" == "linux-gnu" ]]; then
  export PATH="/home/linuxbrew/.linuxbrew/bin:$PATH"
  export MANPATH="/home/linuxbrew/.linuxbrew/share/man:$MANPATH"
  export INFOPATH="/home/linuxbrew/.linuxbrew/share/info:$INFOPATH"
  test -d "/etc/profile.d/vte.sh" && . /etc/profile.d/vte.sh
fi

if grep -q WSL /proc/version; then
    keychain $HOME/.ssh/github_rsa
    source $HOME/.keychain/$HOST-sh
fi
