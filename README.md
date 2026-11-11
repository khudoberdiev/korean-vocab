# SNU Korean Vocab

Vocabulary practice for 서울대 한국어 (Words, Flashcards, Quiz, Spelling, Listening).
Plain HTML/CSS/JS, no build step. Pronunciation uses the browser's Korean voice.

## Publish on GitHub Pages
1. Create a new public repo (e.g. `korean-vocab`) and upload all files from this folder.
2. Repo → Settings → Pages → Source: **Deploy from a branch**, Branch: `main`, folder `/ (root)` → Save.
3. After a minute the site is at `https://<your-username>.github.io/korean-vocab/`.

You can also just double-click `index.html` to use it offline.

## Add a new unit
1. Copy `units/_template` → `units/2a-unit3`.
2. Edit `units/2a-unit3/data.js` (`ko`, `en`, `uz`, optional `note`).
3. Add a line to `window.UNITS` in `shared/site.js`:
   `{ id: "2a-unit3", book: "2A", title: "Unit 3", topic: "..." }`

## Change name / title
Edit `shared/site.js`.

## Natural pronunciation (recommended)
The browser voice is a fallback. For a natural voice, run once on your computer:
```
pip install edge-tts
python3 make_audio.py
```
This creates `units/<unit>/audio/*.mp3`. Upload the new `audio` folders to GitHub.
Run it again whenever you add words; existing files are skipped.
