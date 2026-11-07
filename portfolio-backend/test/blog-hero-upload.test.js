import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import BlogPost from '../src/models/BlogPost.js';
import User from '../src/models/User.js';
import cloudinary from '../src/config/cloudinary.js';
import routes from '../src/routes/blogRoutes.js';
import { access } from 'node:fs/promises';

test('dedicated hero multipart upload keeps image separate and rejects video and body placement', async () => {
 const post=new BlogPost({title:'Test',slug:'test',media:[]});
 const original={find:BlogPost.findById,update:BlogPost.findByIdAndUpdate,user:User.findById,upload:cloudinary.uploader.upload,destroy:cloudinary.uploader.destroy,secret:process.env.JWT_SECRET};
 process.env.JWT_SECRET='test-only';let uploadedPath;let uploads=0;let fail=false;let cleanups=0;
 BlogPost.findById=async()=>post;User.findById=()=>({select:async()=>({id:'test'})});
 cloudinary.uploader.upload=async path=>{uploadedPath=path;uploads++;return {secure_url:'https://example.com/hero.jpg',public_id:'hero',resource_type:'image'};};
 cloudinary.uploader.destroy=async()=>{cleanups++;};
 BlogPost.findByIdAndUpdate=async(id,update)=>{if(fail)throw new Error('test failure');post.media.push(update.$push.media);return post;};
 post.save=async()=>post;
 const app=express();app.use(express.json());app.use('/api/blog',routes);app.use((err,req,res,next)=>res.status(500).json({message:err.message}));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const base=`http://127.0.0.1:${server.address().port}/api/blog/${post.id}`;
 const headers={Authorization:`Bearer ${jwt.sign({id:'test'},process.env.JWT_SECRET)}`};
 async function upload(type,heroOnly){const body=new FormData();body.append('file',new Blob(['test'],{type}),type.startsWith('image')?'hero.jpg':'movie.mp4');if(heroOnly!==undefined)body.append('heroOnly',heroOnly);return fetch(`${base}/media`,{method:'POST',headers,body});}
 try{
  assert.equal((await upload('video/mp4','true')).status,400);assert.equal(uploads,0);
  assert.equal((await upload('image/jpeg','invalid')).status,400);assert.equal(uploads,0);
  let response=await upload('image/jpeg','true');assert.equal(response.status,201);
  let body=await response.json();assert.equal(body.media[0].heroOnly,true);assert.equal(body.heroMediaId,'');
  await assert.rejects(access(uploadedPath));
  response=await fetch(base,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({heroMediaId:body.media[0]._id})});assert.equal(response.status,200);assert.equal((await response.json()).heroMediaId,post.media[0].id);
  response=await fetch(base,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({mediaLayout:[{mediaId:post.media[0].id,section:'process'}]})});assert.equal(response.status,400);
  response=await upload('image/jpeg');assert.equal(response.status,201);body=await response.json();assert.equal(body.media[1].heroOnly,false);
  fail=true;assert.equal((await upload('image/jpeg','true')).status,500);assert.equal(cleanups,1);await assert.rejects(access(uploadedPath));
 }finally{BlogPost.findById=original.find;BlogPost.findByIdAndUpdate=original.update;User.findById=original.user;cloudinary.uploader.upload=original.upload;cloudinary.uploader.destroy=original.destroy;if(original.secret===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=original.secret;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
