import { useId } from 'react';

interface VcplBrandLogoProps {
  variant?: 'header' | 'footer';
  className?: string;
}

export function VcplBrandLogo({ variant = 'header', className = '' }: VcplBrandLogoProps) {
  const uid = useId().replace(/:/g, '');
  const isFooter = variant === 'footer';
  const clipId = `vcpl-box-clip-${uid}`;
  const sheenId = `vcpl-box-sheen-${uid}`;

  // 4 equal cells inside unified rounded box: x=2..114 (width=112 -> 28 per letter)
  const cells = [
    { letter: 'V', x: 2, isFirst: true, delayClass: 'vcpl-cell-1' },
    { letter: 'C', x: 30, isFirst: false, delayClass: 'vcpl-cell-2' },
    { letter: 'P', x: 58, isFirst: false, delayClass: 'vcpl-cell-3' },
    { letter: 'L', x: 86, isFirst: false, delayClass: 'vcpl-cell-4' },
  ];

  return (
    <svg
      viewBox="0 0 232 48"
      className={`vcpl-brand-logo h-9 sm:h-10 w-auto select-none overflow-visible ${
        isFooter
          ? '[--vcpl-ink:#FFFDF5] [--vcpl-cut:#24313F] [--vcpl-shadow:#18222C] [--vcpl-shadow-stroke:#CEE5DC] [--vcpl-border:#FFFDF5] [--vcpl-first-bg:#FFFDF5] [--vcpl-first-ink:#2F3E4E] [--vcpl-main-bg:#F9C80E] [--vcpl-main-ink:#2F3E4E] [--vcpl-divider:rgba(47,62,78,0.25)] [--vcpl-dot1:#CEE5DC] [--vcpl-dot2:#F9C80E]'
          : '[--vcpl-ink:#2F3E4E] dark:[--vcpl-ink:#FFFDF5] [--vcpl-cut:#FEF2C8] dark:[--vcpl-cut:#0F172A] [--vcpl-shadow:#F9C80E] dark:[--vcpl-shadow:#1E293B] [--vcpl-shadow-stroke:#2F3E4E] dark:[--vcpl-shadow-stroke:#F9C80E] [--vcpl-border:#2F3E4E] dark:[--vcpl-border:#FFFDF5] [--vcpl-first-bg:#F9C80E] [--vcpl-first-ink:#2F3E4E] [--vcpl-main-bg:#2F3E4E] dark:[--vcpl-main-bg:#FFFDF5] [--vcpl-main-ink:#FFFDF5] dark:[--vcpl-main-ink:#0F172A] [--vcpl-divider:rgba(255,253,245,0.24)] dark:[--vcpl-divider:rgba(15,23,42,0.22)] [--vcpl-dot1:#F9C80E] [--vcpl-dot2:#2F3E4E] dark:[--vcpl-dot2:#CEE5DC]'
      } ${className}`}
      role="img"
      aria-label="VCPL Tools"
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="2" y="5" width="112" height="32" rx="7.5" />
        </clipPath>
        <linearGradient id={sheenId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.28" />
          <stop offset="55%" stopColor="#FFFDF5" stopOpacity="0.42" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Hard Tactile Offset Accent Layer (Theme Signature) */}
      <rect
        className="vcpl-logo-shadow"
        x="5"
        y="8"
        width="112"
        height="32"
        rx="7.5"
        fill="var(--vcpl-shadow)"
        stroke="var(--vcpl-shadow-stroke)"
        strokeWidth="1.2"
      />

      {/* Tactile Keycap Group (Box + Letters + Sheen + Frame) */}
      <g className="vcpl-logo-keycap">
        {/* Unified Box-Structured Container Holding ALL 4 Letters V | C | P | L */}
        <g clipPath={`url(#${clipId})`}>
          <rect x="2" y="5" width="112" height="32" fill="var(--vcpl-main-bg)" />
          {/* First Cell Accent for 'V' */}
          <rect className="vcpl-first-cell" x="2" y="5" width="28" height="32" fill="var(--vcpl-first-bg)" />

          {/* Crisp Letter-Box Vertical Dividers */}
          <line x1="30" y1="5" x2="30" y2="37" stroke="var(--vcpl-divider)" strokeWidth="1.25" />
          <line x1="58" y1="5" x2="58" y2="37" stroke="var(--vcpl-divider)" strokeWidth="1.25" />
          <line x1="86" y1="5" x2="86" y2="37" stroke="var(--vcpl-divider)" strokeWidth="1.25" />

          {/* Diagonal Sweeping Specular Sheen Across Keycap */}
          <rect
            className="vcpl-logo-sheen"
            x="-36"
            y="1"
            width="28"
            height="42"
            transform="skewX(-22)"
            fill={`url(#${sheenId})`}
          />

          {/* Centered Bold Box Typography with Staggered Micro-Pop */}
          {cells.map((cell) => (
            <text
              key={cell.letter}
              className={`vcpl-letter-pop ${cell.delayClass}`}
              x={cell.x + 14}
              y="29"
              textAnchor="middle"
              fill={cell.isFirst ? 'var(--vcpl-first-ink)' : 'var(--vcpl-main-ink)'}
              style={{
                fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                fontWeight: 800,
                fontSize: '21px',
                letterSpacing: '0px',
              }}
            >
              {cell.letter}
            </text>
          ))}
        </g>

        {/* Crisp Outer Frame Border Around VCPL Box */}
        <rect
          x="2"
          y="5"
          width="112"
          height="32"
          rx="7.5"
          fill="none"
          stroke="var(--vcpl-border)"
          strokeWidth="1.8"
        />
      </g>

      {/* Compact Two-Dot Modern Corner Accent */}
      <circle
        className="vcpl-dot-primary"
        cx="104"
        cy="43.2"
        r="3.4"
        fill="var(--vcpl-dot1)"
        stroke="var(--vcpl-border)"
        strokeWidth="1.1"
      />
      <circle
        className="vcpl-dot-secondary"
        cx="112.5"
        cy="45.2"
        r="1.8"
        fill="var(--vcpl-dot2)"
      />

      {/* Right Wordmark: T [O1] [O2] L S */}
      <text
        className="vcpl-wordmark-t"
        x="141"
        y="30.5"
        textAnchor="end"
        fill="var(--vcpl-ink)"
        style={{
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          fontWeight: 800,
          fontSize: '27px',
        }}
      >
        T
      </text>

      {/* First Geometric 'O' — Orbital Swap + Precision 45° Diagonal Cut */}
      <g className="vcpl-o-left-orbit">
        <g className="vcpl-o-left">
          <circle
            cx="153.5"
            cy="21"
            r="8.2"
            fill="none"
            stroke="var(--vcpl-ink)"
            strokeWidth="5"
          />
          <line
            x1="146.8"
            y1="27.7"
            x2="160.2"
            y2="14.3"
            stroke="var(--vcpl-cut)"
            strokeWidth="2.4"
            strokeLinecap="butt"
          />
        </g>
      </g>

      {/* Second Geometric 'O' — Orbital Swap + Precision -45° Counter-Angle Cut with Gold Index */}
      <g className="vcpl-o-right-orbit">
        <g className="vcpl-o-right">
          <circle
            cx="177.5"
            cy="21"
            r="8.2"
            fill="none"
            stroke="var(--vcpl-ink)"
            strokeWidth="5"
          />
          <line
            x1="170.8"
            y1="14.3"
            x2="184.2"
            y2="27.7"
            stroke="var(--vcpl-cut)"
            strokeWidth="2.4"
            strokeLinecap="butt"
          />
          <circle
            className="vcpl-o-core"
            cx="177.5"
            cy="21"
            r="2.1"
            fill="var(--vcpl-dot1)"
          />
        </g>
      </g>

      <text
        className="vcpl-wordmark-ls"
        x="190.5"
        y="30.5"
        textAnchor="start"
        fill="var(--vcpl-ink)"
        style={{
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          fontWeight: 800,
          fontSize: '27px',
          letterSpacing: '0.5px',
        }}
      >
        LS
      </text>
    </svg>
  );
}

