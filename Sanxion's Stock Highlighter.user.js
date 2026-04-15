// ==UserScript==
// @name         Sanxion's Stock Highlighter
// @namespace    sanxion.tc.stocktickerhighlighter
// @version      1.4
// @description  Highlights stock ticker of choice
// @author       Sanxion [2987640]
// @match        https://www.torn.com/page.php?sid=stocks*
// @updateURL    https://github.com/Quantarallax/Torn-City-Stock-Ticker-Highlighter/raw/refs/heads/main/Sanxion's%20Stock%20Highlighter.user.js
// @downloadURL  https://github.com/Quantarallax/Torn-City-Stock-Ticker-Highlighter/raw/refs/heads/main/Sanxion's%20Stock%20Highlighter.user.js
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // UI Creation
    const searchBar = document.createElement('div');
    searchBar.id = 'sanxion-draggable-search';
    searchBar.style.cssText = `
        position: fixed; top: 10px; left: 50%; transform: translateX(-50%);
        background: #222; color: #fff; padding: 8px 15px; z-index: 9999999;
        border-radius: 8px; border: 2px solid #444; display: flex;
        align-items: center; gap: 10px; font-family: Arial, sans-serif;
        box-shadow: 0 2px 10px rgba(0,0,0,0.5); cursor: grab;
    `;

    searchBar.innerHTML = `
        <label id="dragHandle" style="font-weight: bold; font-size: 11px; color: #fff; cursor: move; user-select: none;">DRAG ⠿ TICKER:</label>
        <input type="text" id="stockSearch" maxlength="3" placeholder="---"
               style="width: 55px; text-transform: uppercase; padding: 4px; background: #fff; color: #000; border: none; font-weight: bold; cursor: text;">
    `;

    document.body.appendChild(searchBar);
    const input = document.getElementById('stockSearch');

    // DRAGGABLE LOGIC
    let isDragging = false;
    let offsetX, offsetY;

    searchBar.addEventListener('mousedown', (e) => {
        if (e.target === input) return; // Don't drag when clicking input
        isDragging = true;
        searchBar.style.cursor = 'grabbing';
        offsetX = e.clientX - searchBar.offsetLeft;
        offsetY = e.clientY - searchBar.offsetTop;
        searchBar.style.transform = 'none'; // Remove centering transform once dragged
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

    // HIGHLIGHT LOGIC
    function highlightStock() {
        const ticker = input.value.toUpperCase();
        localStorage.setItem('gemini_highlighted_stock', ticker);

        document.querySelectorAll('li').forEach(li => {
            li.style.outline = '';
            li.style.backgroundColor = '';
        });

        if (ticker.length === 3) {
            const allLi = document.querySelectorAll('li');
            allLi.forEach(li => {
                if (li.innerText.includes(ticker) && (li.getAttribute('data-stock') || li.className.includes('stock'))) {
                    li.style.outline = "3px solid #ffffff";
                    li.style.backgroundColor = "rgba(0, 255, 0, 0.1)";
                //    li.scrollIntoView({ behavior: 'auto', block: 'center' });
                }
            });
        }
    }

    const savedTicker = localStorage.getItem('gemini_highlighted_stock');
    if (savedTicker) { input.value = savedTicker; }

    input.addEventListener('input', highlightStock);

    const observer = new MutationObserver(() => {
        if (input.value.length === 3) highlightStock();
    });

    const target = document.querySelector('#mainContainer') || document.body;
    observer.observe(target, { childList: true, subtree: true });

    setTimeout(highlightStock, 1000);
})();
