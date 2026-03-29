/**
 * Recessed back control: simple chevron + label (RAW / minimal aesthetic).
 */
function ChevronBackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 18l-6-6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface BackButtonProps {
  onClick: () => void;
  label: string;
  className?: string;
  /** If set, overrides `label` for screen readers */
  ariaLabel?: string;
}

export function BackButton({ onClick, label, className = "", ariaLabel }: BackButtonProps) {
  return (
    <div className={`zen-back-btn-wrap ${className}`.trim()}>
      <button
        type="button"
        onClick={onClick}
        className="zen-back-btn"
        aria-label={ariaLabel ?? label}
      >
        <span className="zen-back-btn__icon">
          <ChevronBackIcon />
        </span>
        <span className="zen-back-btn__label">{label}</span>
      </button>
    </div>
  );
}
