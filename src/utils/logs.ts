import moment from "moment";
import chalk from "chalk";

export const msg = {
    info(text: string) {
        console.log(
            chalk.gray(`[${moment().format("HH:mm:ss")}]`) +
            " " +
            chalk.cyan(text)
        );
    },

    success(text: string) {
        console.log(
            chalk.gray(`[${moment().format("HH:mm:ss")}]`) +
            " " +
            chalk.green(text)
        );
    },

    warn(text: string) {
        console.log(
            chalk.gray(`[${moment().format("HH:mm:ss")}]`) +
            " " +
            chalk.yellow(text)
        );
    },

    error(text: string) {
        console.log(
            chalk.gray(`[${moment().format("HH:mm:ss")}]`) +
            " " +
            chalk.red(text)
        );
    }
};