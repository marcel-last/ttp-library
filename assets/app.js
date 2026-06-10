/* ===========================================================================
   TTP Field Manual — application logic
   =========================================================================== */
(function () {
  "use strict";

  var TACTICS = window.ATTACK_TACTICS || [];
  var TECHS   = window.ATTACK_TECHNIQUES || [];
  var META    = window.ATTACK_META || {};

  /* cool -> warm heat gradient across the kill chain (index = tactic.num - 1) */
  var PALETTE = [
    "#4A6FA5", "#4E83A8", "#4E97A0", "#51A58C", "#6FAE76",
    "#97B25F", "#C2B24D", "#E0A23E", "#E08C3E", "#DD763C",
    "#D85F3E", "#D14A45", "#C53A4E", "#B22D55"
  ];
  function tacticColor(t) { return PALETTE[(t.num - 1) % PALETTE.length]; }
  function tacticById(id) { for (var i=0;i<TACTICS.length;i++) if (TACTICS[i].id===id) return TACTICS[i]; return null; }
  function attackUrl(id) {
    var base = id.split(/[a-z]/)[0]; // strip any local suffix like T1056b
    return "https://attack.mitre.org/techniques/" + base.replace(".", "/") + "/";
  }

  /* ---- safe persistence (degrades to memory if storage unavailable) ---- */
  var mem = {};
  function store(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); }
    catch (e) { mem[key] = val; }
  }
  function load(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v === null ? (mem[key] !== undefined ? mem[key] : fallback) : JSON.parse(v);
    } catch (e) { return mem[key] !== undefined ? mem[key] : fallback; }
  }

  var favs  = new Set(load("ttp_favs", []));
  var notes = load("ttp_notes", {});

  /* ---- state ---- */
  var state = { tactic: null, query: "", favsOnly: false, current: null };

  /* ---- elements ---- */
  var $rail   = document.getElementById("chain");
  var $main   = document.getElementById("main");
  var $search = document.getElementById("search");
  var $favBtn = document.getElementById("favFilter");
  var $stats  = document.getElementById("stats");
  var $scrim  = document.getElementById("scrim");
  var $dossier= document.getElementById("dossier");

  /* ===================================================== rail ========== */
  function renderRail() {
    var html = "";
    html += '<li class="chain-item rail-all" data-tactic="ALL">' +
              '<span class="ci-dot" style="--dot:var(--bone-dim)"></span>' +
              '<span class="ci-num">--</span>' +
              '<span class="ci-name">All Techniques</span>' +
              '<span class="ci-count">' + TECHS.length + '</span>' +
            '</li>';
    TACTICS.forEach(function (t) {
      var count = TECHS.filter(function (x) { return x.tactic === t.id; }).length;
      var num = ("0" + t.num).slice(-2);
      html += '<li class="chain-item" data-tactic="' + t.id + '" style="--dot:' + tacticColor(t) + '">' +
                '<span class="ci-dot"></span>' +
                '<span class="ci-num">' + num + '</span>' +
                '<span class="ci-name">' + t.name + '</span>' +
                '<span class="ci-count">' + count + '</span>' +
              '</li>';
    });
    $rail.innerHTML = html;
    Array.prototype.forEach.call($rail.querySelectorAll(".chain-item"), function (el) {
      el.addEventListener("click", function () {
        var id = el.getAttribute("data-tactic");
        state.tactic = (id === "ALL") ? null : id;
        state.favsOnly = false; $favBtn.classList.remove("active");
        syncRailActive(); renderMain();
        if (window.innerWidth <= 880) $main.scrollIntoView({ block: "start" });
      });
    });
    syncRailActive();
  }
  function syncRailActive() {
    Array.prototype.forEach.call($rail.querySelectorAll(".chain-item"), function (el) {
      var id = el.getAttribute("data-tactic");
      var on = (state.tactic === null && id === "ALL") || id === state.tactic;
      el.classList.toggle("active", on);
    });
  }

  /* ===================================================== main ========== */
  function visibleTechniques() {
    var q = state.query.trim().toLowerCase();
    return TECHS.filter(function (x) {
      if (state.favsOnly && !favs.has(x.id)) return false;
      if (state.tactic && x.tactic !== state.tactic) return false;
      if (q) {
        var hay = (x.id + " " + x.name + " " + x.desc + " " + (x.tools || []).join(" ")).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function renderMain() {
    var list = visibleTechniques();
    var html = "";

    /* banner */
    if (state.favsOnly) {
      html += banner("Saved", "PERSONAL LIBRARY", "Techniques you've flagged for this engagement.", "var(--signal)");
    } else if (state.query.trim()) {
      html += banner("Search", 'QUERY · "' + escapeHtml(state.query.trim()) + '"', list.length + " matching technique" + (list.length===1?"":"s") + " across all tactics.", "var(--signal)");
    } else if (state.tactic) {
      var t = tacticById(state.tactic);
      html += banner(t.name, t.id + " · STAGE " + ("0"+t.num).slice(-2), t.desc, tacticColor(t));
    } else {
      html += banner("All Techniques", META.version || "ENTERPRISE MATRIX", "The full tactic chain — pick a stage on the left to focus, or search across everything.", "var(--signal)");
    }

    /* grid */
    if (!list.length) {
      html += '<div class="empty"><b>Nothing here yet</b>No techniques match the current view. Clear the search or pick another tactic.</div>';
    } else {
      html += '<div class="grid">';
      list.forEach(function (x) {
        var t = tacticById(x.tactic);
        var c = t ? tacticColor(t) : "var(--signal)";
        html += '<article class="card" data-id="' + x.id + '" style="--accent:' + c + '" tabindex="0">' +
                  '<div class="card-top">' +
                    '<span class="card-id">' + x.id.replace(/[a-z]$/,"") + '</span>' +
                    '<button class="card-fav ' + (favs.has(x.id)?"on":"") + '" data-fav="' + x.id + '" aria-label="Save technique">' + (favs.has(x.id)?"\u2605":"\u2606") + '</button>' +
                  '</div>' +
                  '<h3>' + escapeHtml(x.name) + '</h3>' +
                  '<p>' + escapeHtml(truncate(x.desc, 120)) + '</p>' +
                  '<div class="card-tactic"><span class="tdot"></span>' + (t ? t.name : "") + '</div>' +
                '</article>';
      });
      html += '</div>';
    }

    $main.innerHTML = html;

    Array.prototype.forEach.call($main.querySelectorAll(".card"), function (el) {
      el.addEventListener("click", function (e) {
        if (e.target.closest(".card-fav")) return;
        openDossier(el.getAttribute("data-id"));
      });
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDossier(el.getAttribute("data-id")); }
      });
    });
    Array.prototype.forEach.call($main.querySelectorAll(".card-fav"), function (el) {
      el.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleFav(el.getAttribute("data-fav"));
      });
    });

    updateStats(list.length);
  }

  function banner(title, meta, desc, color) {
    return '<div class="tactic-banner">' +
             '<div class="tb-bar" style="--accent:' + color + '"></div>' +
             '<div class="tb-text" style="--accent:' + color + '">' +
               '<div class="tb-meta">' + escapeHtml(meta) + '</div>' +
               '<h2>' + escapeHtml(title) + '</h2>' +
               '<p>' + escapeHtml(desc) + '</p>' +
             '</div>' +
           '</div>';
  }

  /* ===================================================== dossier ======= */
  function openDossier(id) {
    var x = null;
    for (var i=0;i<TECHS.length;i++) if (TECHS[i].id === id) { x = TECHS[i]; break; }
    if (!x) return;
    state.current = id;
    var t = tacticById(x.tactic);
    var c = t ? tacticColor(t) : "var(--signal)";
    var note = notes[id] || "";

    $dossier.style.setProperty("--accent", c);
    $dossier.innerHTML =
      '<div class="dossier-head">' +
        '<div class="accent-bar"></div>' +
        '<div class="d-tactic"><span class="d-stamp">' + x.id.replace(/[a-z]$/,"") + '</span> ' + (t ? t.name : "") + '</div>' +
        '<h2>' + escapeHtml(x.name) + '</h2>' +
        '<button class="d-close" id="dClose" aria-label="Close">\u2715</button>' +
      '</div>' +
      '<div class="dossier-body">' +
        '<p class="d-desc">' + escapeHtml(x.desc) + '</p>' +
        section("methods", "Tools & Services", '<div class="tool-tags">' + (x.tools||[]).map(function(tt){return '<span>'+escapeHtml(tt)+'</span>';}).join("") + '</div>') +
        section("methods", "Technical Approach", '<p>' + escapeHtml(x.methods||"") + '</p>') +
        section("detect", "Detection", '<p>' + escapeHtml(x.detection||"") + '</p>') +
        section("mitig", "Mitigation", '<p>' + escapeHtml(x.mitigation||"") + '</p>') +
        section("methods", "Engagement Notes",
          '<div class="d-notes"><textarea id="dNote" placeholder="Environment-specific notes, tooling tweaks, lessons learned...">' + escapeHtml(note) + '</textarea>' +
          '<div class="note-status" id="dNoteStatus"></div></div>') +
      '</div>' +
      '<div class="dossier-foot">' +
        '<button class="d-fav-btn ' + (favs.has(id)?"on":"") + '" id="dFav">' + (favs.has(id)?"\u2605 Saved":"\u2606 Save technique") + '</button>' +
        '<a class="d-link" href="' + attackUrl(x.id) + '" target="_blank" rel="noopener">ATT&CK \u2197</a>' +
      '</div>';

    document.getElementById("dClose").addEventListener("click", closeDossier);
    document.getElementById("dFav").addEventListener("click", function () {
      toggleFav(id);
      var on = favs.has(id);
      this.classList.toggle("on", on);
      this.innerHTML = on ? "\u2605 Saved" : "\u2606 Save technique";
    });
    var ta = document.getElementById("dNote");
    var st = document.getElementById("dNoteStatus");
    var timer;
    ta.addEventListener("input", function () {
      clearTimeout(timer);
      st.textContent = "editing...";
      timer = setTimeout(function () {
        if (ta.value.trim()) notes[id] = ta.value; else delete notes[id];
        store("ttp_notes", notes);
        st.textContent = "saved \u2713";
        setTimeout(function(){ st.textContent = ""; }, 1400);
      }, 500);
    });

    $scrim.classList.add("open");
    $dossier.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function section(kind, label, inner) {
    return '<div class="d-section"><div class="d-label ' + kind + '">' + label + '</div>' + inner + '</div>';
  }

  function closeDossier() {
    $scrim.classList.remove("open");
    $dossier.classList.remove("open");
    document.body.style.overflow = "";
    state.current = null;
  }

  /* ===================================================== favs / stats == */
  function toggleFav(id) {
    if (favs.has(id)) favs.delete(id); else favs.add(id);
    store("ttp_favs", Array.from(favs));
    // refresh any visible fav buttons
    Array.prototype.forEach.call($main.querySelectorAll('.card-fav[data-fav="' + id + '"]'), function (b) {
      var on = favs.has(id); b.classList.toggle("on", on); b.innerHTML = on ? "\u2605" : "\u2606";
    });
    if (state.favsOnly) renderMain();
    updateStats(visibleTechniques().length);
  }

  function updateStats(showing) {
    $stats.innerHTML = '<b>' + showing + '</b> shown &nbsp;·&nbsp; <b>' + favs.size + '</b> saved';
  }

  /* ===================================================== export ======== */
  function exportLibrary() {
    var payload = {
      exported: new Date().toISOString(),
      attack_version: META.version || "",
      saved: Array.from(favs).map(function (id) {
        var x = null; for (var i=0;i<TECHS.length;i++) if (TECHS[i].id===id) x=TECHS[i];
        return { id: id, name: x ? x.name : "", note: notes[id] || "" };
      }),
      notes: notes
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ttp-library-export.json";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  /* ===================================================== utils ========= */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c];
    });
  }
  function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + "\u2026" : s; }

  /* ===================================================== wire up ======= */
  function init() {
    document.getElementById("attackVer").textContent = META.version || "Enterprise";
    renderRail();
    renderMain();

    var debounce;
    $search.addEventListener("input", function () {
      clearTimeout(debounce);
      debounce = setTimeout(function () {
        state.query = $search.value;
        if (state.query.trim()) { state.favsOnly = false; $favBtn.classList.remove("active"); }
        renderMain();
      }, 140);
    });

    $favBtn.addEventListener("click", function () {
      state.favsOnly = !state.favsOnly;
      $favBtn.classList.toggle("active", state.favsOnly);
      if (state.favsOnly) { state.tactic = null; state.query = ""; $search.value = ""; syncRailActive(); }
      renderMain();
    });

    document.getElementById("exportBtn").addEventListener("click", exportLibrary);
    $scrim.addEventListener("click", closeDossier);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && state.current) closeDossier();
      if (e.key === "/" && document.activeElement !== $search) { e.preventDefault(); $search.focus(); }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
