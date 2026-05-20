import { memo, type ReactNode } from 'react';

interface DocumentShellProps {
  focusMode: boolean;
  hasDocument: boolean;
  topbar: ReactNode;
  focusExit: ReactNode;
  body: ReactNode;
  emptyState: ReactNode;
  footer: ReactNode;
}

function DocumentShellImpl({ focusMode, hasDocument, topbar, focusExit, body, emptyState, footer }: DocumentShellProps) {
  return (
    <div className="app">
      {!focusMode && topbar}
      {focusMode && focusExit}
      {hasDocument ? body : emptyState}
      {footer}
    </div>
  );
}

export const DocumentShell = memo(DocumentShellImpl);
