"use client";

import clsx from "clsx";
import { useLenis } from "lenis/react";
import { motion } from "motion/react";
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type TouchEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import { useLoading } from "@/lib/loading";
import { SCENE, sceneEndOffset, useScenes, type SceneId } from "@/lib/scenes";
import { isScrollLocked, lockScroll, unlockScroll } from "@/lib/scroll-lock";
import { useMediaQuery } from "@/lib/use-media-query";
import { ContactButton } from "./ContactButton";
import { ArrowUpRightIcon, CloseIcon, MenuIcon } from "./ui/icons";

/** Chapter labels in order (shipped `O` in layout module 72781). */
const CHAPTERS: [SceneId, string][] = [
  [SCENE.DELTA_DRONE, "Specs"],
  [SCENE.SWARM_SCENE, "Swarm"],
  [SCENE.MISSION_PRESET, "Mission"],
  [SCENE.FLOCK_SCENE, "Sync"],
  [SCENE.REAL_TIME_DETECTION, "Detection"],
  [SCENE.PHALANX_AI, "Raven Ops"],
  [SCENE.ANALYSIS_EVALUATION, "Sys Analysis"],
  [SCENE.INTEGRATED_NOTIFICATIONS, "Int Alerts"],
  [SCENE.INTERDRONE_COORDINATION, "Coordination"],
  [SCENE.MULTI_THREAT_RESPONSE, "Response"],
];

const MENU_LINKS = [
  { label: "Raven", href: "#" },
  { label: "Raven Ops", href: "#" },
  { label: "SARA", href: "#" },
  { label: "Athena", href: "#" },
  { label: "About Us", href: "#" },
];

const FADE_MS = 150;
const SCROLL_S = 0.75;

function ChapterTab({ name, isActive, onHover, onClick, setRef }: { name: string; isActive: boolean; onHover: () => void; onClick: () => void; setRef: (el: HTMLButtonElement | null) => void }) {
  const measure = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState(0);
  const md = useMediaQuery("(min-width: 768px)");
  useLayoutEffect(() => {
    const on = () => setWidth(measure.current ? measure.current.offsetWidth + (md ? 12 : 16) : 0);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [md]);
  return (
    <>
      <span ref={measure} className="text-m-mono md:text-d-mono invisible absolute font-mono whitespace-nowrap uppercase" aria-hidden="true">
        {name}
      </span>
      <button
        ref={setRef}
        type="button"
        className="cursor-pointer px-2 select-none md:px-3"
        onMouseEnter={onHover}
        onFocus={onHover}
        onClick={onClick}
        aria-label={`Go to ${name}`}
        aria-current={isActive ? "step" : undefined}
      >
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: isActive ? width : 0, opacity: isActive ? 1 : 0 }}
          transition={{ duration: 0.5 }}
          className="relative flex h-4 items-center overflow-hidden"
        >
          <span className="text-m-mono md:text-d-mono absolute top-1/2 left-1/2 inline-block -translate-x-1/2 -translate-y-1/2 font-mono !text-[0.8125rem] whitespace-nowrap uppercase">
            {name}
          </span>
        </motion.div>
      </button>
    </>
  );
}

