import type { LogLevel } from '../types'

export const ENDPOINT = '/__unplugin_console'
export const WS_EVENT = 'unplugin-console:log'
export const REPORTER_GLOBAL = '__UNPLUGIN_CONSOLE_REPORT__'

export function generateRuntimeCode(
  levels: LogLevel[],
  serverPort?: number,
  stackLevels: LogLevel[] = ['warn', 'error'],
  stackTraceDepth = 10,
  useHmrChannel = true,
): string {
  return `
;(function() {
  var _global = typeof globalThis !== 'undefined'
    ? globalThis
    : typeof window !== 'undefined'
      ? window
      : typeof self !== 'undefined'
        ? self
        : undefined;
  if (!_global) return;

  var _levels = ${JSON.stringify(levels)};
  var _stackLevels = ${JSON.stringify(stackLevels)};
  var _stackTraceDepth = ${stackTraceDepth};
  var _useHmrChannel = ${JSON.stringify(useHmrChannel)};
  var _maxDepth = 3;
  var _maxArrayItems = 30;
  var _maxObjectKeys = 20;
  var _maxStringLength = 2000;

  function _clipString(value) {
    if (typeof value !== 'string') return value;
    if (value.length <= _maxStringLength) return value;
    return value.slice(0, _maxStringLength) + '... (truncated ' + (value.length - _maxStringLength) + ' chars)';
  }

  function _safeStringify(value, seen, depth) {
    if (!seen) seen = [];
    if (depth === undefined) depth = 0;
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return _clipString(value);
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

    if (depth >= _maxDepth) {
      return Array.isArray(value) ? '[Array(' + value.length + ')]' : '[Object]';
    }

    for (var i = 0; i < seen.length; i++) {
      if (seen[i] === value) return '[Circular]';
    }
    seen.push(value);

    try {
      if (Array.isArray(value)) {
        var arrItems = [];
        for (var j = 0; j < Math.min(value.length, _maxArrayItems); j++) {
          arrItems.push(_safeStringify(value[j], seen, depth + 1));
        }
        if (value.length > _maxArrayItems) arrItems.push('... (' + (value.length - _maxArrayItems) + ' more)');
        return '[' + arrItems.join(', ') + ']';
      }

      var keys = Object.keys(value);
      var objItems = [];
      for (var k = 0; k < Math.min(keys.length, _maxObjectKeys); k++) {
        objItems.push(keys[k] + ': ' + _safeStringify(value[keys[k]], seen, depth + 1));
      }
      if (keys.length > _maxObjectKeys) objItems.push('... (' + (keys.length - _maxObjectKeys) + ' more)');
      return '{' + objItems.join(', ') + '}';
    } catch (e) {
      return '[Object]';
    }
  }

  function _isEnabledLevel(level) {
    for (var i = 0; i < _levels.length; i++) {
      if (_levels[i] === level) return true;
    }
    return false;
  }

  function _shouldCaptureStack(level) {
    for (var i = 0; i < _stackLevels.length; i++) {
      if (_stackLevels[i] === level) return true;
    }
    return false;
  }

  function _sendToServer(payload) {
    if (_useHmrChannel) {
      try {
        if (typeof import.meta !== 'undefined' && import.meta.hot && typeof import.meta.hot.send === 'function') {
          import.meta.hot.send('${WS_EVENT}', payload);
          return;
        }
      } catch (e) {}
    }

    try {
      var data = JSON.stringify(payload);
      var endpoint = ${serverPort
        ? `(typeof location !== 'undefined' ? location.protocol + '//' + location.hostname + ':${serverPort}${ENDPOINT}' : 'http://localhost:${serverPort}${ENDPOINT}')`
        : `'${ENDPOINT}'`};
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

  _global['${REPORTER_GLOBAL}'] = function(level, args) {
    if (!_isEnabledLevel(level)) return;

    var safeArgs = Array.isArray(args) ? args : [];
    var serialized = [];
    for (var i = 0; i < safeArgs.length; i++) {
      serialized.push(_safeStringify(safeArgs[i]));
    }

    var stack = '';
    if (_shouldCaptureStack(level)) {
      try {
        throw new Error();
      } catch (e) {
        var stackLines = (e.stack || '')
          .split('\\n')
          .slice(2)
          .filter(function(line) {
            return line.indexOf('virtual:unplugin-console') === -1
              && line.indexOf('__x00__virtual:unplugin-console') === -1;
          });
        if (_stackTraceDepth >= 0 && stackLines.length > _stackTraceDepth) {
          stackLines = stackLines.slice(0, _stackTraceDepth);
        }
        stack = stackLines.join('\\n');
      }
    }

    _sendToServer({
      type: level,
      args: serialized,
      timestamp: Date.now(),
      source: 'browser',
      stack: stack,
    });
  };
})();
`
}
