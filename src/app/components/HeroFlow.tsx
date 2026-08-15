// Animated hero: agent traffic streams through Breakwater to the LLM. Healthy
// calls pass; a runaway loop builds and is cut at the gate. Pure SVG + CSS
// (GPU transform/opacity only). Reduced-motion users get the static diagram.

const HEALTHY = [
  { cy: 90, delay: 0 },
  { cy: 110, delay: -0.63 },
  { cy: 130, delay: -1.27 },
  { cy: 90, delay: -1.9 },
  { cy: 110, delay: -2.53 },
  { cy: 130, delay: -3.17 },
];

const RED = [0, 0.14, 0.28];

export default function HeroFlow() {
  return (
    <svg
      viewBox="0 0 720 220"
      className="w-full h-auto"
      role="img"
      aria-label="Agent requests flow through Breakwater to the LLM; a runaway loop is caught at the gate."
    >
      {/* Flow guide */}
      <line
        x1="120"
        y1="110"
        x2="600"
        y2="110"
        stroke="#1e293b"
        strokeWidth="1"
        strokeDasharray="2 6"
      />

      {/* Agent node */}
      <g>
        <rect x="24" y="88" width="96" height="44" rx="10" fill="#0f172a" stroke="#1e293b" />
        <text
          x="72"
          y="114"
          textAnchor="middle"
          fill="#94a3b8"
          fontSize="12"
          fontFamily="var(--font-jetbrains)"
          letterSpacing="0.5"
        >
          AGENT
        </text>
      </g>

      {/* LLM node */}
      <g>
        <rect x="600" y="88" width="96" height="44" rx="10" fill="#0f172a" stroke="#1e293b" />
        <text
          x="648"
          y="114"
          textAnchor="middle"
          fill="#94a3b8"
          fontSize="12"
          fontFamily="var(--font-jetbrains)"
          letterSpacing="0.5"
        >
          LLM
        </text>
      </g>

      {/* Breakwater gate */}
      <g className="bw-float">
        <rect
          className="bw-gate-stroke"
          x="340"
          y="45"
          width="28"
          height="130"
          rx="8"
          fill="#111827"
          stroke="#334155"
          strokeWidth="1.5"
        />
        <text
          x="354"
          y="197"
          textAnchor="middle"
          fill="#7c8ba1"
          fontSize="10"
          fontFamily="var(--font-jetbrains)"
          letterSpacing="1.5"
        >
          BREAKWATER
        </text>
      </g>

      {/* Motion layer */}
      <g className="bw-motion">
        {/* Inspection scan line inside the gate */}
        <rect
          className="bw-scanline"
          x="342"
          y="48"
          width="24"
          height="3"
          rx="1.5"
          fill="#9a9ccb"
        />

        {/* Healthy packets */}
        {HEALTHY.map((p, i) => (
          <circle
            key={i}
            className="bw-pkt"
            cx="120"
            cy={p.cy}
            r="4.5"
            fill="#2fb98a"
            style={{ animationDelay: `${p.delay}s` }}
          />
        ))}

        {/* Runaway loop — caught at the gate */}
        {RED.map((d, i) => (
          <circle
            key={i}
            className="bw-red"
            cx="120"
            cy="110"
            r="5"
            fill="#d16a7e"
            style={{ animationDelay: `${d}s` }}
          />
        ))}

        {/* Halt label */}
        <g className="bw-halt">
          <rect
            x="312"
            y="18"
            width="84"
            height="20"
            rx="10"
            fill="#020617"
            stroke="#d16a7e"
            strokeOpacity="0.5"
          />
          <text
            x="354"
            y="31.5"
            textAnchor="middle"
            fill="#d16a7e"
            fontSize="10"
            fontFamily="var(--font-jetbrains)"
            letterSpacing="0.5"
          >
            LOOP HALTED
          </text>
        </g>
      </g>

      {/* Static fallback (reduced motion) */}
      <g className="bw-static">
        <circle cx="220" cy="110" r="4.5" fill="#2fb98a" />
        <circle cx="290" cy="110" r="4.5" fill="#2fb98a" />
        <circle cx="470" cy="110" r="4.5" fill="#2fb98a" />
        <circle cx="540" cy="110" r="4.5" fill="#2fb98a" />
        <text
          x="354"
          y="31.5"
          textAnchor="middle"
          fill="#2fb98a"
          fontSize="10"
          fontFamily="var(--font-jetbrains)"
          letterSpacing="0.5"
        >
          PROTECTED
        </text>
      </g>
    </svg>
  );
}