/** Centered chapter ticks with hover reveal + fade/scroll/restore navigation. */
function ChapterNav() {
  const lenis = useLenis();
  const coarse = useMediaQuery("(pointer: coarse)");
  const [hovered, setHovered] = useState<SceneId | null>(null);
  const [touched, setTouched] = useState<SceneId | null>(null);
  const [touching, setTouching] = useState(false);
  const [pending, setPending] = useState<SceneId | null>(null);
  const [busy, setBusy] = useState(false);
  const refs = useRef<Partial<Record<SceneId, HTMLButtonElement | null>>>({});
  const t1 = useRef<number | null>(null);
  const t2 = useRef<number | null>(null);

  const current = useScenes(
    useShallow((s) => {
      let id: SceneId | null = null;
      for (const [scene] of CHAPTERS) if (s[scene]?.progress > 0) id = scene;
      return id;
    }),
  );
  const leaving = useScenes((s) => s[SCENE.MULTI_THREAT_RESPONSE].hideRatio > 0);
  const active = pending ?? touched ?? hovered ?? current ?? CHAPTERS[0][0];

  const clear = useCallback(() => {
    if (t1.current !== null) window.clearTimeout(t1.current);
    if (t2.current !== null) window.clearTimeout(t2.current);
    t1.current = t2.current = null;
  }, []);
  useEffect(() => clear, [clear]);

  const go = useCallback(
    (id: SceneId) => {
      if (busy || id === current) return;
      const container = document.getElementById("scene-container");
      if (!container) return;
      const target = sceneEndOffset(id, window.innerHeight);
      setPending(id);
      setBusy(true);
      setHovered(null);
      setTouched(null);
      setTouching(false);
      clear();
      container.style.transition = `opacity ${FADE_MS}ms ease-in-out`;
      container.style.opacity = "0";
      t1.current = window.setTimeout(() => {
        lenis?.scrollTo(target, { duration: SCROLL_S });
        t2.current = window.setTimeout(() => {
          requestAnimationFrame(() => (container.style.opacity = "1"));
          setBusy(false);
          setPending(null);
        }, SCROLL_S * 1000);
      }, FADE_MS);
    },
    [busy, current, lenis, clear],
  );

  const nearest = useCallback((x: number, y: number) => {
    let best: { id: SceneId; d: number } | null = null;
    for (const [id] of CHAPTERS) {
      const el = refs.current[id];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return id;
      const d = Math.abs(r.left + r.width / 2 - x);
      if (!best || d < best.d) best = { id, d };
    }
    return best?.id ?? null;
  }, []);
  const track = (e: TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    const id = nearest(t.clientX, t.clientY);
    if (id) setTouched(id);
  };

  return (
    <nav
      aria-label="Chapters"
      data-nav-touch="1"
      className={clsx(
        "z-navbar pointer-events-none absolute top-7 left-1/2 flex -translate-x-1/2 -translate-y-1/2 transform items-center opacity-0 transition-opacity",
        current && !leaving && "opacity-100",
        !busy && current && !leaving && "pointer-events-auto!",
        coarse && "touch-none",
      )}
      onMouseLeave={() => !busy && setHovered(null)}
      onTouchStart={(e) => {
        if (!coarse || busy) return;
        setTouching(true);
        track(e);
      }}
      onTouchMove={(e) => {
        if (!coarse || !touching || busy) return;
        e.preventDefault();
        track(e);
      }}
      onTouchEnd={() => {
        if (!coarse || !touching || busy) return;
        if (touched) go(touched);
        setTouching(false);
        setTouched(null);
      }}
    >
      {CHAPTERS.map(([id, name], i) => (
        <Fragment key={id}>
          <ChapterTab
            name={name}
            isActive={active === id}
            onHover={() => !coarse && !busy && setHovered(id)}
            onClick={() => !coarse && !busy && go(id)}
            setRef={(el) => {
              refs.current[id] = el;
            }}
          />
          {i < CHAPTERS.length - 1 && (
            <div className="w-0" aria-hidden="true">
              <div className="h-1.5 w-px bg-white/50" />
            </div>
          )}
        </Fragment>
      ))}
    </nav>
  );
}

function MenuToggle({ open }: { open: boolean }) {
  return (
    <div className="relative size-7">
      <div className="absolute top-1/2 left-1/2 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center">
        {open ? (
          <CloseIcon className="size-6 text-white transition-colors hover:text-white/80" />
        ) : (
          <MenuIcon className="size-7 text-white transition-colors hover:text-white/80" />
        )}
      </div>
    </div>
  );
}

