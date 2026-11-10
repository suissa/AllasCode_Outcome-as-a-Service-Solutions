const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const tries = [
  "family=Spline+Sans+Mono:wght@400",
  "family=Spline+Sans+Mono:ital,wght@0,300..800",
  "family=Spline+Sans+Mono:wght@300..800",
  "family=Spline+Sans+Mono"
];
for (const q of tries) {
  const res = await fetch("https://fonts.googleapis.com/css2?" + q + "&display=swap", { headers: { "User-Agent": UA } });
  const css = await res.text();
  console.log(res.status, q, css.includes("@font-face") ? "OK faces=" + (css.match(/@font-face/g)||[]).length : "no-faces");
}
