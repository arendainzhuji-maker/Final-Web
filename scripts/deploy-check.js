const urls = [
  "/",
  "/robots.txt",
  "/sitemap.xml",
  "/privacy.html",
  "/favicon.ico",
  "/styles.css",
  "/app.js",
  "/images/logo.svg",
  "/images/logo-mark.svg",
  "/api/categories",
];

(async () => {
  for (const u of urls) {
    try {
      const r = await fetch("http://127.0.0.1:3000" + u);
      const t = await r.text();
      console.log(r.status, u, t.slice(0, 70).replace(/\n/g, " "));
    } catch (e) {
      console.log("ERR", u, e.message);
    }
  }

  const home = await (await fetch("http://127.0.0.1:3000/")).text();
  console.log("has_title", home.includes("Last Stop Mail | Direct Mail Advertising in Edmonton"));
  console.log("has_index", home.includes("index, follow"));
  console.log("has_noindex", /content=["'][^"']*noindex/i.test(home));
  console.log("has_old_brand", home.includes("Edmonton City Mailer"));
  console.log("has_h1", home.includes("Reach Thousands of Local Households With Direct Mail"));
  console.log("has_canonical", home.includes('href="http://127.0.0.1:3000/"'));
  console.log("has_old_domain", home.includes("edmontoncitymailer.com"));

  const robots = await (await fetch("http://127.0.0.1:3000/robots.txt")).text();
  console.log("robots_allow", robots.includes("Allow: /") && !robots.includes("Disallow: /"));
  console.log("robots_body", JSON.stringify(robots));
})();
