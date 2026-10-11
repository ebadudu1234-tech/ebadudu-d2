# skill — the three Claude skills used on this site

Copies of the three skills installed for Claude (2026-10-11), kept with the site so they travel
with its history and its GitHub backup. The working install is `C:\Users\12695\.claude\skills\`
(Claude Code loads skills from there in every project); these copies are a backup.

| Folder | What it does | Source | License |
|---|---|---|---|
| `apple-design/` | Apple's fluid, physical motion for the web: interruptible springs, velocity hand-off, momentum, rubber-banding, materials and depth, typography, reduced motion | https://github.com/emilkowalski/skills | MIT (see its LICENSE) |
| `web-design-guidelines/` | Reviews UI code against Vercel's Web Interface Guidelines (fetches the latest rules from GitHub each run, needs internet) and reports `file:line` findings | https://github.com/vercel-labs/agent-skills | MIT (stated in the repo's README) |
| `stop-slop/` | "Anti-AI-Slop Writing": removes AI writing tells (filler, adverbs, formulaic structures), scores prose out of 50 and rewrites below 35 | https://github.com/hardikpandya/stop-slop | MIT (see its LICENSE) |

## Using them (Claude Code)

Start a new session, then either type the name or just ask:

- `/apple-design make the toy throw feel more Apple-like`
- `/web-design-guidelines index.html work.html style.css`
- `/stop-slop rewrite this paragraph: ...`

## If the install is lost

Copy the three folders back into `C:\Users\12695\.claude\skills\`. For claude.ai (web / desktop chat),
upload each folder as a zip in Settings → Capabilities → Skills.
