import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, ContactShadows, RoundedBox } from "@react-three/drei";

import * as THREE from "three";
import {
  Copy,
  Check,
  Plus,
  Power,
  Usb,
  Layers,
  Wrench,
  Cpu,
  Eraser,
  Flame,
} from "lucide-react";

const BOARDS = [
  ["Arduino Uno R3", "meet the board"],
  ["LED + resistor", "Ohm's law"],
  ["Transistor switch", "logic drives power"],
  ["ESP32-S3 DevKit", "WiFi + two cores"],
  ["Ultrasonic sensor", "echo ranging"],
  ["L298N driver", "H-bridge, why not"],
  ["A4988 stepper driver", "microstepping"],
  ["SG90 servo", "PWM angle"],
  ["MPU-6050 IMU", "accel + gyro"],
  ["Rotary encoder", "quadrature"],
  ["PCA9685 servo board", "16 PWM over I2C"],
  ["I2C OLED display", "128x64 pixels"],
  ["MPU-6050 IMU", "sensor fusion"],
];
const COLORS: Record<string, string> = {
  Blue: "#1f6fb2",
  Red: "#b8322a",
  Green: "#2f7d46",
  Black: "#1d1d1d",
  White: "#e9e9e4",
};

type Kind =
  | "dip"
  | "qfp"
  | "usb"
  | "jack"
  | "xtal"
  | "btn"
  | "hdr"
  | "cap"
  | "ecap"
  | "led"
  | "res"
  | "reg"
  | "fuse";
interface Part {
  id: string;
  name: string;
  kind: Kind;
  smd: boolean;
  p: [number, number];
  n?: number;
  rot?: number;
  color?: string;
  label?: string;
}

const PARTS: Part[] = [
  {
    id: "u3",
    name: "ATmega16U2",
    kind: "qfp",
    smd: true,
    p: [-1.6, 0.4],
    label: "USB CHIP",
  },
  { id: "reg", name: "5V regulator", kind: "reg", smd: true, p: [-2.2, -1.3] },
  {
    id: "ledon",
    name: "ON LED",
    kind: "led",
    smd: true,
    p: [1.6, 0.9],
    color: "#3dff6a",
    label: "ON",
  },
  {
    id: "ledl",
    name: "L LED",
    kind: "led",
    smd: true,
    p: [-0.9, 1.5],
    color: "#ffb020",
    label: "L (pin 13)",
  },
  {
    id: "ledtx",
    name: "TX LED",
    kind: "led",
    smd: true,
    p: [-0.9, 1.05],
    color: "#ffb020",
  },
  {
    id: "ledrx",
    name: "RX LED",
    kind: "led",
    smd: true,
    p: [-0.9, 1.25],
    color: "#ffb020",
  },
  { id: "c1", name: "100nF cap", kind: "cap", smd: true, p: [0.3, 0.3] },
  { id: "c2", name: "100nF cap", kind: "cap", smd: true, p: [-0.6, -0.1] },
  { id: "r1", name: "1k resistor", kind: "res", smd: true, p: [-0.5, 1.5] },
  { id: "r2", name: "10k resistor", kind: "res", smd: true, p: [1.2, 0.5] },
  {
    id: "mcu",
    name: "ATmega328P",
    kind: "dip",
    smd: false,
    p: [1.0, -1.0],
    label: "ATmega328P",
  },
  {
    id: "usb",
    name: "USB-B port",
    kind: "usb",
    smd: false,
    p: [-3.05, 1.4],
    label: "USB-B",
  },
  {
    id: "jack",
    name: "DC barrel jack",
    kind: "jack",
    smd: false,
    p: [-3.0, -1.8],
    label: "DC JACK",
  },
  {
    id: "xtal",
    name: "16 MHz crystal",
    kind: "xtal",
    smd: false,
    p: [-0.3, -0.9],
    label: "16MHz",
  },
  {
    id: "rst",
    name: "Reset button",
    kind: "btn",
    smd: false,
    p: [-2.6, 2.1],
    label: "RESET",
  },
  {
    id: "hd1",
    name: "Digital header 0-7",
    kind: "hdr",
    smd: false,
    p: [2.0, 2.4],
    n: 8,
    label: "DIGITAL",
  },
  {
    id: "hd2",
    name: "Digital header 8-13",
    kind: "hdr",
    smd: false,
    p: [-0.4, 2.4],
    n: 10,
  },
  {
    id: "hp",
    name: "Power header",
    kind: "hdr",
    smd: false,
    p: [-0.2, -2.4],
    n: 8,
    label: "POWER",
  },
  {
    id: "ha",
    name: "Analog header",
    kind: "hdr",
    smd: false,
    p: [2.0, -2.4],
    n: 6,
    label: "ANALOG",
  },
  {
    id: "icsp",
    name: "ICSP header",
    kind: "hdr",
    smd: false,
    p: [3.1, -0.2],
    n: 3,
    rot: Math.PI / 2,
  },
  {
    id: "icsp2",
    name: "ICSP2 header",
    kind: "hdr",
    smd: false,
    p: [-1.6, 1.9],
    n: 3,
  },
  { id: "e1", name: "47µF cap", kind: "ecap", smd: false, p: [-2.1, -0.5] },
  { id: "e2", name: "47µF cap", kind: "ecap", smd: false, p: [-1.6, -0.5] },
  { id: "fuse", name: "Polyfuse", kind: "fuse", smd: false, p: [-2.6, 0.5] },
];
const TOTAL = PARTS.length;
const PCB_T = 0.16;
const dark = "#1a1a1a";
const metal = "#c9c9c9";

