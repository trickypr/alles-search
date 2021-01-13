const form = document.querySelector("form");
const input = document.querySelector("input");
const bottom = document.querySelector(".bottom");

form.onsubmit = (e) => {
  e.preventDefault();
  const q = input.value.trim();
  document.title = q || "Search with Alles";
  history.pushState(q, q, `/${encodeURIComponent(q)}`);

  bottom.innerHTML = "";
};
