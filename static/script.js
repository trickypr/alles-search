const form = document.querySelector("form");
const input = document.querySelector("input");
const bottom = document.querySelector(".bottom");

let timeouts = [];
let queryId = 0;

form.onsubmit = (e) => {
  e.preventDefault();
  const q = input.value.trim();
  search(q);
};

const search = (q) => {
  timeouts.forEach((t) => clearTimeout(t));
  document.title = q || "Search with Alles";
  history.pushState(q, q, `/${encodeURIComponent(q)}`);
  input.value = q;

  if (!q) return (bottom.innerHTML = "");
  bottom.innerHTML = "<div class='loading'></div>";
  queryId++;
  const qId = queryId;
  fetch(`/${encodeURIComponent(q)}?format=json`).then(async (res) => {
    if (queryId !== qId) return;
    if (res.status === 200) {
      const { results } = await res.json();
      if (results.length > 0) {
        bottom.innerHTML = "";
        timeouts = results.map((r, i) =>
          setTimeout(() => {
            const box = document.createElement("a");
            box.className = "result";
            box.href = r.url;
            bottom.appendChild(box);

            const title = document.createElement("p");
            title.className = "title";
            title.innerText = r.title;
            box.appendChild(title);

            const url = document.createElement("p");
            url.className = "url";
            box.appendChild(url);

            const domain = document.createElement("span");
            domain.className = "domain";
            domain.innerText = r.domain;
            url.appendChild(domain);

            const path = document.createElement("span");
            path.className = "path";
            path.innerText = r.path;
            url.appendChild(path);

            const description = document.createElement("p");
            description.className = "description";
            description.innerText =
              r.description ||
              "Alles doesn't have a description for this page.";
            box.appendChild(description);
          }, i * 100)
        );
      } else bottom.innerText = "Sorry, no results were found.";
    } else bottom.innerText = `Error: ${await res.text()}`;
  });
};
