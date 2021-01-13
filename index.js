require("dotenv").config();
const { SESSION_API, SEARCH_API, SEARCH_SECRET } = process.env;

const axios = require("axios");
const escapeHTML = require("escape-html");
const url = require("url");

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
  result: getHTML("result"),
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
      html.base[3]
  );
});

// Search
app.get("/:query", async (req, res) => {
  const query = req.params.query.trim();
  const json = req.query.format === "json";

  // Request Search API
  let data;
  try {
    data = (
      await axios.get(
        `${SEARCH_API}/search?query=${encodeURIComponent(query)}`,
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
            ? shorten(r.description.split("\n").join(""), 100)
            : null,
          url: r.url,
          domain,
          path,
        };
      }),
    });
  else
    res.send(
      html.base[0] +
        escapeHTML(query) +
        html.base[1] +
        escapeHTML(query) +
        html.base[2] +
        data.results
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
              escapeHTML(
                r.description
                  ? shorten(r.description.split("\n").join(""), 100)
                  : "Alles doesn't have a description for this page."
              ) +
              html.result[5]
            );
          })
          .join("\n") +
        html.base[3]
    );
});

// Static
app.use("/_/static", express.static(`${__dirname}/static`));

// 404
app.use((_req, res) => res.status(404).send("Not Found"));

// Shorten
const shorten = (s, l) => (s.length > l ? s.substr(l - 3) + "..." : s);

// Format URL
const formatUrl = (s) => {
  const parsedUrl = url.parse(s);
  let domain = parsedUrl.hostname;
  if (domain.startsWith("www.")) domain = domain.substr(4);
  let path = parsedUrl.path;
  if (path.endsWith("/")) path = path.substr(0, path.length - 1);
  return { domain, path };
};
