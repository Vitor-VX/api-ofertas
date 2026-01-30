import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import PDFDocument from "pdfkit";

export async function createPdfFromImages({
    image1,
    image2
}: {
    image1: string;
    image2?: string;
}): Promise<string> {

    const tmpDir = path.resolve(process.cwd(), "tmp");
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir);
    }

    const fileName = `${randomUUID()}.pdf`;
    const filePath = path.join(tmpDir, fileName);

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ autoFirstPage: false });
        const stream = fs.createWriteStream(filePath);

        doc.pipe(stream);

        const addPage = (base64: string) => {
            const buffer = Buffer.from(
                base64.replace(/^data:image\/\w+;base64,/, ""),
                "base64"
            );

            doc.addPage({ size: "A4" });

            doc.image(buffer, {
                fit: [595, 842],
                align: "center",
                valign: "center"
            });
        };

        addPage(image1);

        if (image2) {
            addPage(image2);
        }

        doc.end();

        stream.on("finish", () => resolve(filePath));
        stream.on("error", reject);
    });
}