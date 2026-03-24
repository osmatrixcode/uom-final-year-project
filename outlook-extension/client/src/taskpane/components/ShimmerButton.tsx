import * as React from "react";

/* Adapted from MagicUI shimmer-button — no Tailwind required */

const SHIMMER_STYLE_ID = "shimmer-button-keyframes";

function injectKeyframes() {
  if (typeof document === "undefined") return;
  if (document.getElementById(SHIMMER_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = SHIMMER_STYLE_ID;
  style.textContent = `
    @keyframes shimmer-slide {
      to { transform: translate(calc(100cqw - 100%), 0); }
    }
    @keyframes spin-around {
      0%   { transform: translateZ(0) rotate(0);   }
      15%, 35% { transform: translateZ(0) rotate(90deg);  }
      65%, 85% { transform: translateZ(0) rotate(270deg); }
      100% { transform: translateZ(0) rotate(360deg); }
    }
    .shimmer-btn {
      position: relative;
      z-index: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.15);
      cursor: pointer;
      color: #fff;
      transition: transform 0.15s ease-in-out;
      container-type: inline-size;
    }
    .shimmer-btn:active { transform: translateY(1px); }
    .shimmer-spark {
      position: absolute;
      inset: 0;
      overflow: visible;
      z-index: -3;
      filter: blur(2px);
      container-type: size;
    }
    .shimmer-spark-inner {
      position: absolute;
      inset: 0;
      aspect-ratio: 1;
      height: 100cqh;
      animation: shimmer-slide var(--shimmer-speed) ease-in-out infinite alternate;
    }
    .shimmer-spark-rotate {
      position: absolute;
      inset: -100%;
      width: auto;
      animation: spin-around calc(var(--shimmer-speed) * 2) linear infinite;
      background: conic-gradient(
        from calc(270deg - (var(--shimmer-spread) * 0.5)),
        transparent 0,
        var(--shimmer-color) var(--shimmer-spread),
        transparent var(--shimmer-spread)
      );
    }
    .shimmer-highlight {
      position: absolute;
      inset: 0;
      border-radius: inherit;
      box-shadow: inset 0 -8px 10px rgba(255,255,255,0.12);
      transition: box-shadow 0.3s ease;
    }
    .shimmer-btn:hover .shimmer-highlight {
      box-shadow: inset 0 -6px 10px rgba(255,255,255,0.22);
    }
    .shimmer-btn:active .shimmer-highlight {
      box-shadow: inset 0 -10px 10px rgba(255,255,255,0.22);
    }
    .shimmer-backdrop {
      position: absolute;
      border-radius: inherit;
      background: var(--shimmer-bg);
      z-index: -2;
    }
  `;
  document.head.appendChild(style);
}

export interface ShimmerButtonProps extends React.ComponentPropsWithoutRef<"button"> {
  shimmerColor?: string;
  shimmerSize?: string;
  shimmerDuration?: string;
  shimmerSpread?: string;
  borderRadius?: string;
  background?: string;
}

export const ShimmerButton = React.forwardRef<HTMLButtonElement, ShimmerButtonProps>(
  (
    {
      shimmerColor = "#ffffff",
      shimmerDuration = "3s",
      shimmerSpread = "90deg",
      borderRadius = "100px",
      background = "rgba(0,0,0,1)",
      style,
      children,
      ...props
    },
    ref
  ) => {
    React.useEffect(() => {
      injectKeyframes();
    }, []);

    const insetSize = "2px";

    return (
      <button
        ref={ref}
        className="shimmer-btn"
        style={
          {
            "--shimmer-color": shimmerColor,
            "--shimmer-speed": shimmerDuration,
            "--shimmer-spread": shimmerSpread,
            "--shimmer-bg": background,
            borderRadius,
            ...style,
          } as React.CSSProperties
        }
        {...props}
      >
        <div className="shimmer-spark">
          <div className="shimmer-spark-inner">
            <div className="shimmer-spark-rotate" />
          </div>
        </div>

        {children}

        <div className="shimmer-highlight" />

        <div
          className="shimmer-backdrop"
          style={{ inset: insetSize }}
        />
      </button>
    );
  }
);

ShimmerButton.displayName = "ShimmerButton";
