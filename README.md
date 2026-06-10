# TTP Field Manual

An internal **MITRE ATT&CK** knowledge base for red teams and offensive security
consultants. Browse the kill chain stage by stage, search across techniques and
tooling, and capture engagement-specific notes — each entry pairs offensive
context with **detection and mitigation** guidance and links to the official
[attack.mitre.org](https://attack.mitre.org/) page.

It's a static site (HTML/CSS/JS, no build step, no backend) so it drops straight
onto GitHub Pages.

## Quick start

Open `index.html` in a browser — that's it. Saved techniques and notes persist
in the browser via `localStorage`.

## Host on GitHub Pages

1. Create a repo and push these files to the root (keep the folder structure).
2. Repo **Settings → Pages**.
3. Source: **Deploy from a branch**, branch `main`, folder `/ (root)`.
4. Save. Your site goes live at `https://<user>.github.io/<repo>/`.

No build, bundler, or framework required. All paths are relative.

## Load the complete ATT&CK matrix

The shipped `assets/data.js` is a **curated core set** covering all 14 Enterprise
tactics. To replace it with the **entire** official matrix — every technique and
sub-technique, with MITRE's descriptions, associated software, and mapped
mitigations — run the import script (Python 3, standard library only):

```bash
python3 tools/build_from_attack.py            # Enterprise (default)
python3 tools/build_from_attack.py --domain mobile
python3 tools/build_from_attack.py --domain ics
```

It downloads MITRE's published STIX bundle, regenerates `assets/data.js`, and the
app picks it up on reload. Re-run any time to refresh to the latest release.

## Extend by hand

`assets/data.js` is plain data. Add a technique by appending to
`window.ATTACK_TECHNIQUES`:

```js
{
  id: "T1566",
  name: "Phishing",
  tactic: "TA0001",                  // must match a tactic id
  desc: "Short summary.",
  tools: ["GoPhish", "Evilginx"],    // associated tooling
  methods: "Conceptual technical approach.",
  detection: "How defenders catch it.",
  mitigation: "How to reduce the risk."
}
```

This is a great place for your team's own playbook notes, internal tooling
references, and environment-specific TTPs.

## Features

- **Kill-chain rail** — all 14 tactics in order, color-coded cool→warm, with live counts.
- **Search** — across technique names, IDs, descriptions, and tooling (press `/` to focus).
- **Dossier panel** — tools, technical approach, detection, mitigation, ATT&CK deep link.
- **Save + notes** — flag techniques and keep per-technique engagement notes (stored locally).
- **Export** — download your saved techniques and notes as JSON.
- Responsive, keyboard-navigable, respects reduced-motion.

## Files

```
index.html              # page shell
assets/styles.css       # theme
assets/app.js           # rendering, search, navigation, dossier, notes
assets/data.js          # the dataset (regenerate with the script)
tools/build_from_attack.py  # official ATT&CK STIX -> data.js
```

## Notes on scope

This is a reference and orientation tool for **authorized** testing. Entries
describe techniques at the level of the public ATT&CK knowledge base —
categories of tooling, conceptual approach, and the defensive picture — and
deliberately pair every offensive note with detection and mitigation. It is not
a payload or exploit repository.

MITRE ATT&CK® is a registered trademark of The MITRE Corporation. The framework
content is published by MITRE; this app is an independent viewer.
