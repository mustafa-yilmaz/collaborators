import { useTranslation } from 'react-i18next';

import { Text, TextType } from '@/components/';
import { useConfig } from '@/core';

// An emoji, with its optional variation selector (e.g. "✍️" is U+270D U+FE0F)
const EMOJI = /(\p{Extended_Pictographic}\uFE0F?)/u;

/**
 * The wordmark's letters are bold italic; its emojis stay upright, as slanting
 * them would distort them in browsers that synthesize the italic.
 */
const Wordmark = ({ text }: { text: string }) => (
  <span aria-hidden="true" style={{ fontStyle: 'italic', fontWeight: 800 }}>
    {text
      .split(EMOJI)
      .filter(Boolean)
      .map((part, index) =>
        EMOJI.test(part) ? (
          <span key={index} style={{ fontStyle: 'normal' }}>
            {part}
          </span>
        ) : (
          part
        ),
      )}
  </span>
);

type TitleSemanticsProps = TextType & {
  headingLevel?: 'h1' | 'h2' | 'h3';
  className?: string;
};

export const Title = ({
  headingLevel = 'h2',
  ...props
}: TitleSemanticsProps) => {
  const { t } = useTranslation();
  const { data: config } = useConfig();
  const productName = t('Docs', {
    description: 'Product name, shown in page titles and the logo',
  });
  const wordmark = config?.theme_customization?.wordmark;

  return (
    <Text
      className={`--docs--title${props.className ? ` ${props.className}` : ''}`}
      $direction="row"
      $align="center"
      $margin="none"
      as={headingLevel}
      $zIndex={1}
      $size="1.375rem"
      $color="var(--c--contextuals--content--logo1)"
      {...props}
    >
      {wordmark ? (
        <>
          <Wordmark text={wordmark} />
          <span className="sr-only">{productName}</span>
        </>
      ) : (
        productName
      )}
    </Text>
  );
};
