"use client";

import type { ReactElement } from "react";
import { ContactForm } from "./ContactForm";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";

/** Contact CTA that opens the contact modal (shipped module 52953). */
export function ContactButton({
  label,
  small,
  withArrow,
  className,
  trigger,
}: {
  label: string;
  small?: boolean;
  withArrow?: boolean;
  className?: string;
  trigger?: ReactElement<{ onClick?: () => void }>;
}) {
  return (
    <Modal
      title="Contact Us"
      contentClassName="max-w-none!"
      trigger={
        trigger ?? (
          <Button small={small} withArrow={withArrow} arrowDirection="right" className={className}>
            {label}
          </Button>
        )
      }
    >
      <ContactForm className="md:max-w-none" />
    </Modal>
  );
}
