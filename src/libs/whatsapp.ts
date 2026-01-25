import axios from "axios";
import FormData from "form-data";

interface WhatsAppConfig {
    accessToken: string;
    phoneNumberId: string;
    version?: string;
}

type MediaType = "image" | "video" | "document";

interface MediaPayload {
    to: string;
    type: MediaType;
    content: string;
    isBase64?: boolean;
    caption?: string;
    fileName?: string;
}

export class WhatsAppService {
    private baseUrl: string;
    private uploadUrl: string;
    private token: string;

    constructor(config: WhatsAppConfig) {
        const version = config.version || 'v21.0';
        this.baseUrl = `https://graph.facebook.com/${version}/${config.phoneNumberId}/messages`;
        this.uploadUrl = `https://graph.facebook.com/${version}/${config.phoneNumberId}/media`;
        this.token = config.accessToken;
    }

    private async uploadBase64(base64: string, type: string, fileName?: string): Promise<string> {
        const buffer = Buffer.from(base64.replace(/^data:.*?;base64,/, ""), "base64");

        const form = new FormData();
        form.append("file", buffer, {
            filename: fileName || "file",
            contentType: `${type}/png`
        });
        form.append("messaging_product", "whatsapp");

        const response = await axios.post(this.uploadUrl, form, {
            headers: {
                ...form.getHeaders(),
                Authorization: `Bearer ${this.token}`
            }
        });

        return response.data.id;
    }

    async sendMedia({ to, type, content, isBase64, caption, fileName }: MediaPayload) {
        const mediaObject: any = {};

        if (isBase64) {
            const mediaId = await this.uploadBase64(content, type, fileName);
            mediaObject.id = mediaId;
        } else {
            mediaObject.link = content;
        }

        if (caption) {
            mediaObject.caption = caption;
        }

        const payload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: to,
            type: type,
            [type]: mediaObject
        };

        const response = await axios.post(this.baseUrl, payload, {
            headers: {
                Authorization: `Bearer ${this.token}`,
                "Content-Type": "application/json"
            }
        });

        return response.data;
    }
};