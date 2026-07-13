// 2026 makeover page assembler: wraps each page's real content (content/<slug>.html)
// in shared chrome (head, header/nav w/ More dropdown, footer w/ RTEF trust block).
// Preserves ALL original site content — pages are full, not summarized.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const P = (...s) => path.join(ROOT, ...s);

// Cache-busting: a single build version = short hash of every CSS/JS asset.
// Returning visitors always re-fetch when styles/scripts change, preventing the
// stale-stylesheet bug class (new markup served against an old cached site.css).
const V = createHash('sha1')
  .update(Buffer.concat(await Promise.all(
    ['css/tokens.css', 'assets/fonts/fonts.css', 'css/site.css', 'js/site.js'].map((f) => readFile(P(f)))
  )))
  .digest('hex').slice(0, 8);
const SITE = process.env.SITE_URL || 'https://team79krunch.com';

// Per-file cache-busting for images/video referenced in page HTML: append
// ?v=<short content hash> so a changed asset (same filename) is re-fetched by
// browsers instead of served stale. CSS/JS are versioned separately via V above.
const assetVer = new Map();
async function assetHash(rel) {
  if (!assetVer.has(rel)) {
    try { assetVer.set(rel, createHash('sha1').update(await readFile(P(rel))).digest('hex').slice(0, 8)); }
    catch { assetVer.set(rel, null); }
  }
  return assetVer.get(rel);
}
async function versionAssets(html) {
  const re = /\/assets\/(?:img|video)\/[A-Za-z0-9._-]+\.(?:png|jpe?g|svg|webp|gif|mp4|webm)(?!\?)/g;
  for (const url of [...new Set(html.match(re) || [])]) {
    const v = await assetHash(url.slice(1));
    if (v) html = html.split(url).join(`${url}?v=${v}`);
  }
  return html;
}

// group: 'primary' shows in the top nav; 'more' goes in the More dropdown; null = home
const PAGES = [
  { slug: 'home', out: 'index.html', nav: null, group: null, title: 'FIRST Team 79 Krunch | Robotics in Tampa Bay', desc: 'FIRST Robotics Competition Team 79 Krunch: an award-winning, student-powered robotics team and Rotary Interact Club in the Tampa Bay area. Join, sponsor, or support us.' },
  { slug: 'team', out: 'team/index.html', nav: 'The Team', group: 'primary', title: 'The Team | FIRST Team 79 Krunch', desc: 'Meet FIRST Team 79 Krunch: an award-winning robotics team and Rotary Interact Club of students, mentors, and volunteers in Palm Harbor, Florida.' },
  { slug: 'first', out: 'first/index.html', nav: 'FIRST', group: 'primary', title: 'FIRST | Team 79 Krunch', desc: 'What is FIRST? For Inspiration and Recognition of Science and Technology, and the FIRST Robotics Competition that Team 79 Krunch has competed in since its inception.' },
  { slug: 'interact', out: 'interact/index.html', nav: 'Interact', group: 'primary', title: 'Interact | Team 79 Krunch', desc: 'Team 79 Krunch is also a Rotary Interact Club. Learn what Interact is, the benefits of joining, and about our sponsoring Rotary Club of East Lake Sunrise.' },
  { slug: 'why-join', out: 'why-join/index.html', nav: null, group: null, redirect: '/join/', title: 'Why Join Us | FIRST Team 79 Krunch', desc: 'Why join FIRST Team 79 Krunch: STEM skills, mentorship, scholarships, and community. Now part of the Join page.' },
  { slug: 'awards', out: 'awards/index.html', nav: 'Awards', group: 'more', title: 'Awards | FIRST Team 79 Krunch', desc: 'Team 79 Krunch competition awards and recognitions from 1998 through the 2024-2025 Space Coast Showdown, plus community honors and internship programs.' },
  { slug: 'outreach', out: 'outreach/index.html', nav: 'Outreach', group: 'more', title: 'Community Outreach | FIRST Team 79 Krunch', desc: 'KrunchAid relief efforts, news features, community partnerships, and local outreach: how Team 79 Krunch serves the Tampa Bay area and beyond.' },
  { slug: 'events', out: 'events/index.html', nav: 'Events', group: 'more', title: 'Events | FIRST Team 79 Krunch', desc: 'See FIRST Team 79 Krunch compete: recent regional results, where to catch us in person, and how to follow the season.' },
  { slug: 'join', out: 'join/index.html', nav: 'Join', group: 'primary', title: 'Join the Team | FIRST Team 79 Krunch', desc: 'Anyone ages 12-18 can join FIRST Team 79 Krunch. No experience needed. Membership, subteams, the season schedule, dues, mentor and volunteer roles, and how to apply.' },
  { slug: 'volunteer', out: 'volunteer/index.html', nav: 'Volunteer', group: 'more', title: 'Volunteer & Mentor | FIRST Team 79 Krunch', desc: 'Mentor and volunteer opportunities with FIRST Team 79 Krunch for engineers and business professionals who want to inspire the next generation.' },
  { slug: 'sponsors', out: 'sponsors/index.html', nav: 'Sponsors', group: 'primary', title: 'Sponsors & Support | FIRST Team 79 Krunch', desc: 'Sponsor or donate to FIRST Team 79 Krunch through RTEF, a 501(c)(3) nonprofit. Sponsorship benefits, in-kind needs, matching gifts, grants, and ways to give.' },
  { slug: 'contact', out: 'contact/index.html', nav: 'Contact', group: 'primary', title: 'Contact | FIRST Team 79 Krunch', desc: 'Get in touch with FIRST Team 79 Krunch about joining, sponsoring, volunteering, or community outreach.' },
  { slug: 'thanks', out: 'thanks/index.html', nav: null, group: null, title: 'Thank You | FIRST Team 79 Krunch', desc: 'Thanks for reaching out to FIRST Team 79 Krunch. We received your message and will be in touch.' },
];

