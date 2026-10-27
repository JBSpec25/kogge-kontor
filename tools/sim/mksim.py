#!/usr/bin/env python3
"""Baut aus der Spieldatei einen schnellen Simulationsbau mit dem Spieler-Bot (tools/sim/bot.js).

  python3 tools/sim/mksim.py src/kogge-kontor.html tools/out/sim.html

Im Simulationsbau zeichnet und speichert das Spiel nicht (window.__fast); der Bot steht als window.__bot bereit.
Gestartet wird er von tools/sim/run.js.
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
src, out = sys.argv[1], sys.argv[2]
s = open(src, encoding='utf-8').read()


def R(a, b):
    global s
    assert s.count(a) == 1, (s.count(a), a)
    s = s.replace(a, b)


R("function render() { preloadArt();", "function render() { if (window.__fast) return; preloadArt();")
R("  function save() {\n    if (!st || st._temp) return;", "  function save() {\n    if (!st || st._temp || window.__fast) return;")
R("function schedTick() { scene.tickDur", "function schedTick() { if (window.__fast) return; scene.tickDur")
anchor = '  if (window.claude && window.claude.hot && window.claude.hot.snapshot) {'
R(anchor, open(os.path.join(HERE, 'bot.js'), encoding='utf-8').read() + anchor)
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
open(out, 'w', encoding='utf-8').write(s)
print('Simulationsbau', out)
