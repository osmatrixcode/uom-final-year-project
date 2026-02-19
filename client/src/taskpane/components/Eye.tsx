import * as React from "react";
import { useEffect, useRef, useState, useCallback } from "react";
import { makeStyles } from "@fluentui/react-components";

interface EyeProps {
  isRightEye?: boolean;
  idleTarget: { x: number; y: number } | null;
  trackingPoint: { x: number; y: number } | null;
}

type Mode = "mouse" | "typing" | "idle";

const IDLE_TIMEOUT = 2000;

const useStyles = makeStyles({
  eyeContainer: {
    position: "relative",
    width: "80px",
    height: "80px",
    borderRadius: "50%",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    flexShrink: 0,
  },
  pupil: {
    position: "absolute",
    width: "30px",
    height: "30px",
    backgroundColor: "#000",
    borderRadius: "50%",
    top: "50%",
    left: "50%",
    transitionProperty: "transform",
    transitionTimingFunction: "cubic-bezier(0.25, 0.1, 0.25, 1)",
  },
  eyesWrapper: {
    display: "flex",
    flexDirection: "row",
    gap: "4px",
    alignItems: "center",
    justifyContent: "center",
  },
});

// Idle behaviour patterns that mimic real eye movement
const IDLE_BEHAVIOURS = [
  { x: -0.7, y: -0.1 },
  { x: 0.7, y: -0.1 },
  { x: 0.1, y: -0.6 },
  { x: -0.1, y: 0.4 },
  { x: 0, y: 0 },
  { x: 0.3, y: -0.3 },
  { x: -0.3, y: -0.3 },
  { x: 0, y: 0 },
  { x: -0.4, y: 0.3 },
  { x: 0, y: 0 },
];

// Get the pixel position of the caret in the active element
function getCaretPosition(): { x: number; y: number } | null {
  const el = document.activeElement;
  if (!el) return null;

  // For contenteditable elements — use Selection API to get caret rect
  if (el.getAttribute("contenteditable") === "true") {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        // Collapsed caret — use element position instead
        const elRect = el.getBoundingClientRect();
        return { x: elRect.left + elRect.width / 2, y: elRect.top + elRect.height / 2 };
      }
      return { x: rect.left, y: rect.top + rect.height / 2 };
    }
  }

  // For input/textarea — use a mirror element to measure exact caret pixel position
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const rect = el.getBoundingClientRect();
    const caretIndex = el.selectionStart ?? 0;
    const textBeforeCaret = el.value.substring(0, caretIndex);

    // Create a mirror div that replicates the input's text styling
    const mirror = document.createElement("div");
    const computed = window.getComputedStyle(el);

    // Copy all relevant text styling so character widths match
    const stylesToCopy = [
      "font", "fontSize", "fontFamily", "fontWeight", "fontStyle",
      "letterSpacing", "wordSpacing", "textIndent", "textTransform",
      "paddingLeft", "paddingRight", "paddingTop", "paddingBottom",
      "borderLeftWidth", "borderRightWidth", "boxSizing",
    ] as const;
    stylesToCopy.forEach((prop) => {
      mirror.style[prop as string] = computed[prop];
    });

    mirror.style.position = "absolute";
    mirror.style.visibility = "hidden";
    mirror.style.whiteSpace = el instanceof HTMLTextAreaElement ? "pre-wrap" : "pre";
    mirror.style.width = el instanceof HTMLTextAreaElement ? `${el.clientWidth}px` : "auto";

    // Use a span at the end to mark the caret position
    mirror.textContent = textBeforeCaret;
    const caretMarker = document.createElement("span");
    caretMarker.textContent = "|";
    mirror.appendChild(caretMarker);

    document.body.appendChild(mirror);
    const markerRect = caretMarker.getBoundingClientRect();
    document.body.removeChild(mirror);

    // Offset by the input element's position on screen
    const caretX = rect.left + (markerRect.left - mirror.getBoundingClientRect().left);
    const caretY = rect.top + rect.height / 2;

    // Clamp to within the input bounds
    const clampedX = Math.max(rect.left, Math.min(caretX, rect.right));
    return { x: clampedX, y: caretY };
  }

  return null;
}

