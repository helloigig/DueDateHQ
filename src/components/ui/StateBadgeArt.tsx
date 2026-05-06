import * as React from "react";
import { cn } from "@/lib/utils";
import { STATE_NAMES, type StateCode } from "@/types";

// StateBadgeArt — circular state-identity badge for *display* surfaces only
// (Client detail header, StateAlertCard hero). NOT for list-scan contexts —
// those keep the two-letter `StateBadge`. Designed badges live for 19 states
// (the 14 active product states + 5 visually distinctive flagship flags from
// the identity index). Codes outside this set fall back to a cream circle
// with a two-letter monogram so the visual language stays consistent.

export type StateBadgeArtSize = "xs" | "sm" | "md" | "lg" | "xl";

const sizePx: Record<StateBadgeArtSize, number> = {
  xs: 20,
  sm: 28,
  md: 32,
  lg: 56,
  xl: 88,
};

const fallbackTextSize: Record<StateBadgeArtSize, string> = {
  xs: "text-[8px]",
  sm: "text-[10px]",
  md: "text-xs",
  lg: "text-sm",
  xl: "text-lg",
};

export interface StateBadgeArtProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "title"> {
  /** Two-letter state code (CA, NY, …) or "FED" / "IRS" for federal. */
  code: string;
  size?: StateBadgeArtSize;
  /** Override the tooltip; defaults to the resolved state name. */
  title?: string;
}

export const StateBadgeArt = React.forwardRef<HTMLSpanElement, StateBadgeArtProps>(
  ({ code, size = "md", title, className, ...rest }, ref) => {
    const px = sizePx[size];
    const upper = code.toUpperCase();
    const Designed = DESIGNED_BADGES[upper];
    const tooltip = title ?? STATE_NAMES[upper as StateCode] ?? upper;

    return (
      <span
        ref={ref}
        title={tooltip}
        aria-label={tooltip}
        className={cn(
          "inline-flex items-center justify-center shrink-0 leading-none",
          className,
        )}
        style={{ width: px, height: px }}
        {...rest}
      >
        {Designed ? (
          <Designed />
        ) : (
          // Letter-monogram fallback — solid navy disk with cream letters.
          // Borderless to match the designed badges; navy/cream rhymes
          // with TX/NY/PA so a mixed row still reads as one set.
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width={px} height={px}>
            <circle cx="100" cy="100" r="95" fill="#1A3263" />
            <text
              x="100"
              y="100"
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
              fontWeight={700}
              fontSize={upper.length > 2 ? 56 : 80}
              fill="#EFE4BD"
              letterSpacing={upper.length > 2 ? -2 : -3}
            >
              {upper}
            </text>
          </svg>
        )}
        {/* Visually-hidden text for screen readers + size sanity. */}
        <span className={cn("sr-only", fallbackTextSize[size])}>{tooltip}</span>
      </span>
    );
  },
);
StateBadgeArt.displayName = "StateBadgeArt";

// ─── Designed badges ──────────────────────────────────────────────
// Source: files/state-identity-index.html (`stateBadges` object).
// 19 of 50 states have designed badges as of 2026-05-06.
// Adding a new badge: copy the SVG body from the identity index and
// register it under its uppercase state code below.

type BadgeComponent = React.FC;

const Badge_CA: BadgeComponent = () => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <circle cx="100" cy="100" r="95" fill="#EFE4BD" />
    <path d="M52,38 L58,57 L78,57 L62,69 L68,88 L52,76 L36,88 L42,69 L26,57 L46,57 Z" fill="#B91C1C" />
    <g fill="#2A1A0E">
      <ellipse cx="148" cy="100" rx="24" ry="14" />
      <ellipse cx="105" cy="110" rx="58" ry="22" />
      <circle cx="48" cy="100" r="17" />
      <ellipse cx="28" cy="108" rx="13" ry="6" />
      <circle cx="50" cy="80" r="7" />
      <rect x="58" y="128" width="14" height="22" />
      <rect x="80" y="128" width="14" height="22" />
      <rect x="120" y="128" width="14" height="22" />
      <rect x="142" y="128" width="14" height="22" />
      <circle cx="172" cy="92" r="6" />
    </g>
    <circle cx="52" cy="96" r="2" fill="#EFE4BD" />
    <rect x="20" y="160" width="160" height="7" fill="#B91C1C" />
  </svg>
);

