// Canvas loads an app from one file, so the modules in src/ are built into
// extension.js, which is checked in for Canvas to install.
export default {
  input: 'src/index.js',
  output: {
    file: 'extension.js',
    format: 'es',
    banner: '// Built from src/ by `npm run build`; edit those files instead.',
  },
};
