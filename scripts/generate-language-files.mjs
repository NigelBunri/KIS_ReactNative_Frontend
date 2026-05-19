/**
 * i18n generation script
 *
 * Scans all source files for translatable strings, writes en.json with every
 * discovered key, and creates/updates one <code>.json per additional language.
 *
 * ADDING A NEW LANGUAGE
 * ─────────────────────
 * 1. Run this script to get a fresh en.json.
 * 2. Copy en.json → xx.json (e.g. fr.json).
 * 3. Translate the values in xx.json.
 * 4. Add the language to src/languages/registry.ts (two lines).
 *
 * The script will keep your xx.json up-to-date on future runs:
 *  • new English keys are appended with their English value as a placeholder
 *  • keys removed from English are pruned from all other language files
 *  • existing translations are preserved
 */

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const projectRoot = process.cwd();
const sourceRoots = ['src', 'App.tsx', 'index.js'];
const outDir = path.join(projectRoot, 'src', 'languages');
const enPath = path.join(outDir, 'en.json');

// ── Manual translation overrides ─────────────────────────────────────────────
// These are used when generating/refreshing non-English files from scratch.
// Existing translations in the target file always take priority over these.

const manualOverrides = {
  es: {
    'Choose language': 'Elegir idioma',
    'Switch the app language for supported text.': 'Cambia el idioma de la aplicacion para el texto compatible.',
    'Close': 'Cerrar',
    'Location Required': 'Ubicacion requerida',
    'Location access is required to use KIS.': 'Se requiere acceso a la ubicacion para usar KIS.',
    'Open Settings': 'Abrir configuracion',
    'Enable Location': 'Activar ubicacion',
    'Retry': 'Reintentar',
    'Show password': 'Mostrar contrasena',
    'Hide password': 'Ocultar contrasena',
    'Show': 'Mostrar',
    'Hide': 'Ocultar',
    'Clear text': 'Borrar texto',
    'Clear': 'Borrar',
    'Back': 'Atras',
    'Create account': 'Crear cuenta',
    'Phone required; country auto-detected': 'Telefono obligatorio; pais detectado automaticamente.',
    'Display Name (optional)': 'Nombre para mostrar (opcional)',
    'Phone': 'Telefono',
    'Password': 'Contrasena',
    'Confirm Password': 'Confirmar contrasena',
    'Country': 'Pais',
    'Create Account': 'Crear cuenta',
    'Login failed': 'Inicio de sesion fallido',
    'Invalid phone or password.': 'Telefono o contrasena no validos.',
    'Error': 'Error',
    'Unexpected error while logging in.': 'Error inesperado al iniciar sesion.',
    'Reset failed': 'Restablecimiento fallido',
    'Success': 'Exito',
    'Password reset. Please log in.': 'Contrasena restablecida. Inicia sesion.',
    'Registration failed': 'Registro fallido',
    'Please review your details and try again.': 'Revisa tus datos e intentalo de nuevo.',
    'Account created and activated.': 'Cuenta creada y activada.',
    'Unable to send verification code.': 'No se pudo enviar el codigo de verificacion.',
    'We could not send your verification code. Please try again.': 'No pudimos enviar tu codigo de verificacion. Intentalo de nuevo.',
    'Almost done': 'Casi listo',
    'We sent you a verification code via SMS.': 'Te enviamos un codigo de verificacion por SMS.',
    'English': 'Inglés',
    'Spanish': 'Español',
    'Voice message': 'Mensaje de voz',
    'Sticker': 'Pegatina',
    'Attachment': 'Archivo adjunto',
    'Attachments': 'Archivos adjuntos',
    'Contact': 'Contacto',
    'Poll': 'Encuesta',
    'Event': 'Evento',
    'Translate': 'Traducir',
    'Translating...': 'Traduciendo...',
    'Translation': 'Traducción',
    'Read more': 'Leer más',
    'Show less': 'Mostrar menos',
    'Something went wrong': 'Algo salió mal',
    'This section encountered an error.': 'Esta sección encontró un error.',
    'Try again': 'Intentar de nuevo',
  },
};

