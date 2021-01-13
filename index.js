require("dotenv").config();
const { SESSION_API, SEARCH_API, SEACH_SECRET } = process.env;

const axios = require("axios");
const escapeHTML = require("escape-html");

// Express
const express = require("express");
const app = express();
app.use(require("cookie-parser")());
app.use(require("body-parser").json());
app.use((_err, _req, res, _next) => res.status(500).send("Internal Error"));
app.listen(8080, () => console.log("Server is listening..."));

// HTML
const fs = require("fs");
const getHTML = (name) =>
  fs.readFileSync(`${__dirname}/html/${name}.html`).toString().split("[x]");
const html = {
  base: getHTML("base"),
  home: getHTML("home"),
};

// Auth
const auth = async (req, res, next) => {
  const { token } = req.cookies;
  if (!token) return next();

  try {
    const t = (
      await axios.get(
        `${SESSION_API}/tokens?token=${encodeURIComponent(token)}`
      )
    ).data;
    if (t.scope !== "search") return next();
    req.user = t.user;
  } catch (err) {}
  next();
};

// Homepage
app.get("/", (req, res) => {
  // Redirect /?q=example to /example
  const { q } = req.query;
  if (typeof q === "string")
    return res.redirect(q.trim() ? `/${encodeURIComponent(q.trim())}` : `/`);

  // Response
  res.send(
    html.base[0] +
      "Search with Alles" +
      html.base[1] +
      html.base[2] +
      html.home[0] +
      html.base[3]
  );
});

// Search
app.get("/:query", (req, res) => {
  const query = req.params.query.trim();

  // Response
  res.send(
    html.base[0] +
      escapeHTML(query) +
      html.base[1] +
      escapeHTML(query) +
      html.base[2] +
      `Results for "${escapeHTML(query)}"` +
      html.base[3]
  );
});

// Static
app.use("/_/static", express.static(`${__dirname}/static`));

// 404
app.use((_req, res) => res.status(404).send("Not Found"));
