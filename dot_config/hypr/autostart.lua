-- Extra autostart processes. Workspace placement applies only at login.
hl.on("hyprland.start", function()
  hl.exec_cmd(o.launch("discord"), { workspace = "1 silent" })
  hl.exec_cmd(o.launch("omarchy-launch-webapp https://web.whatsapp.com/"), { workspace = "1 silent" })
  hl.exec_cmd(o.launch("zen-browser"), { workspace = "2 silent" })
end)
