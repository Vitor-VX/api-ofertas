import { Queue } from "bullmq";
import { msg } from "../utils/logs";
import { isProd } from "../utils/isProd";

const prod = isProd();

type AddJobOptions = {
    delay?: number;
    attempts?: number;
    backoff?: number;
};

export class BullMQService {
    private queue: Queue;
    public connection: any;

    constructor(queueName: string) {
        this.connection = {
            host: prod ? process.env.REDIS_PROD : process.env.REDIS_LOCAL,
            port: prod ? Number(process.env.PORT_REDIS_PROD) : Number(process.env.PORT_REDIS_LOCAL),
            password: prod ? undefined : process.env.PASSWORD_REDIS_LOCAL,
        };

        this.queue = new Queue(queueName, { connection: this.connection });
        msg.info(`Fila BullMQ "${queueName}" iniciada.`);
    }

    async addJob<T = any>(jobName: string, data: T, options?: AddJobOptions) {
        await this.queue.add(jobName, data, {
            delay: options?.delay,
            attempts: options?.attempts ?? 10,
            backoff: options?.backoff ?? 30000,
            removeOnComplete: { age: 3600, count: 50 },
            removeOnFail: { age: 3600 },
        });

        msg.warn(`Job "${jobName}" adicionado: ${JSON.stringify(data)}`);
    }
}

export const mpFilas = new BullMQService("payments-mp");