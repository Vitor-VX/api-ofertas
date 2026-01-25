import { Queue } from "bullmq";
import { msg } from "../utils/logs";
import { isProd } from "../utils/isProd";

const prod = isProd();

class BullMQ {
    private connection;

    constructor() {
        this.connection = new Queue("payments-mp", {
            connection: {
                host: prod ? process.env.REDIS_PROD : process.env.REDIS_LOCAL,
                port: prod ? Number(process.env.PORT_REDIS_PROD) : Number(process.env.PORT_REDIS_LOCAL),
                password: prod ? "" : process.env.PASSWORD_REDIS_LOCAL
            }
        });
    }

    async job(id: string) {
        await this.connection.add("payment", {
            paymentID: id,
        }, {
            attempts: 10,
            backoff: 30000
        });

        msg.warn(`Job para o ID "${id}" adicionado.`);
    }
};

export const mpFilas = new BullMQ();