// ==UserScript==
// @name         Torn City - Stock Highlighter
// @namespace    sanxion.tc.stockhighlighter
// @version      2.1
// @description  Highlights a stock by 3-letter ticker OR company-name fragment. Works with or without Torn Tools.
// @author       Sanxion [2987640]
// @match        https://www.torn.com/page.php?sid=stocks*
// @run-at       document-end
// @grant        none
// @updateURL    https://github.com/Quantarallax/Torn-City-Stock-Ticker-Highlighter/raw/refs/heads/main/Sanxion's%20Stock%20Highlighter.user.js
// @downloadURL  https://github.com/Quantarallax/Torn-City-Stock-Ticker-Highlighter/raw/refs/heads/main/Sanxion's%20Stock%20Highlighter.user.js
// ==/UserScript==

(function () {
    'use strict';

    const SCRIPT_NAME = 'Torn City - Stock Highlighter';
    const SCRIPT_VERSION = '2.1';

    // ===================== STATCOUNTER =====================
    // Torn's Content Security Policy blocks injected <script> tags from
    // third-party origins. However, image requests use the img-src directive
    // (not script-src), so a plain Image() pixel bypasses the CSP entirely.
    // This is the same technique Statcounter uses in its own <noscript> fallback.
    // No @grant permissions are required.
    function pingStatcounter() {
        const img = new Image();
        img.src = 'https://c.statcounter.com/13222569/0/112bcd44/1/';
    }

    if (document.readyState === 'complete') {
        pingStatcounter();
    } else {
        window.addEventListener('load', pingStatcounter, { once: true });
    }

    // ===================== TICKER -> NAME LOOKUP =====================
    // Hardcoded fallback (current as of script publication). The script also
    // refreshes this from the public Tornsy API in the background so it stays
    // current as Torn adds/removes stocks.
    const FALLBACK_STOCKS = {
        "ASS": "Alcoholics Synonymous",
        "BAG": "Big Al's Gun Shop",
        "CBD": "Herbal Releaf Co.",
        "CNC": "Crude & Co",
        "ELT": "Empty Lunchbox Traders",
        "EVL": "Evil Ducks Candy Corp",
        "EWM": "Eaglewood Mercenary",
        "FHG": "Feathery Hotels Group",
        "GRN": "Grain",
        "HRG": "Home Retail Group",
        "IIL": "I Industries Ltd.",
        "IOU": "Insured On Us",
        "IST": "International School TC",
        "LAG": "Legal Authorities Group",
        "LOS": "Lo Squalo Waste",
        "LSC": "Lucky Shots Casino",
        "MCS": "Mc Smoogle Corp",
        "MSG": "Messaging Inc.",
        "MUN": "Munster Beverage Corp.",
        "PRN": "Performance Ribaldry",
        "PTS": "PointLess",
        "SYM": "Symbiotic Ltd.",
        "SYS": "Syscore MFG",
        "TCC": "Torn City Clothing",
        "TCI": "Torn City Investments",
        "TCM": "Torn City Motors",
        "TCP": "TC Media Productions",
        "TCSE": "TCSE Market Index",
        "TCT": "The Torn City Times",
        "TGP": "Tell Group Plc.",
        "THS": "Torn City Health Service",
        "TMI": "TC Music Industries",
        "TSB": "Torn & Shanghai Banking",
        "WLT": "Wind Lines Travel",
        "WSU": "West Side University",
        "YAZ": "Yazoo"
    };

    let STOCKS = Object.assign({}, FALLBACK_STOCKS);

    // Use the cached list if it is fresh (< 7 days old)
    const CACHE_KEY = 'sanxion_stocks_cache_v1';
    const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
            const cached = JSON.parse(raw);
            if (cached && cached.ts && (Date.now() - cached.ts) < CACHE_TTL_MS && cached.map) {
                STOCKS = Object.assign({}, FALLBACK_STOCKS, cached.map);
            }
        }
    } catch (_) {}

    // Background refresh from Tornsy (no API key required).
    fetch('https://tornsy.com/api/stocks')
        .then(r => r.ok ? r.json() : null)
        .then(data => {
            if (!data || !Array.isArray(data.data)) return;
            const map = {};
            data.data.forEach(s => {
                if (s && s.stock && s.name) map[String(s.stock).toUpperCase()] = String(s.name);
            });
            if (Object.keys(map).length) {
                STOCKS = Object.assign({}, FALLBACK_STOCKS, map);
                try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), map })); } catch (_) {}
                if (input && input.value) highlightStock();
            }
        })
        .catch(() => { /* offline / CORS — fallback list still works */ });

    // ===================== UI =====================
    const searchBar = document.createElement('div');
    searchBar.id = 'sanxion-stock-highlighter';
    searchBar.style.cssText = `
        position: fixed; top: 10px; left: 50%; transform: translateX(-50%);
        background: #222; color: #fff; padding: 8px 15px; z-index: 9999999;
        border-radius: 8px; border: 2px solid #444;
        display: flex; flex-direction: column; gap: 6px;
        font-family: Arial, sans-serif;
        box-shadow: 0 2px 10px rgba(0,0,0,0.5); cursor: grab;
    `;

    searchBar.innerHTML = `
        <div id="sanxionRow" style="display: flex; align-items: center; gap: 10px;">
            <label id="dragHandle" style="font-weight: bold; font-size: 11px; color: #fff; cursor: move; user-select: none;">DRAG ⠿ TICKER / NAME:</label>
            <input type="text" id="stockSearch" maxlength="30" placeholder="MCS or Mc Smo"
                   style="width: 130px; padding: 4px 6px; background: #fff; color: #000; border: none; font-weight: bold; cursor: text;">
            <span id="stockResolved" style="font-size: 10px; color: #9cf; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"></span>
            <button id="creditsBtn" title="Credits"
                    style="background: #444; color: #fff; border: 1px solid #666; border-radius: 4px;
                           padding: 3px 8px; font-size: 11px; cursor: pointer; font-weight: bold;">?</button>
        </div>
        <div id="creditsPanel" style="display: none; border-top: 1px solid #444; padding-top: 6px; font-size: 11px; color: #ddd; text-align: center; line-height: 1.6;">
            <strong style="color: #fff;">${SCRIPT_NAME}</strong>
            <span style="color: #888; margin-left: 4px;">v${SCRIPT_VERSION}</span><br>
            Written by
            <a href="https://www.torn.com/profiles.php?XID=2987640" target="_blank"
               style="color: #00ff88; text-decoration: underline;">Sanxion [2987640]</a>
        </div>
    `;

    document.body.appendChild(searchBar);
    const input = document.getElementById('stockSearch');
    const resolved = document.getElementById('stockResolved');
    const creditsBtn = document.getElementById('creditsBtn');
    const creditsPanel = document.getElementById('creditsPanel');
    const dragHandle = document.getElementById('dragHandle');
    const row = document.getElementById('sanxionRow');

    // ===================== CREDITS (inline expand/collapse) =====================
    creditsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = creditsPanel.style.display !== 'none';
        creditsPanel.style.display = open ? 'none' : 'block';
    });

    creditsPanel.addEventListener('mousedown', (e) => e.stopPropagation());

    // ===================== DRAGGABLE =====================
    let isDragging = false;
    let offsetX, offsetY;

    row.addEventListener('mousedown', (e) => {
        if (e.target === input || e.target === creditsBtn || e.target === resolved) return;
        isDragging = true;
        searchBar.style.cursor = 'grabbing';
        offsetX = e.clientX - searchBar.offsetLeft;
        offsetY = e.clientY - searchBar.offsetTop;
        searchBar.style.transform = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        searchBar.style.left = (e.clientX - offsetX) + 'px';
        searchBar.style.top = (e.clientY - offsetY) + 'px';
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        searchBar.style.cursor = 'grab';
    });

    dragHandle.style.cursor = 'move';

    // ===================== HIGHLIGHT LOGIC =====================
    const HIGHLIGHT_OUTLINE = '3px solid #00ff00';
    const HIGHLIGHT_BG = 'rgba(0, 255, 0, 0.15)';

    function clearHighlights() {
        document.querySelectorAll('[data-sanxion-highlighted="1"]').forEach(el => {
            el.style.outline = '';
            el.style.backgroundColor = '';
            el.removeAttribute('data-sanxion-highlighted');
        });
    }

    // Resolve user input to a search needle.
    //   "MCS"      -> "Mc Smoogle Corp"  (looked up in STOCKS)
    //   "Mc Smo"   -> "Mc Smo"           (used as-is, partial name)
    //   "feathery" -> "feathery"         (used as-is, partial name)
    function resolveNeedle(raw) {
        const trimmed = (raw || '').trim();
        if (!trimmed) return null;

        const upper = trimmed.toUpperCase();
        if (STOCKS[upper]) return { needle: STOCKS[upper], full: STOCKS[upper], viaTicker: upper };

        if (trimmed.length < 2) return null;
        return { needle: trimmed, full: null, viaTicker: null };
    }

    // Find candidate stock rows. Native Torn uses obfuscated React class names
    // like stock-list___xxxxx. Torn Tools / TornPDA add extra attributes.
    function findStockRows() {
        const out = new Set();
        document.querySelectorAll('[data-stock], [data-ticker]').forEach(el => out.add(el));
        document.querySelectorAll(
            'li[class*="stock"], div[class*="stockRow"], div[class*="stock-list"], li[class*="stockRow"]'
        ).forEach(el => out.add(el));
        document.querySelectorAll('ul[class*="stock"] > li').forEach(el => out.add(el));
        return Array.from(out);
    }

    function highlightStock() {
        const raw = input.value || '';
        try { localStorage.setItem('sanxion_highlighted_stock', raw); } catch (_) {}

        clearHighlights();
        resolved.textContent = '';

        const r = resolveNeedle(raw);
        if (!r) return;

        if (r.viaTicker) resolved.textContent = '→ ' + r.full;

        const needleUpper = r.needle.toUpperCase();
        const rows = findStockRows();

        rows.forEach(stockRow => {
            const text = (stockRow.innerText || '').toUpperCase();
            if (text.includes(needleUpper)) {
                stockRow.style.outline = HIGHLIGHT_OUTLINE;
                stockRow.style.backgroundColor = HIGHLIGHT_BG;
                stockRow.setAttribute('data-sanxion-highlighted', '1');
            }
        });
        // No scrollIntoView — user requested no auto-scroll.
    }

    // Restore previous selection
    try {
        const saved = localStorage.getItem('sanxion_highlighted_stock');
        if (saved) input.value = saved;
    } catch (_) {}

    input.addEventListener('input', highlightStock);

    // React / Torn Tools re-render the list. Throttle re-runs with rAF.
    let pending = false;
    const observer = new MutationObserver(() => {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => {
            pending = false;
            if ((input.value || '').trim().length >= 2) highlightStock();
        });
    });

    const target = document.querySelector('#mainContainer') || document.body;
    observer.observe(target, { childList: true, subtree: true });

    // Initial passes — page renders progressively.
    setTimeout(highlightStock, 500);
    setTimeout(highlightStock, 1500);
    setTimeout(highlightStock, 3000);
})();
