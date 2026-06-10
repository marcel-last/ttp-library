#!/usr/bin/env python3
"""
build_from_attack.py — generate assets/data.js from MITRE's official ATT&CK STIX.

This replaces the curated starter dataset with the COMPLETE Enterprise matrix:
every technique and sub-technique, with MITRE's own descriptions, the software
("tools") associated with each technique, and the mitigations mapped to it.

Usage:
    python3 tools/build_from_attack.py
    python3 tools/build_from_attack.py --domain mobile     # or ics

Requires only the Python standard library + internet access to GitHub.
Run from the project root. Re-run any time to refresh to the latest ATT&CK.
"""

import argparse
import json
import os
import sys
import urllib.request

RAW = ("https://raw.githubusercontent.com/mitre-attack/attack-stix-data/"
       "master/{d}-attack/{d}-attack.json")

TACTIC_ORDER = {  # shortname -> (display name, kill-chain position)
    "reconnaissance": ("Reconnaissance", 1),
    "resource-development": ("Resource Development", 2),
    "initial-access": ("Initial Access", 3),
    "execution": ("Execution", 4),
    "persistence": ("Persistence", 5),
    "privilege-escalation": ("Privilege Escalation", 6),
    "defense-evasion": ("Defense Evasion", 7),
    "credential-access": ("Credential Access", 8),
    "discovery": ("Discovery", 9),
    "lateral-movement": ("Lateral Movement", 10),
    "collection": ("Collection", 11),
    "command-and-control": ("Command & Control", 12),
    "exfiltration": ("Exfiltration", 13),
    "impact": ("Impact", 14),
}


def fetch(domain):
    url = RAW.format(d=domain)
    print(f"[*] downloading {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "ttp-library-build"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))


def attack_id(obj):
    for ref in obj.get("external_references", []):
        if ref.get("source_name") == "mitre-attack":
            return ref.get("external_id")
    return None


def first_sentence(text, limit=320):
    if not text:
        return ""
    text = text.replace("\n", " ").strip()
    # drop markdown citation/code noise lightly
    cut = text.find(". ")
    s = text if cut == -1 else text[:cut + 1]
    return (s[:limit] + "…") if len(s) > limit else s


def build(bundle):
    objs = bundle["objects"]

    techniques, software, mitigations = {}, {}, {}
    rels = []
    tactic_meta = {}

    for o in objs:
        typ = o.get("type")
        if o.get("revoked") or o.get("x_mitre_deprecated"):
            continue
        if typ == "attack-pattern":
            techniques[o["id"]] = o
        elif typ in ("tool", "malware"):
            software[o["id"]] = o
        elif typ == "course-of-action":
            mitigations[o["id"]] = o
        elif typ == "relationship":
            rels.append(o)
        elif typ == "x-mitre-tactic":
            sn = o.get("x_mitre_shortname")
            if sn:
                tactic_meta[sn] = attack_id(o)

    # map technique -> [software], technique -> [mitigations]
    tech_tools, tech_mit = {}, {}
    for r in rels:
        tgt = r.get("target_ref", "")
        src = r.get("source_ref", "")
        rtype = r.get("relationship_type")
        if rtype == "uses" and tgt in techniques and src in software:
            tech_tools.setdefault(tgt, []).append(software[src].get("name"))
        elif rtype == "mitigates" and tgt in techniques and src in mitigations:
            tech_mit.setdefault(tgt, []).append(mitigations[src].get("name"))

    # tactics list
    tactics_out = []
    for sn, (name, num) in sorted(TACTIC_ORDER.items(), key=lambda kv: kv[1][1]):
        tactics_out.append({
            "id": tactic_meta.get(sn, ""),
            "code": sn, "name": name, "num": num, "desc": ""
        })
    tac_id_by_short = {sn: tactic_meta.get(sn, "") for sn in TACTIC_ORDER}

    # techniques (one entry per technique/sub-technique per tactic phase)
    out = []
    for tid, t in techniques.items():
        aid = attack_id(t)
        if not aid:
            continue
        phases = [p["phase_name"] for p in t.get("kill_chain_phases", [])
                  if p.get("kill_chain_name") == "mitre-attack"]
        tools = sorted(set(filter(None, tech_tools.get(tid, []))))[:12]
        mits = sorted(set(filter(None, tech_mit.get(tid, []))))[:8]
        desc = first_sentence(t.get("description", ""))
        detection = first_sentence(t.get("x_mitre_detection", "")) or \
            "See the official ATT&CK entry for detection data sources."
        mitigation = (", ".join(mits) if mits else
                      "See the official ATT&CK entry for mitigations.")
        for ph in phases:
            if ph not in TACTIC_ORDER:
                continue
            out.append({
                "id": aid,
                "name": t.get("name", ""),
                "tactic": tac_id_by_short[ph],
                "desc": desc,
                "tools": tools,
                "methods": first_sentence(t.get("description", ""), 280) or desc,
                "detection": detection,
                "mitigation": mitigation,
            })

    out.sort(key=lambda x: x["id"])
    return tactics_out, out


def write_js(tactics, techs, version):
    header = (
        "/* AUTO-GENERATED from official MITRE ATT&CK STIX by "
        "tools/build_from_attack.py. Do not hand-edit. */\n"
    )
    js = header
    js += f'window.ATTACK_META = {json.dumps({"version": version, "source": "https://attack.mitre.org/", "generated": "stix-import"})};\n'
    js += "window.ATTACK_TACTICS = " + json.dumps(tactics, ensure_ascii=False) + ";\n"
    js += "window.ATTACK_TECHNIQUES = " + json.dumps(techs, ensure_ascii=False) + ";\n"
    path = os.path.join(os.path.dirname(__file__), "..", "assets", "data.js")
    path = os.path.abspath(path)
    with open(path, "w", encoding="utf-8") as f:
        f.write(js)
    return path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--domain", default="enterprise",
                    choices=["enterprise", "mobile", "ics"])
    args = ap.parse_args()

    try:
        bundle = fetch(args.domain)
    except Exception as e:
        print(f"[!] download failed: {e}", file=sys.stderr)
        print("    Check network access to raw.githubusercontent.com.", file=sys.stderr)
        sys.exit(1)

    version = "ATT&CK " + args.domain.capitalize()
    for o in bundle["objects"]:
        if o.get("type") == "x-mitre-collection":
            version = o.get("name", version)
            break

    tactics, techs = build(bundle)
    path = write_js(tactics, techs, version)
    print(f"[+] wrote {len(techs)} technique entries across {len(tactics)} tactics")
    print(f"[+] {path}")
    print("[+] reload index.html to see the full matrix.")


if __name__ == "__main__":
    main()
