import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui
import "Model.js" as Model

Panel {
  id: root
  moduleName: "jfranciscosousa.system-usage"
  ipcTarget: "jfranciscosousa.system-usage"
  manageIpc: false

  readonly property color foreground: bar ? bar.foreground : Color.foreground
  readonly property color urgent: bar ? bar.urgent : Color.urgent
  readonly property color dim: Qt.darker(foreground, 1.5)
  readonly property string fontFamily: bar ? bar.fontFamily : Style.font.family

  property bool loaded: false
  property real cpuUsage: 0
  property real memoryUsed: 0
  property real memoryTotal: 0
  property real memoryUsage: 0
  property real diskUsed: 0
  property real diskTotal: 0
  property real diskUsage: 0
  property bool gpuAvailable: false
  property real gpuUsage: 0
  property real gpuMemoryUsedMiB: 0
  property real gpuMemoryTotalMiB: 0
  property real gpuTemperature: 0
  property string gpuName: ""
  property real downloadRate: 0
  property real uploadRate: 0
  property int interfaceCount: 0

  property real previousCpuIdle: 0
  property real previousCpuTotal: 0
  property real previousRxBytes: 0
  property real previousTxBytes: 0
  property real previousSampleMs: 0

  readonly property real gpuMemoryUsage: Model.gpuMemoryPercent(gpuMemoryUsedMiB, gpuMemoryTotalMiB)
  readonly property real peakUsage: Math.max(cpuUsage, memoryUsage, diskUsage, gpuAvailable ? gpuUsage : 0)
  readonly property color iconColor: peakUsage >= 90 ? urgent : foreground
  readonly property string tooltip: loaded
    ? "CPU " + Model.formatPercent(cpuUsage) + " · RAM " + Model.formatPercent(memoryUsage)
    : "System usage"

  function refresh() {
    if (!statsProc.running) statsProc.running = true
  }

  function openDetails() {
    root.close()
    if (root.bar) root.bar.run("omarchy launch tui --app-id=TUI.system-usage btop")
  }

  function updateStats(raw) {
    var snapshot = Model.parseSnapshot(raw)
    var now = Date.now()
    var elapsed = previousSampleMs > 0 ? (now - previousSampleMs) / 1000 : 0

    cpuUsage = Model.cpuPercent(previousCpuIdle, previousCpuTotal, snapshot.cpuIdle, snapshot.cpuTotal)
    downloadRate = Model.rate(previousRxBytes, snapshot.rxBytes, elapsed)
    uploadRate = Model.rate(previousTxBytes, snapshot.txBytes, elapsed)

    previousCpuIdle = snapshot.cpuIdle
    previousCpuTotal = snapshot.cpuTotal
    previousRxBytes = snapshot.rxBytes
    previousTxBytes = snapshot.txBytes
    previousSampleMs = now

    memoryUsed = snapshot.memoryUsed
    memoryTotal = snapshot.memoryTotal
    memoryUsage = snapshot.memoryPercent
    diskUsed = snapshot.diskUsed
    diskTotal = snapshot.diskTotal
    diskUsage = snapshot.diskPercent
    gpuAvailable = snapshot.gpuAvailable
    gpuUsage = snapshot.gpuPercent
    gpuMemoryUsedMiB = snapshot.gpuMemoryUsedMiB
    gpuMemoryTotalMiB = snapshot.gpuMemoryTotalMiB
    gpuTemperature = snapshot.gpuTemperature
    gpuName = snapshot.gpuName
    interfaceCount = snapshot.interfaceCount
    loaded = true
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  onOpenedChanged: if (opened) refresh()

  Process {
    id: statsProc
    command: [Quickshell.env("HOME") + "/.config/omarchy/plugins/jfranciscosousa.system-usage/stats.sh"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.updateStats(text)
    }
  }

  Timer {
    interval: 2000
    running: true
    repeat: true
    triggeredOnStart: true
    onTriggered: root.refresh()
  }

  IpcHandler {
    target: root.ipcTarget
    function open(): void { root.open() }
    function close(): void { root.close() }
    function show(): void { root.open() }
    function hide(): void { root.close() }
    function toggle(): void { root.toggle() }
    function refresh(): string { root.refresh(); return "ok" }
  }

  BarIconButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: "󰍛"
    foreground: root.iconColor
    tooltipText: root.tooltip
    onPressed: function(buttonCode) {
      if (buttonCode === Qt.MiddleButton) root.refresh()
      else root.toggle()
    }
  }

  KeyboardPanel {
    id: panel
    anchorItem: button
    owner: root
    bar: root.bar
    open: root.opened
    focusTarget: keyCatcher
    contentWidth: panel.fittedContentWidth(Style.space(420))
    contentHeight: panel.fittedContentHeight(content.implicitHeight)

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      onReturnRequested: root.openDetails()
      onCloseRequested: root.close()
      onTabRequested: function(direction) { root.switchPanel(direction) }

      Column {
        id: content
        width: parent.width
        spacing: Style.space(14)

        PanelHero {
          width: parent.width
          title: "System usage"
          meta: root.loaded ? "Live performance overview" : "Collecting system data…"
          foreground: root.foreground
          fontFamily: root.fontFamily
          iconComponent: Component {
            Text {
              text: "󰍛"
              color: root.iconColor
              font.family: root.fontFamily
              font.pixelSize: Style.font.display
            }
          }
        }

        PanelSeparator {
          foreground: root.foreground
        }

        Column {
          width: parent.width
          spacing: Style.space(12)

          UsageRow {
            title: "CPU"
            icon: "󰻠"
            value: root.cpuUsage
            detail: Model.formatPercent(root.cpuUsage)
          }

          UsageRow {
            title: "Memory"
            icon: "󰍛"
            value: root.memoryUsage
            detail: Model.formatBytes(root.memoryUsed) + " / " + Model.formatBytes(root.memoryTotal)
          }

          UsageRow {
            title: "Disk"
            icon: "󰋊"
            value: root.diskUsage
            detail: Model.formatBytes(root.diskUsed) + " / " + Model.formatBytes(root.diskTotal)
          }

          UsageRow {
            visible: root.gpuAvailable
            title: "GPU"
            icon: "󰢮"
            value: root.gpuUsage
            detail: Model.formatPercent(root.gpuUsage) + " · " + Math.round(root.gpuTemperature) + "°C"
            subtitle: root.gpuName
          }

          UsageRow {
            visible: root.gpuAvailable
            title: "GPU memory"
            icon: "󰘚"
            value: root.gpuMemoryUsage
            detail: Model.formatBytes(root.gpuMemoryUsedMiB * 1024 * 1024) + " / " + Model.formatBytes(root.gpuMemoryTotalMiB * 1024 * 1024)
          }
        }

        PanelSeparator {
          foreground: root.foreground
        }

        Column {
          width: parent.width
          spacing: Style.space(10)

          PanelSectionHeader {
            text: "NETWORK"
            foreground: root.foreground
            fontFamily: root.fontFamily
          }

          Row {
            width: parent.width
            spacing: Style.space(12)

            NetworkMetric {
              width: (parent.width - parent.spacing) / 2
              icon: "󰇚"
              label: "Receiving"
              value: Model.formatRate(root.downloadRate)
            }

            NetworkMetric {
              width: (parent.width - parent.spacing) / 2
              icon: "󰕒"
              label: "Sending"
              value: Model.formatRate(root.uploadRate)
            }
          }
        }

        PanelSeparator {
          foreground: root.foreground
        }

        Button {
          width: parent.width
          iconText: "󰆍"
          text: "View details"
          foreground: root.foreground
          fontFamily: root.fontFamily
          bordered: true
          onClicked: root.openDetails()
        }
      }
    }
  }

  component UsageRow: Column {
    property string title: ""
    property string subtitle: ""
    property string icon: ""
    property real value: 0
    property string detail: ""

    width: parent.width
    spacing: Style.space(5)

    Row {
      width: parent.width
      spacing: Style.space(8)

      Text {
        text: icon
        color: value >= 90 ? root.urgent : root.dim
        font.family: root.fontFamily
        font.pixelSize: Style.font.body
        width: Style.space(20)
        horizontalAlignment: Text.AlignHCenter
      }

      Column {
        width: parent.width - Style.space(36) - detailText.implicitWidth
        spacing: Style.space(1)

        Text {
          width: parent.width
          text: title
          color: root.foreground
          font.family: root.fontFamily
          font.pixelSize: Style.font.body
          font.bold: true
          elide: Text.ElideRight
        }

        Text {
          visible: subtitle !== ""
          width: parent.width
          text: subtitle
          color: root.dim
          font.family: root.fontFamily
          font.pixelSize: Style.font.caption
          elide: Text.ElideRight
        }
      }

      Text {
        id: detailText
        text: detail
        color: value >= 90 ? root.urgent : root.foreground
        font.family: root.fontFamily
        font.pixelSize: Style.font.bodySmall
        anchors.verticalCenter: parent.verticalCenter
      }
    }

    Rectangle {
      width: parent.width
      height: Style.space(5)
      radius: height / 2
      color: Qt.rgba(root.foreground.r, root.foreground.g, root.foreground.b, 0.12)

      Rectangle {
        width: Math.max(parent.height, parent.width * Model.clampPercent(value) / 100)
        height: parent.height
        radius: parent.radius
        color: value >= 90 ? root.urgent : root.foreground

        Behavior on width { NumberAnimation { duration: 300; easing.type: Easing.OutCubic } }
        Behavior on color { ColorAnimation { duration: 200 } }
      }
    }
  }

  component NetworkMetric: Rectangle {
    property string icon: ""
    property string label: ""
    property string value: ""

    height: metricContent.implicitHeight + Style.space(18)
    radius: Style.cornerRadius
    color: Qt.rgba(root.foreground.r, root.foreground.g, root.foreground.b, 0.06)

    Row {
      id: metricContent
      anchors.left: parent.left
      anchors.right: parent.right
      anchors.verticalCenter: parent.verticalCenter
      anchors.leftMargin: Style.space(12)
      anchors.rightMargin: Style.space(12)
      spacing: Style.space(10)

      Text {
        text: icon
        color: root.dim
        font.family: root.fontFamily
        font.pixelSize: Style.font.heading
        anchors.verticalCenter: parent.verticalCenter
      }

      Column {
        width: parent.width - parent.children[0].implicitWidth - parent.spacing
        spacing: Style.space(1)

        Text {
          text: label
          color: root.dim
          font.family: root.fontFamily
          font.pixelSize: Style.font.caption
        }

        Text {
          text: value
          color: root.foreground
          font.family: root.fontFamily
          font.pixelSize: Style.font.title
          font.bold: true
        }
      }
    }
  }
}
