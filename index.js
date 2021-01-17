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
const REFERRAL_COOKIE = "ref-user";
const cookieConfig = {
  maxAge: 1000 * 60 * 60 * 24 * 365,
  httpOnly: true,
};

const axios = require("axios");
const escapeHTML = require("escape-html");

// Express
const express = require("express");
const app = express();
app.use(require("cookie-parser")());
app.use(require("body-parser").json());
app.use((_err, _req, res, _next) => res.status(500).send("Internal Error"));
app.listen(PORT || 8080, () => console.log("Server is listening..."));

// Templates
const fs = require("fs");
const parseTemplate = (name) =>
  fs.readFileSync(`${__dirname}/templates/${name}`).toString().split("[x]");
const templates = {
  base: parseTemplate("base.html"),
  home: parseTemplate("home.html"),
  result: parseTemplate("result.html"),
  ref: parseTemplate("ref.html"),
  refCard: parseTemplate("ref.svg"),
};

// Generate Page
const generatePage = ({ title, user, query, content }) =>
  templates.base[0] +
  escapeHTML(title || "Search with Alles") +
  templates.base[1] +
  escapeHTML(query || "") +
  templates.base[2] +
  (user
    ? `<img class="avatar" src="https://avatar.alles.cx/${user.id}?size=44" />`
    : "") +
  templates.base[3] +
  (content || "") +
  templates.base[4];

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
      content:
        templates.home[0] +
        (req.user ? "" : '<a href="/_/login">Sign In</a>') +
        templates.home[1],
    })
  );
});

// Search
app.get("/:query", auth, async (req, res) => {
  const query = req.params.query.trim();
  const json = req.query.format === "json";
  const address =
    req.headers["x-forwarded-for"] || req.connection.remoteAddress;

  // Request Search API
  let data;
  try {
    data = (
      await axios.get(
        `${SEARCH_API}/search?query=${encodeURIComponent(query)}${
          req.user ? `&user=${req.user.id}` : ``
        }&address=${encodeURIComponent(address)}`,
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
      answer: data.answer,
      results: data.results.map((r) => {
        const { domain, path } = formatUrl(r.url);
        return {
          title: r.title,
          description: r.description
            ? shorten(r.description.split("\n").join(""), 150)
            : null,
          url: r.resultUrl,
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
        content:
          (data.answer
            ? `<div class="answer"><p>${escapeHTML(data.answer)}</p></div>`
            : ``) +
          data.results
            .map((r) => {
              const { domain, path } = formatUrl(r.url);
              return (
                templates.result[0] +
                escapeHTML(r.resultUrl) +
                templates.result[1] +
                escapeHTML(r.title) +
                templates.result[2] +
                escapeHTML(domain) +
                templates.result[3] +
                escapeHTML(path) +
                templates.result[4] +
                (r.description
                  ? '<p class="description">' +
                    escapeHTML(
                      shorten(r.description.split("\n").join(""), 150)
                    ) +
                    "</p>"
                  : "") +
                templates.result[5]
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
app.get("/_/tweet", auth, (req, res) =>
  res.redirect(
    `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      `I'm using @AllesHQ's new search engine. Join me and #SearchWithAlles! search.alles.cx${
        req.user ? `/ref/${encodeURIComponent(req.user.username)}` : ``
      }`
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
        (await axios.patch(`${SESSION_API}/tokens`, { token })).data.token,
        cookieConfig
      );
    } catch (err) {}
  } else res.cookie(TOKEN_COOKIE, "");

  res.redirect("/?auth");
});

// Redirect to result
app.get("/to/:token", async (req, res) => {
  const { token } = req.params;
  try {
    res.redirect(
      (
        await axios.post(
          `${SEARCH_API}/result`,
          { token },
          { headers: { authorization: SEARCH_SECRET } }
        )
      ).data
    );
  } catch (err) {
    res.redirect("/");
  }
});

// User Referral Link
app.get("/ref/:username", async (req, res) => {
  const ua = req.headers["user-agent"];

  // Get User
  let user;
  try {
    user = (
      await axios.get(
        `${HORIZON_API}/username/${encodeURIComponent(req.params.username)}`
      )
    ).data;
  } catch (err) {
    return res.redirect("/");
  }

  // Social
  if (ua.includes("Twitterbot"))
    return res.send(
      templates.ref[0] +
        escapeHTML(user.nickname) +
        templates.ref[1] +
        escapeHTML(user.username) +
        templates.ref[2]
    );

  // Response
  res.cookie(REFERRAL_COOKIE, user.id, cookieConfig);
  res.redirect("/");
});

// User Referral Link Card
const sharp = require("sharp");
app.get("/ref/:username/card.png", async (req, res) => {
  // Get User
  let user;
  try {
    user = (
      await axios.get(
        `${HORIZON_API}/username/${encodeURIComponent(req.params.username)}`
      )
    ).data;
  } catch (err) {
    return res.status(404).send("Missing Resource");
  }

  // Generate SVG
  const svg =
    templates.refCard[0] + escapeHTML(user.nickname) + templates.refCard[1];

  // Send as PNG
  try {
    const img = await sharp(Buffer.from(svg)).png().toBuffer();
    res.setHeader("Content-Type", "image/png");
    res.send(img);
  } catch (err) {
    res.status(500).send("Internal Error");
  }
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
