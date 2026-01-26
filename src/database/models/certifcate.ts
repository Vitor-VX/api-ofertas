import { Schema, Document } from "mongoose";
import { Providers } from "../../data/providers";
import { mongoConnect } from "../config";

export interface ICertifcate {
    couple: string;
    startDate: string;
    city: string;
    photo: string;
};

export interface IOrdersCertificate extends Document {
    offer: {
        id: string;
        amount: number;
        price: number;
    };
    customer: {
        name: string;
        whatsapp: string;
        email: string;
        cpf: string;
    };
    certificate: ICertifcate[];
    payment: {
        provider: Providers;
        paymentId: string;
        status: string;
    };
    deliverable: {
        delivery: boolean;
        imageUrl: string;
    };
}

const ordersSchema = new Schema<IOrdersCertificate>(
    {
        offer: {
            id: {
                type: String,
                required: true
            },
            amount: {
                type: Number,
                required: true
            },
            price: {
                type: Number,
                required: true
            }
        },

        customer: {
            name: {
                type: String,
                required: true
            },
            whatsapp: {
                type: String,
                required: true
            },
            email: {
                type: String,
                required: true
            },
            cpf: {
                type: String,
                required: true
            }
        },

        certificate: [
            {
                couple: {
                    type: String,
                    required: true
                },
                startDate: {
                    type: String,
                    required: true
                },
                city: {
                    type: String,
                    required: true
                },
                photo: {
                    type: String,
                    default: null
                }
            }
        ],

        payment: {
            provider: {
                type: String,
                enum: Object.values(Providers),
                required: true
            },
            paymentId: {
                type: String,
                required: true
            },
            status: {
                type: String,
                required: true
            }
        },

        deliverable: {
            delivery: {
                type: Boolean,
                default: false
            },
            imageUrl: {
                type: String,
                default: ""
            }
        }
    },
    {
        timestamps: true
    }
);

export const OrdersCertificate = mongoConnect.model<IOrdersCertificate>("orders", ordersSchema);