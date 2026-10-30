"use client";

import clsx from "clsx";
import { useLenis } from "lenis/react";
import { cloneElement, useCallback, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from "react";
import { lockScroll, unlockScroll } from "@/lib/scroll-lock";
import { CloseIcon } from "./icons";

/**
 * Accessible dialog (shipped module 66741 uses Radix Dialog). Built on the
 * native <dialog>: focus is trapped by the browser, Escape closes, focus
 * returns to the trigger, and Lenis is locked while open.
 */
export function Modal({
  trigger,
  title,
  children,
  contentClassName,
}: {
  trigger: ReactElement<{ onClick?: () => void; "aria-haspopup"?: string; "aria-controls"?: string }>;
  title: string;
  children: ReactNode;
  contentClassName?: string;
}) {
  const lenis = useLenis();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const id = useId();
  const titleId = `${id}-title`;

  useEffect(() => {
    if (!open || !lenis) return;
    lockScroll(lenis);
    return () => unlockScroll(lenis);
  }, [open, lenis]);

  const show = useCallback(() => {
    dialog.current?.showModal();
    setOpen(true);
  }, []);
  const close = useCallback(() => dialog.current?.close(), []);

  return (
    <>
      {cloneElement(trigger, { onClick: show, "aria-haspopup": "dialog", "aria-controls": id })}
      <dialog
        ref={dialog}
        id={id}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === dialog.current) close();
        }}
        className={clsx(
          "z-modal fixed inset-0 m-0 flex h-dvh max-h-none w-full max-w-none items-center justify-center bg-black/80 px-4 text-left text-white backdrop:bg-transparent md:px-12",
          "transition-opacity duration-200 [&:not([open])]:hidden",
        )}
        data-lenis-prevent
      >
        <div className="bg-bg relative flex w-full max-w-149.5 flex-col gap-8 overflow-hidden border border-white/15 p-6 md:p-8">
          <div className="relative flex w-full items-start justify-between">
            <h2 id={titleId} className="text-m-h2 md:text-d-h2">
              {title}
            </h2>
            <button type="button" onClick={close} aria-label="Close" className="-m-2.5 flex size-11 cursor-pointer items-center justify-center">
              <CloseIcon className="size-5 text-white transition-colors hover:text-white/80" />
            </button>
          </div>
          <div className={clsx("text-m-body-l md:text-d-body-s max-w-123.5 text-white/60", contentClassName)}>{open && children}</div>
        </div>
      </dialog>
    </>
  );
}
