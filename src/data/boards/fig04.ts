import type { BoardSpec } from "../../types/simulator";

export const fig04: BoardSpec = {
    id: 4,
    name: "ESP32-S3 DevKit",
    subtitle: "WiFi + two cores",
    boardStyle: "devkit-narrow",
    description: [
      { text: "The " },
      { text: "ESP32-S3-DevKitC-1", bold: true },
      { text: ": a matte-black narrow PCB with the castellated " },
      { text: "WROOM-1 module", bold: true },
      {
        text: " (silver RF shield + meander antenna), CP2102N USB bridge, AMS1117-3.3 LDO, dual USB (UART bridge + native OTG), BOOT/RST buttons, an addressable WS2812 RGB LED and twin 22-pin headers.",
      },
    ],
    code: `// ESP32-S3: Wi-Fi RSSI + core heartbeat
void setup() {
  Serial.begin(115200);
  pinMode(2, OUTPUT);
}

void loop() {
  digitalWrite(2, HIGH);
  Serial.println("core 0 alive — RSSI -52 dBm");
  delay(400);
  digitalWrite(2, LOW);
  delay(400);
}`,
    parts: [
      {
        id: "usb1",
        name: "USB port (UART bridge)",
        kind: "usbc",
        smd: true,
        p: [-2.75, 0.35],
        label: "UART",
        onRemoveEffect: {
          severity: "halt",
          message:
            "NO SERIAL / NO POWER: the CP2102N sits behind this connector. Without it there is no 5 V feed into the AMS1117-3.3 LDO and no USB-UART bridge — the board is completely dark and shows up nowhere on your machine.",
        },
      },
      {
        id: "usb2",
        name: "USB port (native OTG)",
        kind: "usbc",
        smd: true,
        p: [-2.75, -0.35],
        label: "OTG",
        onRemoveEffect: {
          severity: "degraded",
          message:
            "NATIVE USB LOST: the second port wires straight to the ESP32-S3's USB-OTG peripheral. Serial-over-TinyUSB, HID and mass-flash are gone — the UART bridge port still works, but the S3's native USB features are unreachable.",
        },
      },
      {
        id: "cp2102",
        name: "CP2102N bridge",
        kind: "qfp",
        smd: true,
        p: [-1.3, 0.35],
        label: "USB-UART",
        onRemoveEffect: {
          severity: "halt",
          message:
            "UART SERIAL DROPPED: the USB-UART bridge that turns the connector's D+/D− into the ESP32's TX/RX pair is gone. Your PC enumerates an empty port and flashing plus the serial monitor are both impossible — the chip itself keeps running fine.",
        },
      },
      {
        id: "ams",
        name: "AMS1117-3.3 LDO",
        kind: "reg",
        smd: true,
        p: [-1.3, -0.5],
        label: "3.3V",
        onRemoveEffect: {
          severity: "halt",
          message:
            "3.3V RAIL CUT: the ESP32-S3 runs exclusively at 3.3 V and the AMS1117 is the only thing making it from the 5 V USB entry. Feed the module 5 V unregulated and the radio's flash dies silently — that's why this little SOT-223 exists.",
        },
      },
      {
        id: "rst",
        name: "RST button",
        kind: "btn",
        smd: false,
        p: [-1.95, 0.55],
        label: "RST",
        onRemoveEffect: {
          severity: "degraded",
          message:
            "NO HARD RESET: with the RST button gone you cannot bounce the chip out of a hung sketch — only full power cycles. Annoying rather than fatal, and a rite of passage on every devkit.",
        },
      },
      {
        id: "boot",
        name: "BOOT button",
        kind: "btn",
        smd: false,
        p: [-1.95, -0.55],
        label: "BOOT",
        onRemoveEffect: {
          severity: "degraded",
          message:
            "DOWNLOAD MODE UNREACHABLE: strapping GPIO0 low at reset is what puts the ROM bootloader in flash mode. Without the button you can't re-flash if your sketch ever crashes before USB starts.",
        },
      },
      {
        id: "ledpwr",
        name: "PWR LED",
        kind: "led",
        smd: true,
        p: [-0.55, 0.6],
        color: "#ff5030",
        label: "PWR",
        onRemoveEffect: {
          severity: "degraded",
          message:
            "NO POWER INDICATOR: the red LED hangs off the 3.3 V rail and is the quickest health check on the board. Its absence changes nothing electrically — you just lose the at-a-glance 'is it alive' signal.",
        },
      },
      {
        id: "rgb",
        name: "WS2812 RGB LED",
        kind: "ws2812",
        smd: true,
        p: [0.1, -0.55],
        label: "RGB",
        onRemoveEffect: {
          severity: "degraded",
          message:
            "ADDRESSABLE LED GONE: the WS2812 daisy-chains colour data on a single wire from GPIO48. With it lifted, drive-code runs harmlessly into an open pad — the board works, but every RGB demo falls flat.",
        },
      },
      {
        id: "esp32",
        name: "ESP32-S3-WROOM-1 module",
        kind: "esp32",
        smd: false,
        p: [1.95, 0],
        label: "WROOM-1",
        onRemoveEffect: {
          severity: "halt",
          message:
            "BRAIN REMOVED: the castellated WROOM-1 at the antenna end carries the dual-core 240 MHz Xtensa LX7 die, 8 MB flash/PSRAM and the 2.4 GHz radio behind its silver shield. Every other part on this PCB exists to serve it.",
        },
      },
      {
        id: "hdrL",
        name: "Left 22-pin header",
        kind: "hdr",
        smd: false,
        p: [-0.1, 1.0],
        n: 22,
        rot: 0,
        label: "3V3 side",
        onRemoveEffect: {
          severity: "degraded",
          message:
            "TOP RAIL GONE: 22 castellated pads carrying 3V3, EN and the left GPIO bank have vanished with the header. Sensors and shields wired to that row now connect to nothing.",
        },
      },
      {
        id: "hdrR",
        name: "Right 22-pin header",
        kind: "hdr",
        smd: false,
        p: [-0.1, -1.0],
        n: 22,
        rot: 0,
        label: "GND side",
        onRemoveEffect: {
          severity: "degraded",
          message:
            "BOTTOM RAIL GONE: the right GPIO bank plus the GND row are lifted. Any peripheral grounded through this header loses its return path and drops off the bus.",
        },
      },
      {
        id: "c1",
        name: "10µF bulk cap",
        kind: "cap",
        smd: true,
        p: [-0.8, -0.5],
        value: "10µF",
        label: "C1",
        onRemoveEffect: {
          severity: "halt",
          message:
            "WI-FI TX BROWNOUT RESET: the S3 radio draws ~500 mA bursts every 100 ms as it transmits. C1 is the local tank that flattens those pulses — the AMS1117 alone has too much impedance to respond, so the 3V3 rail sags below the 2.8 V brownout threshold on the first TX burst and the chip resets in a loop; Wi-Fi never comes up.",
        },
      },
    ],
    faultRule: {
      id: "brownout",
      label: "Brown-out",
      cause:
        "The 3V3 regulator sags when the radio transmits at full power without its decoupling cap.",
      effect: "The chip resets in a loop; Wi-Fi never comes up.",
      errorMessage: "Brown-out detected — 3V3 rail sagged below 2.8 V.",
      criticalPart: "esp32",
      criticalParts: ["c1"],
    },
  };
