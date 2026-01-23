import { Request, Response, NextFunction } from "express";
import { verifyOrderToken } from "../core/auth/order-jwt";
import { AppError } from "../core/http/error";
import { HttpStatus } from "../core/http/status";

export function orderAuth(
    req: Request,
    _: Response,
    next: NextFunction
) {
    const auth = req.headers.authorization;

    if (!auth) {
        throw new AppError(
            "ORDER_TOKEN_REQUIRED",
            "Token do pedido não enviado.",
            HttpStatus.UNAUTHORIZED
        );
    }

    const [, token] = auth.split(" ");
    const payload = verifyOrderToken(token);
    req.orderId = payload.orderId;
    
    next();
}