import "dotenv/config";
import { UnrecoverableError, Worker } from "bullmq";
import { mercadoPago } from "../../libs/mercadopago";
import { msg } from "../../utils/logs";
import { isProd } from "../../utils/isProd";

const prod = isProd();
const connection = {
    host: prod ? process.env.REDIS_PROD : process.env.REDIS_LOCAL,
    port: prod ? Number(process.env.PORT_REDIS_PROD) : Number(process.env.PORT_REDIS_LOCAL),
    password: prod ? "" : process.env.PASSWORD_REDIS_LOCAL
}

const worker = new Worker("payments-mp", async (job) => {
    const idFila = job.id;
    const { paymentID } = job.data;

    try {
        msg.info(`Evento recebido do JOB com ID: ${idFila} | PaymentID: ${paymentID}`);

        const payment = await mercadoPago.getPayment(paymentID);
        console.log(payment);
    } catch (error: any) {
        const status = error.response?.status;
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
    connection: {
        host: prod ? process.env.REDIS_PROD : process.env.REDIS_LOCAL,
        port: prod ? Number(process.env.PORT_REDIS_PROD) : Number(process.env.PORT_REDIS_LOCAL),
        password: prod ? "" : process.env.PASSWORD_REDIS_LOCAL
    }
});

worker.on("completed", (job) => {
    msg.success(`Job ${job.id} finalizado!`);
});

worker.on("failed", (job, err) => {
    msg.error(`Job ${job?.id} falhou: ${err.message}`);
});