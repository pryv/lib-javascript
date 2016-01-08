var utility = require('../../../source/utility/utility.js');


module.exports.connectionSettings = {
  username: 'libjs-test-pryv',
  auth: 'cij5h3idx0rlz1fyq1ztpnij8',
  domain: 'pryv.io'
};

module.exports.loginParams = {
  username: 'libjs-test-pryv',
  password: 'poilonez',
  appId: 'pryv-test-app',
  domain: utility.urls.domains.server.staging,
  origin: utility.urls.domains.client.staging
};

module.exports.testDiaryStreamId = 'diary';
module.exports.testActivityStreamId = 'activity';
module.exports.testNoChildStreamId = 'nochildstream';