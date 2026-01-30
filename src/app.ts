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

app.get(
    "/webhook",
    [
        query("hub.mode").notEmpty(),
        query("hub.verify_token").notEmpty(),
        query("hub.challenge").notEmpty(),
    ],
    (req: Request, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.error("Erro de validação:", errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        const mode = req.query["hub.mode"];
        const token = req.query["hub.verify_token"];
        const challenge = req.query["hub.challenge"];

        const verifyToken = process.env.VERIFY_TOKEN;

        if (
            mode &&
            token &&
            challenge &&
            verifyToken
        ) {
            if (mode === "subscribe" && token === verifyToken) {
                res.status(200).send(challenge);
            }

        }

        res.status(401);
    });


app.post(
    "/webhook",
    [
        body("object")
            .equals("whatsapp_business_account")
            .withMessage("object inválido"),
        body("entry").isArray().withMessage("entry deve ser um array"),
        body("entry.*.changes").isArray().withMessage("changes deve ser um array"),
        body("entry.*.changes.*.value.messaging_product")
            .equals("whatsapp")
            .withMessage("messaging_product deve ser 'whatsapp'"),
        body("entry.*.changes.*.value.messages")
            .optional()
            .isArray()
            .withMessage("messages deve ser um array se existir")
    ],
    async (req: Request, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.error("Erro de validação:", errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        const body = req.body;
        const entry = body.entry?.[0];
        const change = entry?.changes?.[0];
        const message = change?.value?.messages?.[0];

        console.log(body);
        return res.status(200).send('EVENT_RECEIVED');
    });

// const whatsapp = new WhatsAppService({
//     accessToken: process.env.API_KEY_WHATSAPP ?? "",
//     phoneNumberId: process.env.PHONE_ID ?? ""
// });

// console.log(`IsProd: ${isProd()}`);

// if (isProd()) {
//     whatsapp.sendTemplate({
//         to: "69993161840",
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