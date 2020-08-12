import {Injectable} from "injection-js";
import {createTransport} from "nodemailer";
import * as Mail from "nodemailer/lib/mailer";

import {TemplateRenderer} from "./template-renderer";
import {Translator} from "./translator";
import {Configuration} from "./configuration";

export interface MailOptions {
    to: string;
    from?: string;
    subject?: string;
    template: string;
    context: any;
    attachments?: Mail.Attachment[]
}

@Injectable()
export class MailSender {

    readonly transporter: Mail;

    get translator(): Translator {
        return this.renderer.translator;
    }

    constructor(readonly config: Configuration, readonly renderer: TemplateRenderer) {
        this.transporter = createTransport({
            host: this.config.resolve("smtpHost"),
            port: this.config.resolve("smtpPort"),
            auth: {
                user: this.config.resolve("smtpUser"),
                pass: this.config.resolve("smtpPassword"),
            }
        });
    }

    async sendMail(language: string, options: MailOptions): Promise<any> {
        const subject = await this.translator.getTranslation(language, options.subject || "-");
        const html = await this.renderer.render(options.template, language, options.context);
        return this.transporter.sendMail({
            from: options.from || this.config.resolve("mailSenderAddress"),
            to: options.to,
            attachments: options.attachments,
            subject,
            html
        });
    }
}