const PRIMARY = PAGES.filter((p) => p.group === 'primary');
const MORE = PAGES.filter((p) => p.group === 'more');
const ALLNAV = PAGES.filter((p) => p.nav);
const bySlug = Object.fromEntries(PAGES.map((p) => [p.slug, p]));
// Footer links grouped into scannable categories (better than one flat list).
const FOOT_GROUPS = [
  { h: 'Explore', slugs: ['team', 'first', 'interact', 'awards', 'outreach'] },
  { h: 'Get involved', slugs: ['join', 'volunteer', 'sponsors', 'events', 'contact'] },
];
const rel = (slug) => (slug === 'home' ? '/' : `/${slug}/`);

const head = (p) => {
  const url = SITE + rel(p.slug);
  const share = SITE + '/assets/img/hero-team-2026-1200.jpg';
  const ld = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'SportsOrganization',
    name: 'FIRST Team 79 Krunch', alternateName: 'Team 79 Krunch',
    url: SITE, logo: SITE + '/assets/img/clock-logo.png', foundingDate: '1997',
    sport: 'FIRST Robotics Competition',
    address: { '@type': 'PostalAddress', addressLocality: 'Palm Harbor', addressRegion: 'FL', addressCountry: 'US' },
    sameAs: ['https://www.instagram.com/team79krunch', 'https://www.facebook.com/krunch79', 'https://www.youtube.com/channel/UCzrA9jdhqB923qp8KB-6EsA'],
  });
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>document.documentElement.classList.add('js')</script>
<title>${p.title}</title>
<meta name="description" content="${p.desc}">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="#002e5d">
<meta property="og:type" content="website">
<meta property="og:site_name" content="FIRST Team 79 Krunch">
<meta property="og:title" content="${p.title}">
<meta property="og:description" content="${p.desc}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${share}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${p.title}">
<meta name="twitter:description" content="${p.desc}">
<meta name="twitter:image" content="${share}">
<link rel="icon" href="/assets/img/clock-logo.png" type="image/png">
<link rel="apple-touch-icon" href="/assets/img/clock-logo.png">
<link rel="preload" as="font" type="font/woff2" href="/assets/fonts/space-grotesk.woff2" crossorigin>
<link rel="preload" as="font" type="font/woff2" href="/assets/fonts/inter.woff2" crossorigin>
<link rel="preload" as="font" type="font/woff2" href="/assets/fonts/rapscallion.woff2" crossorigin>
<link rel="stylesheet" href="/css/tokens.css?v=${V}">
<link rel="stylesheet" href="/assets/fonts/fonts.css?v=${V}">
<link rel="stylesheet" href="/css/site.css?v=${V}">
<script type="application/ld+json">${ld}</script>
</head>
<body>
<a class="skip-link" href="#main">Skip to main content</a>`;
};

const navlink = (n, p) => `<a href="${rel(n.slug)}"${n.slug === p.slug ? ' aria-current="page"' : ''}>${n.nav}</a>`;

const header = (p) => `
<header class="site-header">
  <div class="container site-header__inner">
    <a class="brand" href="/" aria-label="FIRST Team 79 Krunch home"><img class="brand__logo" src="/assets/img/krunch-logo.png" alt="" width="250" height="160" decoding="async"><span class="wordmark">Team 79 Krunch</span></a>
    <nav class="nav" aria-label="Primary">
      ${PRIMARY.map((n) => navlink(n, p)).join('\n      ')}
      <div class="nav-more">
        <button class="nav-more__btn" aria-expanded="false" aria-haspopup="true" aria-controls="more-menu">More <span aria-hidden="true">&#9662;</span></button>
        <div class="nav-more__menu" id="more-menu">${MORE.map((n) => navlink(n, p)).join('')}</div>
      </div>
    </nav>
    <div class="header-cta">
      <a class="btn btn--primary" href="/sponsors/#donate">Donate</a>
      <button class="nav-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="mobile-menu"><span></span><span></span><span></span></button>
    </div>
  </div>
