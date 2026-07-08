# aceburney.com

Personal portfolio site — static HTML/CSS/JS. Deployed on Vercel.

## Deploy

Every push to `main` auto-deploys via Vercel's GitHub integration.

```bash
git add -A && git commit -m "message" && git push
```

## Local preview

```bash
cd site
python3 -m http.server 8000
```

Then open http://localhost:8000

## Structure

- `index.html` — landing page
- `about.html` — about page
- `assets/portrait.jpg` — grayscale portrait (used on trading card)
- `assets/favicon/` — favicon set (various sizes)
- `robots.txt`, `sitemap.xml` — SEO
- `vercel.json` — clean URLs + cache/security headers
