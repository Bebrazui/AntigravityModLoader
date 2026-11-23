// @ts-check
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Извлекает метрики текущей задачи из файла transcript.jsonl
 * @param {string} [convoId]
 */
function getTaskTelemetry(convoId) {
  try {
    const brainDir = path.join(os.homedir(), '.gemini', 'antigravity', 'brain');
    if (!fs.existsSync(brainDir)) return null;

    let targetId = convoId;
    if (!targetId) {
      // В новом/пустом диалоге нет convoId — возвращаем нули, не сканируя диск на чужие папки!
      return {
        convoId: null,
        taskOutTokens: 0,
        taskInTokens: 0,
        taskCachedTokens: 0,
        taskStepsCount: 0,
        totalDurationSec: 0,
        avgTps: 0,
        lastStepTps: 0,
        isWorking: false
      };
    }

    const tPath = path.join(brainDir, targetId, '.system_generated', 'logs', 'transcript.jsonl');
    if (!fs.existsSync(tPath)) {
      return {
        convoId: targetId,
        taskOutTokens: 0,
        taskInTokens: 0,
        taskCachedTokens: 0,
        taskStepsCount: 0,
        totalDurationSec: 0,
        avgTps: 0,
        lastStepTps: 0,
        isWorking: false
      };
    }

    const content = fs.readFileSync(tPath, 'utf8');
    const lines = content.trim().split('\n');
    if (lines.length === 0 || !lines[0]) {
      return {
        convoId: targetId,
        taskOutTokens: 0,
        taskInTokens: 0,
        taskCachedTokens: 0,
        taskStepsCount: 0,
        totalDurationSec: 0,
        avgTps: 0,
        lastStepTps: 0,
        isWorking: false
      };
    }

    const steps = [];
    for (let i = 0; i < lines.length; i++) {
      try {
        steps.push(JSON.parse(lines[i]));
      } catch (_) {}
    }

    if (steps.length === 0) {
      return {
        convoId: targetId,
        taskOutTokens: 0,
        taskInTokens: 0,
        taskCachedTokens: 0,
        taskStepsCount: 0,
        totalDurationSec: 0,
        avgTps: 0,
        lastStepTps: 0,
        isWorking: false
      };
    }

    // Находим последний запрос пользователя (USER_EXPLICIT)
    let lastUserIdx = 0;
    for (let i = steps.length - 1; i >= 0; i--) {
      if (steps[i].source === 'USER_EXPLICIT') {
        lastUserIdx = i;
        break;
      }
    }

    const userStep = steps[lastUserIdx];
    const userTime = (userStep && userStep.created_at) ? new Date(userStep.created_at).getTime() : null;

    const taskSteps = steps.slice(lastUserIdx);
    let taskOutTokens = 0;
    let taskInTokens = 0;
    let taskCachedTokens = 0;
    let taskStepsCount = 0;
    let firstModelTime = null;
    let lastModelTime = null;

    // Также последние мгновенные значения последнего шага
    let lastStepOut = 0;
    let lastStepDurationSec = 0;
    let lastStepTps = 0;

    let prevStepTime = userTime;

    for (let i = 0; i < taskSteps.length; i++) {
      const s = taskSteps[i];
      if (s.source === 'MODEL' && (s.output_tokens || s.input_tokens)) {
        const outTok = s.output_tokens || 0;
        const inTok = s.input_tokens || 0;
        const cacheTok = s.cache_read_tokens || 0;

        taskOutTokens += outTok;
        taskInTokens += inTok;
        taskCachedTokens += cacheTok;
        taskStepsCount++;

        const t = s.created_at ? new Date(s.created_at).getTime() : Date.now();
        if (!firstModelTime || t < firstModelTime) firstModelTime = t;
        if (!lastModelTime || t > lastModelTime) lastModelTime = t;

        if (prevStepTime && t >= prevStepTime && outTok > 0) {
          const rawSec = (t - prevStepTime) / 1000;
          // Модель не может генерировать 1000 токенов быстрее реальной скорости API (~50-80 tok/s).
          // Если разница во времени из-за округления до секунд составила 0-1 сек, оцениваем длительность
          // генерации на основе реальной пропускной способности модели (~35 tok/сек).
          const estimatedMinSec = +(outTok / 45).toFixed(1);
          const stepSec = Math.max(rawSec, estimatedMinSec, 0.5);
          lastStepOut = outTok;
          lastStepDurationSec = stepSec;
          lastStepTps = +(outTok / stepSec).toFixed(1);
        }
        prevStepTime = t;
      }
    }

    // Если шагов несколько — считаем общее время от первого до последнего шага модели
    // Если шаг один — используем реальную разницу с момента запроса пользователя
    let totalDurationSec = 1;
    if (taskStepsCount > 1 && firstModelTime && lastModelTime && lastModelTime > firstModelTime) {
      totalDurationSec = (lastModelTime - firstModelTime) / 1000;
    } else if (userTime && lastModelTime && lastModelTime > userTime) {
      totalDurationSec = (lastModelTime - userTime) / 1000;
    } else if (lastStepDurationSec > 0) {
      totalDurationSec = lastStepDurationSec;
    }

    // Защита от деления на 0/1 при секундных округлениях метрик
    const minRealisticSec = +(taskOutTokens / 55).toFixed(1);
    if (totalDurationSec < minRealisticSec) {
      totalDurationSec = minRealisticSec;
    }

    const avgTps = taskOutTokens > 0 ? +(taskOutTokens / totalDurationSec).toFixed(1) : 0;

    // Проверяем статус последнего шага диалога
    const lastStep = steps[steps.length - 1];
    const isWorking = lastStep ? (lastStep.status === 'RUNNING' || lastStep.status === 'IN_PROGRESS') : false;

    return {
      convoId: targetId,
      taskOutTokens,
      taskInTokens,
      taskCachedTokens,
      taskStepsCount,
      totalDurationSec: Math.round(totalDurationSec),
      avgTps,
      lastStepTps: lastStepTps || avgTps,
      isWorking
    };
  } catch (err) {
    console.error('[Token Speedometer Main] Error parsing telemetry:', err);
    return null;
  }
}

/**
 * Регистрация хука для Antigravity ModLoader
 * @param {any} context
 */
function init(context) {
  console.log('[Token Speedometer Main] Hook registered.');
  // Возвращаем хелпер для IPC/Action вызовов
  return {
    getTelemetry: getTaskTelemetry
  };
}

module.exports = {
  init,
  getTaskTelemetry
};
