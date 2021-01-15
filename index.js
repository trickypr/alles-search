require("dotenv").config();
const {
  HORIZON_API,
  SESSION_API,
  SEARCH_API,
  SEARCH_SECRET,
  LOGIN_URL,
  PORT,
} = process.env;
const TOKEN_COOKIE = "search-token";

const axios = require("axios");
const escapeHTML = require("escape-html");

// Express
const express = require("express");
const app = express();
app.use(require("cookie-parser")());
app.use(require("body-parser").json());
app.use((_err, _req, res, _next) => res.status(500).send("Internal Error"));
app.listen(PORT || 8080, () => console.log("Server is listening..."));

// HTML
const fs = require("fs");
const getHTML = (name) =>
  fs.readFileSync(`${__dirname}/html/${name}.html`).toString().split("[x]");
const html = {
  base: getHTML("base"),
  result: getHTML("result"),
};

// Generate Page
const generatePage = ({ title, user, query, content }) =>
  html.base[0] +
  escapeHTML(title || "Search with Alles") +
  html.base[1] +
  escapeHTML(query || "") +
  html.base[2] +
  (user
    ? `<img class="avatar" src="https://avatar.alles.cx/${user.id}?size=44" />`
    : "") +
  html.base[3] +
  (content || "") +
  html.base[4];

// Auth
const auth = async (req, _res, next) => {
  const token = req.cookies[TOKEN_COOKIE];
  if (typeof token !== "string") return next();
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const t = (
      await axios.get(
        `${SESSION_API}/tokens?token=${encodeURIComponent(token)}`
      )
    ).data;
    if (t.scope !== "search") return next();
    req.user = (await axios.get(`${HORIZON_API}/users/${t.user}`)).data;
  } catch (err) {}
  next();
};

// Homepage
app.get("/", auth, (req, res) => {
  const { q, auth } = req.query;

  // Redirect /?q=example to /example
  if (typeof q === "string")
    return res.redirect(q.trim() ? `/${encodeURIComponent(q.trim())}` : `/`);

  // Automatic Sign in
  if (typeof auth !== "string" && !req.user && req.user !== null)
    return res.redirect(`${LOGIN_URL}?silent`);

  // Response
  res.send(
    generatePage({
      user: req.user,
      content: `<p style="text-align: center;">${getText(req.user)}</p>`,
    })
  );
});

// Search
app.get("/:query", auth, async (req, res) => {
  const query = req.params.query.trim();
  const json = req.query.format === "json";

  // Request Search API
  let data;
  try {
    data = (
      await axios.get(
        `${SEARCH_API}/search?query=${encodeURIComponent(query)}${
          req.user ? `&user=${req.user.id}` : ``
        }`,
        {
          headers: {
            authorization: SEARCH_SECRET,
          },
        }
      )
    ).data;
  } catch (err) {
    return res.status(500).send("Internal Error");
  }

  // Response
  if (json)
    res.json({
      results: data.results.map((r) => {
        const { domain, path } = formatUrl(r.url);
        return {
          title: r.title,
          description: r.description
            ? shorten(r.description.split("\n").join(""), 150)
            : null,
          url: r.url,
          domain,
          path,
        };
      }),
    });
  else
    res.send(
      generatePage({
        title: `${query} - Alles Search`,
        user: req.user,
        query,
        content: data.results
          .map((r) => {
            const { domain, path } = formatUrl(r.url);
            return (
              html.result[0] +
              escapeHTML(r.url) +
              html.result[1] +
              escapeHTML(r.title) +
              html.result[2] +
              escapeHTML(domain) +
              html.result[3] +
              escapeHTML(path) +
              html.result[4] +
              (r.description
                ? '<p class="description">' +
                  escapeHTML(shorten(r.description.split("\n").join(""), 150)) +
                  "</p>"
                : "") +
              html.result[5]
            );
          })
          .join("\n"),
      })
    );
});

// Static
app.use("/_/static", express.static(`${__dirname}/static`));

// Login
app.get("/_/login", (_req, res) => res.redirect(LOGIN_URL));

// Tweet
app.get("/_/tweet", (_req, res) =>
  res.redirect(
    `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      "I'm using @AllesHQ's new search engine. Join me and #SearchWithAlles! search.alles.cx"
    )}`
  )
);

// Auth
app.get("/_/auth", async (req, res) => {
  const { token } = req.query;

  if (typeof token === "string") {
    try {
      res.cookie(
        TOKEN_COOKIE,
        (await axios.patch(`${SESSION_API}/tokens`, { token })).data.token
      );
    } catch (err) {}
  } else res.cookie(TOKEN_COOKIE, "");

  res.redirect("/?auth");
});

// 404
app.use((_req, res) => res.status(404).send("Not Found"));

// Shorten
const shorten = (s, l) =>
  s.length > l ? s.substr(0, l - 3).trimEnd() + "..." : s;

// Format URL
const url = require("url");
const formatUrl = (s) => {
  const parsedUrl = url.parse(s);
  let domain = parsedUrl.hostname;
  if (domain.startsWith("www.")) domain = domain.substr(4);
  let path = parsedUrl.path;
  if (path.endsWith("/")) path = path.substr(0, path.length - 1);
  return { domain, path };
};

// Get Homepage Text
const texts = require("./texts.json");
const getText = (u) => {
  const t1 = texts.filter((t) => t.auth === !!u || typeof t.auth !== "boolean");

  const t2 = [];
  for (let i1 in t1) {
    for (let i2 = 0; i2 < (t1[i1].weight || 1); i2++) t2.push(t1[i1]);
  }

  const t3 = t2.map((t) => t.content);
  const t = t3[Math.floor(Math.random() * t3.length)];
  return t.split("[nickname]").join(escapeHTML(u ? u.nickname : ""));
};
