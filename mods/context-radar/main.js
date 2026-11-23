// @ts-check
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Accurately reads active tokens from the latest modified conversation transcript
 */
function getRealContextTokens() {
  try {
    const brainDir = path.join(os.homedir(), '.gemini', 'antigravity', 'brain');
    if (!fs.existsSync(brainDir)) return { totalTokens: 0, cachedTokens: 0, inputTokens: 0, maxTokens: 1048576, percentUsed: 0 };

    const entries = fs.readdirSync(brainDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name !== 'tempmediaStorage' && !d.name.startsWith('.'))
      .map(d => {
        const tPath = path.join(brainDir, d.name, '.system_generated', 'logs', 'transcript.jsonl');
        return {
          id: d.name,
          tPath,
          exists: fs.existsSync(tPath),
          mtime: fs.existsSync(tPath) ? fs.statSync(tPath).mtimeMs : 0
        };
      })
      .filter(d => d.exists)
      .sort((a, b) => b.mtime - a.mtime);

    if (entries.length === 0) return { totalTokens: 0, cachedTokens: 0, inputTokens: 0, maxTokens: 1048576, percentUsed: 0 };

    const tPath = entries[0].tPath;
    const stat = fs.statSync(tPath);
    const readSize = Math.min(stat.size, 65536);
    const buffer = Buffer.alloc(readSize);
    const fd = fs.openSync(tPath, 'r');
    fs.readSync(fd, buffer, 0, readSize, Math.max(0, stat.size - readSize));
    fs.closeSync(fd);

    const chunk = buffer.toString('utf8');
    const lines = chunk.trim().split('\n');
    let lastModelStep = null;

    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const step = JSON.parse(lines[i]);
        if (step.source === 'MODEL' && (step.input_tokens || step.cache_read_tokens)) {
          lastModelStep = step;
          break;
        }
      } catch (e) {}
    }

    if (lastModelStep) {
      const input = lastModelStep.input_tokens || 0;
      const cached = lastModelStep.cache_read_tokens || 0;
      const total = input + cached;
      const max = 1048576; // 1M tokens default
      return {
        convoId: entries[0].id,
        totalTokens: total,
        cachedTokens: cached,
        inputTokens: input,
        maxTokens: max,
        percentUsed: Math.min(100, (total / max) * 100)
      };
    }
  } catch (err) {
    console.error('[Context Radar Main Error]', err);
  }
  return { totalTokens: 0, cachedTokens: 0, inputTokens: 0, maxTokens: 1048576, percentUsed: 0 };
}

module.exports = function(api, mod) {
  api.registerIpcHandler('radar:get-metrics', async () => {
    return getRealContextTokens();
  });

  console.log('[Context Radar] Real token tracker successfully initialized.');
};
