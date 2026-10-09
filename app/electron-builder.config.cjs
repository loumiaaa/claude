'use strict';
/* ==========================================================================
   electron-builder : exe Windows portable + ZIP « dossier » (x64), et un
   dossier Linux pour les tests end-to-end (Playwright).

   Compression (cf. docs/04-architecture-technique.md, §7) : l'exe portable se
   décompresse dans %TEMP% à CHAQUE lancement. On garde la compression par
   défaut (« normal ») mais on emballe l'app en ZIP (deflate) plutôt qu'en 7z
   (LZMA) : la décompression deflate est plusieurs fois plus rapide, pour un
   exe un peu plus gros. Le ZIP « dossier » ne se décompresse qu'une fois :
   démarrage le plus rapide, à recommander au quotidien.
   ========================================================================== */
const e2e = process.env.LAMIA_E2E === '1';

module.exports = {
  appId: 'fr.lamia.plateforme-suivi',
  productName: 'Plateforme de suivi - Lamia',
  copyright: 'Lamia',
  directories: { output: 'dist', buildResources: 'build' },
  // Liste blanche : seul le code de l'app (ni tests, ni scripts, ni sources de design inutiles)
  files: [
    'package.json',
    'main/**/*',
    'shared/**/*',
    'renderer/**/*',
    '!**/*.map',
    '!**/*.md',
    '!renderer/design/SOURCE.txt'
  ],
  asar: true,
  electronLanguages: ['fr'],          // une seule locale Chromium
  npmRebuild: false,                  // aucune dépendance native
  compression: 'normal',
  win: {
    target: [{ target: 'portable', arch: ['x64'] }, { target: 'zip', arch: ['x64'] }],
    icon: 'build/icon.ico',
    artifactName: 'Plateforme-de-suivi-Lamia-${version}-win-x64.${ext}'
  },
  portable: {
    artifactName: 'Plateforme-de-suivi-Lamia-${version}-portable.${ext}',
    requestExecutionLevel: 'user',    // jamais de demande de droits administrateur
    useZip: true                      // décompression plus rapide à chaque lancement
  },
  linux: {
    target: ['dir'],
    executableName: 'plateforme-suivi-lamia',
    icon: 'main/assets/icon.png',
    category: 'Office'
  },
  electronFuses: {
    runAsNode: false,
    enableCookieEncryption: false,
    enableNodeOptionsEnvironmentVariable: false,
    enableNodeCliInspectArguments: e2e,   // Playwright en a besoin pour les tests ; fermé dans l'exe livré
    enableEmbeddedAsarIntegrityValidation: false,
    onlyLoadAppFromAsar: true,
    grantFileProtocolExtraPrivileges: false
  }
};
