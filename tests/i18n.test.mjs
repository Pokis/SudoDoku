import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCALES, translate } from '../src/i18n.js';

test('all advertised languages resolve core interface text', () => {
  const coreKeys = ['intro.title', 'settings.language', 'game.newGame', 'tools.hint', 'daily.today', 'result.share', 'stats.title', 'mode.killer', 'mode.hyper', 'mode.mini', 'mode.zen', 'replay.title', 'quest.weekly', 'pwa.title', 'pwa.updateNow', 'academy.title', 'academy.nakedPair.title', 'backup.title', 'backup.restore', 'dedication.madeFor', 'dedication.footer'];
  for (const { code } of LOCALES) {
    for (const key of coreKeys) assert.notEqual(translate(code, key), key, `${code} should resolve ${key}`);
  }
});

test('Lithuanian localization covers onboarding and gameplay', () => {
  assert.match(translate('lt', 'intro.title'), /Mąstyk/);
  assert.equal(translate('lt', 'game.newGame'), 'Naujas žaidimas');
  assert.equal(translate('lt', 'tools.hint'), 'Užuomina');
  assert.equal(translate('lt', 'settings.language'), 'Kalba');
  assert.match(translate('lt', 'dedication.madeFor'), /Edmund/);
});

test('the Edmundas dedication is explicit in the primary experience', () => {
  assert.match(translate('en', 'dedication.madeFor'), /Edmundas/);
  assert.match(translate('en', 'dedication.footer'), /Edmundas/);
  assert.match(translate('en', 'share.cardFooter'), /Edmundas/);
});

test('English and Lithuanian cover the complete achievement collection', () => {
  const achievementIds = [
    'first-flow','clean-grid','pure-logic','daily-devotion','streak-three','speed-focus','explorer','mini-sprint',
    'expert-mind','perfect-ten','killer-adept','hyper-architect','zen-master','variant-voyager','logic-fifty',
    'expert-pure','weekly-ten','daily-thirty','century','perfect-century','logic-legend','weekly-fifty',
    'level-twenty-five','deep-focus','daily-century','year-of-focus','grandmaster','level-fifty',
    'night-owl','close-call','no-pencil','patient-mind',
  ];
  for (const locale of ['en', 'lt']) {
    for (const id of achievementIds) {
      assert.notEqual(translate(locale, `achievement.${id}`), `achievement.${id}`);
      assert.notEqual(translate(locale, `achievement.${id}.desc`), `achievement.${id}.desc`);
    }
  }
});

test('translation variables are interpolated', () => {
  assert.equal(translate('lt', 'game.progressText', { count: 42 }), '42 iš 81 langelio');
});

test('English and Lithuanian cover every Academy lesson', () => {
  for (const locale of ['en', 'lt']) {
    for (const technique of ['nakedSingle', 'hiddenSingle', 'nakedPair', 'xWing']) {
      for (const suffix of ['title', 'intro', 'step1', 'step2', 'step3', 'question', 'success']) {
        const key = `academy.${technique}.${suffix}`;
        assert.notEqual(translate(locale, key), key);
      }
    }
  }
});
