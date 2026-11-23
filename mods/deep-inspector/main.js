// @ts-check
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Deep Inspector & Prompt Lens - Main Process Logic
 * Reads exact session trajectories, system rules, plugins, skills, and full logs.
 */
module.exports = function(api, mod) {
  const homedir = os.homedir();
  const brainBase = path.join(homedir, '.gemini', 'antigravity', 'brain');
  const pluginsBase = path.join(homedir, '.gemini', 'config', 'plugins');
  const skillsBase = path.join(homedir, '.gemini', 'config', 'skills');
  const builtinSkillsBase = path.join(homedir, '.gemini', 'antigravity', 'builtin', 'skills');

  // Helper: Read system rules and guidelines
  function getSystemEnvironment() {
    const rules = [];
    const skills = [];

    // Scan plugins for rules (e.g. AGENTS.md, context-compact)
    if (fs.existsSync(pluginsBase)) {
      try {
        const pList = fs.readdirSync(pluginsBase);
        for (const p of pList) {
          const rulesDir = path.join(pluginsBase, p, 'rules');
          if (fs.existsSync(rulesDir)) {
            const files = fs.readdirSync(rulesDir);
            for (const f of files) {
              const fullP = path.join(rulesDir, f);
              rules.push({
                source: `${p}/rules/${f}`,
                path: fullP,
                content: fs.readFileSync(fullP, 'utf8')
              });
            }
          }
        }
      } catch (e) {}
    }

    // Scan skills
    function scanSkills(dir, type) {
      if (!fs.existsSync(dir)) return;
      try {
        const list = fs.readdirSync(dir);
        for (const s of list) {
          const skillMd = path.join(dir, s, 'SKILL.md');
          if (fs.existsSync(skillMd)) {
            skills.push({
              id: s,
              type: type,
              path: skillMd,
              content: fs.readFileSync(skillMd, 'utf8')
            });
          }
        }
      } catch (e) {}
    }

    scanSkills(skillsBase, 'user');
    scanSkills(builtinSkillsBase, 'builtin');

    return { rules, skills };
  }

  // IPC: Get all conversation steps (with transcript_full merging)
  api.registerIpcHandler('inspector:get-conversation-data', async (_event, convoId) => {
    if (!convoId) {
      // Find latest conversation directory
      if (fs.existsSync(brainBase)) {
        const entries = fs.readdirSync(brainBase, { withFileTypes: true });
        let latest = null;
        let latestTime = 0;
        for (const ent of entries) {
          if (ent.isDirectory()) {
            const stat = fs.statSync(path.join(brainBase, ent.name));
            if (stat.mtimeMs > latestTime) {
              latestTime = stat.mtimeMs;
              latest = ent.name;
            }
          }
        }
        convoId = latest;
      }
    }

    if (!convoId) {
      return { success: false, error: 'No active conversation found' };
    }

    const convoDir = path.join(brainBase, convoId);
    const logsDir = path.join(convoDir, '.system_generated', 'logs');
    const compactLog = path.join(logsDir, 'transcript.jsonl');
    const fullLog = path.join(logsDir, 'transcript_full.jsonl');

    const steps = [];

    // Prefer transcript_full if exists, or compactLog
    const targetFile = fs.existsSync(fullLog) ? fullLog : (fs.existsSync(compactLog) ? compactLog : null);

    if (targetFile) {
      try {
        const raw = fs.readFileSync(targetFile, 'utf8');
        const lines = raw.trim().split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (!lines[i]) continue;
          try {
            const stepObj = JSON.parse(lines[i]);
            stepObj._index = i;
            steps.push(stepObj);
          } catch (pe) {}
        }
      } catch (err) {
        console.error('[DeepInspector] Error reading transcript:', err);
      }
    }

    // Collect available conversations list for switcher
    const allConvos = [];
    if (fs.existsSync(brainBase)) {
      try {
        const dirList = fs.readdirSync(brainBase);
        for (const d of dirList) {
          const lDir = path.join(brainBase, d, '.system_generated', 'logs');
          if (fs.existsSync(lDir)) {
            const st = fs.statSync(path.join(brainBase, d));
            allConvos.push({ id: d, time: st.mtimeMs });
          }
        }
        allConvos.sort((a, b) => b.time - a.time);
      } catch (e) {}
    }

    const envData = getSystemEnvironment();

    return {
      success: true,
      convoId: convoId,
      allConvos: allConvos,
      totalSteps: steps.length,
      steps: steps,
      rules: envData.rules,
      skills: envData.skills
    };
  });

  console.log(`[${mod.name}] Main Process handlers registered.`);
};