function Geo({ part, lit }: { part: Part; lit: boolean }) {
  switch (part.kind) {
    case "dip":
      return (
        <group>
          <mesh position={[0, 0.06, 0]} castShadow>
            <boxGeometry args={[2.6, 0.12, 0.85]} />
            <meshStandardMaterial color="#222" />
          </mesh>
          <mesh position={[0, 0.2, 0]} castShadow>
            <boxGeometry args={[2.4, 0.2, 0.6]} />
            <meshStandardMaterial color={dark} roughness={0.6} />
          </mesh>
          {Array.from({ length: 28 }).map((_, i) => (
            <mesh
              key={i}
              position={[-1.1 + (i % 14) * 0.17, 0.12, i < 14 ? 0.33 : -0.33]}
            >
              <boxGeometry args={[0.06, 0.1, 0.1]} />
              <meshStandardMaterial
                color={metal}
                metalness={0.8}
                roughness={0.3}
              />
            </mesh>
          ))}
          <mesh position={[-1.1, 0.305, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.06, 16]} />
            <meshStandardMaterial color="#444" />
          </mesh>
        </group>
      );
    case "qfp":
      return (
        <group>
          <mesh position={[0, 0.05, 0]} castShadow>
            <boxGeometry args={[0.5, 0.08, 0.5]} />
            <meshStandardMaterial color={dark} />
          </mesh>
          {[0, 1, 2, 3].map((s) => (
            <mesh
              key={s}
              rotation={[0, (s * Math.PI) / 2, 0]}
              position={[0, 0.02, 0]}
            >
              <boxGeometry args={[0.62, 0.02, 0.4]} />
              <meshStandardMaterial color={metal} metalness={0.8} />
            </mesh>
          ))}
        </group>
      );
    case "usb":
      return (
        <group>
          <mesh position={[0, 0.4, 0]} castShadow>
            <boxGeometry args={[1.6, 0.8, 1.2]} />
            <meshStandardMaterial
              color="#d6d6d6"
              metalness={0.9}
              roughness={0.25}
            />
          </mesh>
          <mesh position={[-0.81, 0.4, 0]}>
            <boxGeometry args={[0.02, 0.5, 0.75]} />
            <meshStandardMaterial color="#111" />
          </mesh>
        </group>
      );
    case "jack":
      return (
        <group>
          <mesh position={[0, 0.45, 0]} castShadow>
            <boxGeometry args={[1.4, 0.9, 0.9]} />
            <meshStandardMaterial color="#141414" roughness={0.5} />
          </mesh>
          <mesh position={[-0.71, 0.45, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.28, 0.28, 0.02, 24]} />
            <meshStandardMaterial color="#333" />
          </mesh>
        </group>
      );
    case "xtal":
      return (
        <mesh position={[0, 0.15, 0]} castShadow scale={[1, 1, 0.4]}>
          <capsuleGeometry args={[0.13, 0.35, 6, 16]} />
          <meshStandardMaterial
            color="#d8d8d8"
            metalness={0.9}
            roughness={0.2}
          />
        </mesh>
      );
    case "btn":
      return (
        <group>
          <mesh position={[0, 0.1, 0]} castShadow>
            <boxGeometry args={[0.5, 0.2, 0.5]} />
            <meshStandardMaterial color="#bbb" metalness={0.7} />
          </mesh>
          <mesh position={[0, 0.25, 0]}>
            <cylinderGeometry args={[0.13, 0.13, 0.12, 20]} />
            <meshStandardMaterial color="#222" />
          </mesh>
        </group>
      );
    case "hdr": {
      const n = part.n || 8;
      return (
        <group rotation={[0, part.rot || 0, 0]}>
          <mesh position={[0, 0.2, 0]} castShadow>
            <boxGeometry args={[n * 0.25, 0.4, 0.25]} />
            <meshStandardMaterial color="#151515" />
          </mesh>
          {Array.from({ length: n }).map((_, i) => (
            <mesh
              key={i}
              position={[-((n - 1) * 0.25) / 2 + i * 0.25, 0.401, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <planeGeometry args={[0.1, 0.1]} />
              <meshStandardMaterial color="#000" />
            </mesh>
          ))}
        </group>
      );
    }
    case "cap":
      return (
        <mesh position={[0, 0.04, 0]} castShadow>
          <boxGeometry args={[0.18, 0.08, 0.1]} />
          <meshStandardMaterial color="#b58a4a" />
        </mesh>
      );
    case "res":
      return (
        <mesh position={[0, 0.04, 0]} castShadow>
          <boxGeometry args={[0.18, 0.06, 0.1]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      );
    case "fuse":
      return (
        <mesh position={[0, 0.06, 0]} castShadow>
          <boxGeometry args={[0.35, 0.12, 0.2]} />
          <meshStandardMaterial color="#2a5d2a" />
        </mesh>
      );
    case "reg":
      return (
        <group>
          <mesh position={[0, 0.07, 0]} castShadow>
            <boxGeometry args={[0.45, 0.14, 0.4]} />
            <meshStandardMaterial color={dark} />
          </mesh>
          <mesh position={[0, 0.03, -0.28]}>
            <boxGeometry args={[0.4, 0.04, 0.2]} />
            <meshStandardMaterial color={metal} metalness={0.8} />
          </mesh>
        </group>
      );
    case "ecap":
      return (
        <group>
          <mesh position={[0, 0.3, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.2, 0.6, 24]} />
            <meshStandardMaterial color="#1c2f6b" />
          </mesh>
          <mesh position={[0, 0.605, 0]}>
            <cylinderGeometry args={[0.19, 0.19, 0.01, 24]} />
            <meshStandardMaterial color={metal} metalness={0.9} />
          </mesh>
        </group>
      );
    case "led":
      return (
        <group>
          <mesh position={[0, 0.04, 0]}>
            <boxGeometry args={[0.16, 0.08, 0.1]} />
            <meshStandardMaterial
              color={lit ? part.color : "#eee8d0"}
              emissive={part.color}
              emissiveIntensity={lit ? 3 : 0}
            />
          </mesh>
          {lit && (
            <pointLight
              position={[0, 0.3, 0]}
              color={part.color}
              intensity={1.5}
              distance={1.5}
            />
          )}
        </group>
      );
  }
}

function AnimatedPart({
  part,
  placed,
  explode,
  lit,
  labels,
  onHover,
}: {
  part: Part;
  placed: boolean;
  explode: number;
  lit: boolean;
  labels: boolean;
  onHover: (s: string | null) => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const layer = part.smd ? 1 : part.kind === "hdr" ? 3 : 2;
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const ty = placed ? PCB_T / 2 + explode * layer * 1.1 : 7;
    const k = 1 - Math.exp(-dt * (placed ? 7 : 4));
    g.position.y += (ty - g.position.y) * k;
    const s = placed ? 1 : 0.001;
    g.scale.setScalar(g.scale.x + (s - g.scale.x) * k);
    g.rotation.y += ((placed ? 0 : 2) - g.rotation.y) * k;
  });
  return (
    <group
      ref={ref}
      position={[part.p[0], 7, part.p[1]]}
      scale={0.001}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(part.name);
      }}
      onPointerOut={() => onHover(null)}
    >
      <Geo part={part} lit={lit} />
    </group>
  );
}

