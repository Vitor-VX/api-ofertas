import { connection } from "mongoose"

export const dbName = "oferta-certificado";
export const urlConnect = "";
export const mongoConnect = connection.useDb(dbName);