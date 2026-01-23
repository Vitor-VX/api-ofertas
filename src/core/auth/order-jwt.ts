import jwt from "jsonwebtoken";
import { AppError } from "../http/error";
import { HttpStatus } from "../http/status";

const SECRET = process.env.ORDER_JWT_SECRET!;

export function signOrderToken(orderId: string) {
    return jwt.sign(
        { orderId },
        SECRET,
        { expiresIn: "45m" }
    );
}

export function verifyOrderToken(token: string) {
    try {
        return jwt.verify(token, SECRET) as {
            orderId: string;
        };
    } catch {
        throw new AppError(
            "INVALID_ORDER_TOKEN",
            "Token do pedido inválido ou expirado.",
            HttpStatus.UNAUTHORIZED
        );
    }
}