function SolderJoints({ show, explode }: { show: boolean; explode: number }) {
  const ref = useRef<THREE.Group>(null);
  const pts = useMemo(() => {
    const a: [number, number][] = [];
    PARTS.filter((p) => !p.smd).forEach((p) => {
      if (p.kind === "hdr") {
        const n = p.n || 8;
        for (let i = 0; i < n; i++) {
          const o = -((n - 1) * 0.25) / 2 + i * 0.25;
          a.push(p.rot ? [p.p[0], p.p[1] + o] : [p.p[0] + o, p.p[1]]);
        }
      } else if (p.kind === "dip")
        for (let i = 0; i < 28; i++)
          a.push([
            p.p[0] - 1.1 + (i % 14) * 0.17,
            p.p[1] + (i < 14 ? 0.33 : -0.33),
          ]);
      else {
        a.push([p.p[0] - 0.25, p.p[1]]);
        a.push([p.p[0] + 0.25, p.p[1]]);
      }
    });
    return a;
  }, []);
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const t = show ? 1 : 0.001;
    g.scale.y += (t - g.scale.y) * (1 - Math.exp(-dt * 5));
    g.scale.x = g.scale.z = g.scale.y > 0.01 ? 1 : 0.001;
    g.position.y = -explode * 0.6 - PCB_T / 2;
  });
  return (
    <group ref={ref} scale={[0.001, 0.001, 0.001]}>
      {pts.map((p, i) => (
        <mesh key={i} position={[p[0], -0.03, p[1]]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.07, 0.08, 10]} />
          <meshStandardMaterial
            color="#e0e0e0"
            metalness={1}
            roughness={0.15}
          />
        </mesh>
      ))}
    </group>
  );
}

