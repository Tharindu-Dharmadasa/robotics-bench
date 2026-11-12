// ─────────────────────────────────────────────────────────────────────────────
// Board data: 13 boards. To add one, append an object to BOARDS: no other file changes.
// Each board = parts (what you can place) + rules (what happens when powered).
// "Mistake" parts (isMistake) are wrong wires the user adds ON PURPOSE to break things.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  BoardDefinition,
  Condition,
  FaultRule,
  PartDefinition,
  PartKind,
} from "./types";

/** Default size [width, depth, height] and colour for each kind of part. Any of these can be overridden per part. */
const KIND_DEFAULTS: Record<
  PartKind,
  { size: [number, number, number]; color: string }
> = {
  resistor: { size: [44, 12, 9], color: "#d9b36c" },
  led: { size: [20, 20, 16], color: "#e04a3f" },
  chip: { size: [44, 24, 8], color: "#222222" },
  capacitor: { size: [18, 18, 22], color: "#2b4a9a" },
  header: { size: [48, 10, 8], color: "#222222" },
  terminal: { size: [40, 22, 16], color: "#2f8f4f" },
  heatsink: { size: [50, 36, 22], color: "#b8bcc4" },
  relay: { size: [44, 36, 30], color: "#2b6cb0" },
  motor: { size: [34, 34, 34], color: "#9aa0a8" },
  connector: { size: [40, 36, 22], color: "#b0b4bc" },
  eye: { size: [30, 30, 18], color: "#c8ccd2" },
  block: { size: [30, 20, 12], color: "#888888" },
};

/** Describes a part. Arguments: kind, id, name, description, [x, y], then optional overrides. */
const part = (
  kind: PartKind,
  id: string,
  name: string,
  description: string,
  [x, y]: [number, number],
  overrides: Partial<PartDefinition> = {},
): PartDefinition => {
  const {
    size: [width, depth, height],
    color,
  } = KIND_DEFAULTS[kind];
  return {
    id,
    name,
    description,
    kind,
    x,
    y,
    width,
    depth,
    height,
    color,
    ...overrides,
  };
};

/** Describes a rule. `effects` lets a rule light, blink or burn parts. */
const rule = (
  condition: Condition,
  status: FaultRule["status"],
  message: string,
  currentMilliamps = 0,
  effects: Partial<
    Pick<FaultRule, "litPartIds" | "blinkingPartIds" | "burnedPartIds">
  > = {},
): FaultRule => ({
  condition,
  status,
  message,
  currentMilliamps,
  litPartIds: [],
  blinkingPartIds: [],
  burnedPartIds: [],
  ...effects,
});

const present = (id: string): Condition => ({ partPresent: id });
const missing = (id: string): Condition => ({ partMissing: id });
const ALWAYS: Condition = { allOf: [] }; // empty "all of" is always true: the final "everything is fine" rule

// Resistor colour codes
const BAND = {
  black: "#1a1a1a",
  brown: "#7a4a1e",
  red: "#c62828",
  orange: "#e07a1f",
  yellow: "#e6c619",
  violet: "#7b3fa0",
};
const OHMS_330 = [BAND.orange, BAND.orange, BAND.brown],
  KILOHM_1 = [BAND.brown, BAND.black, BAND.red],
  KILOHM_4_7 = [BAND.yellow, BAND.violet, BAND.red];
// Reusable looks
const RED_LED = { color: "#e04a3f", glowColor: "#ff5a4a" },
  GREEN_LED = { color: "#3fae66", glowColor: "#7dff9e" };
const BLUE_LED = { color: "#3a7bd5", glowColor: "#7ab8ff" },
  AMBER_LED = { color: "#f0a020", glowColor: "#ffc04a" };
const DARK = "#2b2b2b",
  RED_WIRE = {
    color: "#e03a2f",
    width: 36,
    depth: 8,
    height: 6,
    isMistake: true,
  };

