# Product Requirements Document (PRD) — Robotics Bench

## 1. Vision & Goal

An interactive 3D electronics and robotics workbench simulator where users assemble real hardware boards step-by-step, solder joints, upload firmware, inspect serial output, and intentionally trigger hardware faults to see how parts fail.

## 2. Visual & UX Direction

- **Theme:** Warm retro-hardware laboratory (`#EAE6DF` cream canvas, crisp `1px solid #222` borders, monospace typography, pill-shaped interactive buttons).
- **Viewport:** Orthographic isometric 3D stage with studio lighting, contact shadows, orbit/zoom controls, and 2D HUD overlays (Parts Counter, Status Badge, Hover Tooltip).

## 3. Core Functional Requirements

- **13 Interactive Labs:**
  1. `01 Arduino Uno R3` (Meet the board — baseline reference lab)
  2. `02 LED + resistor` (Ohm's law & current limiting)
  3. `03 Transistor switch` (NPN low-side switching)
  4. `04 ESP32-S3 DevKit` (Dual-core Wi-Fi MCU)
  5. `05 Ultrasonic sensor` (HC-SR04 echo ranging)
  6. `06 L298N driver` (Dual H-bridge motor control)
  7. `07 A4988 stepper driver` (Microstepping & current limit)
  8. `08 SG90 servo` (PWM angle positioning)
  9. `09 MPU-6050 IMU` (I2C accelerometer + gyroscope)
  10. `10 Rotary encoder` (Quadrature phase decoding)
  11. `11 PCA9685 servo board` (16-channel I2C PWM)
  12. `12 I2C OLED display` (128x64 SSD1306 graphics)
  13. `13 MPU-6050 IMU` (Complementary/Kalman sensor fusion)
- **Bench Assembly Workflow:**
  - `Strip to bare PCB` -> `Pick & place SMD` -> `Place a part +` -> `Solder joints` -> `Plug / unplug USB` -> `Exploded view` -> `Power on / Run`.
  - Live status progression: `BARE PCB` -> `ASSEMBLING` -> `NEEDS SOLDER` -> `READY` -> `RUNNING` (or `FAULT`).
- **Customization & Diagnostics:**
  - 5 PCB soldermask colors (`Blue`, `Red`, `Green`, `Black`, `White`).
  - Interactive **Fault / Break Simulation** per board (e.g., overcurrent LED burnout, cold solder joint failure, reverse polarity smoke, missing flyback diode).
  - Bottom 3-column workbench: **About the Board**, **Try It Yourself** (copyable Arduino C++ sketch), and **Serial Monitor** (9600 baud live log).
