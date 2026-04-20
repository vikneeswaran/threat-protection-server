declare module "nodemailer" {
  interface Transporter {
    sendMail(options: {
      from?: string
      to?: string
      subject?: string
      html?: string
      text?: string
      replyTo?: string
    }): Promise<unknown>
  }

  interface TransportOptions {
    host?: string
    port?: number
    secure?: boolean
    auth?: {
      user?: string
      pass?: string
    }
  }

  const nodemailer: {
    createTransport(options: TransportOptions): Transporter
  }

  export default nodemailer
}