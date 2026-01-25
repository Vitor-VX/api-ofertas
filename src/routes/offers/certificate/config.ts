import { isProd } from "../../../utils/isProd";

export type PlanKey = "single" | "couple" | "family";

export interface IPlan {
    quantity: number;
    certificates: number;
    price: number;
}

export interface IExtra {
    price: number;
}

export interface ICertificateLimits {
    maxCertificatesPerOrder: number;
}

export const CertificateConfig: {
    plan: Record<PlanKey, IPlan>;
    extras: Record<string, IExtra>;
    limits: ICertificateLimits;
} = {
    plan: {
        single: {
            quantity: 1,
            certificates: 1,
            price: 0.05
            // price: isProd() ? 9.90 : 0.05
        },

        couple: {
            quantity: 2,
            certificates: 2,
            price: 24.90
        },

        family: {
            quantity: 3,
            certificates: 3,
            price: 34.90
        }
    },

    extras: {
        fast_delivery: {
            price: 4.90
        }
    },

    limits: {
        maxCertificatesPerOrder: 3
    }
};