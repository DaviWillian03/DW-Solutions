// Ilustrações coloridas (CP2-11, amostras do CP5-3): azuis do design system + um acento quente
// (`--warm`), sem cores de status como decoração e sem nada que remeta a vigilância. As cores vêm
// dos tokens, então acompanham o tema claro/escuro. Decorativas: o texto ao lado explica a tela.
import type { ReactNode } from 'react';

const S = {
  ice: 'var(--ice)',
  sky: 'var(--sky)',
  royal: 'var(--royal)',
  surface: 'var(--surface)',
  surface2: 'var(--surface-2)',
  border: 'var(--border)',
  onRoyal: 'var(--on-royal)',
  warm: 'var(--warm)',
};

function Sparkle({ x, y, r = 6, fill = S.warm }: { x: number; y: number; r?: number; fill?: string }) {
  const k = r * 0.28;
  return (
    <path
      d={`M${x} ${y - r} L${x + k} ${y - k} L${x + r} ${y} L${x + k} ${y + k} L${x} ${y + r} L${x - k} ${y + k} L${x - r} ${y} L${x - k} ${y - k} Z`}
      fill={fill}
    />
  );
}

/** A1 — “Nenhum aparelho usa esta política”: celular com escudo e cartões de configuração. */
export function PolicyEmptyArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 170" width="240" height="170" aria-hidden="true" className={className}>
      <ellipse cx="120" cy="96" rx="104" ry="64" fill={S.ice} />
      <circle cx="194" cy="38" r="13" fill={S.warm} opacity="0.9" />
      <Sparkle x={54} y={36} r={7} />
      <Sparkle x={206} y={140} r={5} fill={S.sky} />
      <g className="dw-float">
        <rect
          x="86"
          y="26"
          width="68"
          height="122"
          rx="13"
          fill={S.surface}
          stroke={S.royal}
          strokeWidth="3"
        />
        <rect x="110" y="34" width="20" height="4" rx="2" fill={S.sky} />
        <path d="M120 56l21 7.5v14.5c0 13.5-9 22.5-21 27c-12-4.5-21-13.5-21-27V63.5z" fill={S.royal} />
        <path
          d="M110.5 80l6.5 6.5l13-14"
          fill="none"
          stroke={S.onRoyal}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="100" y="116" width="40" height="6" rx="3" fill={S.sky} />
        <rect x="100" y="128" width="27" height="6" rx="3" fill={S.border} />
      </g>
      <g>
        <rect
          x="24"
          y="66"
          width="60"
          height="36"
          rx="9"
          fill={S.surface}
          stroke={S.border}
          strokeWidth="2"
        />
        <rect x="32" y="77" width="20" height="12" rx="6" fill={S.royal} />
        <circle cx="46" cy="83" r="4" fill={S.surface} />
        <rect x="57" y="80" width="20" height="5" rx="2.5" fill={S.sky} />
      </g>
      <g>
        <rect
          x="158"
          y="98"
          width="58"
          height="34"
          rx="9"
          fill={S.surface}
          stroke={S.border}
          strokeWidth="2"
        />
        <circle cx="171" cy="115" r="6" fill={S.warm} />
        <rect x="182" y="108" width="26" height="5" rx="2.5" fill={S.sky} />
        <rect x="182" y="118" width="18" height="5" rx="2.5" fill={S.border} />
      </g>
    </svg>
  );
}

/** A2 — “Nenhum aparelho fora da política”: dois celulares com selo e confete. */
export function AllClearArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 170" width="240" height="170" aria-hidden="true" className={className}>
      <ellipse cx="120" cy="98" rx="104" ry="62" fill={S.ice} />
      <g transform="rotate(-9 92 92)">
        <rect
          x="62"
          y="40"
          width="58"
          height="102"
          rx="12"
          fill={S.surface2}
          stroke={S.sky}
          strokeWidth="3"
        />
        <rect x="74" y="64" width="34" height="6" rx="3" fill={S.sky} />
        <rect x="74" y="76" width="24" height="6" rx="3" fill={S.border} />
      </g>
      <g className="dw-float">
        <rect
          x="112"
          y="28"
          width="64"
          height="116"
          rx="13"
          fill={S.surface}
          stroke={S.royal}
          strokeWidth="3"
        />
        <rect x="134" y="36" width="20" height="4" rx="2" fill={S.sky} />
        <circle cx="144" cy="78" r="21" fill={S.royal} />
        <path
          d="M134.5 78.5l6.5 6.5l13-14"
          fill="none"
          stroke={S.onRoyal}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {[110, 121, 132].map((y, i) => (
          <g key={y}>
            <circle cx="128" cy={y} r="3" fill={i === 1 ? S.warm : S.royal} />
            <rect x="135" y={y - 2.5} width={i === 2 ? 18 : 28} height="5" rx="2.5" fill={S.sky} />
          </g>
        ))}
      </g>
      <Sparkle x={196} y={44} r={8} />
      <Sparkle x={44} y={58} r={5} fill={S.sky} />
      <Sparkle x={202} y={124} r={5} fill={S.sky} />
      <rect x="186" y="76" width="9" height="5" rx="2" fill={S.warm} transform="rotate(25 190 78)" />
      <rect x="40" y="118" width="9" height="5" rx="2" fill={S.warm} transform="rotate(-20 44 120)" />
      <circle cx="58" cy="28" r="4" fill={S.warm} />
    </svg>
  );
}

/** Estado vazio com ilustração, título e explicação. */
export function EmptyState({
  art,
  title,
  children,
}: {
  art: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
      {art}
      <h3 className="text-[17px] font-bold">{title}</h3>
      {children && <div className="max-w-md text-[14px] text-text-2">{children}</div>}
    </div>
  );
}
