module.exports = {
  git: {
    commitMessage: 'chore: release v${version}',
    tagName: 'v${version}',
    tagAnnotation: 'Release CurrencyX AdonisJS v${version}',
    push: true,
    requireCleanWorkingDir: false, // Allow dirty working dir for development
    requireUpstream: false,
    requireBranch: false, // Allow release from any branch
  },
  github: {
    release: true,
    releaseName: 'Release v${version}',
    releaseNotes: null,
    autoGenerate: true,
    draft: false,
    preRelease: false,
    assets: ['build/**/*'], // Include build artifacts
  },
  npm: {
    publish: true,
    publishPath: '.',
    access: 'public',
    otp: false,
    skipChecks: false,
  },
  hooks: {
    'before:init': [
      'echo "🔍 Running pre-release checks..."',
      'npm run lint',
      'npm test',
    ],
    'after:bump': [
      'echo "📦 Building package..."',
      'npm run build',
    ],
    'before:release': [
      'echo "🚀 About to release CurrencyX AdonisJS v${version}"',
    ],
    'after:release': [
      'echo "✅ Successfully released CurrencyX AdonisJS v${version}"',
      'echo "📝 Don\'t forget to update documentation if needed"',
    ],
  },
  plugins: {
    '@release-it/conventional-changelog': {
      preset: 'angular',
      infile: 'CHANGELOG.md',
      header: '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n',
      strictSemVer: true,
    },
  },
}
