/**
 * Explorer styles, injected once through `Style`.
 *
 * Colors are derived from `currentColor` with `color-mix`, so the dialog
 * follows the app's light, dark and high-contrast themes without hard-coded
 * background colors.
 */
export const explorerStyles = `
.se-root {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  color: inherit;
  font: inherit;
}

.se-root *,
.se-root *::before,
.se-root *::after {
  box-sizing: border-box;
}

.se-search-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.se-search-row > *:first-child {
  flex: 1 1 auto;
  min-width: 0;
}

.se-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.se-control {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 140px;
}

.se-control > span {
  font-size: 12px;
  opacity: 0.65;
  white-space: nowrap;
}

.se-group-toggle {
  display: flex;
  align-items: center;
  gap: 7px;
}

.se-spacer {
  flex: 1 1 auto;
}

.se-results {
  position: relative;
  overflow-y: auto;
  overscroll-behavior: contain;
  min-height: 180px;
  height: min(54vh, 430px);
  border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, currentColor 2%, transparent);
}

.se-results:focus-visible {
  outline: 2px solid color-mix(in srgb, currentColor 55%, transparent);
  outline-offset: 1px;
}

.se-list {
  display: flex;
  flex-direction: column;
  padding: 4px;
  gap: 2px;
}

.se-group-title {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 10px 8px 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.72;
}

.se-group-count {
  font-weight: 400;
  letter-spacing: 0;
  opacity: 0.7;
}

.se-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 7px 8px;
  border-radius: 6px;
  border: 1px solid transparent;
  cursor: pointer;
  content-visibility: auto;
  contain-intrinsic-size: auto 52px;
}

.se-row:hover {
  background: color-mix(in srgb, currentColor 6%, transparent);
}

.se-row[data-active="true"] {
  background: color-mix(in srgb, currentColor 10%, transparent);
  border-color: color-mix(in srgb, currentColor 16%, transparent);
}

.se-row-main {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
}

.se-row-main:focus-visible {
  outline: 2px solid color-mix(in srgb, currentColor 55%, transparent);
  outline-offset: 2px;
  border-radius: 4px;
}

.se-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
}

.se-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  align-items: center;
  font-size: 11.5px;
  line-height: 1.3;
  opacity: 0.68;
  min-width: 0;
}

.se-project {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 24ch;
}

.se-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 0 5px;
  border-radius: 4px;
  border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  opacity: 0.9;
}

.se-badge[data-tone="warning"] {
  border-color: color-mix(in srgb, #d19a2a 55%, transparent);
  color: color-mix(in srgb, #d19a2a 75%, currentColor);
}

.se-badge[data-tone="missing"] {
  border-color: color-mix(in srgb, #d9534f 55%, transparent);
  color: color-mix(in srgb, #d9534f 70%, currentColor);
}

.se-badge[data-tone="running"] {
  border-color: color-mix(in srgb, #3f9d6b 55%, transparent);
  color: color-mix(in srgb, #3f9d6b 70%, currentColor);
}

.se-row-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
}

.se-dialog-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
  width: 100%;
  font-size: 12px;
}

.se-dialog-footer .se-status {
  flex: 1 1 auto;
}

.se-status {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  align-items: center;
  opacity: 0.75;
  min-width: 0;
}

.se-status[data-tone="error"] {
  opacity: 1;
  color: color-mix(in srgb, #d9534f 78%, currentColor);
}

.se-status[data-tone="warning"] {
  opacity: 1;
  color: color-mix(in srgb, #d19a2a 80%, currentColor);
}

.se-state {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  justify-content: center;
  padding: 34px 16px;
  text-align: center;
  font-size: 13px;
  opacity: 0.8;
}

.se-state strong {
  font-size: 14px;
  opacity: 1;
}

.se-state-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.se-banner {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  align-items: center;
  padding: 7px 9px;
  border-radius: 6px;
  font-size: 12px;
  border: 1px solid color-mix(in srgb, #d19a2a 45%, transparent);
  color: color-mix(in srgb, #d19a2a 80%, currentColor);
}

.se-banner[data-tone="error"] {
  border-color: color-mix(in srgb, #d9534f 45%, transparent);
  color: color-mix(in srgb, #d9534f 80%, currentColor);
}

.se-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 560px) {
  .se-results {
    height: min(42vh, 280px);
  }
  .se-control {
    min-width: 0;
    flex: 1 1 130px;
  }
  .se-project {
    max-width: 14ch;
  }
  .se-row-actions .se-open-label {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .se-root * {
    scroll-behavior: auto !important;
    transition: none !important;
  }
}
`
