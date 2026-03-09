import { useRef, useEffect } from "react";

interface CollapsibleSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  expanded: boolean;
  onExpand: () => void;
  onCollapse?: () => void;
  "aria-label"?: string;
}

export function CollapsibleSearch({
  value,
  onChange,
  placeholder,
  expanded,
  onExpand,
  onCollapse,
  "aria-label": ariaLabel = "Поиск",
}: CollapsibleSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (expanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [expanded]);

  return (
    <div className="zen-search-toggle-wrap">
      <button
        type="button"
        className="zen-search-toggle-btn"
        onClick={() => (expanded ? onCollapse?.() : onExpand())}
        aria-label={expanded ? "Свернуть поиск" : ariaLabel}
        aria-expanded={expanded}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </button>
      <div
        className={`zen-search-input-wrap ${expanded ? "zen-search-input-wrap--expanded" : "zen-search-input-wrap--collapsed"}`}
      >
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
        />
      </div>
    </div>
  );
}
