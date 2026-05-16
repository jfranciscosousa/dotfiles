export AWS_PROFILE=sts

export DOTFILES_PROVIDER=claude
export DOTFILES_MODEL=opus

alias prod="remotectl k8s shell tiger-api -lc -e production -r production-basic -m 4Gi -- tiger/bin/tiger start_iex"
alias staging="remotectl k8s shell tiger-api -lc -e staging -r engineer -m 4Gi -- tiger/bin/tiger start_iex"

alias tiger-up="git pull && git prune && git gc; mix deps.get --force && mix ecto.migrate"
alias dragon-up="git pull && git prune && git gc; yarn --frozen-lockfile; yarn workspace @remote-com/employ env:local"

alias remotectl-update="asdf install remotectl latest && asdf set -u remotectl latest"
alias dexter-update="asdf install dexter latest && asdf set -u dexter latest"

# Dragon aliases
alias dragon-dev="yarn workspace @remote-com/employ dev"
function dragon-test() {
  yarn workspace @remote-com/employ jest --maxWorkers=4 "$@" --selectProjects test
}

# Tiger aliases
alias tiger-console="iex -S mix"
alias tiger-dev="iex -S mix phx.server"
alias tiger-test-server="MIX_ENV=test iex --sname test_server -S mix"
function tiger-test() {
  mix test "$@"
}
