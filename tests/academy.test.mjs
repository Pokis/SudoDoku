import test from 'node:test';
import assert from 'node:assert/strict';
import { ACADEMY_LESSONS, getAcademyLesson, isAcademyAnswer } from '../src/academy.js';

test('academy lessons use real positions detected by the hint engine', () => {
  assert.equal(ACADEMY_LESSONS.length, 4);
  for (const lesson of ACADEMY_LESSONS) {
    const model = getAcademyLesson(lesson.id);
    assert.equal(model.board.length, 81);
    assert.equal(model.solution.length, 81);
    assert.equal(model.hint.technique, lesson.id);
    assert.ok(model.hint.cells.length >= 1);
    assert.equal(isAcademyAnswer(lesson.id, lesson.answer), true);
  }
});

test('academy rejects plausible but incorrect answers', () => {
  for (const lesson of ACADEMY_LESSONS) {
    const wrong = lesson.choices.find((choice) => choice !== lesson.answer);
    assert.equal(isAcademyAnswer(lesson.id, wrong), false);
  }
});
