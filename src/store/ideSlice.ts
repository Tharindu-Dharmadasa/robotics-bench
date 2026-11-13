import type { StateCreator } from "zustand";
import { BOARDS_BY_ID } from "../data/boards";
import { getTelemetryLines } from "../data/telemetry";
import { getHint } from "../engine/lessonTasks";
import type { SerialLogEntry, SerialLogType } from "../data/types";
import type { BenchStore } from "./benchStore";

const MAX_LOG_LINES = 200;

const wait = async (milliseconds: number): Promise<void> =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

const makeId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export type IdeTab = "code" | "serial";

export interface IdeSlice {
  isIdeOpen: boolean;
  ideTab: IdeTab;
  baudRate: number;
  isAutoscroll: boolean;
  serialLog: SerialLogEntry[];
  uploadedBoardIds: string[]; // boards that have a sketch on them (kept after power-off, like flash memory)
  uploadProgress: number | null; // 0..1 while uploading, otherwise null

  openIde: () => void;
  closeIde: () => void;
  toggleIde: () => void;
  setIdeOpen: (isOpen: boolean) => void;
  setIdeTab: (tab: IdeTab) => void;
  setBaudRate: (baudRate: number) => void;
  toggleAutoscroll: () => void;
  clearSerial: () => void;
  uploadSketch: () => Promise<void>;
  sendSerialCommand: (command: string) => Promise<void>;
  startTelemetry: (boardId: string) => void;
  stopTelemetry: () => void;
}

export const createIdeSlice: StateCreator<BenchStore, [], [], IdeSlice> = (
  set,
  get,
) => {
  let telemetryTimer: ReturnType<typeof setInterval> | null = null;
  const stopTelemetry = () => {
    if (telemetryTimer) clearInterval(telemetryTimer);
    telemetryTimer = null;
  };

  /** Adds one line to the serial monitor (newest last, capped so it never grows forever). */
  const log = (type: SerialLogType, text: string) =>
    set((store: BenchStore) => ({
      serialLog: [
        ...store.serialLog,
        { id: makeId(), type, text, timestamp: Date.now() },
      ].slice(-MAX_LOG_LINES),
    }));

  /** Every second, print what the running sketch would print, based on the REAL board state. */
  const startTelemetry = (boardId: string) => {
    stopTelemetry();
    let tick = 0,
      lastErrorText = "";
    telemetryTimer = setInterval(() => {
      const store = get(),
        board = BOARDS_BY_ID[boardId],
        state = store.boardStates[boardId];
      if (store.currentBoardId !== boardId || !state?.isPowered) return; // paused while you look at another board or it is unplugged
      getTelemetryLines(board, state, tick++).forEach((line) => {
        log(line.type, line.text);
        if (line.type === "error" && line.text !== lastErrorText) {
          // print the hint once per new error, not every second
          lastErrorText = line.text;
          log("system", `Hint: ${getHint(board, state)}`);
        }
      });
    }, 1000);
  };

  return {
    isIdeOpen: false,
    ideTab: "code",
    baudRate: 9600,
    isAutoscroll: true,
    serialLog: [],
    uploadedBoardIds: [],
    uploadProgress: null,

    openIde: () => set({ isIdeOpen: true }),
    closeIde: () => set({ isIdeOpen: false }),
    toggleIde: () =>
      set((store: BenchStore) => ({ isIdeOpen: !store.isIdeOpen })),
    setIdeOpen: (isOpen) => set({ isIdeOpen: isOpen }),
    setIdeTab: (tab) => set({ ideTab: tab }),
    setBaudRate: (baudRate) => set({ baudRate }),
    toggleAutoscroll: () =>
      set((store: BenchStore) => ({ isAutoscroll: !store.isAutoscroll })),
    clearSerial: () => set({ serialLog: [] }),
    startTelemetry,
    stopTelemetry,

    /** Simulated flash: compile, connect to the programmer, write, verify. Needs power and a sketch. */
    uploadSketch: async () => {
      const store = get(),
        board = BOARDS_BY_ID[store.currentBoardId],
        state = store.boardStates[board.id];
      if (store.uploadProgress !== null) return; // already uploading
      if (!board.sketch) {
        log("error", "This circuit has no microcontroller: nothing to upload.");
        return;
      }
      if (!state?.isPowered || state.lastResult?.status === "DEAD") {
        log(
          "error",
          "Upload failed: the board has no power. Plug in USB first.",
        );
        return;
      }

      stopTelemetry();
      const programmer = board.id === "esp32" ? "esptool" : "avrdude";
      const bytes = board.sketch.length * 7; // a believable fake size
      set({ serialLog: [], uploadProgress: 0.1 });
      log("system", "Compiling sketch...");
      await wait(700);
      log("system", `Sketch uses ${bytes} bytes of program storage.`);
      set({ uploadProgress: 0.3 });
      log("system", `${programmer}: connecting to the board...`);
      await wait(600);
      for (let step = 1; step <= 6; step++) {
        set({ uploadProgress: 0.3 + step * 0.1 });
        await wait(220);
      }
      log("system", `${programmer}: wrote ${bytes} bytes and verified them.`);
      set((current: BenchStore) => ({
        uploadProgress: null,
        uploadedBoardIds: [...new Set([...current.uploadedBoardIds, board.id])],
      }));
      log("system", "Upload complete. Sketch running.");
      startTelemetry(board.id);
    },

    /** The command box at the bottom of the serial monitor. */
    sendSerialCommand: async (rawCommand) => {
      const command = rawCommand.trim();
      if (!command) return;
      log("tx", `> ${command}`);
      await wait(250); // the "board" takes a moment to answer
      const store = get(),
        board = BOARDS_BY_ID[store.currentBoardId],
        state = store.boardStates[board.id];
      if (!store.uploadedBoardIds.includes(board.id)) {
        log("error", "No sketch is running. Upload one first.");
        return;
      }
      if (!state?.isPowered) {
        log("error", "No response: the board is unpowered.");
        return;
      }
      switch (command.toLowerCase()) {
        case "help":
          log("rx", "Commands: help, status, version, hint, reset");
          break;
        case "version":
          log("rx", "Robotics Bench firmware 1.0 (simulated)");
          break;
        case "status":
          log(
            "rx",
            `${state.lastResult?.status ?? "UNKNOWN"}, ${state.lastResult?.currentMilliamps ?? 0} mA`,
          );
          break;
        case "hint":
          log("rx", getHint(board, state));
          break;
        case "reset":
          log("system", "Board reset.");
          startTelemetry(board.id);
          break;
        default:
          log("error", `Unknown command "${command}". Type help.`);
      }
    },
  };
};

