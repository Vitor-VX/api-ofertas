import "dotenv/config";

export const isProd = () => {
    return process.env.PROD === "true" ? true : false;
}