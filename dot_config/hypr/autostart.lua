-- Extra autostart processes. Workspace placement applies only at login.
-- Keep workspaces 1–5 on the Gigabyte M27Q and 6–10 on the left LG display.
for workspace = 1, 5 do
  hl.workspace_rule({ workspace = tostring(workspace), monitor = "DP-1" })
end

for workspace = 6, 10 do
  hl.workspace_rule({ workspace = tostring(workspace), monitor = "HDMI-A-1" })
end

hl.on("hyprland.start", function()
  hl.exec_cmd(o.launch("discord"), { workspace = "1 silent" })
  hl.exec_cmd(o.launch("omarchy-launch-webapp https://web.whatsapp.com/"), { workspace = "1 silent" })
  hl.exec_cmd(o.launch("zen-browser"), { workspace = "2 silent" })
end)
