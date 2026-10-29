# CLAUDE.md

Shared project context lives in AGENTS.md (also read by Codex). Keep facts there, not duplicated here.

@AGENTS.md

## Claude Code specifics

- Dev preview: `.claude/launch.json` config `drone-site` (port 3100). Use the preview tools, not `npm run dev` in Bash.
- Reference comparison: open https://www.usavionix.com/ in a second built-in-browser tab, set the same viewport on
  both tabs, front the tab before each screenshot (background tabs show stale frames).
- Prettified bundles are not kept in the repo; regenerate when needed:
  `npx prettier@3.3.3 --write <copy of research/usavionix/shipped/*.js>` in the scratchpad, never in `shipped/`.
- Useful skills here: reverse-engineer-anything, web-animation-design, fixing-motion-performance,
  fixing-accessibility, review-animations. For the Raven asset (`glb/raven-quad/`): blender-mcp, blender-export,
  blender-web-pipeline; build headless from the scripts, use Blender MCP only for live previews.
- When a change alters behavior or closes a gap, update `RECONSTRUCTION.md` and the "Open work" list in AGENTS.md.
- The built-in preview throttles requestAnimationFrame; for animation/WebGL checks use agent-browser (headless Chrome,
  60fps) with a named session. Close the session when done.
- Commit/push only when asked; GitHub repo is private. Never commit `research/`, `asset/` or the ignored mirrored assets.
