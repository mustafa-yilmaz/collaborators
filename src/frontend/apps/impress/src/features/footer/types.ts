import Image from 'next/image';

type Imagetype = React.ComponentProps<typeof Image>;

export interface FooterType {
  default: ContentType;
  [key: string]: ContentType;
}

export interface BottomInformationType {
  label: string;
  link?: LinkType;
}

export interface LinkType {
  label: string;
  href: string;
}

export type LogoType = Imagetype & {
  withTitle: boolean;
  /** Scale of the text wordmark next to (or instead of) the image. */
  titleZoom?: number;
  /** A link shown under the logo, e.g. the address of the platform. */
  link?: LinkType;
};

/** A credits sentence: plain text pieces and links, in reading order. */
export type CreditPart = { text: string } | LinkType;

export interface ContentType {
  logo?: LogoType;
  externalLinks?: LinkType[];
  credits?: CreditPart[];
  legalLinks?: LinkType[];
  bottomInformation?: BottomInformationType;
}
