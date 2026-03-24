/* eslint-disable no-console */
// Test unplugin-console: these logs will appear in both browser console and terminal
console.log('Hello from unplugin-console!')
console.info('Info message', { key: 'value', nested: { a: 1 } })
console.warn('Warning message', [1, 2, 3])
console.error('Error message', new Error('test error'))

// Test circular reference handling
const circular: Record<string, unknown> = { name: 'circular' }
circular.self = circular
console.log('Circular reference:', circular)

document.getElementById('app')!.innerHTML = `
  <h1>unplugin-console playground</h1>
  <p>Open your terminal to see forwarded console logs.</p>
  <button id="btn-log">console.log</button>
  <button id="btn-warn">console.warn</button>
  <button id="btn-error">console.error</button>
`

document.getElementById('btn-log')?.addEventListener('click', () => {
  console.log('Button clicked!', { time: new Date().toISOString() })
})

document.getElementById('btn-warn')?.addEventListener('click', () => {
  console.warn('Warning from button click')
})

document.getElementById('btn-error')?.addEventListener('click', () => {
  console.error('Error from button click', new Error('button error'))
})
