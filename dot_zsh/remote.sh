export AWS_PROFILE=sts

# Remote work machines intentionally use Pi with GPT/OpenAI, not OpenCode Go.
export DOTFILES_PROVIDER=pi
export DOTFILES_MODEL=openai/gpt-5.5
export DOTFILES_FAST_PROVIDER=pi
export DOTFILES_FAST_MODEL=openai/gpt-5.4-mini

alias prod="remotectl k8s shell tiger-api -lc -e production -r production-basic -m 4Gi -- tiger/bin/tiger start_iex"
alias staging="remotectl k8s shell tiger-api -lc -e staging -r engineer -m 4Gi -- tiger/bin/tiger start_iex"

alias tiger-up="git pull && git prune && git gc; mix deps.get --force && mix ecto.migrate"
alias dragon-up="git pull && git prune && git gc; yarn --frozen-lockfile; yarn workspace @remote-com/employ env:local"

alias remotectl-update="mise use -g remotectl@latest"

# Dragon aliases
# dragon-dev: tmux session manager -> ~/.scripts/bin/dragon-dev
function dragon-test() {
  yarn workspace @remote-com/employ jest --maxWorkers=4 "$@" --selectProjects test
}

# Tiger aliases
alias tiger-console="iex -S mix"
# tiger-dev: tmux session manager -> ~/.scripts/bin/tiger-dev
alias tiger-test-server="MIX_ENV=test iex --sname test_server -S mix"
function tiger-test() {
  mix test "$@"
}
