module.exports =  process.browser ?
    require('./Auth-browser.js') : require('./Auth-node.js');