const Badge_TX: BadgeComponent = () => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <circle cx="100" cy="100" r="95" fill="#002868" />
    <path d="M100,28 L120,88 L184,88 L132,124 L152,184 L100,148 L48,184 L68,124 L16,88 L80,88 Z" fill="#FFFFFF" />
  </svg>
);

const Badge_NY: BadgeComponent = () => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <circle cx="100" cy="100" r="95" fill="#1A3263" />
    <path d="M100,28 C70,55 60,85 78,118 C82,100 92,90 105,90 C108,118 122,118 138,108 C138,82 120,52 110,38 C105,55 100,55 100,28 Z" fill="#F4B83C" />
    <path d="M100,55 C88,75 86,95 96,115 C100,100 105,93 110,90 C106,75 102,62 100,55 Z" fill="#FFE08A" />
    <rect x="78" y="120" width="44" height="10" fill="#E8C547" />
    <rect x="86" y="130" width="28" height="36" fill="#E8C547" />
    <rect x="72" y="166" width="56" height="12" fill="#E8C547" />
  </svg>
);

const Badge_FL: BadgeComponent = () => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <defs>
      <clipPath id="b-fl-c">
        <circle cx="100" cy="100" r="95" />
      </clipPath>
    </defs>
    <g clipPath="url(#b-fl-c)">
      <rect x="0" y="0" width="200" height="200" fill="#FBF3D6" />
      <line x1="10" y1="10" x2="190" y2="190" stroke="#C5273E" strokeWidth="24" />
      <line x1="190" y1="10" x2="10" y2="190" stroke="#C5273E" strokeWidth="24" />
    </g>
    <circle cx="100" cy="100" r="34" fill="#F4B83C" stroke="#1A1814" strokeWidth="2.5" />
    <g stroke="#F4B83C" strokeWidth="7" strokeLinecap="round">
      <line x1="100" y1="63" x2="100" y2="52" />
      <line x1="100" y1="137" x2="100" y2="148" />
      <line x1="63" y1="100" x2="52" y2="100" />
      <line x1="137" y1="100" x2="148" y2="100" />
    </g>
  </svg>
);

const Badge_HI: BadgeComponent = () => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <defs>
      <clipPath id="b-hi-c">
        <circle cx="100" cy="100" r="95" />
      </clipPath>
    </defs>
    <g clipPath="url(#b-hi-c)">
      <rect x="0" y="0" width="200" height="25" fill="#FFFFFF" />
      <rect x="0" y="25" width="200" height="25" fill="#BB133E" />
      <rect x="0" y="50" width="200" height="25" fill="#1F4E8C" />
      <rect x="0" y="75" width="200" height="25" fill="#FFFFFF" />
      <rect x="0" y="100" width="200" height="25" fill="#BB133E" />
      <rect x="0" y="125" width="200" height="25" fill="#1F4E8C" />
      <rect x="0" y="150" width="200" height="25" fill="#FFFFFF" />
      <rect x="0" y="175" width="200" height="25" fill="#BB133E" />
      <rect x="0" y="0" width="100" height="100" fill="#1F4E8C" />
      <line x1="0" y1="0" x2="100" y2="100" stroke="#FFFFFF" strokeWidth="14" />
      <line x1="0" y1="0" x2="100" y2="100" stroke="#BB133E" strokeWidth="6" />
      <line x1="100" y1="0" x2="0" y2="100" stroke="#FFFFFF" strokeWidth="14" />
      <line x1="100" y1="0" x2="0" y2="100" stroke="#BB133E" strokeWidth="6" />
      <line x1="50" y1="0" x2="50" y2="100" stroke="#FFFFFF" strokeWidth="22" />
      <line x1="0" y1="50" x2="100" y2="50" stroke="#FFFFFF" strokeWidth="22" />
      <line x1="50" y1="0" x2="50" y2="100" stroke="#BB133E" strokeWidth="10" />
      <line x1="0" y1="50" x2="100" y2="50" stroke="#BB133E" strokeWidth="10" />
    </g>
  </svg>
);

const Badge_AK: BadgeComponent = () => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <circle cx="100" cy="100" r="95" fill="#0B1D3A" />
    <path d="M154,32 L162,52 L184,52 L166,66 L172,86 L154,74 L136,86 L142,66 L124,52 L146,52 Z" fill="#F4B83C" />
    <g fill="#F4B83C">
      <circle cx="50" cy="78" r="7" />
      <circle cx="72" cy="92" r="7" />
      <circle cx="92" cy="104" r="7" />
      <circle cx="116" cy="116" r="7" />
      <circle cx="124" cy="138" r="7" />
      <circle cx="100" cy="148" r="7" />
      <circle cx="76" cy="138" r="7" />
    </g>
  </svg>
);

