import test from 'node:test';
import assert from 'node:assert/strict';
import { publicationErrors } from '../src/services/blogValidation.js';

const complete = () => ({
  title: 'Hoe ik mijn licht instelde', summary: 'Zo maak je hard licht.', context: 'Een testshoot.',
  process: 'Ik testte twee opstellingen.', learning: 'Plaats de flitser hoger.', reflection: 'Ik volgde de feedback.',
  sources: 'Eigen testshoot.', aiUsed: false,
  media: [{ type: 'image', role: 'before' }, { type: 'image', role: 'after' }]
});
test('publicatie vereist de kernonderdelen, maar planning is optioneel', () => {
  assert.deepEqual(publicationErrors(complete()), []);
  for (const field of ['title','summary','context','process','learning','reflection','sources']) {
    assert.ok(publicationErrors({...complete(), [field]: ''}).some(error => error.includes(field)));
  }
});
test('voor en na moeten afbeeldingen zijn; video alleen voldoet niet', () => {
  const post=complete(); post.media[0].type='video';
  assert.ok(publicationErrors(post).some(error=>error.includes('voor-afbeelding')));
});
test('AI-gebruik vereist zowel machine- als eigen bijdrage', () => {
  assert.equal(publicationErrors({...complete(), aiUsed:true}).length,1);
  assert.deepEqual(publicationErrors({...complete(), aiUsed:true, aiContribution:'Varianten',humanContribution:'Selectie en afwerking'}),[]);
});
