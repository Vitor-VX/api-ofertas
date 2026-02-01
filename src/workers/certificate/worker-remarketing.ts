import "dotenv/config";
import "../../database/connect";

import { UnrecoverableError, Worker } from "bullmq";
import { mercadoPago } from "../../libs/mercadopago";
import { msg } from "../../utils/logs";
import { isProd } from "../../utils/isProd";
import { OrdersCertificate } from "../../database/models/certifcate";
import { WhatsAppService } from "../../libs/whatsapp";

const prod = isProd();
const connection = {
    host: prod ? process.env.REDIS_PROD : process.env.REDIS_LOCAL,
    port: prod ? Number(process.env.PORT_REDIS_PROD) : Number(process.env.PORT_REDIS_LOCAL),
    password: prod ? "" : process.env.PASSWORD_REDIS_LOCAL
}

const sendRemarketing = async (
    number: string,
    orderId: string,
    totalPrice: string,
    customerName: string,
    oldPrice: string,
    newPrice: string,
    pixCode: string,
) => {
    const whatsapp = new WhatsAppService({
        accessToken: process.env.API_KEY_WHATSAPP ?? "",
        phoneNumberId: process.env.PHONE_ID ?? ""
    });

    // if (!isProd()) return;

    const { mediaId } = await whatsapp.uploadToMetaFromUrl("https://pub-d997896d0b944e3f97ade771c4a3aeaf.r2.dev/a74c71a5-ba46-4af7-b566-f258e9179df5.jfif");

    await whatsapp.sendTemplate({
        to: number,
        templateName: "remarketing_prod_02",
        components: [
            {
                type: "body",
                parameters: [
                    { type: "text", text: customerName }, // {{1}}
                    { type: "text", text: orderId },      // {{2}}
                    { type: "text", text: oldPrice },     // {{3}}
                    { type: "text", text: newPrice },     // {{4}}
                ]
            },
            {
                type: "button",
                sub_type: "copy_code",
                index: 0,
                parameters: [
                    {
                        type: "text",
                        text: pixCode // {{9}}
                    }
                ]
            }
        ]
    });
}

sendRemarketing(
    "69993161840",
    "12345",
    "8.90",
    "João Victor",
    "9.90",
    "8.90",
    "123456789"
)

const worker = new Worker("remarketing", async (job) => {
    const idFila = job.id;
    const { idDocument } = job.data;

    const order = await OrdersCertificate.findById(idDocument);
    if (!order) return;

    if (order.payment.status === "approved") return;




    return { success: true };
}, {
    connection
});

worker.on("completed", (job) => {
    msg.success(`Job ${job.id} finalizado!`);
});

worker.on("failed", (job, err) => {
    msg.error(`Job ${job?.id} falhou: ${err.message}`);
});