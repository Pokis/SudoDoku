import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const baseUrl = process.env.SUDODOKU_URL || 'http://127.0.0.1:4173/';
const outputDir = resolve(process.argv[2] || 'artifacts');
const profileDir = resolve(tmpdir(), `sudodoku-browser-smoke-${process.pid}`);
const chrome = process.env.CHROME_BIN || (process.platform === 'win32'
  ? ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(existsSync)
  : 'google-chrome');
assert.ok(chrome, 'Chrome or Edge is required for browser smoke tests');

await mkdir(outputDir, { recursive:true });
await rm(profileDir, { recursive:true, force:true });

const browser = spawn(chrome, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--remote-debugging-port=0',
  `--user-data-dir=${profileDir}`, '--window-size=1440,1000', baseUrl,
], { stdio:['ignore', 'ignore', 'pipe'], windowsHide:true });

function debuggingUrl() {
  return new Promise((resolveUrl, reject) => {
    const timeout = setTimeout(() => reject(new Error('Chrome DevTools endpoint did not start')), 12000);
    browser.stderr.on('data', (chunk) => {
      const match = String(chunk).match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timeout); resolveUrl(match[1]); }
    });
    browser.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`Chrome exited early (${code})`)); });
  });
}

class Cdp {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.id = 0;
    this.pending = new Map();
    this.waiters = new Map();
    this.socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(String(data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) pending?.reject(new Error(message.error.message)); else pending?.resolve(message.result);
      } else if (message.method) {
        const waiters = this.waiters.get(message.method) || [];
        this.waiters.delete(message.method);
        waiters.forEach((resolveEvent) => resolveEvent(message.params));
      }
    });
  }
  ready() {
    if (this.socket.readyState === WebSocket.OPEN) return Promise.resolve();
    return new Promise((resolveReady, reject) => {
      this.socket.addEventListener('open', resolveReady, { once:true });
      this.socket.addEventListener('error', reject, { once:true });
    });
  }
  call(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolveCall, reject) => {
      this.pending.set(id, { resolve:resolveCall, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  event(method) {
    return new Promise((resolveEvent, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${method}`)), 10000);
      const wrapped = (value) => { clearTimeout(timeout); resolveEvent(value); };
      this.waiters.set(method, [...(this.waiters.get(method) || []), wrapped]);
    });
  }
  close() { this.socket.close(); }
}

const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
let cdp;
try {
  const browserWs = await debuggingUrl();
  const devtoolsOrigin = browserWs.replace(/^ws:/, 'http:').replace(/\/devtools\/browser\/.*$/, '');
  let page;
  for (let attempt = 0; attempt < 30 && !page; attempt += 1) {
    const targets = await fetch(`${devtoolsOrigin}/json/list`).then((response) => response.json());
    page = targets.find((target) => target.type === 'page' && target.url.startsWith(baseUrl));
    if (!page) await delay(100);
  }
  assert.ok(page, 'Sudodoku page target was not created');
  cdp = new Cdp(page.webSocketDebuggerUrl);
  await cdp.ready();
  await cdp.call('Page.enable');
  await cdp.call('Runtime.enable');

  const evaluate = async (expression, awaitPromise = false) => {
    const result = await cdp.call('Runtime.evaluate', { expression, awaitPromise, returnByValue:true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Browser evaluation failed');
    return result.result.value;
  };
  const waitFor = async (expression) => {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (await evaluate(expression)) return;
      await delay(100);
    }
    throw new Error(`Browser condition timed out: ${expression}`);
  };
  const screenshot = async (name) => {
    const { data } = await cdp.call('Page.captureScreenshot', { format:'png', captureBeyondViewport:false });
    await writeFile(resolve(outputDir, name), Buffer.from(data, 'base64'));
  };

  await waitFor("document.querySelectorAll('.cell').length > 0");
  await waitFor("!document.querySelector('#languageLaunch').hidden");
  const languageLaunch = await evaluate(`(() => ({
    title:document.title,
    visible:!document.querySelector('#languageLaunch').hidden,
    introHidden:document.querySelector('#introCard').hidden,
    choices:document.querySelectorAll('#languageChoiceGrid [data-language]').length,
    selected:document.querySelector('#languageChoiceGrid [aria-checked="true"]')?.dataset.language,
    installButtons:document.querySelectorAll('[data-install-app]').length,
    introInstallVisible:!document.querySelector('.intro-install-button').hidden,
    introInstallText:document.querySelector('.intro-install-button').textContent.trim()
  }))()`);
  assert.match(languageLaunch.title, /Edmundas/);
  assert.equal(languageLaunch.visible, true, 'First launch must begin with a dedicated language page');
  assert.equal(languageLaunch.introHidden, true, 'The introduction must wait until language is confirmed');
  assert.equal(languageLaunch.choices, 5, 'Every supported language must be clearly offered');
  assert.ok(languageLaunch.selected, 'The detected language must be visibly preselected');
  assert.equal(languageLaunch.installButtons, 3, 'Install access must remain explicit across onboarding, menu, and gameplay');
  assert.equal(languageLaunch.introInstallVisible, true, 'The PWA install action must be visible from first launch');
  assert.match(languageLaunch.introInstallText, /install/i);
  await delay(700);
  await screenshot('desktop-language-selection-1440x1000.png');
  await cdp.call('Emulation.setDeviceMetricsOverride', { width:390, height:844, deviceScaleFactor:1, mobile:true });
  await delay(250);
  const mobileLanguageLaunch = await evaluate(`(() => {
    const gate = document.querySelector('#languageLaunch').getBoundingClientRect();
    const continueButton = document.querySelector('#languageContinue').getBoundingClientRect();
    return {
      width:gate.width,
      left:gate.left,
      choices:document.querySelectorAll('#languageChoiceGrid [data-language]').length,
      continueVisible:continueButton.top >= 0 && continueButton.bottom <= innerHeight,
      horizontalOverflow:document.documentElement.scrollWidth > innerWidth
    };
  })()`);
  assert.equal(mobileLanguageLaunch.choices, 5);
  assert.ok(mobileLanguageLaunch.width >= 389 && Math.abs(mobileLanguageLaunch.left) < 1, 'The first-launch page must fill a phone viewport');
  assert.equal(mobileLanguageLaunch.continueVisible, true, 'Language confirmation must be visible without hunting on a standard phone');
  assert.equal(mobileLanguageLaunch.horizontalOverflow, false, 'The mobile language page must not overflow horizontally');
  await screenshot('mobile-language-selection-390x844.png');
  await cdp.call('Emulation.setDeviceMetricsOverride', { width:1440, height:1000, deviceScaleFactor:1, mobile:false });
  await delay(150);
  const lithuanianChoice = await evaluate(`(() => {
    document.querySelector('#languageChoiceGrid [data-language="lt"]').click();
    return {
      locale:document.documentElement.lang,
      selected:document.querySelector('#languageChoiceGrid [data-language="lt"]').getAttribute('aria-checked'),
      heading:document.querySelector('#languageLaunchTitle').textContent.trim(),
      current:document.querySelector('#languageLaunchCurrent').textContent.trim()
    };
  })()`);
  assert.equal(lithuanianChoice.locale, 'lt', 'Choosing Lithuanian must translate the page immediately');
  assert.equal(lithuanianChoice.selected, 'true');
  assert.match(lithuanianChoice.heading, /Pasirink savo kalbą/);
  assert.match(lithuanianChoice.current, /Lietuvių/);
  const confirmedLanguage = await evaluate(`(() => {
    document.querySelector('#languageContinue').click();
    const prefs = JSON.parse(localStorage.getItem('sudodoku-prefs-v1'));
    return {
      gateHidden:document.querySelector('#languageLaunch').hidden,
      introVisible:!document.querySelector('#introCard').hidden,
      introLanguage:document.querySelector('#introLanguage').value,
      dedication:document.querySelector('.intro-dedication strong').textContent.trim(),
      language:prefs.language,
      confirmed:prefs.languageConfirmed
    };
  })()`);
  assert.equal(confirmedLanguage.gateHidden, true);
  assert.equal(confirmedLanguage.introVisible, true);
  assert.equal(confirmedLanguage.introLanguage, 'lt');
  assert.match(confirmedLanguage.dedication, /Edmund/);
  assert.equal(confirmedLanguage.language, 'lt');
  assert.equal(confirmedLanguage.confirmed, true, 'The explicit language confirmation must persist');
  await delay(300);
  await screenshot('desktop-dedication-intro-1440x1000.png');
  await evaluate("navigator.serviceWorker.ready.then(() => true)", true);
  await evaluate("localStorage.setItem('sudodoku-prefs-v1', JSON.stringify({ onboarded:true, languageConfirmed:true, language:'en', academyRulesSeen:false }))");
  const loaded = cdp.event('Page.loadEventFired');
  await cdp.call('Page.navigate', { url:baseUrl });
  await loaded;
  await waitFor("document.querySelectorAll('.cell').length > 0 && document.querySelector('#introScreen').hidden && !document.querySelector('#mainMenu').hidden");
  const mainMenu = await evaluate(`(() => ({
    visible:!document.querySelector('#mainMenu').hidden,
    welcome:document.querySelector('#mainMenuTitle').textContent.trim(),
    personal:document.querySelector('.main-menu-hero .eyebrow').textContent.trim(),
    dedication:document.querySelector('.main-menu-dedication span').textContent.trim(),
    modes:document.querySelectorAll('[data-menu-mode]').length,
    menuButton:!!document.querySelector('#gameMenuButton'),
    achievements:document.querySelectorAll('#achievementList .achievement-card').length,
    installVisible:!document.querySelector('.main-menu-header [data-install-app]').hidden
  }))()`);
  assert.equal(mainMenu.visible, true, 'Returning players must land on the main menu');
  assert.doesNotMatch(mainMenu.welcome, /Edmund/i, 'The returning greeting must not identify the player as Edmundas');
  assert.doesNotMatch(mainMenu.personal, /Edmund/i, 'The player space must remain neutral for every user');
  assert.match(mainMenu.dedication, /Edmundas/, 'Edmundas must remain credited in the separate dedication badge');
  assert.equal(mainMenu.modes, 6, 'The main menu must expose all six game modes');
  assert.equal(mainMenu.menuButton, true, 'Gameplay must provide an explicit main-menu action');
  assert.equal(mainMenu.achievements, 40, 'The complete achievement collection must render');
  assert.equal(mainMenu.installVisible, true, 'The main menu must expose the PWA install action');
  const installAction = await evaluate(`new Promise((resolve) => {
    const promptEvent = new Event('beforeinstallprompt');
    promptEvent.prompt = () => { window.__sudodokuInstallPrompted = true; };
    promptEvent.userChoice = Promise.resolve({ outcome:'dismissed' });
    window.dispatchEvent(promptEvent);
    const button = document.querySelector('.main-menu-header [data-install-app]');
    const ready = button.classList.contains('install-ready');
    button.click();
    setTimeout(() => resolve({ ready, prompted:window.__sudodokuInstallPrompted === true, enabled:!button.disabled }), 80);
  })`, true);
  assert.deepEqual(installAction, { ready:true, prompted:true, enabled:true }, 'The visible install button must invoke and recover from the native PWA prompt');
  const controlled = await evaluate(`new Promise((resolve) => {
    if (navigator.serviceWorker.controller) { resolve(true); return; }
    navigator.serviceWorker.addEventListener('controllerchange', () => resolve(true), { once:true });
    setTimeout(() => resolve(!!navigator.serviceWorker.controller), 4000);
  })`, true);
  if (!controlled) {
    const details = await evaluate("navigator.serviceWorker.getRegistration().then((registration) => ({ scope:registration?.scope, active:registration?.active?.state, waiting:registration?.waiting?.state, installing:registration?.installing?.state, controller:!!navigator.serviceWorker.controller }))", true);
    console.error('Service worker diagnostic:', details);
  }
  assert.equal(controlled, true, 'Service worker must control the smoke-test page');

  await cdp.call('Emulation.setDeviceMetricsOverride', { width:390, height:844, deviceScaleFactor:1, mobile:true });
  await delay(250);
  await screenshot('mobile-main-menu-390x844.png');
  await evaluate("document.querySelector('#menuContinueButton').click()");
  await waitFor("document.querySelector('#mainMenu').hidden && !document.body.classList.contains('main-menu-open')");
  await delay(300);
  assert.equal(await evaluate("!document.querySelector('.topbar-install-button').hidden"), true, 'Gameplay must keep a compact install action in its toolbar');

  const smartNotesOn = await evaluate(`(() => {
    document.querySelector('#autoNotesButton').click();
    return {
      active:document.querySelector('#autoNotesButton').classList.contains('active'),
      pressed:document.querySelector('#autoNotesButton').getAttribute('aria-pressed'),
      badge:document.querySelector('#autoNotesBadge').textContent.trim(),
      count:[...document.querySelectorAll('.notes')].filter((note) => note.textContent.trim()).length
    };
  })()`);
  assert.equal(smartNotesOn.active, true, 'Smart Notes must visibly switch on');
  assert.equal(smartNotesOn.pressed, 'true', 'Smart Notes must expose its on state accessibly');
  assert.match(smartNotesOn.badge, /on/i);
  assert.ok(smartNotesOn.count > 0, 'Smart Notes must populate candidates');
  const smartNotesOff = await evaluate(`(() => {
    document.querySelector('#autoNotesButton').click();
    return {
      active:document.querySelector('#autoNotesButton').classList.contains('active'),
      pressed:document.querySelector('#autoNotesButton').getAttribute('aria-pressed'),
      badge:document.querySelector('#autoNotesBadge').textContent.trim(),
      count:[...document.querySelectorAll('.notes')].filter((note) => note.textContent.trim()).length
    };
  })()`);
  assert.equal(smartNotesOff.active, false, 'Smart Notes must switch off');
  assert.equal(smartNotesOff.pressed, 'false', 'Smart Notes must expose its off state accessibly');
  assert.match(smartNotesOff.badge, /off/i);
  assert.equal(smartNotesOff.count, 0, 'Turning Smart Notes off must clear generated candidates');

  const notes = await evaluate(`(() => {
    const cell = [...document.querySelectorAll('.cell')].find((item) => !item.classList.contains('given'));
    cell.click(); document.querySelector('#notesButton').click(); document.querySelector('.number-button').click();
    const selected = document.querySelector('.cell.selected'); const note = selected.querySelector('.notes');
    return { hasNote:note.textContent.trim().length > 0, noteColor:getComputedStyle(note).color, selectedColor:getComputedStyle(selected).backgroundColor };
  })()`);
  assert.equal(notes.hasNote, true, 'A note must remain visible while its cell is selected');
  assert.notEqual(notes.noteColor, notes.selectedColor, 'Selected notes need distinct contrast');
  await screenshot('mobile-gameplay-390x844.png');

  const hint = await evaluate(`(() => {
    document.querySelector('#hintButton').click();
    return { coach:document.querySelector('#hintCoach').classList.contains('visible'), highlighted:!!document.querySelector('.hint-revealed,.hint-pattern,.hint-elimination') };
  })()`);
  assert.equal(hint.coach, true, 'Hint coach must become visible');
  assert.equal(hint.highlighted, true, 'A hint must visibly highlight its board context');

  await evaluate("document.querySelector('#settingsButton').click()");
  await delay(200);
  await screenshot('mobile-edmundas-settings-390x844.png');
  const settingsLanguageSwitch = await evaluate(`(() => {
    const select = document.querySelector('#settingsLanguage');
    select.value = 'de';
    select.dispatchEvent(new Event('change', { bubbles:true }));
    const changedLocale = document.documentElement.lang;
    const changedPreference = JSON.parse(localStorage.getItem('sudodoku-prefs-v1')).language;
    select.value = 'en';
    select.dispatchEvent(new Event('change', { bubbles:true }));
    return {
      changedLocale,
      changedPreference,
      restoredLocale:document.documentElement.lang,
      restoredPreference:JSON.parse(localStorage.getItem('sudodoku-prefs-v1')).language
    };
  })()`);
  assert.deepEqual(settingsLanguageSwitch, { changedLocale:'de', changedPreference:'de', restoredLocale:'en', restoredPreference:'en' }, 'Settings must keep language switching available and persistent');
  const lockedNotice = await evaluate(`(() => {
    const lockedTheme = document.querySelector('.theme-option.locked');
    const lockedStyle = document.querySelector('.style-option.locked');
    lockedTheme.click();
    const toast = document.querySelector('#toast');
    const dialog = document.querySelector('#settingsDialog');
    const themeParent = toast.parentElement?.id;
    const themeMessage = toast.textContent.trim();
    lockedStyle.click();
    const rect = toast.getBoundingClientRect();
    return {
      themeParent,
      themeMessage,
      styleParent:toast.parentElement?.id,
      styleMessage:toast.textContent.trim(),
      shown:toast.classList.contains('show'),
      inViewport:rect.bottom > 0 && rect.top < innerHeight,
      dialogOpen:dialog.open
    };
  })()`);
  assert.equal(lockedNotice.themeParent, 'settingsDialog', 'Theme notifications must share the dialog top layer');
  assert.equal(lockedNotice.styleParent, 'settingsDialog', 'Board-style notifications must share the dialog top layer');
  assert.ok(lockedNotice.themeMessage && lockedNotice.styleMessage, 'Locked customization notifications need visible text');
  assert.equal(lockedNotice.shown, true, 'A locked theme or style must show a notification');
  assert.equal(lockedNotice.inViewport, true, 'The settings notification must be inside the viewport');
  assert.equal(lockedNotice.dialogOpen, true);
  await screenshot('mobile-settings-notification-390x844.png');
  await evaluate("document.querySelector('.pwa-center').scrollIntoView({block:'center'})");
  await delay(500);
  const pwa = await evaluate(`(() => ({
    dialog:document.querySelector('#settingsDialog').open,
    cache:document.querySelector('#pwaCache').textContent.trim(),
    version:document.querySelector('#pwaVersion').textContent.trim(),
    serviceWorker:!!navigator.serviceWorker.controller,
    languageOptions:document.querySelectorAll('#settingsLanguage option').length
  }))()`);
  assert.equal(pwa.dialog, true, 'Settings must open on mobile');
  assert.ok(pwa.cache, 'PWA cache diagnostic must be visible');
  assert.match(pwa.version, /^v\d+$/);
  assert.equal(pwa.serviceWorker, true, 'PWA diagnostics must report an active controller');
  assert.equal(pwa.languageOptions, 5, 'Settings must keep every language available after onboarding');
  assert.ok(await evaluate("!!document.querySelector('#backupExportButton') && !!document.querySelector('#backupRestoreButton')"), 'Backup and restore controls must be present');
  assert.match(await evaluate("document.querySelector('.settings-dedication strong').textContent"), /Edmundas/, 'Settings must preserve the personal dedication');
  await screenshot('mobile-pwa-center-390x844.png');

  await evaluate("document.querySelector('#settingsDialog').close()");
  const menuReturn = await evaluate(`(() => {
    document.querySelector('#gameMenuButton').click();
    const opened = !document.querySelector('#mainMenu').hidden;
    document.querySelector('#menuContinueButton').click();
    return { opened, closed:document.querySelector('#mainMenu').hidden };
  })()`);
  assert.deepEqual(menuReturn, { opened:true, closed:true }, 'Players must be able to enter and leave the main menu from a game');
  const academy = await evaluate(`(() => {
    document.querySelector('#academyButton').click();
    return {
      dialog:document.querySelector('#academyDialog').open,
      rules:!document.querySelector('#academyRules').hidden,
      rulesCards:document.querySelectorAll('.academy-rules-grid article').length,
      lessons:document.querySelectorAll('#academyLessonList [data-lesson]').length,
      rulesLink:!!document.querySelector('#academyLessonList [data-academy-rules]')
    };
  })()`);
  assert.equal(academy.dialog, true, 'Technique Academy must open from the game');
  assert.equal(academy.rules, true, 'The short rules primer must appear before the first lesson');
  assert.equal(academy.rulesCards, 4, 'The primer must explain the goal, rows, columns, and boxes');
  assert.equal(academy.lessons, 12);
  assert.equal(academy.rulesLink, true, 'Quick rules must remain available from the lesson list');
  await delay(200);
  await screenshot('mobile-sudoku-rules-390x844.png');
  const firstLesson = await evaluate(`(() => {
    document.querySelector('#academyRulesStart').click();
    const prefs = JSON.parse(localStorage.getItem('sudodoku-prefs-v1'));
    return {
      rulesHidden:document.querySelector('#academyRules').hidden,
      active:document.querySelector('#academyLessonList [data-lesson].active')?.dataset.lesson,
      cells:document.querySelectorAll('#academyBoard .academy-cell').length,
      choices:document.querySelectorAll('#academyChoices button').length,
      remembered:prefs.academyRulesSeen
    };
  })()`);
  assert.equal(firstLesson.rulesHidden, true);
  assert.equal(firstLesson.active, 'nakedSingle');
  assert.equal(firstLesson.remembered, true, 'Completing the primer must persist locally');
  assert.equal(firstLesson.cells, 81);
  assert.equal(firstLesson.choices, 3);
  const academyResult = await evaluate(`(() => {
    document.querySelector('#academyChoices [data-answer="6"]').click();
    const stored = JSON.parse(localStorage.getItem('sudodoku-stats-v1'));
    return { feedback:document.querySelector('#academyFeedback').classList.contains('correct'), completed:stored.academyCompleted.includes('nakedSingle'), discovered:stored.techniquesDiscovered.includes('nakedSingle') };
  })()`);
  assert.equal(academyResult.feedback, true, 'Correct Academy answers need visible feedback');
  assert.equal(academyResult.completed, true, 'Academy mastery must persist locally');
  assert.equal(academyResult.discovered, true, 'Academy lessons must contribute to technique achievements');
  await delay(350);
  await screenshot('mobile-technique-academy-390x844.png');
  const academyPatterns = await evaluate(`(() => Object.fromEntries(['nakedSingle','hiddenSingle','pointingPair','boxLineReduction','nakedPair','hiddenPair','nakedTriple','hiddenTriple','xWing','xyWing','skyscraper','swordfish'].map((id) => {
    document.querySelector('[data-lesson="' + id + '"]').click();
    const board = document.querySelector('#academyBoard').getBoundingClientRect();
    const cell = document.querySelector('#academyBoard .academy-cell').getBoundingClientRect();
    return [id, {
      pattern:document.querySelectorAll('#academyBoard .pattern-cell').length,
      elimination:document.querySelectorAll('#academyBoard .elimination-cell').length,
      boardWidth:board.width, boardHeight:board.height, cellWidth:cell.width, cellHeight:cell.height
    }];
  })))()`);
  assert.deepEqual(Object.values(academyPatterns).map(({ pattern }) => pattern), [1, 1, 3, 3, 2, 2, 3, 3, 4, 3, 4, 7]);
  assert.ok(Object.entries(academyPatterns).filter(([id]) => !['nakedSingle','hiddenSingle'].includes(id)).every(([, pattern]) => pattern.elimination > 0), 'Every elimination lesson must display its targets');
  const boardSizes = Object.values(academyPatterns).map(({ boardWidth, boardHeight }) => [boardWidth, boardHeight]);
  assert.ok(boardSizes.every(([width, height]) => Math.abs(width - height) < 1), 'Every Academy grid must remain square');
  assert.ok(Math.max(...boardSizes.map(([width]) => width)) - Math.min(...boardSizes.map(([width]) => width)) < 1, 'Every Academy grid must render at an equivalent size');
  assert.ok(Object.values(academyPatterns).every(({ cellWidth, cellHeight }) => Math.abs(cellWidth - cellHeight) < 1), 'Academy cells must remain square even with dense candidate notes');
  await delay(100);
  await screenshot('mobile-expert-academy-390x844.png');

  await cdp.call('Emulation.setDeviceMetricsOverride', { width:1440, height:1000, deviceScaleFactor:1, mobile:false });
  await delay(200);
  const desktopAcademySizes = await evaluate(`(() => ['nakedSingle','pointingPair','nakedPair','hiddenTriple','xyWing','swordfish'].map((id) => {
    document.querySelector('[data-lesson="' + id + '"]').click();
    const board = document.querySelector('#academyBoard').getBoundingClientRect();
    const cells = [...document.querySelectorAll('#academyBoard .academy-cell')].map((cell) => cell.getBoundingClientRect());
    return { id, width:board.width, height:board.height, minCellWidth:Math.min(...cells.map((cell) => cell.width)), maxCellWidth:Math.max(...cells.map((cell) => cell.width)), minCellHeight:Math.min(...cells.map((cell) => cell.height)), maxCellHeight:Math.max(...cells.map((cell) => cell.height)) };
  }))()`);
  assert.ok(desktopAcademySizes.every(({ width, height }) => Math.abs(width - height) < 1), 'Desktop Academy grids must remain square');
  assert.ok(Math.max(...desktopAcademySizes.map(({ width }) => width)) - Math.min(...desktopAcademySizes.map(({ width }) => width)) < 1, 'Sparse and candidate-heavy desktop grids must use the same dimensions');
  assert.ok(desktopAcademySizes.every(({ minCellWidth, maxCellWidth, minCellHeight, maxCellHeight }) => maxCellWidth - minCellWidth < 1 && maxCellHeight - minCellHeight < 1), 'Every desktop Academy cell must use equal geometry');
  await evaluate("document.querySelector('[data-lesson=\"nakedPair\"]').click()");
  await screenshot('desktop-equal-academy-grid-1440x1000.png');
  await cdp.call('Emulation.setDeviceMetricsOverride', { width:390, height:844, deviceScaleFactor:1, mobile:true });
  await delay(150);

  const backup = await evaluate(`(() => {
    document.querySelector('#academyDialog').close(); document.querySelector('#settingsButton').click();
    HTMLAnchorElement.prototype.click = function smokeDownload() {};
    document.querySelector('#backupExportButton').click(); document.querySelector('.transfer-center').scrollIntoView({block:'center'});
    return { status:document.querySelector('#backupStatus').dataset.state, summary:document.querySelector('#backupSummary').textContent.trim() };
  })()`);
  assert.equal(backup.status, 'success', 'Backup export must report success');
  assert.ok(backup.summary, 'Backup summary must describe local progress');
  await delay(200);
  await screenshot('mobile-backup-transfer-390x844.png');
  await evaluate(`(async () => {
    const { createBackupPayload } = await import('./src/backup.js');
    const payload = createBackupPayload({
      prefs:JSON.parse(localStorage.getItem('sudodoku-prefs-v1')),
      stats:JSON.parse(localStorage.getItem('sudodoku-stats-v1')),
      game:JSON.parse(localStorage.getItem('sudodoku-game-v1')),
    });
    const transfer = new DataTransfer();
    transfer.items.add(new File([JSON.stringify(payload)], 'smoke.sudodoku', { type:'application/json' }));
    const input = document.querySelector('#backupFileInput'); input.files = transfer.files;
    window.confirm = () => false;
    input.dispatchEvent(new Event('change', { bubbles:true }));
  })()`, true);
  await delay(200);
  assert.match(await evaluate("document.querySelector('#backupStatus').textContent"), /cancel/i, 'Validated restore must reach the replacement confirmation');

  await evaluate("document.querySelector('#settingsDialog').close()");
  await cdp.call('Emulation.setDeviceMetricsOverride', { width:1440, height:1000, deviceScaleFactor:1, mobile:false });
  await delay(250);
  await screenshot('desktop-gameplay-1440x1000.png');
  console.log(`Browser smoke passed: neutral returning-player menu, Edmundas dedication, Smart Notes, hints, PWA, Academy, backup, and responsive layouts.`);
} finally {
  cdp?.close();
  browser.kill();
  await rm(profileDir, { recursive:true, force:true }).catch(() => {});
}
