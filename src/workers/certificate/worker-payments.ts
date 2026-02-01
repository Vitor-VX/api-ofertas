import "dotenv/config";
import "../../database/connect";

import { UnrecoverableError, Worker } from "bullmq";
import { mercadoPago } from "../../libs/mercadopago";
import { msg } from "../../utils/logs";
import { isProd } from "../../utils/isProd";
import { OrdersCertificate } from "../../database/models/certifcate";
import { MediaItem, WhatsAppService } from "../../libs/whatsapp";
import { generateCertificateImage } from "../../libs/certificate-generate";
import { BREATHING_BASE64, INPUT_IMAGE_BASE64, INPUT_IMAGE_WITH_PHOTO_BASE64 } from "../../routes/offers/certificate/data";

const prod = isProd();
const connection = {
    host: prod ? process.env.REDIS_PROD : process.env.REDIS_LOCAL,
    port: prod ? Number(process.env.PORT_REDIS_PROD) : Number(process.env.PORT_REDIS_LOCAL),
    password: prod ? "" : process.env.PASSWORD_REDIS_LOCAL
}

const sendProductToWhataspp = async (number: string, couple: string, img: { one: string, two?: string }) => {
    const whatsapp = new WhatsAppService({
        accessToken: process.env.API_KEY_WHATSAPP ?? "",
        phoneNumberId: process.env.PHONE_ID ?? ""
    });

    if (isProd()) {
        const { mediaId } = await whatsapp.uploadPdfToMeta({
            image1: img.one,
            image2: img.two
        });

        await whatsapp.sendTemplate({
            to: number,
            templateName: "entregar_prod_09",
            components: [
                {
                    type: "header",
                    parameters: [
                        {
                            type: "document",
                            document: {
                                id: mediaId,
                                filename: "certificado-do-amor.pdf"
                            }
                        }
                    ]
                },
                {
                    type: "body",
                    parameters: [
                        { type: "text", text: couple }
                    ]
                }
            ]
        });
    }
}

const deliverProduct = async (paymentID: string, id: string) => {
    const order = await OrdersCertificate.findOneAndUpdate(
        {
            "offer.id": id,
            "payment.paymentId": paymentID,
            "payment.status": { $ne: "approved" }
        },
        {
            $set: {
                "payment.status": "approved",
                "payment.approvedAt": new Date()
            }
        },
        { new: true }
    );

    if (!order) {
        msg.warn(`Pagamento ${paymentID} já havia sido aprovado.`);
        return;
    }

    const { couple, startDate, city, photo } = order.certificate[0];
    const names = couple
        .split(/\s+(?:e|&{1,2}|\+|\|)\s+/i)
        .map((n) => n.trim())
        .filter(Boolean);

    const one = names[0] ?? "";
    const two = names[1] ?? "";

    const [img_not_photo, img_with_photo] = await Promise.all([
        generateCertificateImage(
            {
                couple,
                date: startDate,
                city,
                one,
                two,
                photo: null
            },
            BREATHING_BASE64,
            INPUT_IMAGE_BASE64,
            null
        ),
        generateCertificateImage(
            {
                couple,
                date: startDate,
                city,
                one,
                two,
                photo
            },
            BREATHING_BASE64,
            INPUT_IMAGE_BASE64,
            INPUT_IMAGE_WITH_PHOTO_BASE64
        )
    ]);

    const withImg = order.certificate.some(el =>
        typeof el.photo === "string" && el.photo.trim().length > 0
    );

    await sendProductToWhataspp(
        order.customer.whatsapp,
        couple,
        {
            one: img_not_photo.toString("base64"),
            two: withImg ? img_with_photo?.toString("base64") : undefined
        }
    );
}

const worker = new Worker("payments-mp", async (job) => {
    const idFila = job.id;
    const { paymentId } = job.data;

    try {
        msg.info(`Evento recebido do JOB com ID: ${idFila} | PaymentID: ${paymentId}`);

        const payment = await mercadoPago.getPayment(paymentId);
        if (payment.status !== "approved") return;

        deliverProduct(paymentId, payment.external_reference!!);
    } catch (error: any) {
        const status = error?.status;

        if (status === 404) {
            msg.error(`Pagamento ${paymentId} não existe. Abortando.`);
            throw new UnrecoverableError("ID inválido");
        }

        if (status === 429) {
            msg.warn("Muitas requisições (Rate Limit). O BullMQ tentará novamente em breve.");
        }
    }

    return { success: true };
}, {
    connection
});

worker.on("active", () => {
    msg.info("Worker iniciado..");
});

worker.on("completed", (job) => {
    msg.success(`Job ${job.id} finalizado!`);
});

worker.on("failed", (job, err) => {
    msg.error(`Job ${job?.id} falhou: ${err.message}`);
});