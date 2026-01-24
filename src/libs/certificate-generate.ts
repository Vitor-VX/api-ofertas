// libs/certificate-generator.ts
import { chromium } from "playwright";

interface CertificateData {
    couple: string;
    date: string;
    city: string;
    one: string;
    two: string;
}

export async function generateCertificateImage(
    data: CertificateData,
    BREATHING_BASE64: string,
    INPUT_IMAGE_BASE64: string
): Promise<Buffer> {
    const browser = await chromium.launch({
        headless: true
    });

    const page = await browser.newPage({
        viewport: {
            width: 1080,
            height: 1920
        }
    });

    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />

<style>
@font-face {
  font-family: "Breathing";
  src: url("data:font/ttf;base64,${BREATHING_BASE64}") format("truetype");
}

html, body {
  margin: 0;
  padding: 0;
  background: transparent;
}

canvas {
  width: 1080px;
  height: 1920px;
}
</style>
</head>

<body>
<canvas id="c" width="1080" height="1920"></canvas>

<script>
const data = ${JSON.stringify(data)};

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

(async () => {

  await document.fonts.load('40px "Breathing"');
  await document.fonts.ready;

  const bg = new Image();
  bg.src = "data:image/png;base64,${INPUT_IMAGE_BASE64}";
  await bg.decode();

  ctx.drawImage(bg, 0, 0, 1080, 1920);

  ctx.fillStyle = "#393939";
  ctx.textAlign = "center";

 ctx.font = '40px "Breathing"';
 ctx.fillText(data.couple, 620, 775);

    ctx.font = '33px "Breathing"';
    ctx.fillText(data.date, 680, 835);

    ctx.font = '33px "Breathing"';
    ctx.fillText(data.city, 580, 905);

    ctx.font = '33px "Breathing"';
    ctx.fillText(data.one, 298, 1515);

    ctx.font = '33px "Breathing"';
    ctx.fillText(data.two, 775, 1515);

})();
</script>
</body>
</html>
`;

    await page.setContent(html, {
        waitUntil: "load"
    });

    await page.waitForTimeout(200);
    const buffer = await page.locator("canvas").screenshot({
        type: "png"
    });

    await browser.close();
    return buffer;
}