import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const venv = '.venv-paddle'
const python = process.env.PADDLE_BOOTSTRAP_PYTHON ?? 'python3'
if (!existsSync(`${venv}/bin/python`)) {
  execFileSync(python, ['-m', 'venv', venv], { stdio: 'inherit' })
}
execFileSync(`${venv}/bin/python`, ['-m', 'pip', 'install', '--upgrade', 'pip'], { stdio: 'inherit' })
execFileSync(`${venv}/bin/python`, ['-m', 'pip', 'install', 'paddleocr[doc-parser]', 'onnxruntime'], { stdio: 'inherit' })
