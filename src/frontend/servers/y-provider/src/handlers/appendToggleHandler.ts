import * as Sentry from '@sentry/node';
import { Request, Response } from 'express';
import * as Y from 'yjs';

import { logger } from '@/utils';

import { DocsPartialBlock, editor } from './convertHandler';

const FRAGMENT = 'document-store';

interface AppendToggleBody {
  /** The page's current Yjs state, base64 encoded ("" for an empty page) */
  doc?: string;
  /** The toggle's title, e.g. "Input from Ada (ada@example.org) · via Claude" */
  title?: string;
  /** What goes inside it, as Markdown */
  markdown?: string;
}

/** Whether a block holds nothing: the editor's empty last line, say. */
const isEmptyParagraph = (container: Y.XmlElement) => {
  const content = container.get(0);
  return (
    container.length === 1 &&
    content instanceof Y.XmlElement &&
    content.nodeName === 'paragraph' &&
    content.toString().replace(/<[^>]*>/g, '') === ''
  );
};

/**
 * Collaborators: the Yjs update adding, at the end of a page, a toggle
 * heading 3 titled as given, closed, holding the Markdown converted to
 * blocks. It is
 * computed against the page's current state and touches nothing else, so
 * applying it merges with whatever editors are doing at the same time (the
 * backend hands it to the collaboration server's `append-ydoc`).
 *
 * The toggle goes before the editor's empty last line, if there is one.
 */
export const appendToggleHandler = async (
  req: Request<object, Uint8Array | { error: string }, AppendToggleBody>,
  res: Response<Uint8Array | { error: string }>,
) => {
  const { doc: encoded = '', title = '', markdown = '' } = req.body ?? {};
  if (!title.trim() || !markdown.trim()) {
    res.status(400).json({ error: 'A title and some content are needed' });
    return;
  }
  const doc = new Y.Doc();
  let built: Y.Doc | null = null;
  try {
    try {
      if (encoded) {
        Y.applyUpdate(doc, Buffer.from(encoded, 'base64'));
      }
    } catch (e) {
      logger('Invalid document:', e);
      res.status(400).json({ error: 'Invalid document' });
      return;
    }
    const before = Y.encodeStateVector(doc);
    // A toggle heading 3, as the owner chose for input from assistants
    const toggle: DocsPartialBlock = {
      type: 'heading',
      props: { level: 3, isToggleable: true },
      content: [{ type: 'text', text: title.trim(), styles: {} }],
      children: await editor.tryParseMarkdownToBlocks(markdown),
    };
    // The toggle built on its own, then copied into the page
    built = editor.blocksToYDoc([toggle], FRAGMENT);
    const builtGroup = built.getXmlFragment(FRAGMENT).get(0) as Y.XmlElement;
    const page = doc.getXmlFragment(FRAGMENT);
    doc.transact(() => {
      const group = page.get(0);
      if (!(group instanceof Y.XmlElement)) {
        page.insert(0, [builtGroup.clone()]);
        return;
      }
      const container = (builtGroup.get(0) as Y.XmlElement).clone();
      const last = group.get(group.length - 1);
      if (last instanceof Y.XmlElement && isEmptyParagraph(last)) {
        group.insert(group.length - 1, [container]);
      } else {
        group.push([container]);
      }
    });
    res
      .status(200)
      .setHeader('content-type', 'application/octet-stream')
      .send(Buffer.from(Y.encodeStateAsUpdate(doc, before)));
  } catch (e) {
    Sentry.captureException(e, { tags: { handler: 'append-toggle' } });
    logger('append-toggle failed:', e);
    res.status(500).json({ error: 'An error occurred' });
  } finally {
    doc.destroy();
    built?.destroy();
  }
};
