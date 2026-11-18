import React from 'react';

export const MangaloreSkylineSvg: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <svg
      viewBox="0 0 1440 225"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`w-full h-auto block select-none ${className}`}
      role="img"
      aria-label="Architectural skyline illustration of Mangalore and Namma Kudla featuring Sultan Battery lighthouse, coastal temple gopuram, twin-spire cathedral, tiled heritage roof, New Mangalore Port gantry crane, and Arabian Sea fishing boat"
      preserveAspectRatio="xMidYMax slice"
    >
      <defs>
        <linearGradient id="mlr-sky-clouds" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#CEE5DC" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#FFFDF5" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="mlr-sea-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3B627D" />
          <stop offset="50%" stopColor="#5D8AA8" />
          <stop offset="100%" stopColor="#2F3E4E" />
        </linearGradient>
        <linearGradient id="mlr-gold-beam-right" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#F9C80E" stopOpacity="0.62" />
          <stop offset="100%" stopColor="#F9C80E" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="mlr-gold-beam-left" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" stopColor="#F9C80E" stopOpacity="0.62" />
          <stop offset="100%" stopColor="#F9C80E" stopOpacity="0" />
        </linearGradient>
        <clipPath id="mlr-plaque-clip">
          <rect x="598" y="179" width="244" height="28" rx="6" />
        </clipPath>
      </defs>

      {/* Soft Architectural Cloud Silhouettes */}
      <g fill="url(#mlr-sky-clouds)">
        <g className="mlr-cloud-drift">
          <path d="M120 145c0-22 18-40 40-40 6 0 12 1 17 4 9-19 28-32 51-32 29 0 53 21 57 49 4-1 8-2 13-2 20 0 36 16 36 36H120z" />
          <path d="M890 140c0-22 18-40 40-40 7 0 14 2 20 5 10-20 31-33 55-33 32 0 58 24 61 55 5-2 10-3 16-3 19 0 34 15 34 34H890z" />
        </g>
        <g className="mlr-cloud-drift-alt">
          <path d="M460 135c0-26 21-46 46-46 10 0 19 3 27 8 11-24 35-41 64-41 37 0 67 28 70 64 6-2 12-3 19-3 22 0 40 18 40 40H460z" />
          <path d="M1195 148c0-20 16-36 36-36 8 0 16 3 22 7 10-18 30-30 52-30 33 0 60 27 60 60h-170z" />
        </g>
      </g>

      {/* Distant Birds */}
      <g stroke="#2F3E4E" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.62">
        <g className="mlr-bird-glide">
          <path d="M108 62c4-5 9-5 13 0 4-5 9-5 13 0" className="mlr-bird-wing" />
          <path d="M132 48c3-4 7-4 10 0 3-4 7-4 10 0" className="mlr-bird-wing mlr-delay-1" />
        </g>
        <g className="mlr-bird-glide-delayed">
          <path d="M980 54c4-5 9-5 13 0 4-5 9-5 13 0" className="mlr-bird-wing mlr-delay-2" />
          <path d="M1335 42c4-5 9-5 13 0 4-5 9-5 13 0" className="mlr-bird-wing" />
        </g>
      </g>

      {/* ================== 1. ARABIAN SEA & FISHING BOAT (LEFT SHORE) ================== */}
      {/* Lighthouse Beacon Glow */}
      <g className="mlr-beam-sweep" style={{ transformOrigin: '233px 53px' }}>
        <polygon points="222,52 80,22 80,82" fill="url(#mlr-gold-beam-left)" />
        <polygon points="244,52 385,24 385,80" fill="url(#mlr-gold-beam-right)" opacity="0.72" />
      </g>

      {/* Left Palm Trees */}
      <g>
        <g className="mlr-palm-sway" style={{ transformOrigin: '92px 182px' }}>
          <path d="M92 182 Q82 140 74 102" stroke="#2F3E4E" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M74 102 Q52 92 38 106 Q58 106 74 102Z" fill="#5D8AA8" stroke="#2F3E4E" strokeWidth="1.2" />
          <path d="M74 102 Q58 80 45 84 Q62 92 74 102Z" fill="#CEE5DC" stroke="#2F3E4E" strokeWidth="1.2" />
          <path d="M74 102 Q82 76 102 82 Q86 92 74 102Z" fill="#8DB8A8" stroke="#2F3E4E" strokeWidth="1.2" />
          <path d="M74 102 Q98 94 110 112 Q92 108 74 102Z" fill="#5D8AA8" stroke="#2F3E4E" strokeWidth="1.2" />
        </g>

        <g className="mlr-palm-sway-alt" style={{ transformOrigin: '142px 178px' }}>
          <path d="M142 178 Q149 144 156 116" stroke="#2F3E4E" strokeWidth="4" strokeLinecap="round" />
          <path d="M156 116 Q136 108 124 120 Q142 120 156 116Z" fill="#8DB8A8" stroke="#2F3E4E" strokeWidth="1.1" />
          <path d="M156 116 Q150 94 166 92 Q160 106 156 116Z" fill="#CEE5DC" stroke="#2F3E4E" strokeWidth="1.1" />
          <path d="M156 116 Q178 106 188 120 Q172 118 156 116Z" fill="#5D8AA8" stroke="#2F3E4E" strokeWidth="1.1" />
        </g>
      </g>

      {/* ================== 2. LIGHTHOUSE HILL / KAUP LIGHTHOUSE ================== */}
      <g>
        {/* Rocky plinth */}
        <path d="M196 190 L204 168 L262 168 L270 190 Z" fill="#FFE1B3" stroke="#2F3E4E" strokeWidth="1.6" />
        {/* Banded Tower */}
        <polygon points="212,168 220,68 246,68 254,168" fill="#FFFDF5" stroke="#2F3E4E" strokeWidth="1.8" />
        <polygon points="214,148 252,148 250,126 216,126" fill="#C85A32" />
        <polygon points="218,104 248,104 247,84 219,84" fill="#C85A32" />
        {/* Re-stroke tower outline cleanly */}
        <polygon points="212,168 220,68 246,68 254,168" fill="none" stroke="#2F3E4E" strokeWidth="1.8" />
        {/* Doorway & Windows */}
        <path d="M227 168 V154 A6 6 0 0 1 239 154 V168 Z" fill="#2F3E4E" />
        <rect x="230" y="111" width="6" height="9" rx="3" fill="#2F3E4E" />
        <rect x="230" y="72" width="6" height="8" rx="1" fill="#2F3E4E" />
        {/* Gallery Deck */}
        <rect x="213" y="62" width="40" height="6" rx="1.5" fill="#2F3E4E" />
        {/* Lantern Room */}
        <rect x="221" y="45" width="24" height="17" fill="#F9C80E" stroke="#2F3E4E" strokeWidth="1.6" className="mlr-glow-pulse" />
        <line x1="229" y1="45" x2="229" y2="62" stroke="#2F3E4E" strokeWidth="1.3" />
        <line x1="237" y1="45" x2="237" y2="62" stroke="#2F3E4E" strokeWidth="1.3" />
        {/* Dome Cupola */}
        <path d="M219 45 Q233 27 247 45 Z" fill="#2F3E4E" />
        <line x1="233" y1="35" x2="233" y2="25" stroke="#2F3E4E" strokeWidth="2" strokeLinecap="round" />
        <circle cx="233" cy="24" r="2.2" fill="#F9C80E" className="mlr-glow-pulse mlr-delay-1" />
      </g>

      {/* ================== 3. MANGALORE DRAVIDIAN TEMPLE GOPURAM ================== */}
      <g>
        {/* Mandapa / Base Pavilion */}
        <rect x="304" y="156" width="144" height="36" fill="#FFE1B3" stroke="#2F3E4E" strokeWidth="1.7" />
        <rect x="298" y="149" width="156" height="8" rx="1" fill="#C85A32" stroke="#2F3E4E" strokeWidth="1.6" />
        {/* Temple Entrance Gate */}
        <rect x="360" y="160" width="32" height="32" fill="#2F3E4E" />
        <rect x="366" y="166" width="20" height="26" fill="#C85A32" />
        {/* Mandapa Pillars */}
        {[316, 330, 344, 404, 418, 432].map((px) => (
          <rect key={px} x={px} y="157" width="5" height="35" fill="#FFFDF5" stroke="#2F3E4E" strokeWidth="1.2" />
        ))}
        {/* Tier 1 */}
        <rect x="316" y="129" width="120" height="20" fill="#FEF2C8" stroke="#2F3E4E" strokeWidth="1.6" />
        <rect x="312" y="123" width="128" height="7" fill="#F9C80E" stroke="#2F3E4E" strokeWidth="1.5" />
        {[324, 342, 360, 384, 402, 420].map((wx) => (
          <path key={wx} d={`M${wx} 148 V136 A4 4 0 0 1 ${wx + 8} 136 V148 Z`} fill="#2F3E4E" />
        ))}
        {/* Tier 2 */}
        <rect x="328" y="105" width="96" height="18" fill="#FFE1B3" stroke="#2F3E4E" strokeWidth="1.6" />
        <rect x="324" y="99" width="104" height="7" fill="#C85A32" stroke="#2F3E4E" strokeWidth="1.5" />
        {[337, 355, 373, 391, 409].map((wx) => (
          <rect key={wx} x={wx} y="109" width="7" height="12" rx="2" fill="#2F3E4E" />
        ))}
        {/* Tier 3 */}
        <rect x="340" y="83" width="72" height="16" fill="#FEF2C8" stroke="#2F3E4E" strokeWidth="1.5" />
        <rect x="336" y="77" width="80" height="7" fill="#F9C80E" stroke="#2F3E4E" strokeWidth="1.5" />
        {/* Tier 4 */}
        <rect x="352" y="64" width="48" height="13" fill="#FFE1B3" stroke="#2F3E4E" strokeWidth="1.5" />
        <path d="M348 64 Q376 47 404 64 Z" fill="#C85A32" stroke="#2F3E4E" strokeWidth="1.6" />
        {/* Golden Kalashas */}
        {[362, 376, 390].map((kx, idx) => (
          <g key={kx} className={`mlr-glow-pulse ${idx === 1 ? 'mlr-delay-1' : idx === 2 ? 'mlr-delay-2' : ''}`}>
            <line x1={kx} y1="50" x2={kx} y2="39" stroke="#2F3E4E" strokeWidth="1.6" />
            <circle cx={kx} cy="39" r="3" fill="#F9C80E" stroke="#2F3E4E" strokeWidth="1.2" />
          </g>
        ))}
      </g>

      {/* ================== 4. ST. ALOYSIUS / MILAGRES TWIN-SPIRE CATHEDRAL ================== */}
      <g>
        {/* Main Nave Facade */}
        <rect x="498" y="104" width="136" height="88" fill="#FFFDF5" stroke="#2F3E4E" strokeWidth="1.8" />
        {/* Left & Right Belfry Towers */}
        <rect x="492" y="66" width="38" height="126" fill="#FEF2C8" stroke="#2F3E4E" strokeWidth="1.8" />
        <rect x="602" y="66" width="38" height="126" fill="#FEF2C8" stroke="#2F3E4E" strokeWidth="1.8" />
        {/* Twin Spires */}
        <polygon points="494,66 511,16 528,66" fill="#FFE1B3" stroke="#2F3E4E" strokeWidth="1.8" />
        <polygon points="604,66 621,16 638,66" fill="#FFE1B3" stroke="#2F3E4E" strokeWidth="1.8" />
        {/* Center Gable */}
        <polygon points="530,104 566,58 602,104" fill="#FFFDF5" stroke="#2F3E4E" strokeWidth="1.8" />
        {/* Golden Crosses */}
        <g stroke="#2F3E4E" strokeWidth="1.8" strokeLinecap="round">
          <line x1="511" y1="16" x2="511" y2="5" />
          <line x1="506" y1="9" x2="516" y2="9" />
          <line x1="621" y1="16" x2="621" y2="5" />
          <line x1="616" y1="9" x2="626" y2="9" />
          <line x1="566" y1="58" x2="566" y2="45" />
          <line x1="561" y1="50" x2="571" y2="50" />
        </g>
        {/* Rose Window */}
        <circle cx="566" cy="108" r="16" fill="#CEE5DC" stroke="#2F3E4E" strokeWidth="1.8" />
        <circle cx="566" cy="108" r="8" fill="#F9C80E" stroke="#2F3E4E" strokeWidth="1.3" className="mlr-glow-pulse mlr-delay-2" />
        {/* Gothic Arched Windows & Doors */}
        <path d="M504 98 V82 A7 7 0 0 1 518 82 V98 Z" fill="#2F3E4E" />
        <path d="M614 98 V82 A7 7 0 0 1 628 82 V98 Z" fill="#2F3E4E" />
        <path d="M503 142 V122 A8 8 0 0 1 519 122 V142 Z" fill="#3B627D" stroke="#2F3E4E" strokeWidth="1.3" />
        <path d="M613 142 V122 A8 8 0 0 1 629 122 V142 Z" fill="#3B627D" stroke="#2F3E4E" strokeWidth="1.3" />
        <path d="M551 192 V154 A15 15 0 0 1 581 154 V192 Z" fill="#2F3E4E" />
        <path d="M504 192 V164 A7 7 0 0 1 518 164 V192 Z" fill="#2F3E4E" />
        <path d="M614 192 V164 A7 7 0 0 1 628 164 V192 Z" fill="#2F3E4E" />
      </g>

      {/* ================== 5. MANGALORE TILED HERITAGE MANOR ================== */}
      <g>
        {/* Main Building */}
        <rect x="668" y="138" width="122" height="54" fill="#FFFDF5" stroke="#2F3E4E" strokeWidth="1.7" />
        {/* Sloped Mangalore Terracotta Roof */}
        <polygon points="656,138 682,110 776,110 802,138" fill="#C85A32" stroke="#2F3E4E" strokeWidth="1.7" />
        {/* Upper Dormer Gable */}
        <rect x="708" y="96" width="42" height="16" fill="#FEF2C8" stroke="#2F3E4E" strokeWidth="1.5" />
        <polygon points="702,96 729,82 756,96" fill="#C85A32" stroke="#2F3E4E" strokeWidth="1.5" />
        {/* Roof Tile Lines */}
        <line x1="674" y1="124" x2="784" y2="124" stroke="#2F3E4E" strokeWidth="1" opacity="0.45" />
        {/* Veranda Arches & Windows */}
        {[682, 704, 726, 748, 768].map((vx) => (
          <path key={vx} d={`M${vx} 192 V164 A6 6 0 0 1 ${vx + 12} 164 V192 Z`} fill="#2F3E4E" />
        ))}
        <rect x="684" y="144" width="14" height="10" rx="1" fill="#3B627D" stroke="#2F3E4E" strokeWidth="1.2" />
        <rect x="722" y="144" width="14" height="10" rx="1" fill="#3B627D" stroke="#2F3E4E" strokeWidth="1.2" />
        <rect x="760" y="144" width="14" height="10" rx="1" fill="#3B627D" stroke="#2F3E4E" strokeWidth="1.2" />
      </g>

      {/* ================== 6. MODERN MANGALORE SKYLINE & TOWERS ================== */}
      <g>
        {/* Tower A */}
        <rect x="820" y="102" width="44" height="90" fill="#5D8AA8" stroke="#2F3E4E" strokeWidth="1.6" />
        {[110, 124, 138, 152, 166].map((wy, idx) => (
          <g key={wy}>
            <rect x="827" y={wy} width="11" height="8" fill="#FFFDF5" opacity="0.85" />
            <rect
              x="845"
              y={wy}
              width="11"
              height="8"
              fill="#F9C80E"
              className={idx % 2 === 0 ? `mlr-glow-pulse ${idx === 2 ? 'mlr-delay-2' : 'mlr-delay-1'}` : ''}
              opacity="0.85"
            />
          </g>
        ))}
        {/* Tower B */}
        <rect x="870" y="76" width="54" height="116" fill="#2F3E4E" stroke="#1E293B" strokeWidth="1.6" />
        <rect x="878" y="68" width="38" height="8" fill="#F9C80E" stroke="#2F3E4E" strokeWidth="1.3" />
        {[86, 100, 114, 128, 142, 156, 170].map((wy, idx) => (
          <g key={wy}>
            <rect
              x="878"
              y={wy}
              width="15"
              height="7"
              fill="#CEE5DC"
              className={idx % 3 === 0 ? `mlr-glow-pulse ${idx === 3 ? 'mlr-delay-3' : 'mlr-delay-1'}` : ''}
            />
            <rect x="899" y={wy} width="17" height="7" fill="#FEF2C8" />
          </g>
        ))}
        {/* Tower C */}
        <rect x="930" y="114" width="42" height="78" fill="#CEE5DC" stroke="#2F3E4E" strokeWidth="1.6" />
        {[122, 136, 150, 164].map((wy) => (
          <g key={wy}>
            <rect x="937" y={wy} width="28" height="7" fill="#3B627D" />
          </g>
        ))}
      </g>

      {/* Right Coastal Palm Silhouette */}
      <g className="mlr-palm-sway" style={{ transformOrigin: '1018px 190px' }}>
        <path d="M1018 190 Q1010 130 1002 74" stroke="#2F3E4E" strokeWidth="5" strokeLinecap="round" />
        <path d="M1002 74 Q972 60 952 80 Q978 80 1002 74Z" fill="#5D8AA8" stroke="#2F3E4E" strokeWidth="1.3" />
        <path d="M1002 74 Q982 44 964 46 Q986 60 1002 74Z" fill="#CEE5DC" stroke="#2F3E4E" strokeWidth="1.3" />
        <path d="M1002 74 Q1016 40 1038 48 Q1018 62 1002 74Z" fill="#8DB8A8" stroke="#2F3E4E" strokeWidth="1.3" />
        <path d="M1002 74 Q1034 62 1050 84 Q1024 82 1002 74Z" fill="#5D8AA8" stroke="#2F3E4E" strokeWidth="1.3" />
      </g>

      {/* ================== 7. NEW MANGALORE PORT CRANE & CARGO SHIP ================== */}
      <g>
        {/* Port Gantry Crane Frame */}
        <line x1="1115" y1="184" x2="1128" y2="54" stroke="#2F3E4E" strokeWidth="4" />
        <line x1="1182" y1="184" x2="1168" y2="54" stroke="#2F3E4E" strokeWidth="4" />
        <line x1="1123" y1="126" x2="1174" y2="126" stroke="#2F3E4E" strokeWidth="3.2" />
        <line x1="1126" y1="90" x2="1171" y2="90" stroke="#2F3E4E" strokeWidth="2.8" />
        {/* Crane Boom */}
        <line x1="1065" y1="74" x2="1295" y2="74" stroke="#3B627D" strokeWidth="5" strokeLinecap="round" />
        <line x1="1148" y1="38" x2="1075" y2="74" stroke="#2F3E4E" strokeWidth="2.2" />
        <line x1="1148" y1="38" x2="1282" y2="74" stroke="#2F3E4E" strokeWidth="2.2" />
        <polygon points="1138,54 1148,36 1158,54" fill="#F9C80E" stroke="#2F3E4E" strokeWidth="1.6" />

        {/* Animated Crane Trolley & Hoisted Container */}
        <g className="mlr-crane-trolley">
          <rect x="1220" y="76" width="16" height="8" fill="#F9C80E" stroke="#2F3E4E" strokeWidth="1.2" />
          <g className="mlr-crane-hoist">
            <line x1="1228" y1="84" x2="1228" y2="106" stroke="#2F3E4E" strokeWidth="1.6" />
            <rect x="1212" y="106" width="32" height="16" fill="#C85A32" stroke="#2F3E4E" strokeWidth="1.4" />
          </g>
        </g>

        {/* Cargo Ship Bobbing in Port Harbor */}
        <g className="mlr-ship-bob" style={{ transformOrigin: '1284px 176px' }}>
          {/* Bridge */}
          <rect x="1212" y="128" width="28" height="36" fill="#FFFDF5" stroke="#2F3E4E" strokeWidth="1.6" />
          <rect x="1217" y="133" width="18" height="6" fill="#2F3E4E" />
          <rect x="1222" y="114" width="10" height="14" fill="#C85A32" stroke="#2F3E4E" strokeWidth="1.4" />
          {/* Stacked Containers */}
          <rect x="1248" y="148" width="28" height="16" fill="#F9C80E" stroke="#2F3E4E" strokeWidth="1.4" />
          <rect x="1276" y="148" width="28" height="16" fill="#3B627D" stroke="#2F3E4E" strokeWidth="1.4" />
          <rect x="1304" y="148" width="28" height="16" fill="#CEE5DC" stroke="#2F3E4E" strokeWidth="1.4" />
          <rect x="1262" y="132" width="28" height="16" fill="#C85A32" stroke="#2F3E4E" strokeWidth="1.4" />
          <rect x="1290" y="132" width="28" height="16" fill="#F9C80E" stroke="#2F3E4E" strokeWidth="1.4" />
          {/* Ship Hull */}
          <path d="M1196 164 H1372 L1356 192 H1206 Z" fill="#2F3E4E" stroke="#1E293B" strokeWidth="1.6" />
          <path d="M1201 182 H1362 L1356 192 H1206 Z" fill="#C85A32" />
        </g>
      </g>

      {/* ================== FOLIAGE CLUSTERS ALONG HORIZON ================== */}
      <g fill="#5D8AA8" stroke="#2F3E4E" strokeWidth="1.4">
        <circle cx="276" cy="180" r="14" fill="#8DB8A8" />
        <circle cx="294" cy="176" r="18" fill="#5D8AA8" />
        <circle cx="468" cy="178" r="16" fill="#8DB8A8" />
        <circle cx="484" cy="182" r="13" fill="#CEE5DC" />
        <circle cx="648" cy="178" r="16" fill="#8DB8A8" />
        <circle cx="806" cy="176" r="18" fill="#5D8AA8" />
        <circle cx="984" cy="180" r="16" fill="#8DB8A8" />
      </g>

      {/* ================== ARABIAN SEA WATER & COASTAL BASELINE ================== */}
      {/* Right Port Water Strip */}
      <path d="M990 190 Q1110 184 1230 190 T1440 188 V225 H990 Z" fill="url(#mlr-sea-grad)" />
      <path
        d="M1015 202 Q1075 196 1135 202 T1265 200 T1395 202"
        stroke="#CEE5DC"
        strokeWidth="1.6"
        fill="none"
        opacity="0.65"
        className="mlr-wave-shift"
      />

      {/* Center Heritage Terracotta & Coastal Sand Ground */}
      <rect x="200" y="190" width="820" height="35" fill="#FEF2C8" />
      <line x1="200" y1="190" x2="1020" y2="190" stroke="#2F3E4E" strokeWidth="1.8" />

      {/* Left Arabian Sea & Traditional Boat */}
      <path d="M0 176 Q110 170 218 188 L225 225 H0 Z" fill="url(#mlr-sea-grad)" />
      <path d="M140 182 Q215 178 275 194 L290 225 H150 Z" fill="#FFE1B3" />
      <g className="mlr-wave-shift">
        <path d="M10 198 Q65 192 120 198 T220 198" stroke="#CEE5DC" strokeWidth="1.6" fill="none" opacity="0.7" />
        <path d="M25 210 Q85 204 145 210" stroke="#FFFDF5" strokeWidth="1.4" fill="none" opacity="0.55" />
      </g>

      {/* Traditional Mangalore Wooden Fishing Boat */}
      <g className="mlr-boat-bob" style={{ transformOrigin: '105px 182px' }}>
        <path d="M58 178 Q104 192 152 176 L142 192 Q102 200 66 192 Z" fill="#C85A32" stroke="#2F3E4E" strokeWidth="1.6" />
        <path d="M62 182 Q104 194 148 180" stroke="#F9C80E" strokeWidth="2.4" fill="none" />
        <line x1="104" y1="184" x2="104" y2="148" stroke="#2F3E4E" strokeWidth="2" />
        <path d="M104 150 L132 174 L104 176 Z" fill="#FFFDF5" stroke="#2F3E4E" strokeWidth="1.3" />
      </g>

      {/* Signature Coastal Gold & Terracotta Flowing Ribbon Across Foreground */}
      <path
        d="M0 214 Q280 194 560 206 T1120 204 T1440 212 L1440 225 L0 225 Z"
        fill="#F9C80E"
        stroke="#2F3E4E"
        strokeWidth="1.4"
      />
      <path
        d="M0 220 Q340 204 680 214 T1440 217 L1440 225 L0 225 Z"
        fill="#C85A32"
        opacity="0.9"
      />

      {/* Centered Heritage Emblem Plaque: MANGALORE <-> NAMMA KUDLA (4s alternating transition) */}
      <g>
        <rect
          x="592"
          y="174"
          width="256"
          height="38"
          rx="10"
          fill="#FFFDF5"
          stroke="#2F3E4E"
          strokeWidth="2.2"
        />
        <rect
          x="596.5"
          y="178.5"
          width="247"
          height="29"
          rx="7"
          fill="none"
          stroke="#F9C80E"
          strokeWidth="1.4"
        />
        <g clipPath="url(#mlr-plaque-clip)">
          <text
            x="720"
            y="198.5"
            textAnchor="middle"
            fill="#2F3E4E"
            className="mlr-title-a"
            style={{
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              fontWeight: 800,
              fontSize: '16px',
              letterSpacing: '3.5px',
            }}
          >
            MANGALORE
          </text>
          <text
            x="720"
            y="198.5"
            textAnchor="middle"
            fill="#2F3E4E"
            className="mlr-title-b"
            style={{
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              fontWeight: 800,
              fontSize: '16px',
              letterSpacing: '3px',
            }}
          >
            NAMMA KUDLA
          </text>
        </g>
      </g>
    </svg>
  );
};
