# Developer QA Tools (Chrome Extension)

### AI Created extension

This extension injects a small "dice" button next to text-like inputs on any page. Clicking it fills the field with realistic fake data (via @faker-js/faker when available) and includes native generators for Brazilian CPF and CNPJ.

## Features
- Auto-inject a 🎲 button beside inputs and textareas
- Field-aware data (name, email, phone, address, CEP, company, numbers)
- Valid CPF/CNPJ generation with check digits (masked)
- Dispatches input/change events to trigger app listeners

## How it works
- A content script scans the page and enhances fields. When you click the button, it infers the field type from its name/id/type and generates an appropriate value.
- If @faker-js/faker is available on the page or can be dynamically loaded, it will be used. Otherwise, simple built-in generators are used.

Note: Remote code execution from CDNs may be restricted by Chrome Web Store policies. For local development it can be handy; for store submission, bundle faker locally into the extension or via a build step.

## Load the extension (Unpacked)
1. Build/prepare files (already present in this repo)
2. Open Chrome and navigate to chrome://extensions
3. Enable "Developer mode"
4. Click "Load unpacked" and select this folder

## Files
- manifest.json — MV3 config (registers content script)
- scripts/content.js — injector and data generators
- scripts/serviceWorker.js — basic installed hook
- hello.html — placeholder popup

## Roadmap
- Options page to configure which fields to enhance and locales
