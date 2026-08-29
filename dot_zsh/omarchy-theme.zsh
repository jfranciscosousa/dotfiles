#!/usr/bin/env zsh

_omarchy_zsh_theme_read() {
  emulate -L zsh
  setopt extended_glob

  local colors_file="$HOME/.local/state/omarchy/current/theme/colors.toml"
  [[ -r "$colors_file" ]] || colors_file="$HOME/.config/omarchy/current/theme/colors.toml"
  [[ -r "$colors_file" ]] || return 1

  zmodload zsh/stat || return 1
  local -A file_stat
  zstat -H file_stat -- "$colors_file" || return 1

  local signature="${file_stat[device]}:${file_stat[inode]}:${file_stat[mtime]}:${file_stat[size]}"
  if [[ ${1:-} != force && $signature == ${_OMARCHY_ZSH_THEME_SIGNATURE:-} ]]; then
    return 1
  fi

  local key value
  local -A colors
  while IFS='=' read -r key value; do
    key=${${key##[[:space:]]#}%%[[:space:]]#}
    value=${value##[[:space:]]#}
    value=${value#\"}
    value=${value%%\"*}

    if [[ ${#value} -eq 7 && $value == \#[[:xdigit:]][[:xdigit:]][[:xdigit:]][[:xdigit:]][[:xdigit:]][[:xdigit:]] ]]; then
      colors[$key]=${value:l}
    fi
  done < "$colors_file"

  colors[background]="${colors[background]:-${colors[color0]:-#1a1b26}}"
  colors[dark_background]="${colors[dark_background]:-${colors[background]}}"
  colors[darker_background]="${colors[darker_background]:-${colors[dark_background]}}"
  colors[lighter_background]="${colors[lighter_background]:-${colors[color8]:-#292e42}}"
  colors[foreground]="${colors[foreground]:-${colors[color7]:-#a9b1d6}}"
  colors[dark_foreground]="${colors[dark_foreground]:-${colors[color8]:-#565f89}}"
  colors[muted]="${colors[muted]:-${colors[dark_foreground]}}"
  colors[light_foreground]="${colors[light_foreground]:-${colors[foreground]}}"
  colors[bright_foreground]="${colors[bright_foreground]:-${colors[color15]:-#c0caf5}}"
  colors[red]="${colors[red]:-${colors[color1]:-#f7768e}}"
  colors[yellow]="${colors[yellow]:-${colors[color3]:-#e0af68}}"
  colors[orange]="${colors[orange]:-${colors[yellow]}}"
  colors[green]="${colors[green]:-${colors[color2]:-#9ece6a}}"
  colors[cyan]="${colors[cyan]:-${colors[color6]:-#7dcfff}}"
  colors[blue]="${colors[blue]:-${colors[color4]:-#7aa2f7}}"
  colors[magenta]="${colors[magenta]:-${colors[color5]:-#bb9af7}}"
  colors[brown]="${colors[brown]:-${colors[orange]}}"
  colors[bright_red]="${colors[bright_red]:-${colors[color9]:-${colors[red]}}}"
  colors[bright_yellow]="${colors[bright_yellow]:-${colors[color11]:-${colors[yellow]}}}"
  colors[bright_green]="${colors[bright_green]:-${colors[color10]:-${colors[green]}}}"
  colors[bright_cyan]="${colors[bright_cyan]:-${colors[color14]:-${colors[cyan]}}}"
  colors[bright_blue]="${colors[bright_blue]:-${colors[color12]:-${colors[blue]}}}"
  colors[bright_magenta]="${colors[bright_magenta]:-${colors[color13]:-${colors[magenta]}}}"
  colors[accent]="${colors[accent]:-${colors[blue]}}"
  colors[selection]="${colors[selection]:-${colors[lighter_background]}}"

  typeset -gA _OMARCHY_ZSH_THEME_COLORS
  _OMARCHY_ZSH_THEME_COLORS=("${(@kv)colors}")
  typeset -g _OMARCHY_ZSH_THEME_SIGNATURE="$signature"
}

_omarchy_zsh_theme_sgr() {
  emulate -L zsh

  local hex=${1#\#}
  local channel=${2:-38}
  if [[ ${#hex} -ne 6 || $hex != [[:xdigit:]][[:xdigit:]][[:xdigit:]][[:xdigit:]][[:xdigit:]][[:xdigit:]] ]]; then
    REPLY=$channel
    return
  fi

  REPLY="$channel;2;$(( 16#${hex[1,2]} ));$(( 16#${hex[3,4]} ));$(( 16#${hex[5,6]} ))"
}

_omarchy_zsh_theme_apply_completion() {
  emulate -L zsh
  (( ${#_OMARCHY_ZSH_THEME_COLORS} )) || return 1

  local accent=${_OMARCHY_ZSH_THEME_COLORS[accent]}
  local foreground=${_OMARCHY_ZSH_THEME_COLORS[foreground]}
  local muted=${_OMARCHY_ZSH_THEME_COLORS[muted]}
  local selection=${_OMARCHY_ZSH_THEME_COLORS[selection]}
  local red=${_OMARCHY_ZSH_THEME_COLORS[red]}
  local yellow=${_OMARCHY_ZSH_THEME_COLORS[yellow]}
  local magenta=${_OMARCHY_ZSH_THEME_COLORS[magenta]}
  local accent_sgr foreground_sgr muted_sgr selection_bg_sgr
  _omarchy_zsh_theme_sgr "$accent"; accent_sgr=$REPLY
  _omarchy_zsh_theme_sgr "$foreground"; foreground_sgr=$REPLY
  _omarchy_zsh_theme_sgr "$muted"; muted_sgr=$REPLY
  _omarchy_zsh_theme_sgr "$selection" 48; selection_bg_sgr=$REPLY

  local -a completion_colors
  completion_colors=("${(@s.:.)LS_COLORS}" "ma=${foreground_sgr};${selection_bg_sgr}")
  zstyle ':completion:*:default' list-colors "${completion_colors[@]}"
  zstyle ':completion:*:*:kill:*:processes' list-colors \
    "=(#b) #([0-9]#) ([0-9a-z-]#)*=$accent_sgr=$foreground_sgr=$muted_sgr"
  zstyle ':completion:*:corrections' format " %F{$yellow}-- %d (errors: %e) --%f"
  zstyle ':completion:*:descriptions' format " %F{$accent}-- %d --%f"
  zstyle ':completion:*:messages' format " %F{$magenta}-- %d --%f"
  zstyle ':completion:*:warnings' format " %F{$red}-- no matches found --%f"
  zstyle ':completion:*' format " %F{$accent}-- %d --%f"
  zstyle ':completion:*:default' list-prompt " %F{$muted}-- %M matches --%f"
  zstyle ':completion:*:default' select-prompt " %F{$muted}-- scrolling %p --%f"
}

_omarchy_zsh_theme_apply() {
  emulate -L zsh
  (( ${#_OMARCHY_ZSH_THEME_COLORS} )) || return 1

  local accent=${_OMARCHY_ZSH_THEME_COLORS[accent]}
  local background=${_OMARCHY_ZSH_THEME_COLORS[background]}
  local dark_background=${_OMARCHY_ZSH_THEME_COLORS[dark_background]}
  local darker_background=${_OMARCHY_ZSH_THEME_COLORS[darker_background]}
  local lighter_background=${_OMARCHY_ZSH_THEME_COLORS[lighter_background]}
  local selection=${_OMARCHY_ZSH_THEME_COLORS[selection]}
  local foreground=${_OMARCHY_ZSH_THEME_COLORS[foreground]}
  local muted=${_OMARCHY_ZSH_THEME_COLORS[muted]}
  local bright_foreground=${_OMARCHY_ZSH_THEME_COLORS[bright_foreground]}
  local red=${_OMARCHY_ZSH_THEME_COLORS[red]}
  local yellow=${_OMARCHY_ZSH_THEME_COLORS[yellow]}
  local orange=${_OMARCHY_ZSH_THEME_COLORS[orange]}
  local green=${_OMARCHY_ZSH_THEME_COLORS[green]}
  local cyan=${_OMARCHY_ZSH_THEME_COLORS[cyan]}
  local blue=${_OMARCHY_ZSH_THEME_COLORS[blue]}
  local magenta=${_OMARCHY_ZSH_THEME_COLORS[magenta]}
  local bright_red=${_OMARCHY_ZSH_THEME_COLORS[bright_red]}
  local bright_yellow=${_OMARCHY_ZSH_THEME_COLORS[bright_yellow]}
  local bright_green=${_OMARCHY_ZSH_THEME_COLORS[bright_green]}
  local bright_cyan=${_OMARCHY_ZSH_THEME_COLORS[bright_cyan]}
  local bright_blue=${_OMARCHY_ZSH_THEME_COLORS[bright_blue]}
  local bright_magenta=${_OMARCHY_ZSH_THEME_COLORS[bright_magenta]}

  # Geometry reads these values while it loads each prompt plugin.
  typeset -g GEOMETRY_COLOR_PROMPT="$accent"
  typeset -g GEOMETRY_COLOR_ROOT="$red"
  typeset -g GEOMETRY_COLOR_DIR="$blue"
  typeset -g GEOMETRY_COLOR_EXIT_VALUE="$bright_red"
  typeset -g GEOMETRY_COLOR_GIT_DIRTY="$yellow"
  typeset -g GEOMETRY_COLOR_GIT_CLEAN="$green"
  typeset -g GEOMETRY_COLOR_GIT_BARE="$blue"
  typeset -g GEOMETRY_COLOR_GIT_CONFLICTS_UNSOLVED="$bright_red"
  typeset -g GEOMETRY_COLOR_GIT_CONFLICTS_SOLVED="$bright_green"
  typeset -g GEOMETRY_COLOR_GIT_BRANCH="$muted"
  typeset -g GEOMETRY_COLOR_GIT_STASHES="$magenta"
  typeset -g GEOMETRY_COLOR_HG_DIRTY="$yellow"
  typeset -g GEOMETRY_COLOR_HG_CLEAN="$green"
  typeset -g GEOMETRY_COLOR_HG_BRANCH="$muted"
  typeset -g GEOMETRY_COLOR_JOBS="$cyan"
  typeset -g GEOMETRY_COLOR_TIME_SHORT="$green"
  typeset -g GEOMETRY_COLOR_TIME_NEUTRAL="$foreground"
  typeset -g GEOMETRY_COLOR_TIME_LONG="$red"
  typeset -g GEOMETRY_COLOR_NO_TIME="$muted"
  typeset -g GEOMETRY_COLOR_DOCKER_MACHINE="$blue"
  typeset -g GEOMETRY_COLOR_KUBE="$cyan"
  typeset -g GEOMETRY_COLOR_PACKAGER_VERSION="$green"
  typeset -g GEOMETRY_COLOR_RUBY_RVM_VERSION="$red"
  typeset -g GEOMETRY_COLOR_RUSTUP_STABLE="$green"
  typeset -g GEOMETRY_COLOR_RUSTUP_BETA="$yellow"
  typeset -g GEOMETRY_COLOR_RUSTUP_NIGHTLY="$red"
  typeset -g GEOMETRY_COLOR_RUSTUP_stable="$green"
  typeset -g GEOMETRY_COLOR_RUSTUP_beta="$yellow"
  typeset -g GEOMETRY_COLOR_RUSTUP_nightly="$red"
  typeset -g GEOMETRY_COLOR_VIRTUALENV="$magenta"
  typeset -g GEOMETRY_COLOR_CONDA="$cyan"
  typeset -g GEOMETRY_PLUGIN_HOSTNAME_PREFIX="%F{$muted}@ "
  typeset -g GEOMETRY_PLUGIN_HOSTNAME_SUFFIX='%f'
  typeset -g GEOMETRY_PROMPT_PREFIX="%F{$accent}$USER%f"
  typeset -g GEOMETRY_SYMBOL_RPROMPT="%F{$muted}◇%f"

  zstyle ':prezto:module:syntax-highlighting' color 'yes'
  zstyle ':prezto:module:syntax-highlighting' highlighters 'main' 'brackets' 'cursor'
  zstyle ':prezto:module:syntax-highlighting' styles \
    'default' "fg=$foreground" \
    'unknown-token' "fg=$bright_red,bold" \
    'reserved-word' "fg=$magenta" \
    'suffix-alias' "fg=$cyan,underline" \
    'global-alias' "fg=$cyan" \
    'alias' "fg=$cyan" \
    'builtin' "fg=$blue" \
    'function' "fg=$blue" \
    'command' "fg=$blue" \
    'hashed-command' "fg=$blue" \
    'precommand' "fg=$magenta,underline" \
    'commandseparator' "fg=$cyan" \
    'autodirectory' "fg=$blue,underline" \
    'path' "fg=$blue,underline" \
    'path_prefix' "fg=$blue" \
    'path_pathseparator' "fg=$muted" \
    'path_prefix_pathseparator' "fg=$muted" \
    'globbing' "fg=$cyan,bold" \
    'history-expansion' "fg=$magenta" \
    'command-substitution' "fg=$foreground" \
    'command-substitution-quoted' "fg=$foreground" \
    'command-substitution-unquoted' "fg=$foreground" \
    'command-substitution-delimiter' "fg=$magenta" \
    'command-substitution-delimiter-quoted' "fg=$magenta" \
    'command-substitution-delimiter-unquoted' "fg=$magenta" \
    'process-substitution' "fg=$foreground" \
    'process-substitution-delimiter' "fg=$magenta" \
    'single-hyphen-option' "fg=$yellow" \
    'double-hyphen-option' "fg=$yellow" \
    'back-quoted-argument' "fg=$green" \
    'back-quoted-argument-unclosed' "fg=$bright_red" \
    'back-quoted-argument-delimiter' "fg=$magenta" \
    'single-quoted-argument' "fg=$green" \
    'single-quoted-argument-unclosed' "fg=$bright_red" \
    'double-quoted-argument' "fg=$green" \
    'double-quoted-argument-unclosed' "fg=$bright_red" \
    'dollar-quoted-argument' "fg=$green" \
    'dollar-quoted-argument-unclosed' "fg=$bright_red" \
    'rc-quote' "fg=$cyan" \
    'dollar-double-quoted-argument' "fg=$magenta" \
    'back-double-quoted-argument' "fg=$magenta" \
    'back-dollar-quoted-argument' "fg=$magenta" \
    'assign' "fg=$blue" \
    'redirection' "fg=$cyan" \
    'comment' "fg=$muted,italic" \
    'named-fd' "fg=$yellow" \
    'numeric-fd' "fg=$yellow" \
    'arg0' "fg=$blue,bold" \
    'bracket-error' "fg=$bright_red,bold" \
    'bracket-level-1' "fg=$blue,bold" \
    'bracket-level-2' "fg=$green,bold" \
    'bracket-level-3' "fg=$magenta,bold" \
    'bracket-level-4' "fg=$yellow,bold" \
    'bracket-level-5' "fg=$cyan,bold" \
    'cursor-matchingbracket' "fg=$bright_foreground,bg=$selection,bold" \
    'cursor' "fg=$background,bg=$accent" \
    'root' "fg=$bright_foreground,bg=$red,bold" \
    'line' "fg=$foreground"

  local style_name
  local -A syntax_highlighting_styles
  zstyle -a ':prezto:module:syntax-highlighting' styles syntax_highlighting_styles
  typeset -gA ZSH_HIGHLIGHT_STYLES
  for style_name in "${(k)syntax_highlighting_styles[@]}"; do
    ZSH_HIGHLIGHT_STYLES[$style_name]=$syntax_highlighting_styles[$style_name]
  done

  zstyle ':prezto:module:autosuggestions' color 'yes'
  zstyle ':prezto:module:autosuggestions:color' found "fg=$muted,italic"
  typeset -g ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE="fg=$muted,italic"

  zstyle ':prezto:module:history-substring-search' color 'yes'
  zstyle ':prezto:module:history-substring-search:color' found "fg=$bright_foreground,bg=$selection,bold"
  zstyle ':prezto:module:history-substring-search:color' not-found "fg=$background,bg=$red,bold"
  typeset -g HISTORY_SUBSTRING_SEARCH_HIGHLIGHT_FOUND="fg=$bright_foreground,bg=$selection,bold"
  typeset -g HISTORY_SUBSTRING_SEARCH_HIGHLIGHT_NOT_FOUND="fg=$background,bg=$red,bold"

  typeset -ga zle_highlight
  zle_highlight=(
    "region:fg=$bright_foreground,bg=$selection"
    "isearch:fg=$background,bg=$yellow"
    "paste:fg=$background,bg=$cyan"
    "special:fg=$magenta"
    "suffix:fg=$muted"
  )

  typeset -g SPROMPT="%F{$yellow}Correct %B%R%b to %B%r%b?%f [%F{$green}y%f/%F{$red}n%f/%F{$yellow}a%f/%F{$muted}e%f] "
  typeset -g PROMPT_EOL_MARK="%F{$red}%B↵%b%f"
  typeset -g PS3="%F{$accent}Select an option:%f "

  local foreground_sgr muted_sgr red_sgr yellow_sgr orange_sgr green_sgr cyan_sgr blue_sgr magenta_sgr
  local bright_red_sgr bright_cyan_sgr bright_blue_sgr bright_magenta_sgr
  local accent_sgr selection_bg_sgr
  _omarchy_zsh_theme_sgr "$foreground"; foreground_sgr=$REPLY
  _omarchy_zsh_theme_sgr "$muted"; muted_sgr=$REPLY
  _omarchy_zsh_theme_sgr "$red"; red_sgr=$REPLY
  _omarchy_zsh_theme_sgr "$yellow"; yellow_sgr=$REPLY
  _omarchy_zsh_theme_sgr "$orange"; orange_sgr=$REPLY
  _omarchy_zsh_theme_sgr "$green"; green_sgr=$REPLY
  _omarchy_zsh_theme_sgr "$cyan"; cyan_sgr=$REPLY
  _omarchy_zsh_theme_sgr "$blue"; blue_sgr=$REPLY
  _omarchy_zsh_theme_sgr "$magenta"; magenta_sgr=$REPLY
  _omarchy_zsh_theme_sgr "$bright_red"; bright_red_sgr=$REPLY
  _omarchy_zsh_theme_sgr "$bright_cyan"; bright_cyan_sgr=$REPLY
  _omarchy_zsh_theme_sgr "$bright_blue"; bright_blue_sgr=$REPLY
  _omarchy_zsh_theme_sgr "$bright_magenta"; bright_magenta_sgr=$REPLY
  _omarchy_zsh_theme_sgr "$accent"; accent_sgr=$REPLY
  _omarchy_zsh_theme_sgr "$selection" 48; selection_bg_sgr=$REPLY

  typeset -gx LS_COLORS="rs=0:no=${foreground_sgr}:fi=${foreground_sgr}:di=1;${blue_sgr}:ln=${cyan_sgr}"
  LS_COLORS+=":mh=${cyan_sgr}:pi=${yellow_sgr}:so=${magenta_sgr}:do=${magenta_sgr}:bd=1;${yellow_sgr}:cd=1;${orange_sgr}"
  LS_COLORS+=":or=1;${bright_red_sgr}:mi=1;${bright_red_sgr}:su=1;${bright_red_sgr}:sg=1;${yellow_sgr}:ca=${cyan_sgr}"
  LS_COLORS+=":tw=1;${blue_sgr}:ow=1;${blue_sgr}:st=${blue_sgr}:ex=1;${green_sgr}"

  _omarchy_zsh_theme_apply_completion

  typeset -gx EZA_COLORS="di=1;${blue_sgr}:ex=1;${green_sgr}:fi=${foreground_sgr}:pi=${yellow_sgr}:so=${magenta_sgr}:bd=${yellow_sgr}:cd=${orange_sgr}:ln=${cyan_sgr}:or=1;${bright_red_sgr}"
  EZA_COLORS+=":oc=${muted_sgr}:ur=${green_sgr}:uw=${yellow_sgr}:ux=${green_sgr}:ue=${green_sgr}:gr=${green_sgr}:gw=${yellow_sgr}:gx=${green_sgr}:tr=${green_sgr}:tw=${yellow_sgr}:tx=${green_sgr}"
  EZA_COLORS+=":su=1;${bright_red_sgr}:sf=${red_sgr}:xa=${magenta_sgr}:nb=${muted_sgr}:nk=${foreground_sgr}:nm=${blue_sgr}:ng=${yellow_sgr}:nt=${red_sgr}:sb=${muted_sgr}"
  EZA_COLORS+=":df=${yellow_sgr}:ds=${orange_sgr}:uu=${accent_sgr}:uR=1;${red_sgr}:un=${foreground_sgr}:gu=${cyan_sgr}:gR=${red_sgr}:gn=${muted_sgr}:lc=${muted_sgr}:lm=${cyan_sgr}"
  EZA_COLORS+=":ga=${green_sgr}:gm=${yellow_sgr}:gd=${red_sgr}:gv=${blue_sgr}:gt=${cyan_sgr}:gi=${muted_sgr}:gc=1;${bright_red_sgr}:Gm=1;${accent_sgr}:Go=${blue_sgr}:Gc=${green_sgr}:Gd=${yellow_sgr}"
  EZA_COLORS+=":xx=${muted_sgr}:da=${muted_sgr}:in=${muted_sgr}:bl=${muted_sgr}:hd=1;${accent_sgr}:lp=${cyan_sgr}:cc=${orange_sgr}:bO=${bright_red_sgr}:sp=${magenta_sgr}:mp=1;${cyan_sgr}"
  EZA_COLORS+=":im=${magenta_sgr}:vi=${bright_magenta_sgr}:mu=${cyan_sgr}:lo=${bright_cyan_sgr}:cr=${red_sgr}:do=${yellow_sgr}:co=${orange_sgr}:tm=${muted_sgr}:cm=${orange_sgr}:bu=${yellow_sgr}:sc=${bright_blue_sgr}:ic=${accent_sgr}"
  EZA_COLORS+=":Sn=${muted_sgr}:Su=${accent_sgr}:Sr=${cyan_sgr}:St=${foreground_sgr}:Sl=${muted_sgr}:ff=${yellow_sgr}"

  typeset -gx GREP_COLORS="mt=1;${bright_red_sgr}:ms=1;${bright_red_sgr}:mc=1;${bright_red_sgr}:sl=${foreground_sgr}:cx=${muted_sgr}:fn=${blue_sgr}:ln=${muted_sgr}:bn=${muted_sgr}:se=${accent_sgr}:ne"
  typeset -gx GCC_COLORS="error=1;${bright_red_sgr}:warning=1;${yellow_sgr}:note=1;${cyan_sgr}:caret=${accent_sgr}:locus=${muted_sgr}:quote=${green_sgr}:path=${blue_sgr}:fixit-insert=${green_sgr}:fixit-delete=${red_sgr}:diff-filename=${blue_sgr}:diff-hunk=${magenta_sgr}:diff-delete=${red_sgr}:diff-insert=${green_sgr}:type-diff=${yellow_sgr}:fnname=${blue_sgr}:targs=${cyan_sgr}"
  typeset -gx BAT_THEME='ansi'

  local fzf_color_option="--color=fg:${foreground},bg:${background},selected-fg:${bright_foreground},selected-bg:${selection},preview-bg:${dark_background},input-bg:${background},header-bg:${darker_background},footer-bg:${darker_background},hl:${yellow},selected-hl:${bright_yellow},gutter:${background},alt-bg:${dark_background},alt-gutter:${dark_background},query:${foreground},ghost:${muted},disabled:${muted},info:${muted},border:${lighter_background},list-border:${lighter_background},scrollbar:${muted},separator:${lighter_background},gap-line:${lighter_background},preview-border:${lighter_background},preview-scrollbar:${muted},input-border:${lighter_background},header-border:${lighter_background},footer-border:${lighter_background},label:${accent},prompt:${accent},pointer:${accent},marker:${green},spinner:${cyan},header:${muted},footer:${muted},nomatch:${muted}"
  local fzf_options=${FZF_DEFAULT_OPTS:-}
  if [[ -n ${OMARCHY_ZSH_FZF_COLOR_OPTION:-} ]]; then
    fzf_options=${fzf_options//$OMARCHY_ZSH_FZF_COLOR_OPTION/}
  fi
  typeset -gx FZF_DEFAULT_OPTS="${fzf_options:+$fzf_options }$fzf_color_option"
  typeset -gx OMARCHY_ZSH_FZF_COLOR_OPTION="$fzf_color_option"

  local escape=$'\e'
  typeset -gx LESS_TERMCAP_mb="${escape}[1;${bright_red_sgr}m"
  typeset -gx LESS_TERMCAP_md="${escape}[1;${accent_sgr}m"
  typeset -gx LESS_TERMCAP_me="${escape}[0m"
  typeset -gx LESS_TERMCAP_so="${escape}[${foreground_sgr};${selection_bg_sgr}m"
  typeset -gx LESS_TERMCAP_se="${escape}[0m"
  typeset -gx LESS_TERMCAP_us="${escape}[4;${cyan_sgr}m"
  typeset -gx LESS_TERMCAP_ue="${escape}[0m"

  # Geometry caches some colored symbols when its plugins load.
  if (( $+functions[prompt_geometry_colorize] )); then
    if (( ${+parameters[GEOMETRY_SYMBOL_PROMPT]} )); then
      typeset -g GEOMETRY_PROMPT="$(prompt_geometry_colorize "$GEOMETRY_COLOR_PROMPT" "$GEOMETRY_SYMBOL_PROMPT")"
      typeset -g GEOMETRY_EXIT_VALUE="$(prompt_geometry_colorize "$GEOMETRY_COLOR_EXIT_VALUE" "$GEOMETRY_SYMBOL_EXIT_VALUE")"
    fi
    if (( ${+parameters[GEOMETRY_SYMBOL_GIT_DIRTY]} )); then
      typeset -g GEOMETRY_GIT_DIRTY="$(prompt_geometry_colorize "$GEOMETRY_COLOR_GIT_DIRTY" "$GEOMETRY_SYMBOL_GIT_DIRTY")"
      typeset -g GEOMETRY_GIT_CLEAN="$(prompt_geometry_colorize "$GEOMETRY_COLOR_GIT_CLEAN" "$GEOMETRY_SYMBOL_GIT_CLEAN")"
      typeset -g GEOMETRY_GIT_BARE="$(prompt_geometry_colorize "$GEOMETRY_COLOR_GIT_BARE" "$GEOMETRY_SYMBOL_GIT_BARE")"
      typeset -g GEOMETRY_GIT_STASHES="$(prompt_geometry_colorize "$GEOMETRY_COLOR_GIT_STASHES" "$GEOMETRY_SYMBOL_GIT_STASHES")"
    fi
    if (( ${+parameters[GEOMETRY_SYMBOL_HG_DIRTY]} )); then
      typeset -g GEOMETRY_HG_DIRTY="$(prompt_geometry_colorize "$GEOMETRY_COLOR_HG_DIRTY" "$GEOMETRY_SYMBOL_HG_DIRTY")"
      typeset -g GEOMETRY_HG_CLEAN="$(prompt_geometry_colorize "$GEOMETRY_COLOR_HG_CLEAN" "$GEOMETRY_SYMBOL_HG_CLEAN")"
    fi
    if (( ${+parameters[GEOMETRY_SYMBOL_KUBE]} )); then
      typeset -g GEOMETRY_KUBE="$(prompt_geometry_colorize "$GEOMETRY_COLOR_KUBE" "$GEOMETRY_SYMBOL_KUBE")"
    fi
    if (( ${+parameters[GEOMETRY_SYMBOL_PACKAGER_VERSION]} )); then
      typeset -g GEOMETRY_NODE_PACKAGER_VERSION="$(prompt_geometry_colorize "$GEOMETRY_COLOR_PACKAGER_VERSION" "$GEOMETRY_SYMBOL_PACKAGER_VERSION")"
    fi
    if (( ${+parameters[GEOMETRY_SYMBOL_RUBY_RVM_VERSION]} )); then
      typeset -g GEOMETRY_RUBY_RVM_VERSION="$(prompt_geometry_colorize "$GEOMETRY_COLOR_RUBY_RVM_VERSION" "$GEOMETRY_SYMBOL_RUBY_RVM_VERSION")"
    fi
  fi
}

_omarchy_zsh_theme_sync() {
  if _omarchy_zsh_theme_read; then
    _omarchy_zsh_theme_apply
  fi
  return 0
}

_omarchy_zsh_theme_finish() {
  _omarchy_zsh_theme_apply_completion
}

if _omarchy_zsh_theme_read force; then
  _omarchy_zsh_theme_apply
fi

autoload -Uz add-zsh-hook
typeset -ga precmd_functions
if (( ! ${precmd_functions[(I)_omarchy_zsh_theme_sync]} )); then
  add-zsh-hook precmd _omarchy_zsh_theme_sync
fi
