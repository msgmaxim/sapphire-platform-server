module.exports = {
    "env": {
        "commonjs": true,
        "es6": true,
        "node": true
    },
    "extends": [
        "standard"
    ],
    "globals": {
        "Atomics": "readonly",
        "SharedArrayBuffer": "readonly"
    },
    "parserOptions": {
        "ecmaVersion": 2018
    },
    "rules": {
      "camelcase": "off",
      "no-multi-spaces": "off",
      "spaced-comment": "off",
      "space-before-function-paren": ["error", "never"],
      "no-var": "error",
      "no-constant-condition": "off",
    }
};
