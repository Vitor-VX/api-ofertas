import { Request, Response } from "express"
import { CertificateConfig, PlanKey } from "./config";
import { ICertifcate, OrdersCertificate } from "../../../database/models/certifcate";
import { AppError } from "../../../core/http/error";
import { CertificateMessages as MSG } from "./messages";
import { HttpStatus } from "../../../core/http/status";
import { HttpResponse } from "../../../core/http/response";
import { mercadoPago } from "../../../libs/mercadopago";
import { Providers } from "../../../data/providers";
import { signOrderToken } from "../../../core/auth/order-jwt";
import { randomUUID } from "crypto";
import { generateCertificateImage } from "../../../libs/certificate-generate";
import { BREATHING_BASE64, INPUT_IMAGE_BASE64 } from "./data";
import crypto from "crypto";
import { mpFilas } from "../../../libs/bullMq";

export const createOrder = async (req: Request, res: Response) => {
    const { product, name, whatsapp, cpf, email } = req.body;

    const {
        plan,
        extras,
        certificates
    }: {
        plan: PlanKey;
        extras?: string[];
        certificates: ICertifcate[];
    } = product;

    if (!CertificateConfig.plan[plan]) {
        throw new AppError(
            "PLAN_NOT_FOUND",
            MSG.PLAN_NOT_FOUND,
            HttpStatus.UNPROCESSABLE_ENTITY
        );
    }

    if (extras && extras.length > 0) {
        for (const extra of extras) {
            if (!CertificateConfig.extras[extra]) {
                throw new AppError(
                    "UPSELL_NOT_FOUND",
                    MSG.EXTRA_NOT_FOUND,
                    HttpStatus.UNPROCESSABLE_ENTITY
                );
            }
        }
    }

    const selectedPlan = CertificateConfig.plan[plan];
    if (certificates.length !== selectedPlan.certificates) {
        throw new AppError(
            "INVALID_CERTIFICATE_QUANTITY",
            MSG.CERTIFICATE_LIMIT_EXCEEDED,
            HttpStatus.UNPROCESSABLE_ENTITY
        );
    }

    let totalPrice = selectedPlan.price;
    if (extras && extras.length > 0) {
        for (const extra of extras) {
            totalPrice += CertificateConfig.extras[extra].price;
        }
    }

    const pendingOrder = await OrdersCertificate.findOne({
        "customer.cpf": cpf,
        "payment.status": { $ne: "approved" }
    });

    const orderId = pendingOrder?.offer?.id ?? randomUUID();
    const payment = await mercadoPago.createPix({
        transactionAmount: totalPrice,
        description: "Certificado do Amor 💖",
        externalReference: orderId,
        notificationUrl: "https://api.seusite.com/webhooks/mp",
        payer: {
            email,
            firstName: name,
            identification: {
                type: "CPF",
                number: cpf
            }
        }
    });

    if (pendingOrder) {
        await OrdersCertificate.updateOne(
            { _id: pendingOrder._id },
            {
                $set: {
                    offer: {
                        id: orderId,
                        amount: selectedPlan.quantity,
                        price: totalPrice
                    },
                    customer: {
                        name,
                        whatsapp,
                        cpf,
                        email
                    },
                    certificate: certificates,
                    payment: {
                        provider: Providers.MERCADO_PAGO,
                        paymentId: payment.id.toString(),
                        status: payment.status
                    },
                    updatedAt: new Date()
                }
            }
        );

        const token = signOrderToken(orderId);
        return HttpResponse.success(
            res,
            {
                orderId: pendingOrder.id,
                token,
                payment
            },
            "Pedido pendente atualizado com sucesso."
        );
    }

    const order = await OrdersCertificate.create({
        offer: {
            id: orderId,
            amount: selectedPlan.quantity,
            price: totalPrice
        },
        customer: {
            name,
            whatsapp,
            cpf,
            email
        },
        certificate: certificates,
        payment: {
            provider: Providers.MERCADO_PAGO,
            paymentId: payment.id.toString(),
            status: payment.status
        }
    });

    const token = signOrderToken(orderId);
    return HttpResponse.success(
        res,
        {
            orderId: order.id,
            token,
            payment
        },
        "Pedido criado com sucesso."
    );
};

export const getCurrentOrder = async (req: Request, res: Response) => {
    const orderId = req.orderId;

    const order = await OrdersCertificate.findOne(
        { "offer.id": orderId },
        {
            offer: 1,
            payment: 1,
            createdAt: 1
        }
    ).lean();

    if (!order) {
        throw new AppError(
            "ORDER_NOT_FOUND",
            "Pedido não encontrado.",
            HttpStatus.NOT_FOUND
        );
    }

    return HttpResponse.success(res, {
        orderId: order.offer.id,
        amount: order.offer.price,
        status: order.payment.status,
        payment: {
            provider: order.payment.provider,
            status: order.payment.status,
            approved: order.payment.status === "approved"
        }
    });
};

export async function mercadoPagoWebhook(req: Request, res: Response) {
    try {
        const signature = req.headers["x-signature"] as string;
        const requestId = req.headers["x-request-id"] as string;

        const dataId = req.query["data.id"] as string;
        if (!signature || !requestId || !dataId) {
            return res.status(401).json({
                error: "Missing required Mercado Pago headers or query params"
            });
        }

        const parts = signature.split(",");
        let ts: string | undefined;
        let receivedHash: string | undefined;

        parts.forEach(part => {
            const [key, value] = part.split("=");
            if (key && value) {
                const trimmedKey = key.trim();
                const trimmedValue = value.trim();
                if (trimmedKey === "ts") ts = trimmedValue;
                if (trimmedValue && trimmedKey === "v1") receivedHash = trimmedValue;
            }
        });

        if (!ts || !receivedHash) {
            return res.status(401).json({ error: "Invalid signature format" });
        }

        const secret = process.env.MP_WEBHOOK_SECRET;
        if (!secret) {
            throw new Error("MP_WEBHOOK_SECRET not configured");
        }

        const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
        const hmac = crypto.createHmac("sha256", secret);
        hmac.update(manifest);

        const expectedHash = hmac.digest("hex");
        if (expectedHash !== receivedHash) {
            console.error("Signature mismatch!");
            return res.status(401).json({
                error: "Invalid webhook signature"
            });
        }

        const { type, action, data } = req.body;
        
        if (type === "payment") {
            const paymentId = data.id;
            console.log("🔔 Pagamento recebido:", paymentId, "Ação:", action);
            mpFilas.job(paymentId);
        }

        return res.sendStatus(200);
    } catch (err) {
        console.error("Webhook error:", err);
        return res.sendStatus(500);
    }
}