const ignoredDirs = new Set([
  'node_modules',
  'ios',
  'android',
  '.git',
  'coverage',
  'dist',
  'build',
  '__tests__',
  'docs',
]);

const ignoredParentKinds = new Set([
  ts.SyntaxKind.ImportDeclaration,
  ts.SyntaxKind.ExportDeclaration,
  ts.SyntaxKind.ImportSpecifier,
  ts.SyntaxKind.ExportSpecifier,
  ts.SyntaxKind.ModuleDeclaration,
]);

const hasLetters = (value) => /[A-Za-zÀ-ÿ]/.test(value);

const shouldKeep = (raw) => {
  const value = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!value) return false;
  if (!hasLetters(value)) return false;
  if (/^(https?:\/\/|\.\/|\.\.\/|@\/|#|[A-Za-z]:\\)/.test(value)) return false;
  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.\/-]+$/.test(value)) return false;
  if (/^[A-Z0-9_]+$/.test(value) && !value.includes(' ')) return false;
  return true;
};

const walk = (targetPath, files = []) => {
  const stat = fs.statSync(targetPath);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(targetPath)) {
      if (ignoredDirs.has(entry)) continue;
      walk(path.join(targetPath, entry), files);
    }
    return files;
  }
  if (/\.(ts|tsx|js|jsx)$/.test(targetPath)) {
    files.push(targetPath);
  }
  return files;
};

const normalizeText = (value) => value.replace(/\s+/g, ' ').trim();

const gatherStringsFromFile = (filePath, bucket) => {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const scriptKind = filePath.endsWith('.tsx')
    ? ts.ScriptKind.TSX
    : filePath.endsWith('.ts')
    ? ts.ScriptKind.TS
    : filePath.endsWith('.jsx')
    ? ts.ScriptKind.JSX
    : ts.ScriptKind.JS;

  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, scriptKind);

  const visit = (node) => {
    if (ignoredParentKinds.has(node.parent?.kind)) return;
    if (ts.isJsxText(node)) {
      const value = normalizeText(node.getText(sourceFile));
      if (shouldKeep(value)) bucket.add(value);
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const value = normalizeText(node.text);
      if (shouldKeep(value)) bucket.add(value);
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
};

// ── Build English dictionary ─────────────────────────────────────────────────

const allFiles = sourceRoots.flatMap((entry) => walk(path.join(projectRoot, entry)));
const englishEntries = new Set();
allFiles.forEach((filePath) => gatherStringsFromFile(filePath, englishEntries));

const english = {};
Array.from(englishEntries)
  .sort((a, b) => a.localeCompare(b))
  .forEach((entry) => {
    english[entry] = entry;
  });

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(enPath, JSON.stringify(english, null, 2) + '\n');
console.log(`[en] ${Object.keys(english).length} entries written → en.json`);

// ── Update every other language file ─────────────────────────────────────────
// Looks at every *.json in the languages folder except en.json.
// Merges: keeps existing translations, adds new keys (English placeholder),
// removes keys that no longer exist in English.

const languageFiles = fs.readdirSync(outDir)
  .filter((f) => /^[a-z]{2,3}\.json$/.test(f) && f !== 'en.json');

for (const file of languageFiles) {
  const code = file.replace('.json', '');
  const filePath = path.join(outDir, file);

  let existing = {};
  try {
    existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch { /* new file, start empty */ }

  const overrides = manualOverrides[code] ?? {};
  const updated = {};

  for (const key of Object.keys(english)) {
    if (existing[key] && existing[key] !== key) {
      // Keep existing translation
      updated[key] = existing[key];
    } else if (overrides[key]) {
      // Use manual override
      updated[key] = overrides[key];
    } else {
      // Fall back to English value (acts as a placeholder for human translators)
      updated[key] = key;
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(updated, null, 2) + '\n');
  const translated = Object.values(updated).filter((v, i) => v !== Object.keys(updated)[i]).length;
  console.log(`[${code}] ${Object.keys(updated).length} entries (${translated} translated) → ${file}`);
}

console.log('\nDone. Translate any remaining English-value entries in the language files above.');
