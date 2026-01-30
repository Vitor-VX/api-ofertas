import fs from "fs";
import { msg } from "./logs";

export function safeDelete(filePath?: string) {
    if (!filePath) return;

    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch {
        msg.error(`Não foi possível apagar arquivo: ${filePath}`);
    }
}