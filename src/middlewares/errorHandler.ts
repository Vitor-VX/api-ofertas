import { Request, Response, NextFunction } from "express";
import { AppError } from "../core/http/error";
import { HttpStatus } from "../core/http/status";

export function errorHandler(
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
) {
    if (err instanceof AppError) {
        return res.status(err.status).json({
            success: false,
            code: err.code,
            message: err.message
        });
    }

    console.error(err);

    return res.status(HttpStatus.INTERNAL_ERROR).json({
        success: false,
        code: "INTERNAL_ERROR",
        message: "Erro interno do servidor"
    });
}