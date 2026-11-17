// src/customLab/CustomViewport.tsx

/**
 * Custom experiment sandbox viewport.
 *
 * Renders a 3D workbench with a breadboard, controller header strip, and docking bay.
 * Supports three cursor modes – "place", "wire", and "probe" – managed via React state.
 *
 * NOTE: No @react-three/drei <Html> or <Text> components are used inside <Canvas>,
 * adhering to the strict project rule.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  CustomComponentType,
  PlacedCustomPart,
  CustomWire,
  CustomSimResult,
} from "./customTypes";
import { evaluateCustomCircuit } from "./netlistSolver";

/** Helper that creates a cheap material for metallic pins */
const pinMaterial = new THREE.MeshStandardMaterial({ color: "gold", metalness: 0.8, roughness: 0.2 });

/** Simple 3‑D object representing a single breadboard hole */
function BreadboardHole({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position}>
      <cylinderGeometry args={[0.2, 0.2, 0.1, 8]} />
      <meshStandardMaterial color="#555" />
    </mesh>
  );
}

/** Render the entire breadboard grid (830 points = 30 cols × 2 halves + power rails) */
function Breadboard({ onPinClick }: { onPinClick: (pinId: string, event: THREE.Event) => void }) {
  const holes = [] as JSX.Element[];
  const spacing = 0.8; // mm equivalent spacing; adjust to desired scale
  const rowOffset = 0.5; // half‑board vertical offset
  for (let col = 1; col <= 30; col++) {
    for (const half of ["top", "bottom"] as const) {
      const x = (col - 15.5) * spacing; // center at 0
      const y = half === "top" ? rowOffset : -rowOffset;
      const z = 0;
      const pinId = `col${col}_${half}`;
      holes.push(
        <group key={pinId} onPointerDown={(e) => onPinClick(pinId, e)}>
          <BreadboardHole position={[x, y, z]} />
        </group>
      );
    }
  }
  // Power rails (simplified as extra rows)
  for (let col = 1; col <= 30; col++) {
    const x = (col - 15.5) * spacing;
    const rails = [
      { half: "5V", y: 1.2, color: "#ff5555" },
      { half: "GND", y: -1.2, color: "#5555ff" },
    ];
    for (const rail of rails) {
      const pinId = `rail_${rail.half}_col${col}`;
      holes.push(
        <group key={pinId} onPointerDown={(e) => onPinClick(pinId, e)}>
          <mesh position={[x, rail.y, 0]}>
            <cylinderGeometry args={[0.25, 0.25, 0.12, 8]} />
            <meshStandardMaterial color={rail.color} />
          </mesh>
        </group>
      );
    }
  }
  return <group>{holes}</group>;
}

/** A simple 3‑D wire rendered as a thin tube between two points */
function Wire({ from, to, color, isActive, isShorted }: { from: THREE.Vector3; to: THREE.Vector3; color: string; isActive: boolean; isShorted: boolean }) {
  const points = useMemo(() => [from, to], [from, to]);
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points]);
  const geometry = useMemo(() => new THREE.TubeGeometry(curve, 20, 0.07, 8, false), [curve]);
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: isShorted ? "red" : isActive ? "orange" : color, transparent: true, opacity: isShorted ? 0.7 : 1 }),
    [color, isActive, isShorted]
  );
  return <mesh geometry={geometry} material={material} />;
}

