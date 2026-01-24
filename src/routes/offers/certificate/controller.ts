import { Request, Response } from "express"
import { CertificateConfig, PlanKey } from "./config";
import { ICertifcate, OrdersCertificate } from "../../../database/models/certifcate";
import { AppError } from "../../../core/http/error";
import { CertificateMessages as MSG } from "./messages";
import { HttpStatus } from "../../../core/http/status";
import { HttpResponse } from "../../../core/http/response";
import { MercadoPago } from "../../../libs/mercadopago";
import { Providers } from "../../../data/providers";
import { signOrderToken } from "../../../core/auth/order-jwt";
import { randomUUID } from "crypto";
import { generateCertificateImage } from "../../../libs/certificate-generate";
import { BREATHING_BASE64, INPUT_IMAGE_BASE64 } from "./data";
import crypto from "crypto";

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
    const apiToken =
        process.env.PROD === "false"
            ? process.env.API_KEY_MP_TEST
            : process.env.API_KEY_MP;

    const mp = new MercadoPago(apiToken!);
    const payment = await mp.createPix({
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

export async function mercadoPagoWebhook(
    req: Request,
    res: Response
) {
    try {
        const signature = req.headers["x-signature"] as string;
        const requestId = req.headers["x-request-id"] as string;

        if (!signature || !requestId) {
            return res.status(401).json({
                error: "Missing Mercado Pago headers"
            });
        }

        /**
         * x-signature format:
         * ts=123456789,v1=abcdef
         */
        const parts = signature.split(",");

        const tsPart = parts.find(p => p.startsWith("ts="));
        const v1Part = parts.find(p => p.startsWith("v1="));

        if (!tsPart || !v1Part) {
            return res.status(401).json({
                error: "Invalid signature format"
            });
        }

        const timestamp = tsPart.replace("ts=", "");
        const receivedHash = v1Part.replace("v1=", "");

        const secret = process.env.MP_WEBHOOK_SECRET;
        if (!secret) {
            throw new Error("MP_WEBHOOK_SECRET not configured");
        }

        const payload = `${requestId}${timestamp}${secret}`;
        const expectedHash = crypto
            .createHash("sha256")
            .update(payload)
            .digest("hex");

        if (expectedHash !== receivedHash) {
            return res.status(401).json({
                error: "Invalid webhook signature"
            });
        }

        // ✅ assinatura válida
        // -----------------------------

        const { type, data, action } = req.body;

        if (type !== "payment") {
            return res.sendStatus(200);
        }

        const paymentId = data.id;

        console.log("🔔 Webhook Mercado Pago:", {
            paymentId,
            action
        });

        /**
         * Agora você faz:
         *
         * GET /v1/payments/:id
         *
         * e verifica:
         * status === "approved"
         */

        // exemplo:
        // const payment = await getPaymentById(paymentId);

        // if (payment.status === "approved") {
        //   await markOrderAsPaid(payment.external_reference);
        // }

        return res.sendStatus(200);

    } catch (err) {
        console.error("Webhook error:", err);
        return res.sendStatus(500);
    }
}

export const getOrderPaymentStatus = async (
    req: Request,
    res: Response
) => {
    const orderId = req.orderId;
    const order = await OrdersCertificate.findOne({
        "offer.id": orderId
    }).lean();

    if (!order) {
        throw new AppError(
            "ORDER_NOT_FOUND",
            "Pedido não encontrado.",
            HttpStatus.NOT_FOUND
        );
    }

    if (!order.payment?.paymentId) {
        throw new AppError(
            "PAYMENT_NOT_FOUND",
            "Pagamento não encontrado.",
            HttpStatus.UNPROCESSABLE_ENTITY
        );
    }

    const apiToken =
        process.env.PROD === "false"
            ? process.env.API_KEY_MP_TEST
            : process.env.API_KEY_MP;

    const mp = new MercadoPago(apiToken!);
    const payment = await mp.getPayment(order.payment.paymentId);

    return HttpResponse.success(res, {
        orderId: order.offer.id,
        amount: order.offer.price,
        status: payment.status,
        payment: {
            provider: "mercadopago",
            paymentId: payment.id,
            status: payment.status,
            qrCode: payment.point_of_interaction?.transaction_data?.qr_code || null,
            qrCodeBase64:
                payment.point_of_interaction?.transaction_data?.qr_code_base64 || null
        }
    });
};