module.exports =  process.browser ? // eslint-disable-line no-undef
  require('./Auth-browser.js') : require('./Auth-node.js');