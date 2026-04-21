import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const projectRoot = process.cwd();
const sourceRoots = ['src', 'App.tsx', 'index.js'];
const outDir = path.join(projectRoot, 'src', 'languages');
const enPath = path.join(outDir, 'en.json');
const esPath = path.join(outDir, 'es.json');

const spanishOverrides = {
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
  'English': 'Ingles',
  'Español': 'Español',
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
    if (ignoredParentKinds.has(node.parent?.kind)) {
      return;
    }

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

const allFiles = sourceRoots.flatMap((entry) => walk(path.join(projectRoot, entry)));
const englishEntries = new Set();

allFiles.forEach((filePath) => gatherStringsFromFile(filePath, englishEntries));

const english = {};
Array.from(englishEntries)
  .sort((a, b) => a.localeCompare(b))
  .forEach((entry) => {
    english[entry] = entry;
  });

const spanish = {};
Object.keys(english).forEach((entry) => {
  spanish[entry] = spanishOverrides[entry] ?? english[entry];
});

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(enPath, JSON.stringify(english, null, 2) + '\n');
fs.writeFileSync(esPath, JSON.stringify(spanish, null, 2) + '\n');

console.log(`Generated ${Object.keys(english).length} translation entries.`);
