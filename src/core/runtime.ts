import type { LogLevel } from '../types'

export const ENDPOINT = '/__unplugin_console'
export const WS_EVENT = 'unplugin-console:log'

export function generateRuntimeCode(levels: LogLevel[], serverPort?: number): string {
  return `
;(function() {
  if (typeof console === 'undefined') return;

  var _origLog = console.log;
  var _origInfo = console.info;
  var _origWarn = console.warn;
  var _origError = console.error;
  var _original = {
    log: _origLog ? _origLog.bind(console) : function() {},
    info: _origInfo ? _origInfo.bind(console) : function() {},
    warn: _origWarn ? _origWarn.bind(console) : function() {},
    error: _origError ? _origError.bind(console) : function() {},
  };

  var _levels = ${JSON.stringify(levels)};

  function _safeStringify(value, seen) {
    if (!seen) seen = [];
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'function') return 'function ' + (value.name || 'anonymous') + '()';
    if (typeof value === 'symbol') return value.toString();
    if (typeof value === 'bigint') return value.toString() + 'n';
    if (typeof value !== 'object') return String(value);

    if (value instanceof Error) {
      return (value.name || 'Error') + ': ' + (value.message || '') + (value.stack ? '\\n' + value.stack : '');
    }
    if (value instanceof Date) return value.toISOString();
    if (value instanceof RegExp) return value.toString();
    if (typeof HTMLElement !== 'undefined' && value instanceof HTMLElement) {
      return value.outerHTML ? value.outerHTML.slice(0, 200) : value.toString();
    }

    for (var i = 0; i < seen.length; i++) {
      if (seen[i] === value) return '[Circular]';
    }
    seen.push(value);

    try {
      if (Array.isArray(value)) {
        var arrItems = [];
        for (var j = 0; j < Math.min(value.length, 100); j++) {
          arrItems.push(_safeStringify(value[j], seen));
        }
        if (value.length > 100) arrItems.push('... (' + (value.length - 100) + ' more)');
        return '[' + arrItems.join(', ') + ']';
      }

      var keys = Object.keys(value);
      var objItems = [];
      for (var k = 0; k < Math.min(keys.length, 50); k++) {
        objItems.push(keys[k] + ': ' + _safeStringify(value[keys[k]], seen));
      }
      if (keys.length > 50) objItems.push('... (' + (keys.length - 50) + ' more)');
      return '{' + objItems.join(', ') + '}';
    } catch (e) {
      return '[Object]';
    }
  }

  function _sendToServer(payload) {
    try {
      if (typeof __vite_import_meta_hot__ !== 'undefined' || (typeof import.meta !== 'undefined' && import.meta.hot)) {
        import.meta.hot.send('${WS_EVENT}', payload);
        return;
      }
    } catch (e) {}

    try {
      var data = JSON.stringify(payload);
      var endpoint = ${serverPort ? `'http://localhost:${serverPort}${ENDPOINT}'` : `'${ENDPOINT}'`};
      if (typeof fetch !== 'undefined') {
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: data,
        }).catch(function() {});
      } else if (typeof XMLHttpRequest !== 'undefined') {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', endpoint, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(data);
      }
    } catch (e) {}
  }

  function _intercept(level) {
    console[level] = function() {
      var args = Array.prototype.slice.call(arguments);
      _original[level].apply(console, args);

      var serialized = [];
      for (var i = 0; i < args.length; i++) {
        serialized.push(_safeStringify(args[i]));
      }

      var stack = '';
      try {
        throw new Error();
      } catch (e) {
        stack = (e.stack || '').split('\\n').slice(2).join('\\n');
      }

      _sendToServer({
        type: level,
        args: serialized,
        timestamp: Date.now(),
        source: 'browser',
        stack: stack,
      });
    };
  }

  for (var i = 0; i < _levels.length; i++) {
    _intercept(_levels[i]);
  }
})();
`
}
