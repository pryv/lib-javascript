[![NPM version](https://badge.fury.io/js/pryv.png)](http://badge.fury.io/js/pryv)

# Deprecated

This library is deprecated, please use the v2 version at [https://github.com/pryv/lib-js](https://github.com/pryv/lib-js)

# SYNOPSIS

This is the javascript client library for Pryv.IO, a data store for your private
data. This library allows easy access to the Pryv.IO API from different javascript
environments.

# OVERVIEW

This library will allow you to use Pryv.IO functionality from almost anywhere
javascript can be run. Here's a usage example:

```javascript
const pryv = require('pryv');
const api = new pryv.Connection({
  username: 'PRYVIO_USERNAME',
  auth: 'PRYVIO_AUTH_TOKEN'
});

api.streams.get(null, function(error, streams) {
  // streams contains an array of streams
});

const filter = new pryv.Filter({ limit: 20 });
api.events.get(filter, function(error, events) {
  // events contains the last 20 events in your Pryv.IO account
});
```

Here are some usage examples to try out right now:

- [Pryv basic example](http://codepen.io/pryv/pen/apQJxz): Example exposing how
  to request an access and fetching basic informations form a Pryv account.
- [Pryv notes and values example](http://codepen.io/pryv/pen/apQJrO): Web form,
  enter notes and values.
- [Pryv events monitor example](http://codepen.io/pryv/pen/rjQygX): Monitor
  changes live on an Pryv account. Create, modifiy and delete events.

# INSTALL

To use this library in your **client-side javascript projects**, you can include it
directly from this url: http://api.pryv.com/lib-javascript/latest/pryv.js

Here's the full script tag:

```html
<script type="text/javascript" src="http://api.pryv.com/lib-javascript/latest/pryv.js"></script>
```

For use in your **nodejs projects**, you can simply do either

```shell
$ npm install pryv
```

or - if you use yarn:

```shell
$ yarn add pryv
```

The above will also work for **webpack based builds**, allowing you to use pryv
as part of your application package.

If you encounter a situation where importing or requiring this library does
not work, please let us know by filing a github issue. We want this to work
in as many places as possible, but the situation around javascript environments
is complex.

# DOCUMENTATION

- [Getting started guide](./getting-started.md)
- [JS docs](http://pryv.github.io/lib-javascript/latest/docs/)

# HACKING

Read, then run `./scripts/setup-environment-dev.sh`.

To build this project, use `grunt`:

- builds documentation into `dist/{version}/docs`
- browserifies the lib into `dist/{version}` as well as `dist/latest` for
  browser standalone distribution
- runs the tests, outputting coverage info into `test/coverage.html`

Also: `grunt test` & `grunt watch` (runs tests on changes)

`./scripts/update-event-types.bash` updates the default event types and extras
by fetching the latest master versions online.

After building, run `./scripts/upload.sh "Commit message"` to push
changes from `dist` to `gh-pages` branch.

# SUPPORT AND WARRANTY

Pryv provides this software for educational and demonstration purposes with no support or warranty.

# LICENSE

[Revised BSD license](https://github.com/pryv/documents/blob/master/license-bsd-revised.md)
