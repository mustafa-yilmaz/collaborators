import request from 'supertest';
import { describe, expect, test, vi } from 'vitest';
import * as Y from 'yjs';

vi.mock('../src/env', async (importOriginal) => {
  return {
    ...(await importOriginal()),
    COLLABORATION_SERVER_ORIGIN: 'http://localhost:3000',
  };
});

import { editor } from '@/handlers';
import { initApp } from '@/servers';

import { JWKS_URL } from '../src/env';

import { mockJwksEndpoint, signAdminToken } from './testUtils/adminJwt';

const apiKey = await signAdminToken();
const TITLE = 'Input from Ada (ada@example.org) · via Claude · 26 Oct 2026';

const pageOf = async (markdown: string) =>
  editor.blocksToYDoc(
    await editor.tryParseMarkdownToBlocks(markdown),
    'document-store',
  );

const append = (body: object) => {
  mockJwksEndpoint(JWKS_URL);
  return request(initApp())
    .post('/api/append-toggle/')
    .set('authorization', `Bearer ${apiKey}`)
    .send(body)
    .buffer(true)
    .parse((res, callback) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => callback(null, Buffer.concat(chunks)));
    });
};

describe('append-toggle', () => {
  test('adds a toggle heading 3 at the end of the page', async () => {
    const page = await pageOf('# Plan\n\nFirst paragraph.');
    const response = await append({
      doc: Buffer.from(Y.encodeStateAsUpdate(page)).toString('base64'),
      title: TITLE,
      markdown: '## Summary\n\n- one\n- two',
    });

    expect(response.status).toBe(200);
    Y.applyUpdate(page, response.body as Buffer);
    const blocks = editor.yDocToBlocks(page, 'document-store');
    const toggle = blocks[blocks.length - 1];
    expect(blocks[0].type).toBe('heading');
    expect(toggle.type).toBe('heading');
    expect(toggle.props).toMatchObject({ level: 3, isToggleable: true });
    expect(toggle.content).toEqual([{ type: 'text', text: TITLE, styles: {} }]);
    expect(toggle.children.map((child) => child.type)).toEqual([
      'heading',
      'bulletListItem',
      'bulletListItem',
    ]);
  });

  test('the update only adds: concurrent edits merge with it', async () => {
    const page = await pageOf('Shared text.');
    const state = Y.encodeStateAsUpdate(page);
    const response = await append({
      doc: Buffer.from(state).toString('base64'),
      title: TITLE,
      markdown: 'Added.',
    });
    // Someone edits meanwhile, in another copy of the page
    const other = new Y.Doc();
    Y.applyUpdate(other, state);
    const group = other.getXmlFragment('document-store').get(0) as Y.XmlElement;
    const paragraph = (group.get(0) as Y.XmlElement).get(0) as Y.XmlElement;
    (paragraph.get(0) as Y.XmlText).insert(0, 'Edited. ');

    Y.applyUpdate(other, response.body as Buffer);

    const blocks = editor.yDocToBlocks(other, 'document-store');
    expect(JSON.stringify(blocks[0].content)).toContain('Edited. Shared text.');
    expect(blocks[blocks.length - 1].props).toMatchObject({
      level: 3,
      isToggleable: true,
    });
  });

  test('an empty page gets the toggle as its first block', async () => {
    const response = await append({ doc: '', title: TITLE, markdown: 'Hi.' });

    const page = new Y.Doc();
    Y.applyUpdate(page, response.body as Buffer);
    const blocks = editor.yDocToBlocks(page, 'document-store');
    expect(blocks.map((block) => block.type)).toEqual(['heading']);
  });

  test('a title and some content are needed; the backend only', async () => {
    expect((await append({ doc: '', title: '', markdown: 'x' })).status).toBe(
      400,
    );
    mockJwksEndpoint(JWKS_URL);
    const anonymous = await request(initApp())
      .post('/api/append-toggle/')
      .send({ title: TITLE, markdown: 'x' });
    expect(anonymous.status).toBe(401);
  });
});