const Badge_AZ: BadgeComponent = () => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <defs>
      <clipPath id="b-az-c">
        <circle cx="100" cy="100" r="95" />
      </clipPath>
    </defs>
    <g clipPath="url(#b-az-c)">
      <rect x="0" y="100" width="200" height="100" fill="#003F87" />
      <path d="M100,100 L0,100 L2.9,76 Z" fill="#CD212A" />
      <path d="M100,100 L2.9,76 L11.5,53.5 Z" fill="#F4B83C" />
      <path d="M100,100 L11.5,53.5 L25,33.7 Z" fill="#CD212A" />
      <path d="M100,100 L25,33.7 L43.2,17.7 Z" fill="#F4B83C" />
      <path d="M100,100 L43.2,17.7 L64.5,6.5 Z" fill="#CD212A" />
      <path d="M100,100 L64.5,6.5 L88,0.7 Z" fill="#F4B83C" />
      <path d="M100,100 L88,0.7 L112,0.7 Z" fill="#CD212A" />
      <path d="M100,100 L112,0.7 L135.5,6.5 Z" fill="#F4B83C" />
      <path d="M100,100 L135.5,6.5 L157,17.7 Z" fill="#CD212A" />
      <path d="M100,100 L157,17.7 L175,33.7 Z" fill="#F4B83C" />
      <path d="M100,100 L175,33.7 L188.5,53.5 Z" fill="#CD212A" />
      <path d="M100,100 L188.5,53.5 L197,76 Z" fill="#F4B83C" />
      <path d="M100,100 L197,76 L200,100 Z" fill="#CD212A" />
      <path d="M100,68 L110,96 L138,96 L116,114 L124,142 L100,124 L76,142 L84,114 L62,96 L90,96 Z" fill="#B87333" />
    </g>
  </svg>
);

const Badge_NM: BadgeComponent = () => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <circle cx="100" cy="100" r="95" fill="#F4B83C" />
    <circle cx="100" cy="100" r="20" fill="none" stroke="#BB133E" strokeWidth="8" />
    <g stroke="#BB133E" strokeWidth="9" strokeLinecap="butt">
      <line x1="84" y1="80" x2="84" y2="56" />
      <line x1="94" y1="80" x2="94" y2="40" />
      <line x1="106" y1="80" x2="106" y2="40" />
      <line x1="116" y1="80" x2="116" y2="56" />
      <line x1="84" y1="120" x2="84" y2="144" />
      <line x1="94" y1="120" x2="94" y2="160" />
      <line x1="106" y1="120" x2="106" y2="160" />
      <line x1="116" y1="120" x2="116" y2="144" />
      <line x1="120" y1="84" x2="144" y2="84" />
      <line x1="120" y1="94" x2="160" y2="94" />
      <line x1="120" y1="106" x2="160" y2="106" />
      <line x1="120" y1="116" x2="144" y2="116" />
      <line x1="80" y1="84" x2="56" y2="84" />
      <line x1="80" y1="94" x2="40" y2="94" />
      <line x1="80" y1="106" x2="40" y2="106" />
      <line x1="80" y1="116" x2="56" y2="116" />
    </g>
  </svg>
);

const Badge_MD: BadgeComponent = () => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <defs>
      <clipPath id="b-md-c">
        <circle cx="100" cy="100" r="95" />
      </clipPath>
      <pattern id="b-md-cal" patternUnits="userSpaceOnUse" width="36" height="36" patternTransform="rotate(45)">
        <rect width="18" height="36" fill="#F4B83C" />
        <rect x="18" width="18" height="36" fill="#1A1814" />
      </pattern>
      <pattern id="b-md-cross" patternUnits="userSpaceOnUse" width="60" height="60">
        <rect width="60" height="60" fill="#FFFFFF" />
        <rect x="22" width="16" height="60" fill="#BB133E" />
        <rect y="22" width="60" height="16" fill="#BB133E" />
      </pattern>
    </defs>
    <g clipPath="url(#b-md-c)">
      <rect x="0" y="0" width="100" height="100" fill="url(#b-md-cal)" />
      <rect x="100" y="0" width="100" height="100" fill="url(#b-md-cross)" />
      <rect x="0" y="100" width="100" height="100" fill="url(#b-md-cross)" />
      <rect x="100" y="100" width="100" height="100" fill="url(#b-md-cal)" />
    </g>
  </svg>
);

