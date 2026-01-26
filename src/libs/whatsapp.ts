import axios from "axios";
import FormData from "form-data";

type MediaType = "image" | "video" | "document";

interface WhatsAppConfig {
    accessToken: string;
    phoneNumberId: string;
    version?: string;
}

export interface MediaItem {
    content: string;
    fileName?: string;
    caption?: string;
}

export class WhatsAppService {
    private baseUrl: string;
    private uploadUrl: string;
    private token: string;

    constructor(config: WhatsAppConfig) {
        const version = config.version || "v21.0";
        this.baseUrl = `https://graph.facebook.com/${version}/${config.phoneNumberId}/messages`;
        this.uploadUrl = `https://graph.facebook.com/${version}/${config.phoneNumberId}/media`;
        this.token = config.accessToken;
    }

    private async uploadBase64(
        base64: string,
        type: MediaType,
        fileName?: string
    ): Promise<string> {
        const buffer = Buffer.from(
            base64.replace(/^data:.*?;base64,/, ""),
            "base64"
        );

        const form = new FormData();
        form.append("file", buffer, {
            filename: fileName || `file.${type}`,
            contentType: `${type}/png`,
        });
        form.append("messaging_product", "whatsapp");

        const response = await axios.post(this.uploadUrl, form, {
            headers: {
                ...form.getHeaders(),
                Authorization: `Bearer ${this.token}`,
            },
        });

        return response.data.id;
    }

    async sendTemplate({
        to,
        templateName,
        language = "pt_BR",
        components = [],
    }: {
        to: string;
        templateName: string;
        language?: string;
        components?: any[];
    }) {
        const payload = {
            messaging_product: "whatsapp",
            to,
            type: "template",
            template: {
                name: templateName,
                language: { code: language },
                components,
            },
        };

        const response = await axios.post(this.baseUrl, payload, {
            headers: {
                Authorization: `Bearer ${this.token}`,
                "Content-Type": "application/json",
            },
        });

        return response.data;
    }

    private async sendSingleMedia({
        to,
        type,
        mediaId,
        caption,
    }: {
        to: string;
        type: MediaType;
        mediaId: string;
        caption?: string;
    }) {
        const payload: any = {
            messaging_product: "whatsapp",
            to,
            type,
            [type]: {
                id: mediaId,
            },
        };

        if (caption) {
            payload[type].caption = caption;
        }

        await axios.post(this.baseUrl, payload, {
            headers: {
                Authorization: `Bearer ${this.token}`,
                "Content-Type": "application/json",
            },
        });
    }

    async sendMultipleMedia({
        to,
        type,
        files,
    }: {
        to: string;
        type: MediaType;
        files: MediaItem[];
    }) {
        for (const file of files) {
            const mediaId = await this.uploadBase64(
                file.content,
                type,
                file.fileName
            );

            await this.sendSingleMedia({
                to,
                type,
                mediaId,
                caption: file.caption,
            });
        }
    }
}