/** Main viewport component */
export default function CustomViewport() {
  const [parts, setParts] = useState<PlacedCustomPart[]>([]);
  const [wires, setWires] = useState<CustomWire[]>([]);
  const [mode, setMode] = useState<"place" | "wire" | "probe">("place");
  const [selectedComponent, setSelectedComponent] = useState<CustomComponentType | null>(null);
  const [wireStartPin, setWireStartPin] = useState<string | null>(null);
  const [simResult, setSimResult] = useState<CustomSimResult>(
    // initial empty result
    {
      status: "IDLE",
      burnedPartIds: [],
      shortedWireIds: [],
      activeWireIds: [],
      litLedIds: [],
      ledBrightness: {},
      servoActive: false,
      oledActive: false,
      nodeVoltages: {},
      logs: [],
    }
  );

  // Run simulation whenever parts/wires change and power is on (simple flag for now)
  useEffect(() => {
    const powered = true; // TODO: hook to a power switch UI
    const result = evaluateCustomCircuit(parts, wires, powered);
    setSimResult(result);
  }, [parts, wires]);

  /** Handles clicking a pin based on current mode */
  const handlePinClick = (pinId: string, _event: THREE.Event) => {
    if (mode === "place") {
      if (!selectedComponent) return;
      // Determine column & row from pinId (simple parsing for demo)
      const match = pinId.match(/col(\d+)_(top|bottom)/);
      if (!match) return; // ignore power‑rail pins for placement
      const col = parseInt(match[1]);
      const row = match[2] as "top" | "bottom";
      const newPart: PlacedCustomPart = {
        id: `${selectedComponent}_${Date.now()}`,
        type: selectedComponent,
        name: selectedComponent,
        gridCol: col,
        gridRow: row,
      };
      setParts((p) => [...p, newPart]);
    } else if (mode === "wire") {
      if (!wireStartPin) {
        setWireStartPin(pinId);
      } else {
        // Create a wire linking the two pins
        const newWire: CustomWire = {
          id: `wire_${Date.now()}`,
          fromPinId: wireStartPin,
          toPinId: pinId,
          color: "#888",
        };
        setWires((w) => [...w, newWire]);
        setWireStartPin(null);
      }
    } else if (mode === "probe") {
      const voltage = simResult.nodeVoltages[pinId] ?? "UNKNOWN";
      alert(`Pin ${pinId} voltage: ${voltage}`);
    }
  };

  /** Render all placed parts as simple meshes */
  const renderParts = parts.map((part) => {
    const basePosX = (part.gridCol - 15.5) * 0.8;
    const basePosY = part.gridRow === "top" ? 0.5 : -0.5;
    const position = new THREE.Vector3(basePosX, basePosY, 0);
    // Simple geometry per component type (placeholder shapes)
    let geometry: THREE.BufferGeometry;
    let color = "#ccc";
    switch (part.type) {
      case "led_red":
        geometry = new THREE.CylinderGeometry(0.2, 0.2, 0.4, 12);
        color = "#ff5555";
        break;
      case "led_green":
        geometry = new THREE.CylinderGeometry(0.2, 0.2, 0.4, 12);
        color = "#55ff55";
        break;
      case "res_220":
      case "res_10":
      case "res_10k":
        geometry = new THREE.BoxGeometry(0.6, 0.2, 0.2);
        color = "#aaaaaa";
        break;
      case "button":
        geometry = new THREE.BoxGeometry(0.4, 0.2, 0.2);
        color = "#ffdd00";
        break;
      case "npn_2n2222":
        geometry = new THREE.ConeGeometry(0.2, 0.5, 8);
        color = "#5555ff";
        break;
      case "diode_1n4007":
        geometry = new THREE.TorusGeometry(0.2, 0.07, 8, 16);
        color = "#ffddaa";
        break;
      case "sg90_servo":
        geometry = new THREE.CylinderGeometry(0.5, 0.5, 0.3, 12);
        color = "#777777";
        break;
      case "oled_i2c":
        geometry = new THREE.PlaneGeometry(1.2, 0.6);
        color = "#00aaff";
        break;
      default:
        geometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    }
    const mat = new THREE.MeshStandardMaterial({ color });
    return (
      <mesh key={part.id} geometry={geometry} material={mat} position={position} />
    );
  });

  /** Render all wires */
  const renderWires = wires.map((wire) => {
    // Resolve pin positions (very naive – assumes pins are on the breadboard grid)
    const resolvePin = (pinId: string): THREE.Vector3 => {
      const colMatch = pinId.match(/col(\d+)_([a-zA-Z]+)/);
      if (colMatch) {
        const col = parseInt(colMatch[1]);
        const row = colMatch[2] === "top" ? 0.5 : -0.5;
        return new THREE.Vector3((col - 15.5) * 0.8, row, 0);
      }
      // Power rails
      const railMatch = pinId.match(/rail_(5V|GND)_col(\d+)/);
      if (railMatch) {
        const col = parseInt(railMatch[2]);
        const y = railMatch[1] === "5V" ? 1.2 : -1.2;
        return new THREE.Vector3((col - 15.5) * 0.8, y, 0);
      }
      // Arduino pins – placed on left side
      const unoMap: Record<string, THREE.Vector3> = {
        uno_5V: new THREE.Vector3(-8, 1.2, 0),
        uno_3V3: new THREE.Vector3(-8, 0.9, 0),
        uno_GND: new THREE.Vector3(-8, -1.2, 0),
        uno_D9: new THREE.Vector3(-8, 0.2, 0),
        uno_D13: new THREE.Vector3(-8, -0.2, 0),
        uno_SDA: new THREE.Vector3(-8, -0.6, 0),
        uno_SCL: new THREE.Vector3(-8, -1.0, 0),
      };
      return unoMap[pinId] ?? new THREE.Vector3(0, 0, 0);
    };
    const fromPos = resolvePin(wire.fromPinId);
    const toPos = resolvePin(wire.toPinId);
    const isActive = simResult.activeWireIds.includes(wire.id);
    const isShorted = simResult.shortedWireIds.includes(wire.id);
    return (
      <Wire key={wire.id} from={fromPos} to={toPos} color={wire.color} isActive={isActive} isShorted={isShorted} />
    );
  });

  // UI controls (simple HTML overlay, not inside Canvas)
  const controlPanel = (
    <div style={{ position: "absolute", top: 10, left: 10, background: "rgba(0,0,0,0.5)", padding: 8, borderRadius: 4, color: "white" }}>
      <div>
        Mode:{" "}
        <select value={mode} onChange={(e) => setMode(e.target.value as any)}>
          <option value="place">Place</option>
          <option value="wire">Wire</option>
          <option value="probe">Probe</option>
        </select>
      </div>
      {mode === "place" && (
        <div>
          Component:{" "}
          <select
            value={selectedComponent ?? ""}
            onChange={(e) => setSelectedComponent(e.target.value as CustomComponentType)}
          >
            <option value="">Select…</option>
            <option value="led_red">LED Red</option>
            <option value="led_green">LED Green</option>
            <option value="res_220">Resistor 220Ω</option>
            <option value="res_10k">Resistor 10kΩ</option>
            <option value="button">Button</option>
            <option value="npn_2n2222">2N2222 NPN</option>
            <option value="diode_1n4007">Diode 1N4007</option>
            <option value="sg90_servo">SG90 Servo</option>
            <option value="oled_i2c">OLED I2C</option>
          </select>
        </div>
      )}
      <div>
        <strong>Status:</strong> {simResult.status}
        {simResult.faultMessage && <div>⚠ {simResult.faultMessage}</div>}
      </div>
    </div>
  );

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {controlPanel}
      <Canvas camera={{ position: [0, 0, 30], fov: 45 }}>
        {/* Ambient lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 10]} intensity={0.8} />
        {/* Workbench base */}
        <mesh position={[0, 0, -0.5]} receiveShadow>
          <boxGeometry args={[40, 25, 1]} />
          <meshStandardMaterial color="#333" />
        </mesh>
        {/* Breadboard */}
        <Breadboard onPinClick={handlePinClick} />
        {/* Arduino header strip – left side */}
        <group position={[-12, 0, 0]}>
          {[
            "uno_5V",
            "uno_3V3",
            "uno_GND",
            "uno_D9",
            "uno_D13",
            "uno_SDA",
            "uno_SCL",
          ].map((pin, i) => (
            <mesh key={pin} position={[0, 2 - i * 0.5, 0]} onPointerDown={(e) => handlePinClick(pin, e)}>
              <cylinderGeometry args={[0.25, 0.25, 0.1, 8]} />
              <primitive object={pinMaterial} />
            </mesh>
          ))}
        </group>
        {/* Render placed parts */}
        {renderParts}
        {/* Render wires */}
        {renderWires}
      </Canvas>
    </div>
  );
}
