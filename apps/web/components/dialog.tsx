'use client';

import { type ReactNode, useEffect, useId, useRef } from 'react';

/**
 * Diálogo modal acessível (elemento <dialog> nativo: foco preso, Esc fecha, fundo inerte). Diálogos de
 * risco mostram o impacto real em texto — nunca um “tem certeza?” genérico (prompt-mestre §12).
 */
export function Dialog({
  open,
  onClose,
  title,
  danger = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  danger?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={onClose}
      className="dw-rise m-auto w-[min(560px,calc(100vw-32px))] rounded-[18px] border border-border bg-surface p-0 text-text shadow-[var(--shadow)] backdrop:bg-[rgba(6,13,28,0.55)]"
    >
      {open && (
        <div className="flex flex-col gap-4 p-6">
          <div className="flex items-start gap-3">
            <h2
              id={titleId}
              className={`text-[19px] font-extrabold tracking-tight ${danger ? 'text-crit' : ''}`}
            >
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="ml-auto rounded-lg px-2 py-1 text-[18px] leading-none text-muted hover:bg-surface-2"
            >
              ×
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
