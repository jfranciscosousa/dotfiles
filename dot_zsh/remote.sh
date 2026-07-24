# Remote work machines intentionally use Pi with GPT/OpenAI, not OpenCode Go.
export DOTFILES_PROVIDER=pi
export DOTFILES_MODEL=openai/gpt-5.6-terra
export DOTFILES_FAST_PROVIDER=pi
export DOTFILES_FAST_MODEL=openai/gpt-5.6-luna

alias prod="remotectl k8s shell tiger-api -lc -e production -r production-basic -m 4Gi -- tiger/bin/tiger start_iex"
alias staging="remotectl k8s shell tiger-api -lc -e staging -r engineer -m 4Gi -- tiger/bin/tiger start_iex"

alias tiger-up="git pull && git prune && git gc; mix deps.get --force && mix ecto.migrate"
alias dragon-up="git pull && git prune && git gc; pnpm install --frozen-lockfile; pnpm --filter @remote-com/employ run env:local"

alias remotectl-update="mise use -g remotectl@latest"

# Dragon aliases
# dragon-dev: tmux session manager -> ~/.scripts/bin/dragon-dev
function dragon-test() {
  pnpm --filter @remote-com/employ exec jest --maxWorkers=4 "$@" --selectProjects test
}

# Tiger aliases
alias tiger-console="iex -S mix"
# tiger-dev: tmux session manager -> ~/.scripts/bin/tiger-dev
alias tiger-test-server="MIX_ENV=test iex --sname test_server -S mix"
function tiger-test() {
  mix test "$@"
}