/** Right-side sheet menu (shipped `T`); native <dialog> for focus trap + Escape. */
function Menu() {
  const lenis = useLenis();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open || !lenis) return;
    lockScroll(lenis);
    return () => unlockScroll(lenis);
  }, [open, lenis]);
  const close = () => dialog.current?.close();
  return (
    <>
      <button
        type="button"
        className="cursor-pointer"
        aria-label="Open menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          dialog.current?.showModal();
          setOpen(true);
        }}
      >
        <MenuToggle open={false} />
      </button>
      <dialog
        ref={dialog}
        aria-label="Menu"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === dialog.current) close();
        }}
        className="z-menu fixed inset-0 m-0 h-svh max-h-none w-full max-w-none bg-black/50 text-white [&:not([open])]:hidden"
      >
        <div
          className={clsx(
            "fixed top-0 right-0 bottom-0 flex h-svh w-full flex-col border-l border-white/20 bg-black/70 backdrop-blur-xl transition-transform duration-500 md:max-w-79",
            open ? "translate-x-0" : "translate-x-full",
          )}
        >
          <div className="text-d-body-l flex h-[var(--nav-height)] w-full items-center justify-end px-4 text-white/70 md:px-8">
            <button type="button" onClick={close} aria-label="Close menu" className="cursor-pointer">
              <MenuToggle open />
            </button>
          </div>
          <div className="flex flex-1 flex-col px-4 py-6 md:px-8">
            <ul className="flex flex-col gap-1">
              {MENU_LINKS.map((l) => (
                <li key={l.label}>
                  <a href={l.href} onClick={close} className="text-d-cta block w-fit py-3 text-white transition-colors duration-200 hover:text-white/50">
                    {l.label}
                  </a>
                </li>
              ))}
              <li className="md:hidden">
                <ContactButton
                  label="Contact"
                  trigger={
                    <button type="button" className="text-d-cta block w-fit py-3 text-white transition-colors duration-200 hover:text-white/50">
                      Contact
                    </button>
                  }
                />
              </li>
            </ul>
            <ul className="mt-auto flex flex-col gap-2 border-t border-white/10 pt-5">
              {[
                { title: "We're hiring", description: "Join a team of engineers building a sentient drone for good." },
                { title: "Partner Program", description: "We partner with agencies responsible for large areas. Capacity is limited." },
              ].map((i) => (
                <li key={i.title}>
                  <a href="#" onClick={close} className="group block py-2">
                    <span className="text-d-cta flex items-center gap-2 text-white transition-colors duration-200 group-hover:text-white/60">
                      {i.title}
                      <ArrowUpRightIcon className="size-4 text-white/40 transition-colors duration-200 group-hover:text-white/70" />
                    </span>
                    <span className="text-d-body-s mt-1 block leading-6 text-white/40">{i.description}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </dialog>
    </>
  );
}

/** Wordmark; collapses to the mark on narrow portrait screens after 40px scroll. */
function Logo({ collapsed, className: cls }: { collapsed?: boolean; className?: string }) {
  return <span className={clsx("inline-flex items-center font-semibold tracking-[-0.04em] text-white", cls)} style={{ fontSize: 28, lineHeight: 1 }} aria-label="Raven"><span className="portrait:max-[480px]:hidden">Raven</span><span className="hidden portrait:max-[480px]:inline">{collapsed ? "R" : "Raven"}</span></span>;
}

export function Navbar() {
  const lenis = useLenis(({ scroll }) => {
    if (!isScrollLocked()) setCollapsed(scroll > 40);
  });
  const [collapsed, setCollapsed] = useState(false);
  const bg = useScenes((s) => s[SCENE.MULTI_THREAT_RESPONSE]?.hideRatio ?? 0);
  const hiding = useLoading((s) => s.loadingCanvasIsHiding);
  return (
    <nav
      aria-label="Primary"
      className={clsx(
        "z-navbar fixed top-0 flex h-[var(--nav-height)] w-full items-center justify-between px-4 md:px-8",
        "transition-opacity delay-200 duration-700 ease-out",
        hiding ? "opacity-100" : "pointer-events-none opacity-0",
        "before:pointer-events-none before:absolute before:inset-0 before:-z-1 before:bg-black before:opacity-[var(--bg-opacity)]",
      )}
      style={{ "--bg-opacity": bg } as React.CSSProperties}
    >
      <button
        type="button"
        className="group cursor-pointer"
        aria-label="Raven, back to top"
        onClick={() => {
          lenis?.scrollTo(1, { immediate: true });
          lenis?.stop();
          setTimeout(() => lenis?.start(), 2);
        }}
      >
        <Logo collapsed={collapsed} />
      </button>
      <ChapterNav />
      <div className="flex items-center gap-3 md:gap-5">
        <ContactButton label="Contact" small className="hidden md:flex" />
        <Menu />
      </div>
    </nav>
  );
}
