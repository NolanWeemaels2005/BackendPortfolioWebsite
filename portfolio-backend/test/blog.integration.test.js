import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import BlogPost from '../src/models/BlogPost.js';
import blogRoutes from '../src/routes/blogRoutes.js';
test('model ondersteunt veel afbeeldingen en videos zonder aantallimiet', () => {
  const post=new BlogPost({title:'Test',slug:'test',media:Array.from({length:150},(_,i)=>({url:`https://example.com/${i}`,publicId:String(i),type:i%2?'video':'image',role:'process'}))});
  assert.equal(post.validateSync(),undefined);
  assert.equal(post.media.length,150);
});
test('concepten blijven privé en schrijfroutes vereisen login', async () => {
  const original=BlogPost.findOne;
  let query;
  BlogPost.findOne=async filter=>{query=filter;return null;};
  const app=express();app.use(express.json());app.use('/api/blog',blogRoutes);
  const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}/api/blog`;
  try {
    const response=await fetch(`${base}/een-concept`);
    assert.equal(response.status,404);
    assert.deepEqual(query,{slug:'een-concept',status:'published'});
    for(const [method,path] of [['POST',''],['PUT','/507f1f77bcf86cd799439011'],['DELETE','/507f1f77bcf86cd799439011'],['POST','/507f1f77bcf86cd799439011/media'],['GET','/admin']]) {
      assert.equal((await fetch(base+path,{method})).status,401);
    }
  } finally {BlogPost.findOne=original;await new Promise(resolve=>server.close(resolve));}
});
