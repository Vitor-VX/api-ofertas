import { Response } from "express";
import { HttpStatus } from "./status";

interface ApiResponse<T = any> {
    success: boolean;
    message?: string;
    data?: T;
    code?: string;
}

export class HttpResponse {
    static success<T>(
        res: Response,
        data?: T,
        message = "OK",
        status = HttpStatus.OK
    ) {
        return res.status(status).json({
            success: true,
            message,
            data
        });
    }

    static error(
        res: Response,
        code: string,
        message: string,
        status = HttpStatus.BAD_REQUEST
    ) {
        return res.status(status).json({
            success: false,
            code,
            message
        });
    }
}