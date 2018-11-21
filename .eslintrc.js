module.exports = {
    "env": {
        "browser": true, 
        "commonjs": true, 
    },
    "extends": [
        "eslint:recommended",
    ],
    parserOptions: {
        ecmaVersion: 8, 
        sourceType: "module", 
    },
    "rules": {
        "indent": [
            "warn",
            2, 
            { "VariableDeclarator": { "var": 2, "let": 2, "const": 3 }, 
                "SwitchCase": 1 },
        ],
        "linebreak-style": [
            "error",
            "unix"
        ],
        "quotes": ["error", "single", 
            { "avoidEscape": true }],
        "semi": [
            "error",
            "always"
        ]
    }
};