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

export const createOrder = async (req: Request, res: Response) => {
    const { product, name, whatsapp, cpf, email } = req.body;
    const { plan, extras, certificates }: {
        plan: PlanKey;
        extras?: string;
        certificates: ICertifcate[];
    } = product;

    if (!CertificateConfig.plan[plan]) {
        throw new AppError(
            "PLAN_NOT_FOUND",
            MSG.PLAN_NOT_FOUND,
            HttpStatus.UNPROCESSABLE_ENTITY
        );
    }

    if (extras && extras.length > 0 && !CertificateConfig.extras[extras]) {
        throw new AppError(
            "UPSELL_NOT_FOUND",
            MSG.EXTRA_NOT_FOUND,
            HttpStatus.UNPROCESSABLE_ENTITY
        );
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
    if (extras) {
        totalPrice += CertificateConfig.extras[extras].price;
    }

    const orderId = randomUUID();
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
    return HttpResponse.success(res, {
        orderId: order.id,
        token,
        payment
    }, "Pedido criado com sucesso.");
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