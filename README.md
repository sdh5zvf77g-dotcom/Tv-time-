# Free TV

A free live TV player for English-language channels. No account, no sign-up, no tracking.
It loads public channel lists (from [iptv-org](https://github.com/iptv-org/iptv)) in your browser and plays the streams directly.

## Put it online with GitHub Pages
1. Create a new GitHub repository and upload every file in this folder (keep the `icons` folder).
2. Go to **Settings → Pages**, set **Source** to *Deploy from a branch*, choose `main` and `/ (root)`, then save.
3. Open `https://<your-username>.github.io/<repo-name>/`.
4. On iPhone: open it in Safari → Share → **Add to Home Screen**.

## Add or remove channel lists
Edit `sources.json`. Any public `.m3u` / `.m3u8` playlist URL works. Duplicates are removed automatically.

## Good to know
- Only `https` streams are shown on a hosted page; browsers block `http` streams there.
- Public channels come and go, and some are blocked outside their home country. If one won't play, try another.
- This app hosts no video. It only links to streams that other people publish.
