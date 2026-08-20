import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import qs.Commons
import qs.Ui

Panel {
  id: root
  moduleName: "jfranciscosousa.notification-center"
  ipcTarget: moduleName

  readonly property string historyDir: Quickshell.env("HOME") + "/.local/state/omarchy/notifications/history"
  readonly property string focusStatePath: Quickshell.env("HOME") + "/.local/state/omarchy/notification-center.json"
  readonly property var notificationService: bar && bar.shell
    ? bar.shell.firstPartyServiceFor("omarchy.notifications")
    : null
  readonly property bool focusEnabled: notificationService
    ? notificationService.doNotDisturb
    : false
  readonly property color foreground: Color.menu.text
  readonly property color dim: Util.alpha(foreground, 0.6)
  readonly property string fontFamily: bar ? bar.fontFamily : Style.font.family

  property string focusMode: "off"
  property double focusUntil: 0
  property bool focusStateLoaded: false
  property bool applyingFocusState: false

  readonly property bool timedFocus: focusMode === "1h" || focusMode === "4h"
  readonly property string focusStatus: focusMode === "off"
    ? "Notifications are allowed"
    : timedFocus
      ? "Silenced until " + Qt.formatTime(new Date(focusUntil), "HH:mm")
      : "Silenced until turned off"

  function refreshHistory() {
    if (!historyProcess.running) historyProcess.running = true
  }

  function loadHistory(raw) {
    var rows = []
    var lines = String(raw || "").split("\n")

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim()
      if (!line) continue

      try {
        var entry = JSON.parse(line)
        var sourceApp = String(entry.app || "Notification")
        var sourceBody = String(entry.body || "")
        rows.push({
          app: webAppName(sourceApp, sourceBody),
          summary: String(entry.summary || "Notification"),
          body: displayBody(sourceBody, sourceApp),
          timestamp: Number(entry.timestamp || 0)
        })
      } catch (error) {
        console.warn("notification-center: skipped invalid history entry:", error)
      }
    }

    rows.sort(function(a, b) { return b.timestamp - a.timestamp })
    historyModel.clear()
    for (var row = 0; row < rows.length; row++) historyModel.append(rows[row])
  }

  function formatTimestamp(timestamp) {
    var date = new Date(timestamp)
    var today = new Date()
    var sameDay = date.getFullYear() === today.getFullYear()
      && date.getMonth() === today.getMonth()
      && date.getDate() === today.getDate()
    return sameDay
      ? Qt.formatTime(date, "HH:mm")
      : Qt.formatDateTime(date, "d MMM · HH:mm")
  }

  function isChromiumApp(app) {
    var name = String(app || "").toLowerCase()
    return name.indexOf("chrom") >= 0 || name.indexOf("brave") >= 0
      || name.indexOf("vivaldi") >= 0 || name.indexOf("edge") >= 0
      || name.indexOf("opera") >= 0
  }

  function webAppName(app, body) {
    if (!isChromiumApp(app)) return String(app || "Notification")

    var match = String(body || "").match(/<a\b[^>]*\bhref=["'](?:https?:\/\/)?([^\/"'?#]+)[^"']*["']/i)
    if (!match) return String(app || "Notification")

    var host = String(match[1] || "").toLowerCase().replace(/:\d+$/, "")
    var knownApps = [
      ["whatsapp.com", "WhatsApp"],
      ["discord.com", "Discord"],
      ["slack.com", "Slack"],
      ["mail.google.com", "Gmail"],
      ["calendar.google.com", "Google Calendar"],
      ["messages.google.com", "Google Messages"],
      ["meet.google.com", "Google Meet"],
      ["teams.microsoft.com", "Microsoft Teams"]
    ]

    for (var i = 0; i < knownApps.length; i++) {
      var domain = knownApps[i][0]
      if (host === domain || host.slice(-(domain.length + 1)) === "." + domain)
        return knownApps[i][1]
    }

    host = host.replace(/^(?:www|web|app)\./, "")
    var label = host.split(".")[0].replace(/[-_]+/g, " ")
    return label ? label.charAt(0).toUpperCase() + label.slice(1) : String(app || "Notification")
  }

  function displayBody(body, app) {
    var text = String(body || "").replace(/<img[^>]*>/gi, "")
    if (isChromiumApp(app)) {
      text = text
        .replace(/^\s*<a\b[^>]*>\s*(?:https?:\/\/|www\.)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:\/[^<\s]*)?\s*<\/a>\s*/i, "")
        .replace(/^\s*(?:https?:\/\/|www\.)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:\/\S*)?\s+/i, "")
    }
    return text.replace(/\r\n|\r|\n/g, "<br/>")
  }

  function normalizedFocusMode(mode) {
    return mode === "1h" || mode === "4h" || mode === "on" ? mode : "off"
  }

  function setFocusMode(mode) {
    var next = normalizedFocusMode(mode)
    applyingFocusState = true
    focusMode = next
    focusUntil = next === "1h" ? Date.now() + 60 * 60 * 1000
      : next === "4h" ? Date.now() + 4 * 60 * 60 * 1000
      : 0
    if (notificationService) notificationService.setDoNotDisturb(next !== "off")
    applyingFocusState = false
    saveFocusState()
  }

  function toggleFocus() {
    setFocusMode(focusEnabled ? "off" : "on")
  }

  function loadFocusState(raw) {
    if (focusStateLoaded) return

    var savedMode = "off"
    var savedUntil = 0
    try {
      var state = JSON.parse(String(raw || "{}"))
      savedMode = normalizedFocusMode(String(state.mode || "off"))
      savedUntil = Number(state.until || 0)
    } catch (error) {
      console.warn("notification-center: focus state parse failed:", error)
    }

    focusMode = savedMode
    focusUntil = savedUntil
    focusStateLoaded = true
    applyLoadedFocusState()
  }

  function applyLoadedFocusState() {
    if (!focusStateLoaded || !notificationService) return

    if (timedFocus && focusUntil <= Date.now()) {
      setFocusMode("off")
      return
    }

    applyingFocusState = true
    if (focusMode === "on" || timedFocus) {
      notificationService.setDoNotDisturb(true)
    } else if (focusEnabled) {
      focusMode = "on"
      focusUntil = 0
      saveFocusState()
    }
    applyingFocusState = false
  }

  function syncExternalFocusState() {
    if (!focusStateLoaded || applyingFocusState) return

    if (!focusEnabled && focusMode !== "off") {
      focusMode = "off"
      focusUntil = 0
      saveFocusState()
    } else if (focusEnabled && focusMode === "off") {
      focusMode = "on"
      focusUntil = 0
      saveFocusState()
    }
  }

  function saveFocusState() {
    if (!focusStateLoaded) return
    focusStateFile.setText(JSON.stringify({
      version: 1,
      mode: focusMode,
      until: focusUntil
    }, null, 2) + "\n")
  }

  function clearHistory() {
    if (notificationService) notificationService.clearHistory()
    historyModel.clear()
    refreshAfterClear.restart()
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  onOpenedChanged: if (opened) refreshHistory()
  onNotificationServiceChanged: applyLoadedFocusState()
  onFocusEnabledChanged: syncExternalFocusState()
  Component.onCompleted: focusStateFile.reload()

  ListModel {
    id: historyModel
  }

  FileView {
    id: focusStateFile
    path: root.focusStatePath
    atomicWrites: true
    watchChanges: false
    printErrors: false
    onLoaded: root.loadFocusState(text())
    onLoadFailed: root.loadFocusState("")
  }

  Process {
    id: historyProcess
    command: [
      "bash", "-c",
      "find \"$1\" -maxdepth 1 -type f -name '*.json' -print0 2>/dev/null | sort -z -r | xargs -0 -r awk 1",
      "--", root.historyDir
    ]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.loadHistory(text)
    }
  }

  Timer {
    interval: 3000
    running: root.opened
    repeat: true
    onTriggered: root.refreshHistory()
  }

  Timer {
    id: refreshAfterClear
    interval: 500
    onTriggered: root.refreshHistory()
  }

  Timer {
    interval: Math.max(250, root.focusUntil - Date.now())
    running: root.focusStateLoaded && root.timedFocus && root.focusUntil > Date.now()
    repeat: false
    onTriggered: root.setFocusMode("off")
  }

  BarIconButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: root.focusEnabled ? "󰂛" : "󰂚"
    foreground: root.focusEnabled ? Color.accent : root.foreground
    tooltipText: root.focusEnabled
      ? "Focus mode on · " + historyModel.count + " recent"
      : "Notifications · " + historyModel.count + " recent"
    onPressed: function(buttonCode) {
      if (buttonCode === Qt.RightButton) root.toggleFocus()
      else root.toggle()
    }
  }

  PanelWindow {
    id: overlay
    visible: root.opened
    anchors { top: true; bottom: true; left: true; right: true }
    color: "transparent"
    exclusionMode: ExclusionMode.Ignore
    WlrLayershell.namespace: "omarchy-notification-center"
    WlrLayershell.layer: WlrLayer.Overlay
    WlrLayershell.keyboardFocus: WlrKeyboardFocus.Exclusive

    Rectangle {
      anchors.fill: parent
      color: Util.alpha(Color.background, 0.48)

      MouseArea {
        anchors.fill: parent
        onClicked: root.close()
      }
    }

    Rectangle {
      id: drawer
      width: Math.min(Style.space(420), overlay.width - Style.space(32))
      anchors.top: parent.top
      anchors.right: parent.right
      anchors.bottom: parent.bottom
      anchors.margins: Style.gapsOut
      radius: Style.cornerRadius
      color: Color.menu.background
      border.width: 1
      border.color: Color.menu.border
      focus: true

      Keys.onEscapePressed: root.close()

      MouseArea {
        anchors.fill: parent
        onClicked: {}
      }

      Item {
        id: header
        anchors.top: parent.top
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.margins: Style.space(20)
        height: Style.space(36)

        Text {
          anchors.left: parent.left
          anchors.verticalCenter: parent.verticalCenter
          text: "Notifications"
          color: root.foreground
          font.family: root.fontFamily
          font.pixelSize: Style.font.heading
          font.bold: true
        }

        Rectangle {
          width: Style.space(32)
          height: width
          anchors.right: parent.right
          anchors.verticalCenter: parent.verticalCenter
          radius: width / 2
          color: closeArea.containsMouse ? Color.menu.selectedBackground : "transparent"

          Text {
            anchors.centerIn: parent
            text: "󰅖"
            color: root.foreground
            font.family: root.fontFamily
            font.pixelSize: Style.font.icon
          }

          MouseArea {
            id: closeArea
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: root.close()
          }
        }
      }

      Rectangle {
        id: focusCard
        anchors.top: header.bottom
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.topMargin: Style.space(16)
        anchors.leftMargin: Style.space(20)
        anchors.rightMargin: Style.space(20)
        height: Style.space(116)
        radius: Style.cornerRadius
        color: Color.menu.selectedBackground
        border.width: root.focusEnabled ? 1 : 0
        border.color: Color.accent

        Text {
          id: focusIcon
          anchors.left: parent.left
          anchors.leftMargin: Style.space(16)
          anchors.top: parent.top
          anchors.topMargin: Style.space(16)
          text: "󰒲"
          color: root.focusEnabled ? Color.accent : root.dim
          font.family: root.fontFamily
          font.pixelSize: Style.font.display
        }

        Column {
          anchors.left: focusIcon.right
          anchors.leftMargin: Style.space(12)
          anchors.right: parent.right
          anchors.rightMargin: Style.space(16)
          anchors.verticalCenter: focusIcon.verticalCenter
          spacing: Style.space(2)

          Text {
            text: "Focus mode"
            color: root.foreground
            font.family: root.fontFamily
            font.pixelSize: Style.font.body
            font.bold: true
          }

          Text {
            text: root.focusStatus
            color: root.dim
            font.family: root.fontFamily
            font.pixelSize: Style.font.caption
          }
        }

        Row {
          id: focusOptions
          anchors.left: parent.left
          anchors.right: parent.right
          anchors.bottom: parent.bottom
          anchors.margins: Style.space(10)
          height: Style.space(34)
          spacing: Style.space(4)

          Repeater {
            model: [
              { mode: "off", label: "Off" },
              { mode: "1h", label: "1h" },
              { mode: "4h", label: "4h" },
              { mode: "on", label: "On" }
            ]

            Rectangle {
              id: focusOption
              required property var modelData
              readonly property bool selected: root.focusMode === modelData.mode

              width: (focusOptions.width - focusOptions.spacing * 3) / 4
              height: focusOptions.height
              radius: Style.cornerRadius
              color: selected ? Color.accent
                : optionArea.containsMouse ? Util.alpha(root.foreground, 0.1)
                : Util.alpha(root.foreground, 0.05)

              Text {
                anchors.centerIn: parent
                text: focusOption.modelData.label
                color: focusOption.selected ? Color.background : root.foreground
                font.family: root.fontFamily
                font.pixelSize: Style.font.bodySmall
                font.bold: parent.selected
              }

              MouseArea {
                id: optionArea
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onClicked: root.setFocusMode(focusOption.modelData.mode)
              }
            }
          }
        }
      }

      Flickable {
        id: historyView
        anchors.top: focusCard.bottom
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.bottom: footer.top
        anchors.topMargin: Style.space(16)
        anchors.leftMargin: Style.space(20)
        anchors.rightMargin: Style.space(20)
        anchors.bottomMargin: Style.space(14)
        contentWidth: width
        contentHeight: historyColumn.height
        clip: true
        boundsBehavior: Flickable.StopAtBounds

        Column {
          id: historyColumn
          width: historyView.width
          spacing: Style.space(10)

          Text {
            visible: historyModel.count === 0
            width: parent.width
            topPadding: Style.space(48)
            text: "No recent notifications"
            color: root.dim
            font.family: root.fontFamily
            font.pixelSize: Style.font.body
            horizontalAlignment: Text.AlignHCenter
          }

          Repeater {
            model: historyModel

            Rectangle {
              required property string app
              required property string summary
              required property string body
              required property double timestamp

              width: historyColumn.width
              height: notificationContent.implicitHeight + Style.space(24)
              radius: Style.cornerRadius
              color: Color.notifications.background
              border.width: 1
              border.color: Util.alpha(Color.notifications.border, 0.45)

              Column {
                id: notificationContent
                anchors.top: parent.top
                anchors.left: parent.left
                anchors.right: parent.right
                anchors.margins: Style.space(12)
                spacing: Style.space(4)

                Row {
                  width: parent.width

                  Text {
                    width: parent.width - timeLabel.implicitWidth - Style.space(8)
                    text: app
                    color: root.dim
                    font.family: root.fontFamily
                    font.pixelSize: Style.font.caption
                    elide: Text.ElideRight
                  }

                  Text {
                    id: timeLabel
                    text: root.formatTimestamp(timestamp)
                    color: root.dim
                    font.family: root.fontFamily
                    font.pixelSize: Style.font.caption
                  }
                }

                Text {
                  width: parent.width
                  text: summary
                  color: root.foreground
                  font.family: "Liberation Sans"
                  font.pixelSize: Style.font.body
                  font.bold: true
                  wrapMode: Text.WordWrap
                  maximumLineCount: 2
                  elide: Text.ElideRight
                }

                Text {
                  visible: body !== ""
                  width: parent.width
                  text: body
                  textFormat: Text.StyledText
                  color: root.dim
                  font.family: "Liberation Sans"
                  font.pixelSize: Style.font.bodySmall
                  wrapMode: Text.WordWrap
                  maximumLineCount: 2
                  elide: Text.ElideRight
                }
              }
            }
          }
        }
      }

      Item {
        id: footer
        height: Style.space(36)
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        anchors.margins: Style.space(20)

        Text {
          anchors.left: parent.left
          anchors.verticalCenter: parent.verticalCenter
          text: historyModel.count + (historyModel.count === 1 ? " notification" : " notifications")
          color: root.dim
          font.family: root.fontFamily
          font.pixelSize: Style.font.caption
        }

        Rectangle {
          width: clearLabel.implicitWidth + Style.space(24)
          height: parent.height
          anchors.right: parent.right
          radius: Style.cornerRadius
          color: clearArea.containsMouse && historyModel.count > 0
            ? Color.menu.selectedBackground
            : "transparent"
          opacity: historyModel.count > 0 ? 1 : 0.45

          Text {
            id: clearLabel
            anchors.centerIn: parent
            text: "Clear all"
            color: root.foreground
            font.family: root.fontFamily
            font.pixelSize: Style.font.bodySmall
          }

          MouseArea {
            id: clearArea
            anchors.fill: parent
            enabled: historyModel.count > 0
            hoverEnabled: true
            cursorShape: enabled ? Qt.PointingHandCursor : Qt.ArrowCursor
            onClicked: root.clearHistory()
          }
        }
      }
    }
  }
}
