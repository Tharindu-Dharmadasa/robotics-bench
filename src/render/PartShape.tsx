// ─────────────────────────────────────────────────────────────────────────────
// Draws what a part LOOKS like, based on its `kind`. Each case composes the
// basic shapes (IsoBox, IsoCylinder) into something recognisable.
// `isActive` is true while the part is lit (e.g. a motor that is spinning).
// ─────────────────────────────────────────────────────────────────────────────
import {motion} from 'framer-motion';
import type {PartDefinition} from '../data/types';
import {IsoBox, IsoCylinder, OUTLINE_STYLE, ellipseRadii, projectToScreen, toPolygonPoints} from './isometric';

const METAL = '#c9ccd2', GOLD = '#d8b04a';

export function PartShape({part, isActive}: {part: PartDefinition; isActive: boolean}) {
  const {x, y, width: w, depth: d, height: h, color} = part;
  const centerX = x + w / 2, centerY = y + d / 2;
  const topCenter = projectToScreen(centerX, centerY, h);
  const evenlySpaced = (count: number, index: number) => x + (w * (index + 0.5)) / count; // x position of the index-th of `count` items

  switch (part.kind) {
    case 'resistor': // tan body, colour bands across the top, metal legs at both ends
      return (<g>
        <IsoBox x={x - 6} y={centerY - 1} width={7} depth={2} height={2} color={METAL} />
        <IsoBox x={x + w - 1} y={centerY - 1} width={7} depth={2} height={2} color={METAL} />
        <IsoBox x={x} y={y} width={w} depth={d} height={h} color={color} />
        {(part.bands ?? []).map((bandColor, index) => {
          const bandX = x + w * (0.22 + index * 0.16);
          return <polygon key={index} fill={bandColor} points={toPolygonPoints([[bandX, y, h], [bandX + 4, y, h], [bandX + 4, y + d, h], [bandX, y + d, h]])} />;
        })}
      </g>);

    case 'led': { // flange + round body + shiny top
      const {rx, ry} = ellipseRadii(w / 2);
      return (<g>
        <IsoCylinder cx={centerX} cy={centerY} radius={w / 2 + 1.5} height={3} color={color} />
        <IsoCylinder cx={centerX} cy={centerY} radius={w / 2} height={h} color={color} z0={3} />
        <ellipse cx={topCenter.x + 3 + 3} cy={topCenter.y + 3} rx={rx * 0.3} ry={ry * 0.3} fill="#fff" opacity={0.55} />
      </g>);
    }

    case 'capacitor': { // electrolytic can with a silver, ringed top
      const {rx, ry} = ellipseRadii(w / 2);
      return (<g>
        <IsoCylinder cx={centerX} cy={centerY} radius={w / 2} height={h} color={color} />
        <ellipse cx={topCenter.x} cy={topCenter.y} rx={rx * 0.7} ry={ry * 0.7} fill={METAL} {...OUTLINE_STYLE} strokeWidth={1} />
      </g>);
    }

    case 'chip': { // black package, a row of pins on both long sides, and a pin-1 dot
      const pinsPerSide = part.pinCount ?? Math.max(4, Math.round(w / 7));
      return (<g>
        {Array.from({length: pinsPerSide}, (_, i) => (<g key={i}>
          <IsoBox x={evenlySpaced(pinsPerSide, i) - 1.2} y={y - 3} width={2.4} depth={3.5} height={2} color={METAL} />
          <IsoBox x={evenlySpaced(pinsPerSide, i) - 1.2} y={y + d - 0.5} width={2.4} depth={3.5} height={2} color={METAL} />
        </g>))}
        <IsoBox x={x} y={y} width={w} depth={d} height={h} color={color} />
        <ellipse cx={projectToScreen(x + 5, y + 5, h).x} cy={projectToScreen(x + 5, y + 5, h).y} rx={3} ry={1.7} fill="#fff" opacity={0.7} />
      </g>);
    }

    case 'header': { // black plastic strip with gold pins standing up
      const pinCount = part.pinCount ?? 4;
      return (<g>
        <IsoBox x={x} y={y} width={w} depth={d} height={5} color={color} />
        {Array.from({length: pinCount}, (_, i) => <IsoBox key={i} x={evenlySpaced(pinCount, i) - 1.2} y={centerY - 1.2} width={2.4} depth={2.4} height={7} z0={5} color={GOLD} />)}
      </g>);
    }

    case 'terminal': { // green screw terminal block: one round screw head per wire
      const screwCount = part.pinCount ?? 2;
      const {rx, ry} = ellipseRadii(4.5);
      return (<g>
        <IsoBox x={x} y={y} width={w} depth={d} height={h} color={color} />
        {Array.from({length: screwCount}, (_, i) => {
          const screw = projectToScreen(evenlySpaced(screwCount, i), centerY, h);
          return <g key={i}><ellipse cx={screw.x} cy={screw.y} rx={rx} ry={ry} fill={METAL} {...OUTLINE_STYLE} strokeWidth={1} /><line x1={screw.x - rx * 0.6} y1={screw.y} x2={screw.x + rx * 0.6} y2={screw.y} stroke="var(--ink)" strokeWidth={1.2} /></g>;
        })}
      </g>);
    }

    case 'heatsink': { // thin base plate with tall parallel fins
      const finCount = Math.floor(w / 6);
      return (<g>
        <IsoBox x={x} y={y} width={w} depth={d} height={4} color={color} />
        {Array.from({length: finCount}, (_, i) => <IsoBox key={i} x={x + 1 + i * 6} y={y} width={3.2} depth={d} height={h} z0={4} color={color} />)}
      </g>);
    }

    case 'relay': // blue cube with a white label on top
      return (<g>
        <IsoBox x={x} y={y} width={w} depth={d} height={h} color={color} />
        <polygon fill="#e9ecef" stroke="var(--ink)" strokeWidth={1} points={toPolygonPoints([[x + 5, y + 5, h], [x + w - 5, y + 5, h], [x + w - 5, y + d - 5, h], [x + 5, y + d - 5, h]])} />
      </g>);

    case 'motor': { // metal can, a shaft on top, and a dashed ring that "spins" while running
      const {rx, ry} = ellipseRadii(w / 2 * 0.72);
      return (<g>
        <IsoCylinder cx={centerX} cy={centerY} radius={w / 2} height={h * 0.8} color={color} />
        <motion.ellipse cx={projectToScreen(centerX, centerY, h * 0.8).x} cy={projectToScreen(centerX, centerY, h * 0.8).y} rx={rx} ry={ry}
          fill="none" stroke="#fff" strokeWidth={2} strokeDasharray="8 8" initial={false}
          animate={isActive ? {strokeDashoffset: [0, -32]} : {strokeDashoffset: 0}}
          transition={isActive ? {duration: 0.5, repeat: Infinity, ease: 'linear'} : {duration: 0}} />
        <IsoCylinder cx={centerX} cy={centerY} radius={3} height={9} z0={h * 0.8} color={METAL} />
      </g>);
    }

    case 'eye': { // ultrasonic transducer: a silver can with a dark mesh face
      const {rx, ry} = ellipseRadii(w / 2 * 0.7);
      return (<g>
        <IsoCylinder cx={centerX} cy={centerY} radius={w / 2} height={h} color={color} />
        <ellipse cx={topCenter.x} cy={topCenter.y} rx={rx} ry={ry} fill="#2a2d33" stroke="var(--ink)" strokeWidth={1} />
      </g>);
    }

    case 'connector': // metal-shelled port with a dark opening (USB)
      return <IsoBox x={x} y={y} width={w} depth={d} height={h} color={color} windowed={part.hasWindow ?? true} />;

    default: // 'block': any plain component (regulator, diode, jumper wire...)
      return <IsoBox x={x} y={y} width={w} depth={d} height={h} color={color} windowed={part.hasWindow} />;
  }
}
