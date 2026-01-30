import "dotenv/config";
import "./database/connect";

import { msg } from "./utils/logs";
import { errorHandler } from "./middlewares/errorHandler";

import express, { Request, Response } from "express";
import cors from "cors";
import OffersRoutes from "./routes/offers";
import { BREATHING_BASE64, INPUT_IMAGE_BASE64, INPUT_IMAGE_WITH_PHOTO_BASE64 } from "./routes/offers/certificate/data";
import { generateCertificateImage } from "./libs/certificate-generate";
import { writeFileSync } from "fs";
import { isProd } from "./utils/isProd";
import { WhatsAppService } from "./libs/whatsapp";
import { body, query, validationResult } from "express-validator";

const app = express();
const port = process.env.PORT || 4545;

app.use(express.json({ limit: "100mb" }));
app.use(cors());

app.use("/api/v1/offers", OffersRoutes);
app.use(errorHandler);

// const whatsapp = new WhatsAppService({
//     accessToken: process.env.API_KEY_WHATSAPP ?? "",
//     phoneNumberId: process.env.PHONE_ID ?? ""
// });

// console.log(`IsProd: ${isProd()}`);

// if (isProd()) {
//     whatsapp.sendTemplate({
//         to: "11934065408",
//         templateName: "entregar_prod_03",
//         components: [{
//             type: "body",
//             parameters: [
//                 { type: "text", text: "Victor" }
//             ]
//         }]
//     })
//         .then(res => {
//             console.log(res);
//         })
//         .catch(err => {
//             console.log(err);
//         })
// }


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