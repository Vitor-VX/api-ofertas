import "dotenv/config";
import "./database/connect";

import { msg } from "./utils/logs";
import { errorHandler } from "./middlewares/errorHandler";

import express from "express";
import cors from "cors";
import OffersRoutes from "./routes/offers";
import { BREATHING_BASE64, INPUT_IMAGE_BASE64, INPUT_IMAGE_WITH_PHOTO_BASE64 } from "./routes/offers/certificate/data";
import { generateCertificateImage } from "./libs/certificate-generate";
import { writeFileSync } from "fs";

const app = express();
const port = process.env.PORT || 4545;

app.use(express.json({ limit: "100mb" }));
app.use(cors());

app.use("/api/v1/offers", OffersRoutes);
app.use(errorHandler);


// generateCertificateImage(
//     {
//         couple: "Keila e Heitor",
//         date: "12/12/2005",
//         city: "Minas Gerais MG",
//         one: "Keila",
//         two: "Heitor",
//         photo: 'https://files.botsync.site/certificates/45b1afb4-a714-44c6-b474-a7cbe7698947.jpg'
//     },
//     BREATHING_BASE64,
//     INPUT_IMAGE_BASE64,
//     INPUT_IMAGE_WITH_PHOTO_BASE64
// ).then(res => {
//     writeFileSync("certidao.png", res);
// });

app.listen(port, () => msg.info(`Servidor iniciado na porta: ${port}`));