const Eye: React.FC<EyeProps> = ({ isRightEye = false, idleTarget, trackingPoint }) => {
  const styles = useStyles();
  const eyeRef = useRef<HTMLDivElement>(null);
  const [pupilPosition, setPupilPosition] = useState({ x: 0, y: 0 });
  const [mode, setMode] = useState<Mode>("idle");
  const mouseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [transitionDuration, setTransitionDuration] = useState("0.15s");

  const defaultPosition = isRightEye ? { x: 6, y: 6 } : { x: -6, y: -6 };
  const maxMovement = 22;

  const clampToEye = useCallback(
    (x: number, y: number) => {
      const dx = x - defaultPosition.x;
      const dy = y - defaultPosition.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > maxMovement) {
        const scale = maxMovement / dist;
        return { x: defaultPosition.x + dx * scale, y: defaultPosition.y + dy * scale };
      }
      return { x, y };
    },
    [defaultPosition.x, defaultPosition.y, maxMovement]
  );

  // Convert a screen-space point to pupil offset relative to eye center
  const pointToOffset = useCallback(
    (px: number, py: number) => {
      if (!eyeRef.current) return { x: defaultPosition.x, y: defaultPosition.y };
      const eyeRect = eyeRef.current.getBoundingClientRect();
      const eyeCenterX = eyeRect.left + eyeRect.width / 2;
      const eyeCenterY = eyeRect.top + eyeRect.height / 2;

      const dx = px - eyeCenterX;
      const dy = py - eyeCenterY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 1) return { x: defaultPosition.x, y: defaultPosition.y };

      const nx = dx / distance;
      const ny = dy / distance;
      const moveX = Math.min(distance, maxMovement) * nx + defaultPosition.x;
      const moveY = Math.min(distance, maxMovement) * ny + defaultPosition.y;
      return clampToEye(moveX, moveY);
    },
    [defaultPosition.x, defaultPosition.y, maxMovement, clampToEye]
  );

  // Apply idle target
  useEffect(() => {
    if (mode !== "idle" || !idleTarget) return;
    setTransitionDuration("0.6s");
    const pos = clampToEye(
      defaultPosition.x + idleTarget.x * maxMovement,
      defaultPosition.y + idleTarget.y * maxMovement
    );
    setPupilPosition(pos);
  }, [idleTarget, mode, clampToEye, defaultPosition.x, defaultPosition.y, maxMovement]);

  // Apply typing tracking point
  useEffect(() => {
    if (mode !== "typing" || !trackingPoint) return;
    setTransitionDuration("0.3s");
    setPupilPosition(pointToOffset(trackingPoint.x, trackingPoint.y));
  }, [trackingPoint, mode, pointToOffset]);

  // Mouse tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!eyeRef.current) return;

      setMode("mouse");
      setTransitionDuration("0.15s");

      if (mouseTimerRef.current) clearTimeout(mouseTimerRef.current);
      mouseTimerRef.current = setTimeout(() => setMode("idle"), IDLE_TIMEOUT);

      setPupilPosition(pointToOffset(e.clientX, e.clientY));
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (mouseTimerRef.current) clearTimeout(mouseTimerRef.current);
    };
  }, [pointToOffset]);

  // Typing mode — keydown sets mode to typing, which pauses idle but not mouse
  useEffect(() => {
    const handleKeyDown = () => {
      // Only switch to typing if not currently mouse-tracking
      if (mode === "mouse") return;

      setMode("typing");
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => setMode("idle"), IDLE_TIMEOUT);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [mode]);

  // Initialize position
  useEffect(() => {
    setPupilPosition({ x: defaultPosition.x, y: defaultPosition.y });
  }, [defaultPosition.x, defaultPosition.y]);

  return (
    <div ref={eyeRef} className={styles.eyeContainer}>
      <div
        className={styles.pupil}
        style={{
          transform: `translate(-50%, -50%) translate(${pupilPosition.x}px, ${pupilPosition.y}px)`,
          transitionDuration,
        }}
      />
    </div>
  );
};

export const Eyes: React.FC = () => {
  const styles = useStyles();
  const [idleTarget, setIdleTarget] = useState<{ x: number; y: number } | null>(null);
  const [trackingPoint, setTrackingPoint] = useState<{ x: number; y: number } | null>(null);
  const behaviourIndexRef = useRef(0);
  const isIdleRef = useRef(true);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track mouse/typing activity for idle detection
  useEffect(() => {
    const markActive = () => {
      isIdleRef.current = false;
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        isIdleRef.current = true;
      }, IDLE_TIMEOUT);
    };

    window.addEventListener("mousemove", markActive);
    window.addEventListener("keydown", markActive);
    return () => {
      window.removeEventListener("mousemove", markActive);
      window.removeEventListener("keydown", markActive);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  // Detect typing and get caret position
  useEffect(() => {
    const handleKeyDown = () => {
      // Small delay so the caret position updates after the keystroke
      requestAnimationFrame(() => {
        const pos = getCaretPosition();
        if (pos) setTrackingPoint(pos);
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Idle animation loop
  useEffect(() => {
    const scheduleNext = () => {
      const delay = 800 + Math.random() * 1700;
      return setTimeout(() => {
        if (isIdleRef.current) {
          const behaviour = IDLE_BEHAVIOURS[behaviourIndexRef.current % IDLE_BEHAVIOURS.length];
          const jitterX = (Math.random() - 0.5) * 0.15;
          const jitterY = (Math.random() - 0.5) * 0.15;
          setIdleTarget({ x: behaviour.x + jitterX, y: behaviour.y + jitterY });
          behaviourIndexRef.current++;
        }
        timerId = scheduleNext();
      }, delay);
    };

    let timerId = scheduleNext();
    return () => clearTimeout(timerId);
  }, []);

  return (
    <div className={styles.eyesWrapper}>
      <Eye isRightEye={false} idleTarget={idleTarget} trackingPoint={trackingPoint} />
      <Eye isRightEye={true} idleTarget={idleTarget} trackingPoint={trackingPoint} />
    </div>
  );
};
