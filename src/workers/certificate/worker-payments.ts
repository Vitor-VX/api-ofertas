import "dotenv/config";
import "../../database/connect";

import { UnrecoverableError, Worker } from "bullmq";
import { mercadoPago } from "../../libs/mercadopago";
import { msg } from "../../utils/logs";
import { isProd } from "../../utils/isProd";
import { OrdersCertificate } from "../../database/models/certifcate";
import { WhatsAppService } from "../../libs/whatsapp";
import { generateCertificateImage } from "../../libs/certificate-generate";
import { BREATHING_BASE64, INPUT_IMAGE_BASE64 } from "../../routes/offers/certificate/data";

const prod = isProd();
const connection = {
    host: prod ? process.env.REDIS_PROD : process.env.REDIS_LOCAL,
    port: prod ? Number(process.env.PORT_REDIS_PROD) : Number(process.env.PORT_REDIS_LOCAL),
    password: prod ? "" : process.env.PASSWORD_REDIS_LOCAL
}

const sendProductToWhataspp = async (number: string, content: string) => {
    const whatsapp = new WhatsAppService({
        accessToken: process.env.API_KEY_WHATSAPP ?? "",
        phoneNumberId: process.env.PHONE_ID ?? ""
    });

    whatsapp.sendMedia({
        to: number,
        type: "image",
        caption: "Olá, obrigada pela sua compra. Aqui está seu certificado.",
        content: content,
        isBase64: true,
        fileName: "certificado.png"
    })
}

const deliverProduct = async (paymentID: string, id: string) => {
    const order = await OrdersCertificate.findOne(
        { "offer.id": id, "payment.paymentId": paymentID },
        {
            offer: 1,
            payment: 1,
            createdAt: 1
        }
    ).lean();
    if (!order) return;

    order.payment.status = "approved";
    await order.save();

    const { couple, startDate, city } = order.certificate[0];
    const names = couple
        .split(/\s+(?:e|&{1,2}|\+|\|)\s+/i)
        .map((n) => n.trim())
        .filter(Boolean);

    const one = names[0] ?? "";
    const two = names[1] ?? "";

    await generateCertificateImage({
        couple,
        date: startDate,
        city,
        one,
        two
    }, BREATHING_BASE64, INPUT_IMAGE_BASE64).then((buffer) => {
        sendProductToWhataspp(order.customer.whatsapp, buffer.toString("base64"));
    });
}

const worker = new Worker("payments-mp", async (job) => {
    const idFila = job.id;
    const { paymentID } = job.data;

    try {
        msg.info(`Evento recebido do JOB com ID: ${idFila} | PaymentID: ${paymentID}`);

        const payment = await mercadoPago.getPayment(paymentID);

        console.log(payment);
        if (payment.status !== "approved") return;
        
        deliverProduct(paymentID, payment.external_reference!!);
    } catch (error: any) {
        const status = error?.status;

        if (status === 404) {
            msg.error(`Pagamento ${paymentID} não existe. Abortando.`);
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