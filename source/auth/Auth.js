var utility = require('../utility/utility.js');

module.exports =  utility.isBrowser() ?
    require('./Auth-browser.js') : require('./Auth-node.js');
