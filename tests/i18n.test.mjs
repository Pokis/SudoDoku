import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCALES, translate } from '../src/i18n.js';
import { ACADEMY_LESSONS } from '../src/academy.js';

test('all advertised languages resolve core interface text', () => {
  const coreKeys = ['languageLaunch.title', 'languageLaunch.lead', 'languageLaunch.selected', 'languageLaunch.continue', 'languageLaunch.changeAnytime', 'intro.title', 'settings.language', 'game.newGame', 'tools.hint', 'daily.today', 'result.share', 'stats.title', 'mode.killer', 'mode.hyper', 'mode.mini', 'mode.zen', 'replay.title', 'quest.weekly', 'pwa.title', 'pwa.updateNow', 'academy.title', 'academy.rules.title', 'academy.rules.start', 'academy.nakedPair.title', 'backup.title', 'backup.restore', 'dedication.madeFor', 'dedication.footer', 'mainMenu.welcome', 'mainMenu.open', 'toast.smartNotesOn', 'toast.smartNotesOff'];
  for (const { code } of LOCALES) {
    for (const key of coreKeys) assert.notEqual(translate(code, key), key, `${code} should resolve ${key}`);
  }
});

test('Lithuanian localization covers onboarding and gameplay', () => {
  assert.equal(translate('lt', 'languageLaunch.title'), 'Pasirink savo kalbą');
  assert.equal(translate('lt', 'languageLaunch.selected', { language:'Lietuvių' }), 'Pasirinkta: Lietuvių');
  assert.match(translate('lt', 'intro.title'), /Mąstyk/);
  assert.equal(translate('lt', 'game.newGame'), 'Naujas žaidimas');
  assert.equal(translate('lt', 'tools.hint'), 'Užuomina');
  assert.equal(translate('lt', 'settings.language'), 'Kalba');
  assert.match(translate('lt', 'dedication.madeFor'), /Edmund/);
});

test('the Edmundas dedication is explicit in the primary experience', () => {
  assert.match(translate('en', 'dedication.madeFor'), /Edmundas/);
  assert.match(translate('en', 'dedication.footer'), /Edmundas/);
  assert.match(translate('en', 'mainMenu.welcome'), /Edmundas/);
  assert.match(translate('lt', 'mainMenu.forEdmundas'), /Edmundui/);
  assert.match(translate('en', 'share.cardFooter'), /Edmundas/);
});

test('English and Lithuanian cover the complete achievement collection', () => {
  const achievementIds = [
    'first-flow','clean-grid','pure-logic','daily-devotion','streak-three','speed-focus','explorer','mini-sprint',
    'expert-mind','perfect-ten','killer-adept','hyper-architect','zen-master','variant-voyager','logic-fifty',
    'expert-pure','weekly-ten','daily-thirty','century','perfect-century','logic-legend','weekly-fifty',
    'level-twenty-five','deep-focus','daily-century','year-of-focus','grandmaster','level-fifty',
    'night-owl','close-call','no-pencil','patient-mind',
    'academy-initiate','academy-scholar','fish-school','academy-master','pattern-voyager','logical-guide','technique-librarian','deduction-sage',
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
    for (const { id:technique, level } of ACADEMY_LESSONS) {
      assert.notEqual(translate(locale, `academy.level.${level}`), `academy.level.${level}`);
      for (const suffix of ['title', 'intro', 'step1', 'step2', 'step3', 'question', 'success']) {
        const key = `academy.${technique}.${suffix}`;
        assert.notEqual(translate(locale, key), key);
      }
    }
  }
});

test('English and Lithuanian include the complete Sudoku rules primer', () => {
  const suffixes = ['short','nav','eyebrow','title','lead','goalTitle','goalText','rowTitle','rowText','columnTitle','columnText','boxTitle','boxText','notesTitle','notesText','start'];
  for (const locale of ['en', 'lt']) {
    for (const suffix of suffixes) {
      const key = `academy.rules.${suffix}`;
      assert.notEqual(translate(locale, key), key);
    }
  }
});

test('English and Lithuanian explain every supported hint technique', () => {
  for (const locale of ['en', 'lt']) {
    for (const { id } of ACADEMY_LESSONS) {
      assert.notEqual(translate(locale, `technique.${id}.title`), `technique.${id}.title`);
      assert.notEqual(translate(locale, `technique.${id}.text`), `technique.${id}.text`);
    }
  }
});
