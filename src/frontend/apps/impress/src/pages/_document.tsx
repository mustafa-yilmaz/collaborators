import Document, {
  DocumentContext,
  Head,
  Html,
  Main,
  NextScript,
} from 'next/document';

import { fallbackLng } from '../i18n/config';

class MyDocument extends Document<{ locale: string }> {
  static async getInitialProps(ctx: DocumentContext) {
    const initialProps = await Document.getInitialProps(ctx);
    return {
      ...initialProps,
      locale: ctx.locale || fallbackLng,
    };
  }

  render() {
    return (
      <Html lang={this.props.locale}>
        <Head>
          {/* Collaborators: the ✍️ icon (Noto Color Emoji, Apache 2.0), in
              the page itself for every browser, before any script runs */}
          <link rel="icon" href="/favicon.ico" sizes="any" />
          <link
            rel="icon"
            href="/assets/favicon-collaborators.svg"
            type="image/svg+xml"
          />
          <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
