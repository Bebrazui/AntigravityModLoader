#!/usr/bin/env node
// @ts-check
const { resolvePaths, isPatched, patch, unpatch } = require('./core');

const args = process.argv.slice(2);
const command = args[0] || 'status';
const customPath = args[1] || undefined;

const paths = resolvePaths(customPath);

console.log('====================================================');
console.log('       Antigravity ModLoader CLI Installer          ');
console.log('====================================================');
console.log(`ОС:         ${process.platform} (${process.arch})`);
console.log(`Статус:     ${paths.found ? 'Найден Antigravity' : 'Antigravity не обнаружен'}`);
if (paths.found) {
  console.log(`Каталог:    ${paths.installDir}`);
  console.log(`app.asar:   ${paths.appAsar}`);
  console.log(`Патч модов: ${isPatched(paths.appAsar) ? 'УСТАНОВЛЕН (Активен)' : 'НЕ УСТАНОВЛЕН'}`);
}
console.log('----------------------------------------------------');

if (command === 'status') {
  console.log('Команды:');
  console.log('  node cli.js install    - Установить/пропатчить загрузчик модов');
  console.log('  node cli.js uninstall  - Удалить патч и восстановить оригинал');
  console.log('  node cli.js gui        - Запустить графический установщик');
  process.exit(0);
}

if (command === 'install') {
  console.log('[*] Применение патча ModLoader...');
  const res = patch(customPath);
  if (res.success) {
    if (res.alreadyPatched) {
      console.log('[OK] Antigravity уже пропатчен и готов к работе!');
    } else {
      console.log('[SUCCESS] Загрузчик модов успешно установлен в app.asar!');
    }
  } else {
    console.error(`[ERROR] Не удалось установить патч: ${res.reason || res.error}`);
    process.exit(1);
  }
} else if (command === 'uninstall') {
  console.log('[*] Восстановление оригинального app.asar...');
  const res = unpatch(customPath);
  if (res.success) {
    console.log('[SUCCESS] Оригинальный файл Antigravity успешно восстановлен.');
  } else {
    console.error(`[ERROR] Не удалось восстановить: ${res.reason || res.error}`);
    process.exit(1);
  }
} else {
  console.log(`Неизвестная команда: ${command}`);
}