const Badge_SC: BadgeComponent = () => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <circle cx="100" cy="100" r="95" fill="#003875" />
    <path d="M40,40 A28,28 0 1 0 40,96 A22,22 0 1 1 40,40 Z" fill="#FFFFFF" />
    <g fill="#FFFFFF">
      <rect x="95" y="100" width="10" height="62" />
      <g transform="translate(100 90)">
        <ellipse cx="0" cy="-22" rx="8" ry="28" />
        <ellipse cx="0" cy="-22" rx="8" ry="28" transform="rotate(30)" />
        <ellipse cx="0" cy="-22" rx="8" ry="28" transform="rotate(-30)" />
        <ellipse cx="0" cy="-22" rx="8" ry="28" transform="rotate(60)" />
        <ellipse cx="0" cy="-22" rx="8" ry="28" transform="rotate(-60)" />
        <ellipse cx="0" cy="-22" rx="8" ry="28" transform="rotate(90)" />
        <ellipse cx="0" cy="-22" rx="8" ry="28" transform="rotate(-90)" />
      </g>
    </g>
  </svg>
);

const Badge_CO: BadgeComponent = () => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <defs>
      <clipPath id="b-co-c">
        <circle cx="100" cy="100" r="95" />
      </clipPath>
    </defs>
    <g clipPath="url(#b-co-c)">
      <rect x="0" y="0" width="200" height="65" fill="#1F4E8C" />
      <rect x="0" y="65" width="200" height="70" fill="#FFFFFF" />
      <rect x="0" y="135" width="200" height="65" fill="#1F4E8C" />
    </g>
    <path d="M130,60 A40,40 0 1 0 130,140 L118,124 A24,24 0 1 1 118,76 Z" fill="#CD212A" />
    <circle cx="100" cy="100" r="22" fill="#F4B83C" />
  </svg>
);

const Badge_TN: BadgeComponent = () => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <circle cx="100" cy="100" r="95" fill="#CD212A" />
    <circle cx="100" cy="100" r="58" fill="#1F4E8C" stroke="#FFFFFF" strokeWidth="4" />
    <g fill="#FFFFFF">
      <path d="M100,64 L104,75 L115,75 L106,82 L109,93 L100,86 L91,93 L94,82 L85,75 L96,75 Z" />
      <path d="M75,106 L79,117 L90,117 L81,124 L84,135 L75,128 L66,135 L69,124 L60,117 L71,117 Z" />
      <path d="M125,106 L129,117 L140,117 L131,124 L134,135 L125,128 L116,135 L119,124 L110,117 L121,117 Z" />
    </g>
  </svg>
);

const Badge_OH: BadgeComponent = () => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <circle cx="100" cy="100" r="95" fill="#EFE4BD" />
    <g transform="translate(20 60)">
      <path d="M0,0 L120,0 L160,40 L120,80 L0,80 Z" fill="#FFFFFF" stroke="#1A1814" strokeWidth="2" />
      <rect x="0" y="0" width="120" height="16" fill="#CD212A" />
      <rect x="0" y="32" width="120" height="16" fill="#CD212A" />
      <rect x="0" y="64" width="120" height="16" fill="#CD212A" />
      <path d="M120,0 L160,40 L120,16 Z" fill="#CD212A" />
      <path d="M120,32 L160,40 L120,48 Z" fill="#CD212A" />
      <path d="M120,64 L160,40 L120,80 Z" fill="#CD212A" />
      <path d="M0,0 L60,0 L60,80 L0,80 Z" fill="#1F4E8C" />
      <circle cx="30" cy="40" r="16" fill="none" stroke="#FFFFFF" strokeWidth="6" />
      <circle cx="30" cy="40" r="8" fill="#CD212A" />
    </g>
  </svg>
);

const Badge_IL: BadgeComponent = () => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <circle cx="100" cy="100" r="95" fill="#EFE4BD" />
    <g fill="#1A1814">
      <rect x="64" y="36" width="72" height="78" />
      <rect x="44" y="110" width="112" height="14" />
    </g>
    <rect x="64" y="92" width="72" height="12" fill="#B91C1C" />
    <path d="M100,134 L107,150 L124,150 L110,160 L116,176 L100,166 L84,176 L90,160 L76,150 L93,150 Z" fill="#B91C1C" />
  </svg>
);

