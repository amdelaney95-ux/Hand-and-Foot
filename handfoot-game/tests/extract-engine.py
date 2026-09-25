#!/usr/bin/env python3
"""
Extracts the pure game-engine section out of handfoot.html into tests/engine.js
so the Node-based tests can require it without a browser/DOM.

The engine section is delimited by two comment banners that exist in the HTML:
    /* ---------------------------- Card helpers ...
    /* ---------------------------- Networking ...
Everything between them is DOM-free and safe to eval() in Node.

Run from the repo root:  python3 tests/extract-engine.py
Then:                    cd tests && node test.js
"""
import re
import sys
import os

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML_PATH = os.path.join(REPO_ROOT, 'handfoot.html')
OUT_PATH = os.path.join(REPO_ROOT, 'tests', 'engine.js')

START_MARKER = '/* ---------------------------- Card helpers'
END_MARKER = '/* ---------------------------- Networking'


def main():
    with open(HTML_PATH, encoding='utf-8') as f:
        html = f.read()

    match = re.search(r'<script>(.*)</script>', html, re.S)
    if not match:
        sys.exit('ERROR: could not find a <script> block in handfoot.html')
    js = match.group(1)

    try:
        start = js.index(START_MARKER)
        end = js.index(END_MARKER)
    except ValueError:
        sys.exit(
            'ERROR: engine section markers not found. If the section banners in '
            'handfoot.html were renamed, update START_MARKER/END_MARKER in this script.'
        )

    engine = js[start:end]
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        f.write(engine)

    print(f'Wrote {len(engine)} chars to {OUT_PATH}')


if __name__ == '__main__':
    main()