function UsbCable({ plugged, explode }: { plugged: boolean; explode: number }) {
  const ref = useRef<THREE.Group>(null);
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.8, 0, 0),
        new THREE.Vector3(-2.5, 0, 0),
        new THREE.Vector3(-4, -0.4, 1.5),
        new THREE.Vector3(-5.5, -0.5, 4),
      ]),
    [],
  );
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const tx = plugged ? -3.85 : -6.5;
    g.position.x += (tx - g.position.x) * (1 - Math.exp(-dt * 5));
    g.position.y = PCB_T / 2 + 0.4 + explode * 2 * 1.1;
  });
  return (
    <group ref={ref} position={[-6.5, 0.5, 1.4]}>
      <mesh castShadow>
        <boxGeometry args={[1.0, 0.7, 1.0]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.6} />
      </mesh>
      <mesh position={[0.6, 0, 0]}>
        <boxGeometry args={[0.3, 0.45, 0.7]} />
        <meshStandardMaterial color={metal} metalness={0.9} />
      </mesh>
      <mesh castShadow>
        <tubeGeometry args={[curve, 40, 0.13, 10]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.7} />
      </mesh>
    </group>
  );
}

function Pcb({
  color,
  explode,
  generic,
}: {
  color: string;
  explode: number;
  generic?: string;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.position.y = -explode * 0.6;
  });
  const holes: [number, number][] = [
    [-2.9, 2.3],
    [3.1, 2.3],
    [3.1, -2.3],
    [-1.9, -2.3],
  ];
  return (
    <group ref={ref}>
      <RoundedBox
        args={generic ? [4, PCB_T, 2.6] : [6.9, PCB_T, 5.3]}
        radius={0.07}
        smoothness={3}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial color={color} roughness={0.55} />
      </RoundedBox>
      {!generic &&
        holes.map((h, i) => (
          <mesh
            key={i}
            position={[h[0], PCB_T / 2 + 0.002, h[1]]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[0.1, 0.18, 24]} />
            <meshStandardMaterial
              color="#d8c27a"
              metalness={0.8}
              roughness={0.3}
            />
          </mesh>
        ))}
      {!generic &&
        Array.from({ length: 14 }).map((_, i) => (
          <mesh
            key={"t" + i}
            position={[-1.5 + i * 0.3, PCB_T / 2 + 0.001, 0.8 - (i % 3) * 0.6]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[0.03, 1.4]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.12} />
          </mesh>
        ))}
      {generic && (
        <group position={[0, PCB_T / 2, 0]}>
          <mesh position={[0, 0.1, 0]} castShadow>
            <boxGeometry args={[1.2, 0.2, 1.2]} />
            <meshStandardMaterial color={dark} />
          </mesh>
          <mesh position={[0, 0.2, 1.1]} castShadow>
            <boxGeometry args={[3, 0.4, 0.25]} />
            <meshStandardMaterial color="#151515" />
          </mesh>
        </group>
      )}
    </group>
  );
}

