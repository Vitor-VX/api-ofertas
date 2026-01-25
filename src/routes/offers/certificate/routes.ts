import express from "express";
import { body } from "express-validator";
import { createOrder, getCurrentOrder, mercadoPagoWebhook } from "./controller";
import { validate } from "../../../middlewares/validate";
import { orderAuth } from "../../../middlewares/order-auth";

const router = express.Router();

router.post(
    "/orders/create",
    [
        body("product").isObject(),

        body("product.plan")
            .isString()
            .notEmpty(),

        body("product.extras")
            .optional()
            .isArray(),

        body("product.certificates")
            .isArray({ min: 1 }),

        body("product.certificates.*.couple")
            .isString()
            .notEmpty(),

        body("product.certificates.*.startDate")
            .isString()
            .notEmpty(),

        body("product.certificates.*.city")
            .isString()
            .notEmpty(),


        body("name").isString().notEmpty(),
        body("whatsapp").isString().notEmpty(),
        body("cpf").isString().isLength({ min: 11 }),
        body("email").isEmail()
    ],
    validate,
    createOrder
);

router.post(
    "/payments/webhook",
    [
        body("type")
            .isString()
            .notEmpty(),

        body("action")
            .optional()
            .isString(),

        body("data")
            .isObject(),

        body("data.id")
            .isString()
            .notEmpty()
    ],
    mercadoPagoWebhook
);

router.get(
    "/orders/current",
    orderAuth,
    getCurrentOrder
);

export default router;