const form = document.querySelector("form");
const input = document.querySelector("input");
const avatar = document.querySelector(".avatar");
const bottom = document.querySelector(".bottom");

let timeouts = [];
let queryId = 0;

form.onsubmit = (e) => {
  e.preventDefault();
  const q = input.value.trim();
  search(q);
};

// Search
const search = (q) => {
  // Clear Timeouts
  timeouts.forEach((t) => clearTimeout(t));

  // Change Page
  document.title = q ? `${q} - Alles Search` : `Search with Alles`;
  history.pushState(q, q, `/${encodeURIComponent(q)}`);
  input.value = q;

  // Set .bottom
  if (!q) return (bottom.innerHTML = "");
  bottom.innerHTML = "<div class='loading'></div>";

  // Fetch Data
  queryId++;
  const qId = queryId;
  fetch(`/${encodeURIComponent(q)}?format=json`).then(async (res) => {
    if (queryId !== qId) return;
    if (res.status === 200) {
      const { answer, results } = await res.json();
      if (results.length > 0) {
        // Clear .bottom
        bottom.innerHTML = "";

        // Answer Box
        if (answer) {
          const box = document.createElement("div");
          box.className = "answer appear";
          bottom.appendChild(box);

          const p = document.createElement("p");
          p.innerText = answer;
          box.appendChild(p);
        }

        // Display Results
        timeouts = results.map((r, i) =>
          setTimeout(() => {
            const box = document.createElement("a");
            box.className = "result appear";
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

            if (r.description) {
              const description = document.createElement("p");
              description.className = "description";
              description.innerText = r.description;
              box.appendChild(description);
            }
          }, i * 100)
        );
      } else bottom.innerText = "Sorry, no results were found.";
    } else bottom.innerText = `Error: ${await res.text()}`;
  });
};

if (avatar)
  avatar.onload = () => {
    avatar.style.display = "block";
    setTimeout(() => (avatar.style.opacity = 1), 100);
  };
