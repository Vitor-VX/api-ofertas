import { chromium } from "playwright";
import axios from "axios";

interface CertificateData {
    couple: string;
    date: string;
    city: string;
    photo: string | null;
    one: string;
    two: string;
}


export async function imageUrlToBase64(url: string): Promise<string | null> {
    try {
        const response = await axios.get(url, {
            responseType: "arraybuffer",
            timeout: 10000
        });

        const buffer = Buffer.from(response.data);
        const mime = response.headers["content-type"] || "image/jpeg";

        return `data:${mime};base64,${buffer.toString("base64")}`;
    } catch (err) {
        console.error("Erro ao converter imagem:", err);
        return null;
    }
}

export async function generateCertificateImage(
    data: CertificateData,
    BREATHING_BASE64: string,
    INPUT_IMAGE_BASE64: string,
    INPUT_IMAGE_WITH_PHOTO_BASE64: string | null = null
): Promise<Buffer> {
    console.log(data);
    
    if (data.photo?.startsWith("http")) {
        const base64Photo = await imageUrlToBase64(data.photo);
        data.photo = base64Photo;
    };

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

const layoutWithoutPhoto = {
  couple: { x: 620, y: 775, size: 40 },
  date:   { x: 680, y: 835, size: 33 },
  city:   { x: 580, y: 905, size: 33 },
  one:    { x: 298, y: 1515, size: 33 },
  two:    { x: 775, y: 1515, size: 33 }
};

const layoutWithPhoto = {
  couple: { x: 820, y: 785, size: 25 },
  date:   { x: 860, y: 855, size: 25 },
  city:   { x: 825, y: 925, size: 25 },
  one:    { x: 298, y: 1550, size: 33 },
  two:    { x: 800, y: 1550, size: 33 }
};

(async () => {

  await document.fonts.load('40px "Breathing"');
  await document.fonts.ready;

  const hasPhoto = !!data.photo;

  const layout = hasPhoto
    ? layoutWithPhoto
    : layoutWithoutPhoto;

  const bgBase64 = hasPhoto && "${INPUT_IMAGE_WITH_PHOTO_BASE64 ?? ""}"
    ? "data:image/png;base64,${INPUT_IMAGE_WITH_PHOTO_BASE64 ?? INPUT_IMAGE_BASE64}"
    : "data:image/png;base64,${INPUT_IMAGE_BASE64}";

  const bg = new Image();
  bg.src = bgBase64;
  await bg.decode();

  ctx.drawImage(bg, 0, 0, 1080, 1920);

  ctx.fillStyle = "#393939";
  ctx.textAlign = "center";

  ctx.font = layout.couple.size + 'px "Breathing"';
  ctx.fillText(data.couple, layout.couple.x, layout.couple.y);

  ctx.font = layout.date.size + 'px "Breathing"';
  ctx.fillText(data.date, layout.date.x, layout.date.y);

  ctx.font = layout.city.size + 'px "Breathing"';
  ctx.fillText(data.city, layout.city.x, layout.city.y);

  ctx.font = layout.one.size + 'px "Breathing"';
  ctx.fillText(data.one, layout.one.x, layout.one.y);

  ctx.font = layout.two.size + 'px "Breathing"';
  ctx.fillText(data.two, layout.two.x, layout.two.y);

  if (hasPhoto) {
    const photoConfig = {
      x: 130,
      y: 640,
      w: 300,
      h: 350,
      radius: 24
    };

    const img = new Image();
    img.src = data.photo;
    await img.decode();

    ctx.save();

    ctx.beginPath();
    ctx.roundRect(
      photoConfig.x,
      photoConfig.y,
      photoConfig.w,
      photoConfig.h,
      photoConfig.radius
    );
    ctx.clip();

    const imgRatio = img.width / img.height;
    const canvasRatio = photoConfig.w / photoConfig.h;

    let drawX, drawY, drawW, drawH;

    if (imgRatio > canvasRatio) {
      drawH = photoConfig.h;
      drawW = img.width * (photoConfig.h / img.height);
      drawX = photoConfig.x + (photoConfig.w - drawW) / 2;
      drawY = photoConfig.y;
    } else {
      drawW = photoConfig.w;
      drawH = img.height * (photoConfig.w / img.width);
      drawX = photoConfig.x;
      drawY = photoConfig.y + (photoConfig.h - drawH) / 2;
    }

    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    ctx.restore();
  }
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