const CODE = `// Blink — the "hello world" of hardware
void setup() {
  Serial.begin(9600);
  pinMode(LED_BUILTIN, OUTPUT); // pin 13
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  Serial.println("LED ON");
  delay(500);
  digitalWrite(LED_BUILTIN, LOW);
  Serial.println("LED OFF");
  delay(500);
}`;

export default function App() {
  const [board, setBoard] = useState(0);
  const [placed, setPlaced] = useState<Set<string>>(
    () => new Set(PARTS.slice(0, 14).map((p) => p.id)),
  );
  const [soldered, setSoldered] = useState(false);
  const [usb, setUsb] = useState(false);
  const [exploded, setExploded] = useState(false);
  const [running, setRunning] = useState(false);
  const [color, setColor] = useState("Blue");
  const [labels, setLabels] = useState(true);
  const [logs, setLogs] = useState<string[]>([
    "> Bench ready. Place the remaining parts.",
  ]);
  const [hover, setHover] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [blink, setBlink] = useState(false);
  const [flick, setFlick] = useState(false);
  const [explode, setExplode] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);

  const log = (s: string) => setLogs((l) => [...l.slice(-80), s]);
  const count = placed.size;
  const powered = usb && soldered && count === TOTAL;
  const status = running
    ? "RUNNING"
    : count === 0
      ? "BARE PCB"
      : count < TOTAL
        ? "ASSEMBLING"
        : !soldered
          ? "NEEDS SOLDER"
          : "READY";

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setExplode((e) => {
        const t = exploded ? 1 : 0;
        return Math.abs(t - e) < 0.002 ? t : e + (t - e) * 0.1;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [exploded]);

  useEffect(() => {
    if (!running) {
      setBlink(false);
      return;
    }
    let on = false;
    let ms = 0;
    const id = setInterval(() => {
      on = !on;
      ms += 500;
      setBlink(on);
      setFlick(true);
      setTimeout(() => setFlick(false), 80);
      log(
        `[${(ms / 1000).toFixed(1).padStart(5, " ")}s] ${on ? "LED ON" : "LED OFF"}`,
      );
    }, 500);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    logRef.current?.scrollTo(0, logRef.current.scrollHeight);
  }, [logs]);

  const stopIfBroken = () => {
    if (running) {
      setRunning(false);
      log("! Power lost — board halted.");
    }
  };

  const actions = [
    {
      label: "Strip to bare PCB",
      icon: Eraser,
      fn: () => {
        setPlaced(new Set());
        setSoldered(false);
        stopIfBroken();
        log("> Stripped down to bare FR-4 PCB.");
      },
    },
    {
      label: "Pick & place SMD",
      icon: Cpu,
      fn: () => {
        setPlaced(
          (s) =>
            new Set([...s, ...PARTS.filter((p) => p.smd).map((p) => p.id)]),
        );
        log("> Pick & place: 10 SMD parts reflowed.");
      },
    },
    {
      label: "Place a part",
      icon: Plus,
      fn: () => {
        const next = PARTS.find(
          (p) => !placed.has(p.id) && (p.smd ? true : true),
        );
        const nextSmd = PARTS.find((p) => p.smd && !placed.has(p.id));
        const pick = nextSmd || next;
        if (!pick) return log("> All 24 parts already placed.");
        setPlaced((s) => new Set([...s, pick.id]));
        if (!pick.smd) setSoldered(false);
        log(`> Placed ${pick.name}.`);
      },
    },
    {
      label: "Solder joints",
      icon: Flame,
      fn: () => {
        if (count < TOTAL) return log("! Place all parts before soldering.");
        setSoldered(true);
        log("> Solder joints flowed. Shiny & conical. ✓");
      },
    },
    {
      label: "Plug / unplug USB",
      icon: Usb,
      fn: () => {
        const n = !usb;
        setUsb(n);
        if (!n) stopIfBroken();
        log(
          n ? "> USB connected — /dev/ttyACM0 @ 9600" : "> USB disconnected.",
        );
      },
    },
    { label: "Exploded view", icon: Layers, fn: () => setExploded((e) => !e) },
    {
      label: running ? "Stop" : "Power on / Run",
      icon: Power,
      fn: () => {
        if (running) {
          setRunning(false);
          return log("> Sketch halted.");
        }
        if (board !== 0)
          return log("! Only Fig. 01 is wired up on this bench.");
        if (count < TOTAL) return log(`! Missing ${TOTAL - count} parts.`);
        if (!soldered) return log("! Cold joints — solder the board first.");
        if (!usb) return log("! No power — plug in USB.");
        log("> avrdude: uploading Blink.ino ... done. 924 bytes.");
        setRunning(true);
      },
    },
  ];

  const isUno = board === 0;
  const litMap = (id: string) => {
    if (!powered) return false;
    if (id === "ledon") return true;
    if (!running) return false;
    if (id === "ledl") return blink;
    if (id === "ledtx") return flick;
    if (id === "ledrx") return false;
    return false;
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#EAE6DF] font-mono text-[#222]">
      {/* sidebar */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-[#222]">
        <div className="border-b border-[#222] p-4">
          <h1 className="text-lg font-bold">Robotics Bench</h1>
          <p className="mt-1 text-xs leading-snug text-[#555]">
            Real boards you can build, power up and break.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {BOARDS.map(([n, s], i) => (
            <button
              key={i}
              onClick={() => {
                setBoard(i);
                setRunning(false);
              }}
              className={`mb-1 w-full rounded-md px-3 py-2 text-left transition ${board === i ? "bg-[#222] text-[#EAE6DF]" : "hover:bg-[#dcd6cb]"}`}
            >
              <div className="text-[10px] opacity-60">
                Fig. {String(i + 1).padStart(2, "0")}
              </div>
              <div className="text-sm font-bold">{n}</div>
              <div className="text-[10px] opacity-60">{s}</div>
            </button>
          ))}
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1">
          {/* controls */}
          <div className="flex w-56 shrink-0 flex-col gap-2 overflow-y-auto border-r border-[#222] p-4">
            <h2 className="text-sm font-bold">
              Fig. {String(board + 1).padStart(2, "0")} — {BOARDS[board][0]}
            </h2>
            <div className="text-[10px] tracking-widest text-[#666]">BENCH</div>
            {actions.map((a) => (
              <button
                key={a.label}
                onClick={a.fn}
                className={`flex items-center gap-2 rounded-full border border-[#222] px-3 py-1.5 text-left text-xs transition hover:bg-[#222] hover:text-[#EAE6DF] ${a.label === "Stop" || (a.label === "Exploded view" && exploded) || (a.label.startsWith("Plug") && usb) ? "bg-[#222] text-[#EAE6DF]" : "bg-[#f3efe7]"}`}
              >
                <a.icon size={13} /> {a.label}
              </button>
            ))}
            <div className="mt-3 text-[10px] tracking-widest text-[#666]">
              PCB COLOUR
            </div>
            <div className="flex gap-2">
              {Object.entries(COLORS).map(([k, v]) => (
                <button
                  key={k}
                  title={k}
                  onClick={() => setColor(k)}
                  style={{ background: v }}
                  className={`h-6 w-6 rounded-full border border-[#222] ${color === k ? "ring-2 ring-[#222] ring-offset-2 ring-offset-[#EAE6DF]" : ""}`}
                />
              ))}
            </div>
            <div className="mt-3 text-[10px] tracking-widest text-[#666]">
              LABELS
            </div>
            <button
              onClick={() => setLabels((l) => !l)}
              className={`w-16 rounded-full border border-[#222] px-3 py-1 text-xs ${labels ? "bg-[#222] text-[#EAE6DF]" : ""}`}
            >
              {labels ? "On" : "Off"}
            </button>
            <div className="mt-auto pt-4 text-[10px] leading-snug text-[#666]">
              <Wrench size={11} className="inline" /> Drag to orbit · scroll to
              zoom
            </div>
          </div>

          {/* viewport */}
          <div className="relative min-w-0 flex-1">
            <Canvas
              shadows
              orthographic
              camera={{ position: [10, 10, 10], zoom: 55 }}
            >
              <color attach="background" args={["#EAE6DF"]} />
              <ambientLight intensity={0.7} />
              <directionalLight
                position={[5, 10, 4]}
                intensity={1.6}
                castShadow
                shadow-mapSize={[2048, 2048]}
                shadow-camera-left={-8}
                shadow-camera-right={8}
                shadow-camera-top={8}
                shadow-camera-bottom={-8}
              />
              <directionalLight position={[-6, 4, -3]} intensity={0.4} />
              {isUno ? (
                <group>
                  <Pcb color={COLORS[color]} explode={explode} />
                  <SolderJoints show={soldered} explode={explode} />
                  {PARTS.map((p) => (
                    <AnimatedPart
                      key={p.id}
                      part={p}
                      placed={placed.has(p.id)}
                      explode={explode}
                      lit={litMap(p.id)}
                      labels={labels}
                      onHover={setHover}
                    />
                  ))}
                  <UsbCable plugged={usb} explode={explode} />
                </group>
              ) : (
                <Pcb
                  color={COLORS[color]}
                  explode={explode}
                  generic={BOARDS[board][0]}
                />
              )}
              <mesh
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, -1.6, 0]}
                receiveShadow
              >
                <planeGeometry args={[60, 60]} />
                <shadowMaterial opacity={0.15} />
              </mesh>
              <ContactShadows
                position={[0, -1.59, 0]}
                opacity={0.35}
                scale={20}
                blur={2.5}
                far={4}
              />
              <OrbitControls
                makeDefault
                enableDamping
                minZoom={25}
                maxZoom={150}
              />
            </Canvas>
            <div className="pointer-events-none absolute right-5 top-4 text-right">
              <div className="text-[10px] tracking-widest text-[#666]">
                PARTS
              </div>
              <div className="text-4xl font-bold">
                {isUno ? count : 12}/{isUno ? TOTAL : 12}
              </div>
              <div className="mt-1 text-[10px] tracking-widest text-[#666]">
                STATUS
              </div>
              <div
                className={`text-xl font-bold ${status === "RUNNING" ? "text-green-700" : ""}`}
              >
                {isUno ? status : "READY"}
              </div>
            </div>
            {hover && (
              <div className="pointer-events-none absolute bottom-4 left-4 rounded-full border border-[#222] bg-[#f5efd9] px-3 py-1 text-xs">
                {hover}
              </div>
            )}
            {!isUno && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-[#222] bg-[#f5efd9] px-3 py-1 text-xs">
                Preview only — Fig. 01 is fully playable
              </div>
            )}
          </div>
        </div>

        {/* info bar */}
        <div className="grid h-60 shrink-0 grid-cols-3 border-t border-[#222]">
          <div className="overflow-y-auto border-r border-[#222] p-4 text-xs leading-relaxed">
            <div className="mb-2 text-[10px] tracking-widest text-[#666]">
              ABOUT THE BOARD
            </div>
            {isUno ? (
              <p>
                The <b>Arduino Uno R3</b> is the classic starter board: an{" "}
                <b>ATmega328P</b> running at <b>16 MHz</b>, 14 digital I/O pins
                (6 PWM), 6 analog inputs and a second chip (ATmega16U2) that
                turns USB into serial. Power it from USB or the 7–12 V barrel
                jack. Pin 13 drives the onboard <b>L</b> LED — perfect for your
                first blink.
              </p>
            ) : (
              <p>
                <b>{BOARDS[board][0]}</b> — {BOARDS[board][1]}. This lab is on
                the bench as a preview; build Fig. 01 end-to-end first.
              </p>
            )}
          </div>
          <div className="flex min-h-0 flex-col border-r border-[#222] p-4">
            <div className="mb-2 flex items-center justify-between text-[10px] tracking-widest text-[#666]">
              TRY IT YOURSELF · BLINK
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(CODE);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1200);
                }}
                className="flex items-center gap-1 rounded-full border border-[#222] px-2 py-0.5 text-[10px] text-[#222] hover:bg-[#222] hover:text-[#EAE6DF]"
              >
                {copied ? <Check size={11} /> : <Copy size={11} />}{" "}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="flex-1 overflow-auto rounded-lg border border-[#222] bg-[#f7f4ee] p-2 text-[11px] leading-snug">
              {CODE}
            </pre>
          </div>
          <div className="flex min-h-0 flex-col p-4">
            <div className="mb-2 flex items-center justify-between text-[10px] tracking-widest text-[#666]">
              SERIAL MONITOR · 9600 BAUD
              <span
                className={`h-2 w-2 rounded-full ${running ? "bg-green-600" : usb ? "bg-amber-500" : "bg-[#999]"}`}
              />
            </div>
            <div
              ref={logRef}
              className="flex-1 overflow-y-auto rounded-lg border border-[#222] bg-[#1c1c1a] p-2 text-[11px] leading-snug text-[#9fe39f]"
            >
              {logs.map((l, i) => (
                <div
                  key={i}
                  className={l.startsWith("!") ? "text-[#ff9a7a]" : ""}
                >
                  {l}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
