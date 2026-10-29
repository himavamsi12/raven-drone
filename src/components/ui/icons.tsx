/**
 * Small filled icons. The reference uses Phosphor icons whose exact glyphs were
 * not recoverable from the minified bundle; these are close stand-ins.
 */
type P = { className?: string };

export const WarningIcon = ({ className }: P) => (
  <svg viewBox="0 0 256 256" fill="currentColor" className={className} aria-hidden="true">
    <path d="M236.8 188.09 149.35 36.22a24.76 24.76 0 0 0-42.7 0L19.2 188.09a23.51 23.51 0 0 0 0 23.72A24.35 24.35 0 0 0 40.55 224h174.9a24.35 24.35 0 0 0 21.33-12.19 23.51 23.51 0 0 0 .02-23.72ZM120 104a8 8 0 0 1 16 0v40a8 8 0 0 1-16 0Zm8 88a12 12 0 1 1 12-12 12 12 0 0 1-12 12Z" />
  </svg>
);

export const InfoIcon = ({ className }: P) => (
  <svg viewBox="0 0 256 256" fill="currentColor" className={className} aria-hidden="true">
    <path d="M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24Zm-4 48a12 12 0 1 1-12 12 12 12 0 0 1 12-12Zm12 112a16 16 0 0 1-16-16v-40a8 8 0 0 1 0-16 16 16 0 0 1 16 16v40a8 8 0 0 1 0 16Z" />
  </svg>
);

export const CheckIcon = ({ className }: P) => (
  <svg viewBox="0 0 256 256" fill="currentColor" className={className} aria-hidden="true">
    <path d="M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24Zm45.66 85.66-56 56a8 8 0 0 1-11.32 0l-24-24a8 8 0 0 1 11.32-11.32L112 148.69l50.34-50.35a8 8 0 0 1 11.32 11.32Z" />
  </svg>
);

export const NavigationArrowIcon = ({ className }: P) => (
  <svg viewBox="0 0 256 256" fill="currentColor" className={className} aria-hidden="true">
    <path d="M234.35 129 152 152l-23 82.35a8 8 0 0 1-15.21.24L32.47 46.58a8 8 0 0 1 10.11-10.11l188.04 81.32a8 8 0 0 1-.27 15.21Z" />
  </svg>
);

export const ArrowRightIcon = ({ className }: P) => (
  <svg viewBox="0 0 256 256" fill="currentColor" className={className} aria-hidden="true">
    <path d="m221.66 133.66-72 72a8 8 0 0 1-11.32-11.32L196.69 136H40a8 8 0 0 1 0-16h156.69l-58.35-58.34a8 8 0 0 1 11.32-11.32l72 72a8 8 0 0 1 0 11.32Z" />
  </svg>
);

export const ArrowDownIcon = ({ className }: P) => (
  <svg viewBox="0 0 256 256" fill="currentColor" className={className} aria-hidden="true">
    <path d="m205.66 149.66-72 72a8 8 0 0 1-11.32 0l-72-72a8 8 0 0 1 11.32-11.32L120 196.69V40a8 8 0 0 1 16 0v156.69l58.34-58.35a8 8 0 0 1 11.32 11.32Z" />
  </svg>
);

export const ArrowUpRightIcon = ({ className }: P) => (
  <svg viewBox="0 0 256 256" fill="currentColor" className={className} aria-hidden="true">
    <path d="M204 64v104a12 12 0 0 1-24 0V93L72.49 200.49a12 12 0 0 1-17-17L163 76H88a12 12 0 0 1 0-24h104a12 12 0 0 1 12 12Z" />
  </svg>
);

export const MenuIcon = ({ className }: P) => (
  <svg viewBox="0 0 256 256" fill="currentColor" className={className} aria-hidden="true">
    <path d="M224 128a8 8 0 0 1-8 8H40a8 8 0 0 1 0-16h176a8 8 0 0 1 8 8ZM40 72h176a8 8 0 0 0 0-16H40a8 8 0 0 0 0 16Zm176 112H40a8 8 0 0 0 0 16h176a8 8 0 0 0 0-16Z" />
  </svg>
);

export const CloseIcon = ({ className }: P) => (
  <svg viewBox="0 0 256 256" fill="currentColor" className={className} aria-hidden="true">
    <path d="M205.66 194.34a8 8 0 0 1-11.32 11.32L128 139.31l-66.34 66.35a8 8 0 0 1-11.32-11.32L116.69 128 50.34 61.66a8 8 0 0 1 11.32-11.32L128 116.69l66.34-66.35a8 8 0 0 1 11.32 11.32L139.31 128Z" />
  </svg>
);