const Badge_NJ: BadgeComponent = () => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <circle cx="100" cy="100" r="95" fill="#E6CFA0" />
    <path d="M70,176 L70,142 Q52,134 48,116 Q38,108 42,86 Q50,68 66,58 L78,40 L76,18 L96,28 L122,40 L146,58 L158,80 L156,100 L150,118 L136,128 L132,150 L132,176 Z" fill="#1A1814" />
    <circle cx="120" cy="76" r="3.5" fill="#E6CFA0" />
    <path d="M64,58 L70,82 L74,108 L78,134" stroke="#E6CFA0" strokeWidth="2.5" fill="none" opacity="0.45" />
  </svg>
);

const Badge_MA: BadgeComponent = () => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <circle cx="100" cy="100" r="95" fill="#1F4E8C" />
    <g fill="#F4B83C">
      <path d="M40,100 L20,70 L30,100 L20,130 Z" />
      <path d="M40,100 Q66,62 130,68 Q160,76 170,100 Q160,124 130,132 Q66,138 40,100 Z" />
      <path d="M84,68 L92,48 L108,50 L106,72 Z" />
      <path d="M84,132 L92,152 L108,150 L106,128 Z" />
    </g>
    <path d="M118,82 Q112,100 118,118" stroke="#1F4E8C" strokeWidth="3.5" fill="none" />
    <circle cx="150" cy="92" r="5" fill="#1F4E8C" />
    <circle cx="150" cy="92" r="2.2" fill="#F4B83C" />
  </svg>
);

const Badge_GA: BadgeComponent = () => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <circle cx="100" cy="100" r="95" fill="#FBF3D6" />
    <ellipse cx="100" cy="118" rx="58" ry="54" fill="#F2A269" />
    <ellipse cx="78" cy="100" rx="22" ry="18" fill="#E97955" opacity="0.75" />
    <path d="M100,72 Q100,118 100,168" stroke="#B8492A" strokeWidth="3.5" fill="none" opacity="0.65" />
    <path d="M100,68 Q102,54 102,46" stroke="#5A4A2A" strokeWidth="5" fill="none" strokeLinecap="round" />
    <path d="M104,62 Q126,46 148,50 Q140,72 120,76 Q108,76 104,62 Z" fill="#5A8B3A" />
    <path d="M108,66 Q124,58 140,58" stroke="#3F6B26" strokeWidth="2" fill="none" />
  </svg>
);

const Badge_LA: BadgeComponent = () => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <circle cx="100" cy="100" r="95" fill="#5B2C8E" />
    <g fill="#F4B83C">
      <path d="M100,28 Q90,54 90,86 L110,86 Q110,54 100,28 Z" />
      <path d="M62,68 C 54,92 60,114 82,112 Q80,98 78,86 Q74,72 72,66 Q66,62 62,68 Z" />
      <path d="M138,68 C 146,92 140,114 118,112 Q120,98 122,86 Q126,72 128,66 Q134,62 138,68 Z" />
      <rect x="56" y="98" width="88" height="14" rx="2" />
      <path d="M84,112 L90,168 L110,168 L116,112 Z" />
    </g>
  </svg>
);

const Badge_PA: BadgeComponent = () => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <circle cx="100" cy="100" r="95" fill="#003F87" />
    <path d="M44,46 L156,46 L132,156 L68,156 Z" fill="#F4B83C" />
    <g fill="#003F87">
      <rect x="94" y="64" width="12" height="6" />
      <rect x="84" y="70" width="32" height="7" />
      <path d="M76,77 L124,77 L132,118 L68,118 Z" />
      <rect x="64" y="118" width="72" height="9" />
      <rect x="98" y="127" width="4" height="9" />
    </g>
    <path d="M115,77 L113,92 L117,104 L113,118" stroke="#F4B83C" strokeWidth="2.2" fill="none" />
  </svg>
);

const DESIGNED_BADGES: Record<string, BadgeComponent> = {
  CA: Badge_CA,
  TX: Badge_TX,
  NY: Badge_NY,
  FL: Badge_FL,
  HI: Badge_HI,
  AK: Badge_AK,
  AZ: Badge_AZ,
  NM: Badge_NM,
  MD: Badge_MD,
  SC: Badge_SC,
  CO: Badge_CO,
  TN: Badge_TN,
  OH: Badge_OH,
  IL: Badge_IL,
  NJ: Badge_NJ,
  MA: Badge_MA,
  GA: Badge_GA,
  LA: Badge_LA,
  PA: Badge_PA,
};

/** Whether a designed badge exists for the given state code (uppercased). */
export function hasDesignedBadge(code: string): boolean {
  return code.toUpperCase() in DESIGNED_BADGES;
}
