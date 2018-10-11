/**
 * Common regexps
 * TODO: fix naming to "commonRegexps", "Username" and "Email" (they are constants)
 */
module.exports = {
  username :  /^([a-zA-Z0-9])(([a-zA-Z0-9-]){3,21})([a-zA-Z0-9])$/,
  email : /^([a-zA-Z0-9_.-])+@(([a-zA-Z0-9-])+\.)+([a-zA-Z0-9]{2,4})+$/
};
