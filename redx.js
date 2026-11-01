const commands = [];
const commandIndex = new Map();

function indexCommand(data) {
  const pattern = String(data.pattern || '').toLowerCase().trim();
  if (pattern) commandIndex.set(pattern, data);
  for (const alias of data.alias || []) {
    const n = String(alias || '').toLowerCase().trim();
    if (!n || commandIndex.has(n)) continue;
    commandIndex.set(n, data);
  }
}

function cmd(info, func) {
  const data = info;
  data.function = func;

  if (!data.pattern && data.cmdname) data.pattern = data.cmdname;
  if (!data.alias) data.alias = [];
  if (typeof data.alias === 'string') data.alias = [data.alias];
  if (!data.dontAddCommandList) data.dontAddCommandList = false;
  if (!data.desc) data.desc = '';
  if (!data.fromMe) data.fromMe = false;
  if (!data.category) data.category = 'misc';

  commands.push(data);
  indexCommand(data);
  return data;
}

function find(name) {
  if (!name) return null;
  return commandIndex.get(String(name).toLowerCase().trim()) || null;
}

function rebuildIndex() {
  commandIndex.clear();
  for (const c of commands) indexCommand(c);
  return commandIndex.size;
}

function bodyListeners() {
  return commands.filter((c) => c.on === 'body');
}

module.exports = {
  cmd,
  AddCommand: cmd,
  Function: cmd,
  commands,
  find,
  rebuildIndex,
  bodyListeners,
  commandIndex
};
