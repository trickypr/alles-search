require("dotenv").config();
const { SESSION_API, SEARCH_API, SEACH_SECRET } = process.env;
const axios = require("axios");

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
const html = {};

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
  if (typeof req.query.q === "string")
    return res.redirect(`/${encodeURIComponent(req.query.q)}`);

  // Response
  res.send("Alles Search!");
});

// Search
app.get("/:query", (req, res) => res.send(req.params.query));

// Static
app.use("/_/static", express.static(`${__dirname}/web`));

// 404
app.use((_req, res) => res.status(404).send("Not Found"));
