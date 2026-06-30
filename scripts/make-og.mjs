// og-source.svg → public/og.png (1200×630) 렌더. 한글 폰트 명시 로드.
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";

const svg = readFileSync(new URL("../og-source.svg", import.meta.url), "utf8");
const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: 1200 },
  font: {
    loadSystemFonts: true,
    fontFiles: [
      "/System/Library/Fonts/AppleSDGothicNeo.ttc",
      "/System/Library/Fonts/Helvetica.ttc",
    ],
    defaultFontFamily: "Apple SD Gothic Neo",
  },
});
const png = resvg.render().asPng();
writeFileSync(new URL("../public/og.png", import.meta.url), png);
console.log("public/og.png 생성:", png.length, "bytes");
