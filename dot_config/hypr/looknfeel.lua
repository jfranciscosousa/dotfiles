-- Change the default Omarchy look'n'feel.

-- Make 1Password approvals 35% larger than Omarchy's 875x600 floating default.
o.window("^1[Pp]assword$", { size = { 1180, 810 } })

-- Use a dedicated class so Omarchy's default 875x600 btop rule cannot override this size.
o.window([[^TUI\.system-usage$]], { float = true, size = { 1480, 1014 }, center = true })

-- Keep Spotify in its dedicated special workspace however it is launched,
-- matching the tray toggle's large centered layout.
o.window("^([Ss]potify)$", {
  workspace = "special:spotify silent",
  float = true,
  center = true,
  size = { "(monitor_w*95/100)", "(monitor_h*95/100)" },
})
