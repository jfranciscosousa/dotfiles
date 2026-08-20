import QtQuick
import Quickshell
import Quickshell.Io
import qs.Ui
import qs.Commons

BarWidget {
  id: root
  moduleName: "jfranciscosousa.spotify-player"

  readonly property var mediaService: bar?.shell?.firstPartyServiceFor("omarchy.media")
  readonly property var activePlayer: mediaService ? mediaService.activePlayer : null
  readonly property var sourcePlayers: mediaService ? mediaService.sourcePlayers : []
  readonly property var spotifyStream: findSpotifyStream()
  readonly property real spotifyVolume: spotifyStream && spotifyStream.audio ? spotifyStream.audio.volume : 0
  readonly property bool spotifyMuted: spotifyStream && spotifyStream.audio ? spotifyStream.audio.muted : false

  readonly property string title: activePlayer ? (activePlayer.trackTitle || "") : ""
  readonly property string artist: activePlayer ? (activePlayer.trackArtist || "") : ""
  readonly property string toggleCommand: [
    "if ! pgrep -x spotify >/dev/null; then",
    "  hyprctl eval 'return hl.dispatch(hl.dsp.exec_cmd(\"uwsm-app -- spotify\", { workspace = \"special:spotify silent\", float = true, center = true, size = { \"(monitor_w*95/100)\", \"(monitor_h*95/100)\" } }))'",
    "fi",
    "hyprctl eval 'return hl.dispatch(hl.dsp.workspace.toggle_special(\"spotify\"))'"
  ].join("\n")

  property bool popupOpen: false

  function close() { popupOpen = false }

  function findSpotifyStream() {
    const streams = mediaService ? mediaService.playbackStreams : []
    for (let i = 0; i < streams.length; i++) {
      const label = mediaService.streamLabelKey(mediaService.rawStreamLabel(streams[i]))
      if (label.indexOf("spotify") !== -1) return streams[i]
    }
    return null
  }

  function refreshTrayTooltip() {
    if (!button.tooltipHovered || !root.bar) return
    Qt.callLater(function() {
      if (!button.tooltipHovered || !root.bar) return
      if (root.bar.tooltipTarget === button)
        root.bar.tooltipText = button.tooltipText
      else if (root.bar.pendingTooltipTarget === button)
        root.bar.pendingTooltipText = button.tooltipText
    })
  }

  function setSpotifyVolume(value) {
    if (!spotifyStream || !spotifyStream.audio) return
    spotifyStream.audio.volume = Math.max(0, Math.min(1.5, value))
    spotifyStream.audio.muted = false
    refreshTrayTooltip()
  }

  function adjustSpotifyVolume(delta) {
    setSpotifyVolume(spotifyVolume + delta)
  }

  function toggleSpotifyMute() {
    if (!spotifyStream || !spotifyStream.audio) return
    spotifyStream.audio.muted = !spotifyStream.audio.muted
    refreshTrayTooltip()
  }

  function toggleSpotify() {
    Quickshell.execDetached(["bash", "-c", toggleCommand])
    popupOpen = false
  }

  function handleTrayClick() {
    if (!visibilityProbe.running) visibilityProbe.running = true
  }

  Process {
    id: visibilityProbe
    command: ["hyprctl", "-j", "monitors"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        try {
          const monitors = JSON.parse(text || "[]")
          const spotifyVisible = monitors.some(function(monitor) {
            return monitor.specialWorkspace && monitor.specialWorkspace.name === "special:spotify"
          })

          if (spotifyVisible) root.toggleSpotify()
          else root.popupOpen = !root.popupOpen
        } catch (e) {
          root.popupOpen = !root.popupOpen
        }
      }
    }
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  BarIconButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: "󰓇"
    slotSize: Style.bar.statusSlot
    active: root.activePlayer && root.activePlayer.isPlaying
    tooltipText: (root.title ? root.title + (root.artist ? " — " + root.artist : "") : "Media controls")
      + (root.spotifyStream ? " · " + Math.round(root.spotifyVolume * 100) + "%" + (root.spotifyMuted ? " muted" : "") : "")
    onPressed: function(buttonCode) {
      if (buttonCode === Qt.MiddleButton) root.toggleSpotifyMute()
      else root.handleTrayClick()
    }
    onWheelMoved: function(delta) {
      if (delta !== 0) root.adjustSpotifyVolume(delta > 0 ? 0.05 : -0.05)
    }
  }

  PopupCard {
    id: popup
    anchorItem: root
    bar: root.bar
    owner: root
    open: root.popupOpen
    contentWidth: popup.fittedContentWidth(Style.space(320))
    contentHeight: popup.fittedContentHeight(column.implicitHeight)

    Column {
      id: column
      anchors.fill: parent
      spacing: Style.space(10)

      Row {
        spacing: Style.space(10)
        width: parent.width

        BorderSurface {
          width: Style.space(64)
          height: Style.space(64)
          radius: Style.spacing.labelGap
          color: Style.normalFillFor(root.bar.foreground, Color.accent)
          borderSpec: Border.controlSpec("normal", root.bar.foreground, Color.accent)

          Image {
            anchors.fill: parent
            anchors.margins: Style.space(2)
            fillMode: Image.PreserveAspectCrop
            asynchronous: true
            source: root.activePlayer && root.activePlayer.trackArtUrl ? root.activePlayer.trackArtUrl : ""
            visible: source !== ""
          }

          Text {
            anchors.centerIn: parent
            visible: !root.activePlayer || !root.activePlayer.trackArtUrl
            text: "󰝚"
            color: root.bar.foreground
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.displayLarge
          }
        }

        Column {
          spacing: Style.space(4)
          width: parent.width - Style.space(74)

          Text {
            text: root.title || "Nothing playing"
            color: root.bar.foreground
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.subtitle
            font.bold: true
            elide: Text.ElideRight
            width: parent.width
          }

          Text {
            text: root.artist
            color: Qt.darker(root.bar.foreground, 1.3)
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.bodySmall
            elide: Text.ElideRight
            width: parent.width
            visible: text !== ""
          }

          Text {
            text: root.activePlayer && root.activePlayer.trackAlbum ? root.activePlayer.trackAlbum : ""
            color: Qt.darker(root.bar.foreground, 1.6)
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.caption
            elide: Text.ElideRight
            width: parent.width
            visible: text !== ""
          }
        }
      }

      Row {
        anchors.horizontalCenter: parent.horizontalCenter
        spacing: Style.space(6)

        Button {
          iconText: "󰒮"
          foreground: root.bar.foreground
          horizontalPadding: Style.spacing.controlPaddingX
          verticalPadding: Style.spacing.controlPaddingY
          enabled: root.activePlayer && root.activePlayer.canGoPrevious
          opacity: enabled ? 1.0 : 0.4
          onClicked: if (root.mediaService) root.mediaService.runAction("previous", false, root.mediaService.playerKey(root.activePlayer))
        }

        Button {
          iconText: root.activePlayer && root.activePlayer.isPlaying ? "󰏤" : "󰐊"
          foreground: root.bar.foreground
          horizontalPadding: Style.spacing.panelGap
          verticalPadding: Style.spacing.controlPaddingY
          iconSize: Style.font.iconLarge
          enabled: root.activePlayer && (root.activePlayer.canTogglePlaying || root.activePlayer.canPlay || root.activePlayer.canPause)
          opacity: enabled ? 1.0 : 0.4
          onClicked: if (root.mediaService) root.mediaService.runAction("playPause", false, root.mediaService.playerKey(root.activePlayer))
        }

        Button {
          iconText: "󰒭"
          foreground: root.bar.foreground
          horizontalPadding: Style.spacing.controlPaddingX
          verticalPadding: Style.spacing.controlPaddingY
          enabled: root.activePlayer && root.activePlayer.canGoNext
          opacity: enabled ? 1.0 : 0.4
          onClicked: if (root.mediaService) root.mediaService.runAction("next", false, root.mediaService.playerKey(root.activePlayer))
        }
      }

      Row {
        width: parent.width
        spacing: Style.space(8)
        opacity: root.spotifyStream ? 1.0 : 0.4

        Button {
          id: spotifyMuteButton
          anchors.verticalCenter: parent.verticalCenter
          iconText: root.spotifyMuted ? "󰝟" : "󰕾"
          tooltipText: root.spotifyMuted ? "Unmute Spotify" : "Mute Spotify"
          foreground: root.bar.foreground
          horizontalPadding: Style.spacing.controlPaddingX
          verticalPadding: Style.spacing.controlPaddingY
          enabled: root.spotifyStream !== null
          onClicked: root.toggleSpotifyMute()
        }

        PanelSlider {
          anchors.verticalCenter: parent.verticalCenter
          width: parent.width - spotifyMuteButton.implicitWidth - spotifyVolumePercent.width - parent.spacing * 2
          bar: root.bar
          minimum: 0
          maximum: 1.5
          step: 0.05
          value: root.spotifyVolume
          enabled: root.spotifyStream !== null
          onMoved: function(value) { root.setSpotifyVolume(value) }
        }

        Text {
          id: spotifyVolumePercent
          anchors.verticalCenter: parent.verticalCenter
          width: Style.space(40)
          text: Math.round(root.spotifyVolume * 100) + "%"
          color: root.bar.foreground
          font.family: root.bar.fontFamily
          font.pixelSize: Style.font.caption
          font.bold: true
          horizontalAlignment: Text.AlignRight
        }
      }

      Button {
        anchors.horizontalCenter: parent.horizontalCenter
        iconText: "󰓇"
        text: "Open Spotify"
        foreground: root.bar.foreground
        bordered: true
        horizontalPadding: Style.spacing.panelGap
        verticalPadding: Style.spacing.controlPaddingY
        onClicked: root.toggleSpotify()
      }

      PanelSeparator {
        visible: root.sourcePlayers.length > 1
        foreground: root.bar.foreground
      }

      Column {
        id: sourceList
        visible: root.sourcePlayers.length > 1
        width: parent.width
        spacing: Style.space(4)

        Repeater {
          model: root.sourcePlayers

          BorderSurface {
            id: sourceRow
            required property var modelData

            readonly property var player: modelData
            readonly property bool selected: root.activePlayer && player
              && root.mediaService.playerKey(root.activePlayer) === root.mediaService.playerKey(player)
            readonly property string sourceTitle: player ? (player.trackTitle || player.identity || player.desktopEntry || "Media source") : "Media source"
            readonly property string sourceDetail: player && player.trackArtist ? player.trackArtist : (player && player.identity ? player.identity : "")

            width: sourceList.width
            height: sourceInner.implicitHeight + Style.space(10)
            radius: Style.spacing.labelGap
            color: selected ? Style.selectedFillFor(root.bar.foreground, Color.accent) : "transparent"
            borderSpec: selected ? Border.controlSpec("normal", root.bar.foreground, Color.accent) : Border.none()

            Row {
              id: sourceInner
              anchors.left: parent.left
              anchors.right: parent.right
              anchors.verticalCenter: parent.verticalCenter
              anchors.leftMargin: sourceRow.borderLeft + Style.space(8)
              anchors.rightMargin: sourceRow.borderRight + Style.space(8)
              spacing: Style.space(8)

              Text {
                text: sourceRow.player && sourceRow.player.isPlaying ? "󰏤" : "󰐊"
                color: root.bar.foreground
                font.family: root.bar.fontFamily
                font.pixelSize: Style.font.body
                width: Style.space(18)
                horizontalAlignment: Text.AlignHCenter
                anchors.verticalCenter: parent.verticalCenter
              }

              Column {
                width: parent.width - Style.space(26)
                spacing: Style.space(1)
                anchors.verticalCenter: parent.verticalCenter

                Text {
                  text: sourceRow.sourceTitle
                  color: root.bar.foreground
                  font.family: root.bar.fontFamily
                  font.pixelSize: Style.font.bodySmall
                  font.bold: sourceRow.selected
                  elide: Text.ElideRight
                  width: parent.width
                }

                Text {
                  text: sourceRow.sourceDetail
                  color: Qt.darker(root.bar.foreground, 1.5)
                  font.family: root.bar.fontFamily
                  font.pixelSize: Style.font.caption
                  elide: Text.ElideRight
                  width: parent.width
                  visible: text !== ""
                }
              }
            }

            MouseArea {
              anchors.fill: parent
              hoverEnabled: true
              cursorShape: Qt.PointingHandCursor
              onClicked: if (root.mediaService) root.mediaService.selectPlayer(root.mediaService.playerKey(sourceRow.player))
            }
          }
        }
      }
    }
  }
}
