-- Extra autostart processes.
-- Launch in this order so dwindle places Discord on the left and ZapZap on the right.
o.launch_on_start("omarchy-launch-webapp https://discord.com/channels/@me")
o.launch_on_start("flatpak run com.rtosta.zapzap")
