import {
    S3,
    PutObjectCommand,
    DeleteObjectCommand
} from "@aws-sdk/client-s3";

import crypto from "crypto";
import { fileTypeFromBuffer } from "file-type";
import { msg } from "./logs";

const keyId = process.env.KEY_ID_CLOUDFLARE || "";
const accessKey = process.env.ACCESS_KEY_CLOUDFLARE || "";

const s3Client = new S3({
    endpoint: "https://ef42a56f8b3922dfeaefbffa0ddcda34.r2.cloudflarestorage.com",
    region: "auto",
    credentials: {
        accessKeyId: keyId,
        secretAccessKey: accessKey
    }
});

function detectImageMime(buffer: Buffer) {
    const hex = buffer.toString("hex", 0, 12);

    if (hex.startsWith("ffd8ff")) {
        return { ext: "jpg", mime: "image/jpeg" };
    }

    if (hex.startsWith("89504e47")) {
        return { ext: "png", mime: "image/png" };
    }

    if (hex.startsWith("47494638")) {
        return { ext: "gif", mime: "image/gif" };
    }

    if (
        hex.startsWith("52494646") &&
        buffer.toString("ascii", 8, 12) === "WEBP"
    ) {
        return { ext: "webp", mime: "image/webp" };
    }

    return null;
}

const BUCKET = "botsync-files";
const PUBLIC_URL = "https://files.botsync.site";

class UploadCloudFlare {

    /**
     * Upload inteligente:
     * - detecta tipo real do arquivo
     * - gera uuid
     * - define extensão correta
     * - protege contra arquivos inválidos
     */
    async uploadBuffer(
        buffer: Buffer,
        folder = "uploads"
    ): Promise<{ url: string; key: string } | null> {

        try {
            const type = detectImageMime(buffer);
            if (!type) {
                throw new Error("Formato de imagem não suportado");
            }

            if (
                !type.mime.startsWith("image/") &&
                type.mime !== "application/pdf"
            ) {
                throw new Error(`Tipo não permitido: ${type.mime}`);
            }

            const uuid = crypto.randomUUID();
            const key = `${folder}/${uuid}.${type.ext}`;

            await s3Client.send(
                new PutObjectCommand({
                    Bucket: BUCKET,
                    Key: key,
                    Body: buffer,
                    ContentType: type.mime
                })
            );

            const url = `${PUBLIC_URL}/${key}`;
            msg.info(`Upload realizado: ${url}`);

            return { key, url };
        } catch (err: any) {
            msg.error(`Erro Cloudflare R2: ${err.message}`);
            return null;
        }
    }

    /**
     * Remove arquivo do bucket
     */
    async deleteFile(key: string): Promise<boolean> {
        try {
            await s3Client.send(
                new DeleteObjectCommand({
                    Bucket: BUCKET,
                    Key: key
                })
            );

            msg.info(`Arquivo deletado: ${key}`);
            return true;

        } catch (err: any) {
            msg.error(`Erro ao deletar: ${err.message}`);
            return false;
        }
    }
}

export const uploadCloudFlare = new UploadCloudFlare();