</header>
<nav class="mobile-menu" id="mobile-menu" aria-label="Mobile">
  ${ALLNAV.map((n) => navlink(n, p)).join('\n  ')}
  <a class="btn btn--primary" href="/sponsors/#donate">Donate</a>
</nav>`;

const footer = () => `
<footer class="site-footer">
  <div class="container">
    <div class="foot-grid">
      <div>
        <span class="wordmark wordmark--footer">Team 79 Krunch</span>
        <p style="max-width:34ch">An award-winning <span class="first">FIRST</span>&reg; Robotics Competition team and Rotary Interact Club serving the Tampa Bay area.</p>
        <div class="foot-social">
          <a href="https://www.instagram.com/team79krunch" target="_blank" rel="noopener" aria-label="Instagram"><img src="/assets/img/social-instagram.svg" alt="" width="30" height="30" loading="lazy"></a>
          <a href="https://www.facebook.com/krunch79" target="_blank" rel="noopener" aria-label="Facebook"><img src="/assets/img/social-facebook.svg" alt="" width="30" height="30" loading="lazy"></a>
          <a href="https://www.youtube.com/channel/UCzrA9jdhqB923qp8KB-6EsA" target="_blank" rel="noopener" aria-label="YouTube"><img src="/assets/img/social-youtube.svg" alt="" width="30" height="30" loading="lazy"></a>
          <a href="mailto:team79krunch@gmail.com" aria-label="Email"><span aria-hidden="true">&#9993;</span></a>
        </div>
      </div>
      ${FOOT_GROUPS.map((g) => `<div>
        <h2>${g.h}</h2>
        <ul class="foot-links">${g.slugs.map((s) => `<li><a href="${rel(s)}">${bySlug[s].nav}</a></li>`).join('')}</ul>
      </div>`).join('\n      ')}
      <div>
        <h2>Support the team</h2>
        <p style="color:#cdddf1"><strong style="color:#fff">Robotics Technical Education Foundation, Inc. ("RTEF")</strong> is a Tampa Bay, Florida 501(c)(3) nonprofit formed to exclusively benefit <span class="first">FIRST</span>&reg; Team 79 Krunch. 100% of donations go to the team and are tax-deductible.</p>
        <p style="margin-bottom:0"><a href="/sponsors/#donate">Donate to RTEF &rarr;</a></p>
      </div>
    </div>
    <div class="foot-bottom">
      <div class="foot-sponsors">
        <img src="/assets/img/sponsor-rtef.png" alt="RTEF" height="34" loading="lazy" decoding="async">
        <img src="/assets/img/sponsor-honeywell.jpg" alt="Honeywell" height="34" loading="lazy" decoding="async">
        <img src="/assets/img/sponsor-rotary.svg" alt="Rotary Club of East Lake Sunrise" height="34" loading="lazy" decoding="async">
        <img src="/assets/img/sponsor-afi.svg" alt="AFI" height="34" loading="lazy" decoding="async">
        <img src="/assets/img/sponsor-smt.png" alt="SMT" height="34" loading="lazy" decoding="async">
        <img src="/assets/img/sponsor-library.png" alt="East Lake Community Library" height="34" loading="lazy" decoding="async">
      </div>
      <p style="margin:0">&copy; ${new Date().getFullYear()} <span class="first">FIRST</span>&reg; Team 79 Krunch / The Interact Club of Krunch Robotics</p>
    </div>
    <p class="foot-disclosure">A COPY OF THE OFFICIAL REGISTRATION AND FINANCIAL INFORMATION MAY BE OBTAINED FROM THE DIVISION OF CONSUMER SERVICES BY CALLING 1-800-HELP-FLA (435-7352) WITHIN THE STATE OF FLORIDA. REGISTRATION DOES NOT IMPLY ENDORSEMENT, APPROVAL OR RECOMMENDATION BY THE STATE.</p>
  </div>
