import { Payment, MercadoPagoConfig } from "mercadopago";
import { AppError } from "../core/http/error";
import { HttpStatus } from "../core/http/status";

export interface MercadoPagoCreatePix {
    transactionAmount: number;
    description: string;
    payer: {
        email: string;
        firstName: string;
        identification: {
            type: "CPF";
            number: string;
        };
    };
    externalReference?: string;
    notificationUrl?: string;
    expiresAt?: Date;
}

export interface MercadoPagoPixResponse {
    id: number;
    status: string;
    qrCode: string;
    qrCodeBase64: string;
    ticketUrl: string;
    expirationDate: string;
}

class MercadoPago {
    private payment: Payment;

    constructor(accessToken: string) {
        const client = new MercadoPagoConfig({
            accessToken
        });

        this.payment = new Payment(client);
    }

    /**
     * Cria um pagamento PIX
     */
    async createPix(
        payload: MercadoPagoCreatePix
    ): Promise<MercadoPagoPixResponse> {
        try {
            const response = await this.payment.create({
                body: {
                    transaction_amount: payload.transactionAmount,
                    description: payload.description,
                    payment_method_id: "pix",
                    external_reference: payload.externalReference,
                    notification_url: payload.notificationUrl,
                    date_of_expiration: payload.expiresAt?.toISOString(),
                    payer: {
                        email: payload.payer.email,
                        first_name: payload.payer.firstName,
                        identification: {
                            type: "CPF",
                            number: payload.payer.identification.number
                        }
                    }
                }
            });

            return {
                id: response.id!,
                status: response.status!,
                qrCode: response.point_of_interaction!
                    .transaction_data!
                    .qr_code!,
                qrCodeBase64: response.point_of_interaction!
                    .transaction_data!
                    .qr_code_base64!,
                ticketUrl: response.point_of_interaction!
                    .transaction_data!
                    .ticket_url!,
                expirationDate: response.date_of_expiration!
            };
        } catch (error: any) {
            console.error("MercadoPago error:", error);

            throw new AppError(
                "MERCADOPAGO_ERROR",
                "Erro ao criar pagamento no Mercado Pago.",
                HttpStatus.INTERNAL_ERROR
            );
        }
    }

    async getPayment(paymentId: string) {
        const response = await this.payment.get({
            id: paymentId
        });

        return response;
    }
}

const apiToken =
    process.env.PROD === "false"
        ? process.env.API_KEY_MP_TEST
        : process.env.API_KEY_MP;
export const mercadoPago = new MercadoPago(apiToken!!);