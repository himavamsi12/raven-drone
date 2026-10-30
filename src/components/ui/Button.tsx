import clsx from "clsx";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { ArrowDownIcon, ArrowRightIcon } from "./icons";

/**
 * Raven CTA: the homepage's square outlined button (hero `SquareCta`) instead of the shipped white/25 pill (module 56612),
 * so every action on the page speaks one equipment-like language. The dark frosted fill keeps white text readable over
 * bright terrain.
 */
export const CTA_CLASS =
  "text-d-cta pointer-events-auto flex cursor-pointer items-center justify-between border border-white/75 bg-black/25 px-5 py-3 backdrop-blur-[6px] transition-colors duration-200 hover:border-white hover:bg-black/45 focus-visible:border-white focus-visible:bg-black/45 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  withArrow?: boolean;
  arrowDirection?: "down" | "right";
  small?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { children, withArrow = false, arrowDirection = "down", small = false, className, type = "button", ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={clsx(CTA_CLASS, className, small && "px-4! py-2! md:py-1.5!")} {...rest}>
      {children}
      {withArrow &&
        (arrowDirection === "down" ? <ArrowDownIcon className="size-4.5" /> : <ArrowRightIcon className="size-4.5" />)}
    </button>
  );
});