export const BOARDS: BoardDefinition[] = [
  // ── 01 ─ the simplest circuit ──────────────────────────────────────────────
  {
    id: "led",
    currentPaths: [["power", "resistor", "led"]],
    figureLabel: "Fig. 01",
    name: "LED + resistor",
    pcbColor: "#2f6b4f",
    lessonText:
      "A power source, a current limiter and a light. The resistor decides how much current the LED sees.",
    tryToBreakText:
      "Power it without the resistor, then replace the burnt LED and try again.",
    parts: [
      part("header", "power", "5 V header", "brings power in", [20, 60], {
        width: 30,
        pinCount: 2,
      }),
      part(
        "resistor",
        "resistor",
        "330 Ω resistor",
        "limits current",
        [105, 28],
        { bands: OHMS_330 },
      ),
      part("led", "led", "Red LED", "the light (the load)", [170, 84], RED_LED),
    ],
    rules: [
      rule(
        missing("power"),
        "DEAD",
        "No 5 V source on the board, so nothing is powered.",
      ),
      rule(
        missing("led"),
        "IDLE",
        "The circuit is open: there is no LED to carry current.",
      ),
      rule(
        missing("resistor"),
        "FAULT",
        "No current limiter! About 600 mA hit the LED and it burned out.",
        600,
        { burnedPartIds: ["led"] },
      ),
      rule(
        ALWAYS,
        "RUNNING",
        "LED lit. The resistor limits current to about 14 mA.",
        14,
        { litPartIds: ["led"] },
      ),
    ],
  },

  // ── 02 ─ a transistor as an electronic switch ──────────────────────────────
  {
    id: "transistor",
    currentPaths: [
      ["power", "baseResistor", "transistor"],
      ["power", "ledResistor", "led", "transistor"],
    ],
    figureLabel: "Fig. 02",
    name: "Transistor switch",
    pcbColor: "#2f6b4f",
    inputs: [{ id: "signal", label: "Signal" }],
    lessonText:
      "A tiny base current lets a transistor switch a bigger load current, the way a microcontroller pin drives bigger loads.",
    tryToBreakText:
      "Set the signal HIGH with no base resistor, or remove the LED resistor.",
    parts: [
      part("header", "power", "5 V header", "brings power in", [14, 10], {
        width: 30,
        pinCount: 2,
      }),
      part(
        "resistor",
        "baseResistor",
        "1 kΩ base resistor",
        "protects the transistor base",
        [70, 30],
        { bands: KILOHM_1 },
      ),
      part("block", "transistor", "2N2222 NPN", "the switch", [130, 22], {
        width: 16,
        depth: 14,
        height: 12,
        color: DARK,
      }),
      part(
        "resistor",
        "ledResistor",
        "330 Ω resistor",
        "limits LED current",
        [75, 80],
        { bands: OHMS_330 },
      ),
      part(
        "led",
        "led",
        "Green LED",
        "the light (the load)",
        [170, 90],
        GREEN_LED,
      ),
    ],
    rules: [
      rule(missing("power"), "DEAD", "No 5 V source on the board."),
      rule(
        missing("transistor"),
        "IDLE",
        "No transistor, so nothing can switch the LED.",
      ),
      rule(
        { not: { inputIsOn: "signal" } },
        "IDLE",
        "Signal is LOW: the transistor is off. Set the signal HIGH.",
        1,
      ),
      rule(
        missing("baseResistor"),
        "FAULT",
        "No base resistor: the base was over-driven and the transistor died.",
        300,
        { burnedPartIds: ["transistor"] },
      ),
      rule(
        missing("led"),
        "IDLE",
        "Open load: there is no LED in the path.",
        2,
      ),
      rule(
        missing("ledResistor"),
        "FAULT",
        "No series resistor on the LED, so it burned out.",
        500,
        { burnedPartIds: ["led"] },
      ),
      rule(
        ALWAYS,
        "RUNNING",
        "About 4 mA of base current switches about 16 mA through the LED.",
        20,
        { litPartIds: ["led"] },
      ),
    ],
  },

  // ── 03 ─ Arduino Uno ───────────────────────────────────────────────────────
  {
    id: "uno",
    currentPaths: [
      ["usbPort", "regulator", "microcontroller", "pin13Resistor", "pin13Led"],
      ["crystal", "microcontroller"],
      ["regulator", "decouplingCap"],
    ],
    figureLabel: "Fig. 03",
    name: "Arduino Uno R3",
    pcbColor: "#2b5aa8",
    lessonText:
      "An ATmega328P needs power, a clean 5 V rail and a 16 MHz clock before it runs your sketch. Pin 13 drives an LED.",
    tryToBreakText:
      "Remove the crystal or the regulator, then power up. Try the LED without its resistor.",
    parts: [
      part(
        "connector",
        "usbPort",
        "USB-B connector",
        "power and serial",
        [8, 10],
        { width: 34, depth: 40, height: 22 },
      ),
      part(
        "block",
        "regulator",
        "5 V regulator",
        "makes a clean 5 V rail",
        [70, 12],
        { width: 26, depth: 22, height: 14, color: DARK },
      ),
      part("block", "crystal", "16 MHz crystal", "the clock", [75, 60], {
        width: 34,
        depth: 12,
        height: 10,
        color: "#c0c0c8",
      }),
      part("chip", "microcontroller", "ATmega328P", "the brain", [130, 40], {
        width: 70,
        depth: 28,
        height: 12,
        pinCount: 14,
      }),
      part(
        "capacitor",
        "decouplingCap",
        "100 nF capacitor",
        "filters supply noise",
        [70, 105],
        { width: 14, depth: 14, height: 12, color: "#d6a228" },
      ),
      part(
        "resistor",
        "pin13Resistor",
        "Pin 13 resistor",
        "limits LED current",
        [130, 100],
        { width: 36, bands: KILOHM_1 },
      ),
      part(
        "led",
        "pin13Led",
        "Pin 13 LED",
        "blink output",
        [185, 100],
        AMBER_LED,
      ),
    ],
    rules: [
      rule(missing("usbPort"), "DEAD", "No USB power."),
      rule(
        missing("regulator"),
        "DEAD",
        "No 5 V regulator, so there is no stable supply rail.",
      ),
      rule(
        missing("microcontroller"),
        "IDLE",
        "Power is fine but there is no ATmega328P to run code.",
        5,
      ),
      rule(
        missing("crystal"),
        "FAULT",
        "No 16 MHz crystal: the chip never starts executing.",
        22,
      ),
      rule(
        { allOf: [present("pin13Led"), missing("pin13Resistor")] },
        "FAULT",
        "Pin 13 drove the LED with no resistor. The LED burned out.",
        90,
        { burnedPartIds: ["pin13Led"] },
      ),
      rule(
        { anyOf: [missing("pin13Led"), missing("pin13Resistor")] },
        "RUNNING",
        "Code runs, but pin 13 shows nothing. Add its resistor and LED.",
        45,
      ),
      rule(
        missing("decouplingCap"),
        "RUNNING",
        "Blinks, but with no decoupling cap the supply is noisy and may reset.",
        48,
        { blinkingPartIds: ["pin13Led"] },
      ),
      rule(
        ALWAYS,
        "RUNNING",
        "Blink sketch running: pin 13 toggles once a second.",
        45,
        { blinkingPartIds: ["pin13Led"] },
      ),
    ],
  },

  // ── 04 ─ ESP32-S3 DevKit ───────────────────────────────────────────────────
  {
    id: "esp32",
    currentPaths: [
      ["usbPort", "regulator", "espModule", "statusLed"],
      ["regulator", "decouplingCap"],
    ],
    figureLabel: "Fig. 04",
    name: "ESP32-S3 DevKit",
    pcbColor: "#1f3a2e",
    lessonText:
      "Two cores, Wi-Fi and Bluetooth, but every GPIO pin is 3.3 V only. A 3.3 V regulator feeds the chip from USB.",
    tryToBreakText:
      "Solder the 5 V jumper onto a GPIO pin. Or remove the decoupling capacitor and watch it reboot.",
    parts: [
      part(
        "connector",
        "usbPort",
        "USB-C connector",
        "power and programming",
        [8, 56],
        { width: 26, depth: 30, height: 10 },
      ),
      part(
        "block",
        "regulator",
        "3.3 V regulator",
        "powers the chip",
        [52, 14],
        { width: 20, depth: 16, height: 10, color: DARK },
      ),
      part(
        "capacitor",
        "decouplingCap",
        "10 µF capacitor",
        "smooths Wi-Fi current bursts",
        [52, 56],
        { width: 14, depth: 14, height: 14 },
      ),
      part(
        "block",
        "espModule",
        "ESP32-S3 module",
        "the brain, with Wi-Fi",
        [100, 34],
        { width: 76, depth: 62, height: 8, color: "#b9bec6" },
      ),
      part(
        "led",
        "statusLed",
        "Status LED",
        "shows Wi-Fi activity",
        [190, 20],
        BLUE_LED,
      ),
      part(
        "block",
        "wire5v",
        "5 V jumper to GPIO 4",
        "MISTAKE: 5 V into a 3.3 V pin",
        [186, 100],
        { ...RED_WIRE, width: 30 },
      ),
    ],
    rules: [
      rule(missing("usbPort"), "DEAD", "No USB-C power."),
      rule(
        missing("regulator"),
        "DEAD",
        "No 3.3 V regulator: nothing powers the chip.",
      ),
      rule(
        present("wire5v"),
        "FAULT",
        "A 5 V signal on a 3.3 V GPIO pin fried the ESP32-S3.",
        350,
        { burnedPartIds: ["espModule"] },
      ),
      rule(
        missing("espModule"),
        "IDLE",
        "Power is fine but the ESP32-S3 module is missing.",
        8,
      ),
      rule(
        missing("decouplingCap"),
        "RUNNING",
        "Boots, but Wi-Fi bursts sag the supply and it reboots at random.",
        130,
        { blinkingPartIds: ["statusLed"] },
      ),
      rule(
        ALWAYS,
        "RUNNING",
        "Dual-core firmware running; the status LED blinks while Wi-Fi connects.",
        90,
        { blinkingPartIds: ["statusLed"] },
      ),
    ],
  },

  // ── 05 ─ TB6612FNG motor driver ────────────────────────────────────────────
  {
    id: "tb6612",
    currentPaths: [
      ["motorPower", "driverChip", "motor"],
      ["motorPower", "bulkCap"],
      ["standbyJumper", "driverChip"],
    ],
    figureLabel: "Fig. 05",
    name: "TB6612FNG driver",
    pcbColor: "#b3262e",
    lessonText:
      "A dual H-bridge: it reverses and speeds a DC motor using direction pins and PWM. STBY must be HIGH or the chip sleeps.",
    tryToBreakText: "Remove the STBY jumper, or add the reversed supply leads.",
    parts: [
      part(
        "terminal",
        "motorPower",
        "VM supply terminal",
        "motor power in",
        [10, 20],
      ),
      part(
        "chip",
        "driverChip",
        "TB6612FNG",
        "dual H-bridge driver",
        [80, 50],
        { width: 50, depth: 26 },
      ),
      part(
        "capacitor",
        "bulkCap",
        "100 µF capacitor",
        "absorbs motor spikes",
        [30, 90],
      ),
      part(
        "block",
        "standbyJumper",
        "STBY jumper",
        "wakes the driver",
        [80, 100],
        { width: 24, depth: 8, height: 6, color: DARK },
      ),
      part("motor", "motor", "DC motor", "the load", [180, 70]),
      part(
        "block",
        "reversedLeads",
        "Reversed VM leads",
        "MISTAKE: + and − swapped",
        [10, 56],
        RED_WIRE,
      ),
    ],
    rules: [
      rule(missing("motorPower"), "DEAD", "No motor supply (VM)."),
      rule(
        present("reversedLeads"),
        "FAULT",
        "Reversed supply polarity pushed current backwards through the driver.",
        300,
        { burnedPartIds: ["driverChip"] },
      ),
      rule(missing("driverChip"), "IDLE", "No TB6612FNG on the board."),
      rule(
        missing("standbyJumper"),
        "IDLE",
        "STBY is low, so the driver sleeps and the motor stays still.",
        2,
      ),
      rule(
        missing("motor"),
        "IDLE",
        "No motor connected: nothing to drive.",
        5,
      ),
      rule(
        missing("bulkCap"),
        "RUNNING",
        "Spins, but motor spikes ripple the supply and may reset your controller.",
        420,
        { litPartIds: ["motor"] },
      ),
      rule(
        ALWAYS,
        "RUNNING",
        "The H-bridge drives the motor; PWM sets its speed.",
        380,
        { litPartIds: ["motor"] },
      ),
    ],
  },

  // ── 06 ─ L298N motor driver ────────────────────────────────────────────────
  {
    id: "l298n",
    currentPaths: [
      ["powerTerminal", "l298nChip", "motor"],
      ["powerTerminal", "regulator"],
      ["l298nChip", "flybackDiodes"],
    ],
    figureLabel: "Fig. 06",
    name: "L298N driver",
    pcbColor: "#a82424",
    lessonText:
      "An old bipolar H-bridge. It wastes about 2 V per channel as heat, so it needs a heatsink, and flyback diodes to tame motor kickback.",
    tryToBreakText:
      "Skip the heatsink or the flyback diodes. Then try the 24 V supply mistake.",
    parts: [
      part(
        "terminal",
        "powerTerminal",
        "12 V power terminal",
        "motor supply in",
        [8, 20],
        { pinCount: 3 },
      ),
      part("chip", "l298nChip", "L298N", "dual H-bridge", [90, 28], {
        width: 40,
        depth: 20,
        height: 16,
        pinCount: 5,
      }),
      part("heatsink", "heatsink", "Heatsink", "removes waste heat", [90, 58]),
      part(
        "block",
        "flybackDiodes",
        "Flyback diodes",
        "catch motor kickback",
        [150, 28],
        { width: 44, depth: 12, height: 6, color: DARK },
      ),
      part(
        "block",
        "regulator",
        "78M05 regulator",
        "makes 5 V for logic",
        [28, 70],
        { width: 20, depth: 16, height: 14, color: DARK },
      ),
      part("motor", "motor", "DC motor", "the load", [180, 85]),
      part(
        "block",
        "surgeSupply",
        "24 V supply leads",
        "MISTAKE: board is rated 12 V",
        [8, 106],
        RED_WIRE,
      ),
    ],
    rules: [
      rule(missing("powerTerminal"), "DEAD", "No motor power."),
      rule(
        present("surgeSupply"),
        "FAULT",
        "24 V overloaded the 78M05 regulator and it cooked.",
        150,
        { burnedPartIds: ["regulator"] },
      ),
      rule(missing("l298nChip"), "IDLE", "No L298N on the board."),
      rule(
        missing("flybackDiodes"),
        "FAULT",
        "Motor kickback spikes killed the L298N with no flyback diodes.",
        250,
        { burnedPartIds: ["l298nChip"] },
      ),
      rule(
        missing("heatsink"),
        "FAULT",
        "No heatsink: the L298N overheated and failed.",
        600,
        { burnedPartIds: ["l298nChip"] },
      ),
      rule(missing("motor"), "IDLE", "No motor connected.", 8),
      rule(
        missing("regulator"),
        "RUNNING",
        "Motor spins, but the board’s 5 V output for your controller is dead.",
        500,
        { litPartIds: ["motor"] },
      ),
      rule(
        ALWAYS,
        "RUNNING",
        "Motor driven. The heatsink is carrying about 2 V of waste heat per channel.",
        550,
        { litPartIds: ["motor"] },
      ),
    ],
  },

  // ── 07 ─ A4988 stepper driver ──────────────────────────────────────────────
  {
    id: "a4988",
    currentPaths: [
      ["supplyTerminal", "driverChip", "stepper"],
      ["supplyTerminal", "bulkCap"],
      ["microstepHeader", "driverChip"],
    ],
    figureLabel: "Fig. 07",
    name: "A4988 stepper driver",
    pcbColor: "#a82424",
    lessonText:
      "Moves a stepper motor one precise step per pulse. The MS pins pick the step size: finer steps are smoother and quieter.",
    tryToBreakText:
      "Leave out the VMOT capacitor, or unplug the motor while the board is powered.",
    parts: [
      part(
        "terminal",
        "supplyTerminal",
        "VMOT supply terminal",
        "12 V motor power",
        [8, 20],
      ),
      part(
        "capacitor",
        "bulkCap",
        "100 µF capacitor",
        "protects VMOT from spikes",
        [30, 70],
      ),
      part("chip", "driverChip", "A4988", "stepper driver", [90, 30], {
        width: 36,
        depth: 36,
        pinCount: 8,
      }),
      part(
        "header",
        "microstepHeader",
        "MS1–MS3 jumpers",
        "selects microstepping",
        [90, 90],
        { width: 36, pinCount: 3 },
      ),
      part("motor", "stepper", "NEMA 17 stepper", "the load", [170, 50], {
        width: 44,
        depth: 44,
        height: 30,
      }),
    ],
    rules: [
      rule(missing("supplyTerminal"), "DEAD", "No motor supply."),
      rule(missing("driverChip"), "IDLE", "No A4988 on the board."),
      rule(
        missing("bulkCap"),
        "FAULT",
        "No capacitor on VMOT: supply spikes destroyed the A4988.",
        200,
        { burnedPartIds: ["driverChip"] },
      ),
      rule(
        missing("stepper"),
        "FAULT",
        "Motor disconnected while powered: back-EMF destroyed the driver.",
        150,
        { burnedPartIds: ["driverChip"] },
      ),
      rule(
        missing("microstepHeader"),
        "RUNNING",
        "Full-step mode works, but it is loud and jerky.",
        700,
        { litPartIds: ["stepper"] },
      ),
      rule(
        ALWAYS,
        "RUNNING",
        "1/16 microstepping: smooth and quiet motion.",
        650,
        { litPartIds: ["stepper"] },
      ),
    ],
  },

  // ── 08 ─ PCA9685 servo board ───────────────────────────────────────────────
  {
    id: "pca9685",
    currentPaths: [
      ["i2cHeader", "pcaChip", "servoHeader", "servo"],
      ["servoPowerTerminal", "servoHeader"],
      ["i2cHeader", "pullupResistors"],
    ],
    figureLabel: "Fig. 08",
    name: "PCA9685 servo board",
    pcbColor: "#2a5fb0",
    lessonText:
      "Drives 16 servos over two I²C wires. The chip only makes the PWM signals; servos need their own V+ power.",
    tryToBreakText:
      "Remove the pull-up resistors, or the servo power terminal.",
    parts: [
      part(
        "header",
        "i2cHeader",
        "I²C header",
        "SDA / SCL / power from the controller",
        [8, 20],
        { width: 36, pinCount: 4 },
      ),
      part("chip", "pcaChip", "PCA9685", "16-channel PWM chip", [70, 40], {
        width: 50,
        depth: 24,
      }),
      part(
        "resistor",
        "pullupResistors",
        "4.7 kΩ pull-ups",
        "keep I²C lines high",
        [70, 95],
        { bands: KILOHM_4_7 },
      ),
      part(
        "terminal",
        "servoPowerTerminal",
        "V+ servo supply",
        "5 V for the servos",
        [8, 70],
      ),
      part(
        "header",
        "servoHeader",
        "Servo outputs",
        "plug servos here",
        [140, 20],
        { width: 60, pinCount: 12 },
      ),
      part("block", "servo", "SG90 servo", "the load", [150, 70], {
        width: 40,
        depth: 20,
        height: 26,
        color: "#2b6cb0",
        glowColor: "#9fd0ff",
      }),
    ],
    rules: [
      rule(missing("i2cHeader"), "DEAD", "No connection to the controller."),
      rule(missing("pcaChip"), "IDLE", "No PCA9685 on the board."),
      rule(
        missing("pullupResistors"),
        "IDLE",
        "I²C lines float, so the controller cannot find the chip at 0x40.",
        10,
      ),
      rule(
        missing("servoPowerTerminal"),
        "IDLE",
        "The chip answers, but the servos have no V+ supply and cannot move.",
        12,
      ),
      rule(
        { anyOf: [missing("servoHeader"), missing("servo")] },
        "IDLE",
        "No servo plugged into an output channel.",
        12,
      ),
      rule(
        ALWAYS,
        "RUNNING",
        "Channel 0 PWM sweeps the servo horn smoothly.",
        180,
        { litPartIds: ["servo"] },
      ),
    ],
  },

  // ── 09 ─ MPU-6050 IMU ──────────────────────────────────────────────────────
  {
    id: "mpu6050",
    currentPaths: [
      ["headerPins", "regulator", "imuChip"],
      ["headerPins", "pullupResistors", "imuChip"],
      ["regulator", "decouplingCap"],
      ["regulator", "powerLed"],
    ],
    figureLabel: "Fig. 09",
    name: "MPU-6050 IMU",
    pcbColor: "#5a3a8a",
    lessonText:
      "A 6-axis motion sensor (accelerometer + gyroscope) read over I²C at address 0x68. It runs at 3.3 V.",
    tryToBreakText:
      "Swap SDA and SCL, or remove the pull-ups, then try to find the sensor.",
    parts: [
      part(
        "header",
        "headerPins",
        "VCC / GND / SCL / SDA header",
        "connects to the controller",
        [20, 112],
        { width: 60, pinCount: 8 },
      ),
      part(
        "block",
        "regulator",
        "3.3 V regulator",
        "powers the sensor",
        [40, 30],
        { width: 20, depth: 16, height: 10, color: DARK },
      ),
      part(
        "chip",
        "imuChip",
        "MPU-6050",
        "accelerometer + gyroscope",
        [100, 50],
        { width: 26, depth: 26, height: 6, pinCount: 5 },
      ),
      part(
        "resistor",
        "pullupResistors",
        "4.7 kΩ pull-ups",
        "keep I²C lines high",
        [150, 30],
        { bands: KILOHM_4_7 },
      ),
      part(
        "capacitor",
        "decouplingCap",
        "100 nF capacitor",
        "steadies the supply",
        [160, 80],
        { width: 14, depth: 14, height: 12, color: "#d6a228" },
      ),
      part(
        "led",
        "powerLed",
        "Power LED",
        "shows the board is on",
        [200, 112],
        GREEN_LED,
      ),
      part(
        "block",
        "swappedI2c",
        "Swapped SDA/SCL wires",
        "MISTAKE: data and clock crossed",
        [20, 70],
        RED_WIRE,
      ),
    ],
    rules: [
      rule(missing("headerPins"), "DEAD", "No connection to the controller."),
      rule(missing("regulator"), "DEAD", "No 3.3 V rail for the sensor."),
      rule(
        present("swappedI2c"),
        "IDLE",
        "SDA and SCL are swapped: nothing answers at 0x68.",
        4,
        { litPartIds: ["powerLed"] },
      ),
      rule(missing("imuChip"), "IDLE", "No MPU-6050 on the board.", 2, {
        litPartIds: ["powerLed"],
      }),
      rule(
        missing("pullupResistors"),
        "IDLE",
        "I²C lines float, so the sensor is never found.",
        4,
        { litPartIds: ["powerLed"] },
      ),
      rule(
        missing("decouplingCap"),
        "RUNNING",
        "Readings arrive, but a noisy supply makes the gyro drift and jitter.",
        4,
        { litPartIds: ["powerLed"] },
      ),
      rule(
        ALWAYS,
        "RUNNING",
        "Streaming acceleration and rotation at 100 Hz.",
        4,
        { litPartIds: ["powerLed"] },
      ),
    ],
  },

  // ── 10 ─ HC-SR04 ultrasonic ranger ─────────────────────────────────────────
  {
    id: "hcsr04",
    currentPaths: [
      ["pinHeader", "controllerChip", "transmitter"],
      ["receiver", "controllerChip"],
      ["crystal", "controllerChip"],
    ],
    figureLabel: "Fig. 10",
    name: "HC-SR04 ultrasonic",
    pcbColor: "#1f5fa8",
    lessonText:
      "Sends a 40 kHz ping and times the echo: distance = time × speed of sound ÷ 2. Needs 5 V and a stable clock.",
    tryToBreakText:
      "Take away the receiver (it hears nothing), or add the reversed power leads.",
    parts: [
      part(
        "header",
        "pinHeader",
        "VCC / TRIG / ECHO / GND",
        "connects to the controller",
        [90, 128],
        { width: 40, pinCount: 4 },
      ),
      part(
        "eye",
        "transmitter",
        "Transmitter (T)",
        "sends the ping",
        [30, 40],
        { width: 40, depth: 40, height: 20, glowColor: "#6ec5ff" },
      ),
      part(
        "eye",
        "receiver",
        "Receiver (R)",
        "listens for the echo",
        [160, 40],
        { width: 40, depth: 40, height: 20, glowColor: "#6ec5ff" },
      ),
      part(
        "chip",
        "controllerChip",
        "Controller IC",
        "times the pulses",
        [88, 60],
        { width: 46, depth: 22 },
      ),
      part("block", "crystal", "8 MHz crystal", "timing reference", [96, 92], {
        width: 18,
        depth: 10,
        height: 8,
        color: "#c0c0c8",
      }),
      part(
        "block",
        "reversedPower",
        "Reversed VCC/GND",
        "MISTAKE: power swapped",
        [190, 120],
        RED_WIRE,
      ),
    ],
    rules: [
      rule(missing("pinHeader"), "DEAD", "No connection to the controller."),
      rule(
        present("reversedPower"),
        "FAULT",
        "VCC and GND were swapped: the controller IC fried.",
        400,
        { burnedPartIds: ["controllerChip"] },
      ),
      rule(
        missing("controllerChip"),
        "IDLE",
        "No controller IC to drive the transducers.",
        2,
      ),
      rule(
        missing("crystal"),
        "IDLE",
        "No 8 MHz clock: it cannot time a 40 kHz burst.",
        5,
      ),
      rule(missing("transmitter"), "IDLE", "Nothing can send the ping.", 5),
      rule(
        missing("receiver"),
        "IDLE",
        "Pings go out, but nothing hears the echo.",
        10,
        { litPartIds: ["transmitter"] },
      ),
      rule(
        ALWAYS,
        "RUNNING",
        "Ping out, echo back: about 23 cm to the nearest object.",
        15,
        { litPartIds: ["transmitter", "receiver"] },
      ),
    ],
  },

  // ── 11 ─ 5 V relay module ──────────────────────────────────────────────────
  {
    id: "relay",
    currentPaths: [
      [
        "signalHeader",
        "optocoupler",
        "driverTransistor",
        "relayCoil",
        "loadTerminal",
      ],
      ["relayCoil", "flybackDiode"],
      ["driverTransistor", "relayLed"],
    ],
    figureLabel: "Fig. 11",
    name: "Relay module",
    pcbColor: "#1d4f91",
    inputs: [{ id: "signal", label: "IN pin" }],
    lessonText:
      "A small signal drives a coil that clicks a switch for a big load. An optocoupler keeps the two sides electrically apart.",
    tryToBreakText: "Remove the flyback diode and switch the relay on.",
    parts: [
      part(
        "header",
        "signalHeader",
        "VCC / GND / IN header",
        "control connection",
        [8, 20],
        { width: 30, pinCount: 3 },
      ),
      part(
        "chip",
        "optocoupler",
        "PC817 optocoupler",
        "isolates the control side",
        [58, 20],
        { width: 28, depth: 18, pinCount: 2 },
      ),
      part(
        "block",
        "driverTransistor",
        "S8050 transistor",
        "drives the coil",
        [58, 62],
        { width: 14, depth: 14, height: 10, color: DARK },
      ),
      part(
        "block",
        "flybackDiode",
        "Flyback diode",
        "absorbs coil kickback",
        [100, 74],
        { width: 16, depth: 8, height: 8, color: DARK },
      ),
      part("relay", "relayCoil", "Relay", "the switch", [110, 18]),
      part(
        "terminal",
        "loadTerminal",
        "Load terminal",
        "where the load connects",
        [170, 20],
        { width: 36, pinCount: 3 },
      ),
      part(
        "led",
        "relayLed",
        "Relay LED",
        "lit when energised",
        [20, 100],
        RED_LED,
      ),
    ],
    rules: [
      rule(missing("signalHeader"), "DEAD", "No control connection."),
      rule(missing("relayCoil"), "IDLE", "No relay to switch."),
      rule(
        { not: { inputIsOn: "signal" } },
        "IDLE",
        "IN is LOW: the coil is off and the relay stays open.",
        3,
      ),
      rule(
        missing("driverTransistor"),
        "IDLE",
        "The coil gets no current: the transistor is missing.",
        3,
      ),
      rule(
        missing("flybackDiode"),
        "FAULT",
        "Coil kickback voltage destroyed the driver transistor.",
        250,
        { burnedPartIds: ["driverTransistor"] },
      ),
      rule(
        missing("loadTerminal"),
        "IDLE",
        "The relay clicks, but there is nothing connected to switch.",
        70,
        { litPartIds: ["relayLed"] },
      ),
      rule(
        missing("optocoupler"),
        "RUNNING",
        "Works, but without the optocoupler the control side is not isolated.",
        75,
        { litPartIds: ["relayLed"] },
      ),
      rule(
        ALWAYS,
        "RUNNING",
        "Click! The relay closes and connects the load.",
        75,
        { litPartIds: ["relayLed"] },
      ),
    ],
  },

  // ── 12 ─ BME280 environment sensor ─────────────────────────────────────────
  {
    id: "bme280",
    currentPaths: [
      ["headerPins", "regulator", "bmeChip"],
      ["headerPins", "pullupResistors", "bmeChip"],
      ["regulator", "decouplingCap"],
      ["regulator", "powerLed"],
    ],
    figureLabel: "Fig. 12",
    name: "BME280 sensor",
    pcbColor: "#6b3fa0",
    lessonText:
      "Measures temperature, humidity and air pressure over I²C. The bare chip tolerates only 3.6 V, so a regulator protects it.",
    tryToBreakText:
      "Feed 5 V straight to the chip with the mistake wire, or leave out the capacitor.",
    parts: [
      part(
        "header",
        "headerPins",
        "VIN / GND / SCL / SDA header",
        "connects to the controller",
        [20, 112],
        { width: 48, pinCount: 6 },
      ),
      part(
        "block",
        "regulator",
        "3.3 V regulator",
        "protects the chip",
        [40, 30],
        { width: 20, depth: 16, height: 10, color: DARK },
      ),
      part(
        "chip",
        "bmeChip",
        "BME280",
        "temperature, humidity, pressure",
        [100, 50],
        { width: 20, depth: 20, height: 6, color: "#b9bec6", pinCount: 4 },
      ),
      part(
        "resistor",
        "pullupResistors",
        "4.7 kΩ pull-ups",
        "keep I²C lines high",
        [150, 30],
        { bands: KILOHM_4_7 },
      ),
      part(
        "capacitor",
        "decouplingCap",
        "100 nF capacitor",
        "steadies the supply",
        [160, 80],
        { width: 14, depth: 14, height: 12, color: "#d6a228" },
      ),
      part(
        "led",
        "powerLed",
        "Power LED",
        "shows the board is on",
        [200, 112],
        GREEN_LED,
      ),
      part(
        "block",
        "fiveVoltOnChip",
        "5 V straight to the chip",
        "MISTAKE: bypasses the regulator",
        [20, 70],
        RED_WIRE,
      ),
    ],
    rules: [
      rule(missing("headerPins"), "DEAD", "No connection to the controller."),
      rule(missing("regulator"), "DEAD", "No 3.3 V rail for the sensor."),
      rule(
        present("fiveVoltOnChip"),
        "FAULT",
        "The bare BME280 handles 3.6 V at most: 5 V destroyed it.",
        60,
        { burnedPartIds: ["bmeChip"] },
      ),
      rule(missing("bmeChip"), "IDLE", "No BME280 on the board.", 2, {
        litPartIds: ["powerLed"],
      }),
      rule(
        missing("pullupResistors"),
        "IDLE",
        "I²C lines float, so the sensor is never found at 0x76.",
        3,
        { litPartIds: ["powerLed"] },
      ),
      rule(
        missing("decouplingCap"),
        "RUNNING",
        "Works, but a noisy supply makes the temperature reading wander.",
        4,
        { litPartIds: ["powerLed"] },
      ),
      rule(ALWAYS, "RUNNING", "Reading 22.4 °C, 48 % humidity, 1013 hPa.", 4, {
        litPartIds: ["powerLed"],
      }),
    ],
  },

  // ── 13 ─ servo with its own power ──────────────────────────────────────────
  {
    id: "servo",
    currentPaths: [
      ["externalSupply", "bulkCap", "servo"],
      ["signalHeader", "servo"],
      ["servo", "commonGround"],
    ],
    figureLabel: "Fig. 13",
    name: "Servo + external power",
    pcbColor: "#2f6b4f",
    lessonText:
      "A servo pulls big current spikes when it moves. Give it its own 5 V supply, and share the ground with the controller.",
    tryToBreakText:
      "Add the mistake wire that powers the servo from the controller’s 5 V pin.",
    parts: [
      part(
        "terminal",
        "externalSupply",
        "External 5 V supply",
        "dedicated servo power",
        [8, 20],
      ),
      part(
        "capacitor",
        "bulkCap",
        "470 µF capacitor",
        "covers servo current spikes",
        [10, 70],
        { width: 22, depth: 22, height: 26 },
      ),
      part(
        "header",
        "signalHeader",
        "Signal header",
        "PWM from the controller",
        [70, 20],
        { width: 30, pinCount: 3 },
      ),
      part(
        "block",
        "commonGround",
        "Common ground wire",
        "ties the grounds together",
        [70, 60],
        { width: 30, depth: 8, height: 6, color: DARK },
      ),
      part("block", "servo", "SG90 servo", "the load", [140, 50], {
        width: 44,
        depth: 22,
        height: 28,
        color: "#2b6cb0",
        glowColor: "#9fd0ff",
      }),
      part(
        "block",
        "mcuPowerWire",
        "Servo V+ to controller 5 V",
        "MISTAKE: the controller powers the servo",
        [100, 105],
        RED_WIRE,
      ),
    ],
    rules: [
      rule(
        present("mcuPowerWire"),
        "FAULT",
        "The servo stalled and dragged the controller’s 5 V rail down: brown-out reset.",
        800,
      ),
      rule(missing("externalSupply"), "DEAD", "No servo power."),
      rule(
        missing("signalHeader"),
        "IDLE",
        "No PWM signal reaches the servo.",
        5,
      ),
      rule(
        missing("commonGround"),
        "IDLE",
        "No common ground: the signal has no reference, so the servo ignores it.",
        5,
      ),
      rule(missing("servo"), "IDLE", "No servo connected.", 2),
      rule(
        missing("bulkCap"),
        "RUNNING",
        "Moves, but voltage dips make it jitter.",
        320,
        { litPartIds: ["servo"] },
      ),
      rule(ALWAYS, "RUNNING", "Smooth sweep from 0° to 180°.", 250, {
        litPartIds: ["servo"],
      }),
    ],
  },
];

/** Look a board up by id, e.g. BOARDS_BY_ID['led']. */
export const BOARDS_BY_ID = Object.fromEntries(
  BOARDS.map((board) => [board.id, board]),
) as Record<string, BoardDefinition>;
