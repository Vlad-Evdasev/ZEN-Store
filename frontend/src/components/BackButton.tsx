/**
 * Recessed “back” control with a keyboard-style backspace arrow (left arrow + stem).
 * Use for all «Назад» / «Вернуться в каталог» actions for a consistent look.
 */
function BackspaceArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9.5 19L3 12l6.5-7h11.5a1.5 1.5 0 011.5 1.5v11a1.5 1.5 0 01-1.5 1.5H9.5z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M14 9.5L10 12.5l4 3"
        stroke="currentColor"
        strokeWidth="1.75"
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
          <BackspaceArrowIcon />
        </span>
        <span className="zen-back-btn__label">{label}</span>
      </button>
    </div>
  );
}
