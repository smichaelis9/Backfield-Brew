# Brewers Prospect Website Starter

This is a simple static website powered by your published Google Sheet.

## Files

- `index.html` — ranking/search/list page
- `player.html` — dynamic player page template
- `script.js` — pulls the Google Sheet tabs and connects everything by `Player-ID`
- `styles.css` — Brewers-themed styling

## How to use

1. Keep your Google Sheet published to the web.
2. Make sure every tab name matches exactly:
   - Biography Info
   - Pitcher Tools
   - Hitter Tools
   - Hitter Stats 2023
   - Hitter Stats 2024
   - Hitter Stats 2025
   - Hitter Stats 2026
   - Pitcher Stats 2023
   - Pitcher Stats 2024
   - Pitcher Stats 2025
   - Pitcher Stats 2026
3. Make sure `Player-ID` matches exactly across every tab.
4. Open `index.html` locally or upload the folder to GitHub Pages/Netlify.

## Player links

The ranking page links players like this:

`player.html?id=cooper-pratt`

That ID must match the `Player-ID` column in your Google Sheet.
