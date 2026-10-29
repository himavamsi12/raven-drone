import clsx from "clsx";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { ArrowDownIcon, ArrowRightIcon } from "./icons";

/** Exact class list from shipped module 56612. */
export const CTA_CLASS =
  "text-d-cta pointer-events-auto flex cursor-pointer items-center justify-between rounded-full bg-white/25 px-5 py-3 -outline-offset-1 hover:bg-white/30 focus-visible:bg-white/25 focus-visible:shadow-none focus-visible:outline-1 focus-visible:outline-white";

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
