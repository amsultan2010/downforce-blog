# the downforce blog

Personal Formula 1 blog. Astro 7 static site, GSAP for motion, deployed on Vercel.
The blog is fully manual: no bots, no scheduled jobs, no generation scripts. Do not add any.

## Adding a post

The owner pastes the text and a thumbnail into the chat. Then:

1. Pick a slug: two to six kebab-case words, no date (`monza-gp-2026`). It becomes the URL.
2. Save the thumbnail as `src/assets/posts/<slug>.<ext>` (jpg, png, webp or avif), long edge
   2000px at most (`sips -Z 2000`). Photos used inside a post go in `src/assets/posts/<slug>/`.
3. Create `src/content/posts/<slug>.md`:

   ```
   ---
   title: "all lowercase title"
   date: 2026-10-04
   excerpt: "one sentence, 160 characters or fewer."
   tldr: "the main story in two or three sentences, 300 characters or fewer."
   category: race-report
   tags: ["three-to-six", "kebab-case-tags"]
   race: "2026 singapore grand prix"
   thumbnail: ../../assets/posts/<slug>.jpg
   thumbnailAlt: "what the photo shows, lowercase, no 'image of'"
   thumbnailCredit: "photographer, CC BY-SA 4.0"
   thumbnailSource: https://commons.wikimedia.org/wiki/File:...
   ---
   ```

   `category` is one of `race-report`, `sprint-report`, `editorial`, `guide`, `paddock`, `meta`.
   `race` is only for posts about one race weekend. `thumbnail` and `thumbnailAlt` are optional.
   `tldr` is required: it shows in a box at the top of the post and has to fit in four lines.
   `thumbnailCredit` and `thumbnailSource` are for photos that need attribution (wikimedia
   commons and other creative commons photos); the credit shows next to the post's tags.
4. Keep his words. Only apply the house style below, and fact-check (next section).
5. `npm run build` must pass. Check the post at `/posts/<slug>/` in Orca's browser.
6. Commit on a branch. Push or open a PR only when asked.

Everything else updates itself: the home page, the posts index, RSS, the sitemap, and the share
image at `/og/<slug>.png`.

## House style for post text

- All lowercase, including names, places and sentence starts. Capitals only for acronyms and
  initialisms: F1, FIA, DRS, DNF, WDC, VSC, GP, FP1, Q3, P4, GOAT, and car or tyre codes.
- No em dashes or en dashes, no emoji, plain markdown, `##` headings at most.
- Reports and editorials run about 350 to 550 words, guides up to 700.

## Fact-checking

Before saving a post, check every checkable claim (results, grid slots, points, gaps,
penalties, records, dates, the next race) against the Jolpica API
(`https://api.jolpi.ca/ergast/f1/<season>/<round>/results/`, `/sprint/`, `/qualifying/`,
`/driverStandings/`) and at least one independent report. A post only states what was known
on its publish date. Opinions and predictions are his and stay. Tell him what you corrected
and why; if a fix changes what he meant, ask first. `docs/fact-check-2026-10.md` shows the
standard.

## Code map

- `src/pages/` routes. `sitemap.xml.ts`, `robots.txt.ts`, `rss.xml.ts` and `og/[slug].png.ts`
  are generated, never hand-maintained.
- `src/lib/motion/` all animation. Components import GSAP from `core.ts`, never from `gsap`.
  Motion is declared in markup with `data-split`, `data-reveal`, `data-rule`, `data-count`,
  `data-parallax`, `data-magnetic`, `data-fill`. `boot.ts` owns the page lifecycle.
- `src/lib/f1.ts` standings from the Jolpica API: fetched at build, refreshed in the browser.
  `src/data/f1-snapshot.json` is the fallback if the API is down during a build.
- `src/styles/global.css` tokens. Green, paper and orange only. Radii are 0 or fully round.

## Site rules

Run the `anti-ai-site` and `gsap-max` skills before shipping visual changes. Site copy follows
the same lowercase rule as posts.