</footer>
<script src="/js/site.js?v=${V}"></script>
</body>
</html>`;

// Count every award entry in the "Awards by season" list. Each event line is
// "<strong>Event</strong> &mdash; Award A, Award B"; awards are the comma-separated
// items after the em dash, summed across all rows.
function countAwards(src) {
  let n = 0;
  for (const body of src.match(/class="award-body">[\s\S]*?<\/div>/g) || []) {
    for (const p of body.match(/<p>[\s\S]*?<\/p>/g) || []) {
      const after = p.replace(/<[^>]+>/g, '').split('&mdash;').slice(1).join('&mdash;');
      n += after.split(',').filter((s) => s.trim()).length;
    }
  }
  return n;
}

let built = 0;
for (const p of PAGES) {
  // Retired page -> emit a tiny redirect stub (meta refresh + JS + canonical to the
  // target) so old links/bookmarks still land in the right place. No chrome.
  if (p.redirect) {
    const rhtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Redirecting&hellip;</title>
<link rel="canonical" href="${SITE + p.redirect}">
<meta name="robots" content="noindex, follow">
<meta http-equiv="refresh" content="0; url=${p.redirect}">
<script>location.replace(${JSON.stringify(p.redirect)});</script>
</head>
<body><p>This page has moved. If you are not redirected, <a href="${p.redirect}">continue to ${p.redirect}</a>.</p></body>
</html>
`;
    const outPath = P(p.out);
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, rhtml);
    built++;
    console.log(`built ${p.out} (redirect -> ${p.redirect})`);
    continue;
  }
  let main;
  try { main = await readFile(P('content', `${p.slug}.html`), 'utf8'); }
  catch { console.warn(`skip ${p.slug} (no content/${p.slug}.html yet)`); continue; }
  let html = head(p) + header(p) + '\n<main id="main" tabindex="-1">\n' + main.trim() + '\n</main>\n' + footer();
  // Auto-calculated tokens (no annual manual edits). Seasons: 1 per year since 1998, inclusive.
  html = html.replaceAll('{{SEASONS_SINCE_1998}}', String(new Date().getFullYear() - 1998 + 1));
  // Awards Won: derived from the "Awards by season" list itself, so the hero stat
  // can never drift from the list. Add an award to the list -> the count updates on rebuild.
  html = html.replaceAll('{{TOTAL_AWARDS}}', String(countAwards(html)));
  html = await versionAssets(html);
  const outPath = P(p.out);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, html);
  built++;
  console.log(`built ${p.out}`);
}
console.log(`\n${built}/${PAGES.length} pages built.`);
