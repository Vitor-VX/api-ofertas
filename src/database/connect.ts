import mongoose, { connect, type Mongoose } from "mongoose";
import { msg } from "../utils/logs";

const MONGO_URI = process.env.MONGO_CONNECT || "";
let isConnected = false;

const connectToDatabase = async (): Promise<Mongoose> => {
    if (isConnected && mongoose.connection.readyState === 1) {
        msg.success("Usando conexão de banco de dados existente.");
        return mongoose;
    }

    if (!MONGO_URI) {
        throw new Error("MONGO_URI não foi definida nas variáveis de ambiente.");
    }

    try {
        msg.success("Estabelecendo nova conexão com o banco de dados...");

        const db = await connect(MONGO_URI, {
            serverSelectionTimeoutMS: 30000,
            maxPoolSize: 10
        });

        isConnected = true;
        msg.success("Conexão com o MongoDB estabelecida com sucesso.");

        mongoose.connection.on("disconnected", () => {
            msg.info("Conexão com o MongoDB perdida.");
            isConnected = false;
        });

        mongoose.connection.on("error", (err) => {
            msg.error("Erro na conexão MongoDB: " + err.message);
        });
        return db;
    } catch (error: any) {
        msg.error(`Falha ao conectar ao MongoDB: ${error.message}`);
        throw error;
    }
};

export default connectToDatabase();