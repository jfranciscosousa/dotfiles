-- Personal Hyprland keybindings kept with Omarchy configuration.
-- This file is loaded from ~/.config/hypr/bindings.lua.

hl.unbind("SUPER + CTRL + LEFT")
hl.unbind("SUPER + CTRL + RIGHT")
o.bind("SUPER + CTRL + LEFT", "Previous workspace", "~/.config/omarchy/workspace-step-bounded previous")
o.bind("SUPER + CTRL + RIGHT", "Next workspace", "~/.config/omarchy/workspace-step-bounded next")

o.bind("SUPER + CTRL + ALT + LEFT", "Move window to previous workspace", "~/.config/omarchy/workspace-step-bounded previous move")
o.bind("SUPER + CTRL + ALT + RIGHT", "Move window to next workspace", "~/.config/omarchy/workspace-step-bounded next move")
