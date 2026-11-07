import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import BlogPost from '../src/models/BlogPost.js';
import User from '../src/models/User.js';
import cloudinary from '../src/config/cloudinary.js';
import routes from '../src/routes/blogRoutes.js';

test('hero selection validates ownership and image type, persists, clears and follows deletion', async () => {
  const post = new BlogPost({ title: 'Hero', slug: 'hero', media: [
    { url: 'https://example.com/a.jpg', publicId: 'a', type: 'image' },
    { url: 'https://example.com/b.mp4', publicId: 'b', type: 'video' }
  ] });
  assert.equal(post.heroMediaId, '');
  const originals = { find: BlogPost.findById, user: User.findById, destroy: cloudinary.uploader.destroy, secret: process.env.JWT_SECRET };
  process.env.JWT_SECRET = 'local-test-secret';
  let saves = 0;
  post.save = async () => { saves++; assert.equal(post.validateSync(), undefined); return post; };
  BlogPost.findById = async () => post;
  User.findById = () => ({ select: async () => ({ id: 'test-user' }) });
  cloudinary.uploader.destroy = async () => ({ result: 'ok' });
  const app = express(); app.use(express.json()); app.use('/api/blog', routes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/blog/${post.id}`;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt.sign({ id: 'test-user' }, process.env.JWT_SECRET)}` };
  const put = heroMediaId => fetch(url, { method: 'PUT', headers, signal: AbortSignal.timeout(5000), body: JSON.stringify({ heroMediaId }) });
  try {
    for (const value of [null, 123, {}, '507f1f77bcf86cd799439011', post.media[1].id]) assert.equal((await put(value)).status, 400);
    assert.equal(saves, 0);
    const imageId = post.media[0].id;
    assert.equal((await (await put(imageId)).json()).heroMediaId, imageId);
    assert.equal((await (await fetch(url.replace(post.id, `admin/${post.id}`), { headers, signal: AbortSignal.timeout(5000) })).json()).heroMediaId, imageId);
    assert.equal((await (await put('')).json()).heroMediaId, '');
    await put(imageId);
    const removed = await fetch(`${url}/media/${imageId}`, { method: 'DELETE', headers, signal: AbortSignal.timeout(5000) });
    assert.equal(removed.status, 200);
    const body = await removed.json();
    assert.equal(body.heroMediaId, '');
    assert.equal(body.media.length, 1);
  } finally {
    BlogPost.findById = originals.find; User.findById = originals.user; cloudinary.uploader.destroy = originals.destroy;
    if (originals.secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originals.secret;
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
});
