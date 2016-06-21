var utility = require('../utility/Utility.js');

module.exports =  utility.isBrowser() ?
    require('./Auth-browser.js') : require('./Auth-node.js');
