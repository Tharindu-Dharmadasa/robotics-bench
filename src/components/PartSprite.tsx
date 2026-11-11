// ─────────────────────────────────────────────────────────────────────────────
// ONE component on the board (resistor, LED, chip...). It is "dumb": it receives
// flags like isPlaced / isBurned and animates between looks. It never decides
// anything itself. That is how clicks and animations stay connected: state
// changes -> props change -> Framer Motion animates to the new look.
// ─────────────────────────────────────────────────────────────────────────────
import { motion } from "framer-motion";
import * as Tooltip from "@radix-ui/react-tooltip";
import type { PartDefinition } from "../data/types";
import { IsoBox, projectToScreen, toPolygonPoints } from "../render/isometric";

/** The three "looks" a part can have. Framer Motion tweens between them automatically. */
const partLooks = {
  inTheBin: { y: -170, opacity: 0 }, // floating above the board, invisible
  placed: {
    y: 0,
    x: 0,
    opacity: 1,
    transition: { type: "spring" as const, stiffness: 170, damping: 11 },
  }, // drops in with a bounce
  burned: {
    y: 0,
    opacity: 1,
    x: [0, -5, 5, -4, 4, 0],
    transition: { duration: 0.5 },
  }, // shakes once
};

interface PartSpriteProps {
  part: PartDefinition;
  isPlaced: boolean;
  isSoldered: boolean;
  isBurned: boolean;
  isGlowing: boolean;
  isBlinking: boolean;
  isHovered: boolean;
  onClick: () => void;
  onHoverChange: (isHovering: boolean) => void;
}

export function PartSprite({
  part,
  isPlaced,
  isSoldered,
  isBurned,
  isGlowing,
  isBlinking,
  isHovered,
  onClick,
  onHoverChange,
}: PartSpriteProps) {
  const topCenter = projectToScreen(
    part.x + part.width / 2,
    part.y + part.depth / 2,
    part.height,
  );
  // Two solder joints, drawn just in front of the part.
  const solderJoints = [0.25, 0.75].map((fraction) =>
    projectToScreen(part.x + part.width * fraction, part.y + part.depth + 3),
  );
  const currentLook = isBurned ? "burned" : isPlaced ? "placed" : "inTheBin";

  return (
    <g>
      {/* Dashed outline showing where the part goes; fades out once it is placed. */}
      <motion.polygon
        initial={false}
        animate={{ opacity: isPlaced ? 0 : 1 }}
        fill="none"
        stroke="var(--accent)"
        strokeDasharray="5 4"
        strokeWidth={1.5}
        points={toPolygonPoints([
          [part.x, part.y, 0],
          [part.x + part.width, part.y, 0],
          [part.x + part.width, part.y + part.depth, 0],
          [part.x, part.y + part.depth, 0],
        ])}
      />

      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <motion.g
            initial={false}
            variants={partLooks}
            animate={currentLook}
            style={{ cursor: "pointer" }}
            onClick={onClick}
            onMouseEnter={() => onHoverChange(true)}
            onMouseLeave={() => onHoverChange(false)}
          >
            {/* The part's body. Burned parts turn grey/dark; hovered parts get an orange glow. */}
            <g
              className={isBurned ? "grayscale brightness-[.35]" : ""}
              style={
                isHovered
                  ? { filter: "drop-shadow(0 0 3px var(--accent))" }
                  : undefined
              }
            >
              <IsoBox
                x={part.x}
                y={part.y}
                width={part.width}
                depth={part.depth}
                height={part.height}
                color={part.color}
              />
            </g>

            {/* Light glow for LEDs: fades in when lit, flashes on/off when blinking. */}
            <motion.ellipse
              cx={topCenter.x}
              cy={topCenter.y}
              rx={24}
              ry={13}
              fill={part.glowColor ?? "#ffffff"}
              className="pointer-events-none blur-md"
              initial={false}
              animate={{
                opacity: isGlowing ? (isBlinking ? [0.95, 0] : 0.95) : 0,
              }}
              transition={
                isGlowing && isBlinking
                  ? {
                      duration: 0.5,
                      repeat: Infinity,
                      repeatType: "reverse",
                      ease: "linear",
                    }
                  : { duration: 0.3 }
              }
            />

            {/* Three smoke puffs that rise forever while the part is burned. */}
            {isBurned &&
              [0, 0.6, 1.2].map((delay) => (
                <motion.circle
                  key={delay}
                  cx={topCenter.x + delay * 8 - 8}
                  cy={topCenter.y}
                  r={5}
                  fill="var(--ink)"
                  className="pointer-events-none"
                  animate={{ y: -46, scale: 2.2, opacity: [0.55, 0] }}
                  transition={{ duration: 1.8, repeat: Infinity, delay }}
                />
              ))}

            {/* Name label shown while hovered (from the parts bin or the board). */}
            {isHovered && (
              <text
                x={topCenter.x}
                y={topCenter.y - 24}
                textAnchor="middle"
                fontSize={11}
                fill="var(--ink)"
                stroke="var(--surface)"
                strokeWidth={4}
                paintOrder="stroke"
              >
                {part.name}
              </text>
            )}
          </motion.g>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            sideOffset={6}
            className="rounded bg-[var(--ink)] px-2 py-1 text-xs text-[var(--paper)]"
          >
            {part.name}: {part.description}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>

      {/* Solder joints: grey when unsoldered, glowing orange (with a pop) once soldered. */}
      {solderJoints.map((joint, index) => (
        <motion.circle
          key={index}
          cx={joint.x}
          cy={joint.y}
          r={3}
          stroke="var(--ink)"
          initial={false}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
          animate={{
            opacity: isPlaced ? 1 : 0,
            fill: isSoldered ? "#e6a817" : "#8c8c8c",
            scale: isSoldered ? [1.9, 1] : 1,
          }}
        />
      ))}
    </g>
  );
}
