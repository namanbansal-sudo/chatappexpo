module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: [
    '@testing-library/jest-native/extend-expect',
    '<rootDir>/jest.setup.js'
  ],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native" +
      "|@react-native" +
      "|react-clone-referenced-element" +
      "|@expo" +
      "|expo(nent)?|expo-modules-core" +
      "|expo-font|expo-asset|expo-constants" +
      "|expo-file-system" +
      "|@expo/vector-icons" +
      "|react-navigation" +
      "|@react-navigation/.*" +
      "))"
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@components/(.*)$': '<rootDir>/components/$1',
    '^@screens/(.*)$': '<rootDir>/screens/$1',
    '^@services/(.*)$': '<rootDir>/services/$1',
    '^@hooks/(.*)$': '<rootDir>/hooks/$1',
    '^@utils/(.*)$': '<rootDir>/utils/$1',
    '^@constants/(.*)$': '<rootDir>/constants/$1',
    '^@assets/(.*)$': '<rootDir>/assets/$1',
    '^@i18n/(.*)$': '<rootDir>/i18n/$1',
    '^@types/(.*)$': '<rootDir>/types/$1'
  },
  collectCoverageFrom: [
    'components/**/*.{js,jsx,ts,tsx}',
    'screens/**/*.{js,jsx,ts,tsx}',
    'hooks/**/*.{js,jsx,ts,tsx}',
    'services/**/*.{js,jsx,ts,tsx}',
    'utils/**/*.{js,jsx,ts,tsx}',
    '!**/coverage/**',
    '!**/node_modules/**',
    '!**/babel.config.js',
    '!**/jest.setup.js',
    '!**/index.ts',
    '!**/types/**',
    '!**/__tests__/**',
    '!**/.expo/**',
    '!**/android/**',
    '!**/ios/**'
  ],
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest'
  },
  testMatch: [
    '**/__tests__/**/*.test.(ts|tsx|js|jsx)',
    '**/*.test.(ts|tsx|js|jsx)'
  ],
  modulePathIgnorePatterns: [
    '<rootDir>/build/',
    '<rootDir>/node_modules/',
    '<rootDir>/.expo/'
  ]
};