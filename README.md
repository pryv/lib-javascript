# Pryv library for Javascript

Javascript library (browser & Node.js) to access and manipulate Pryv users data.

[![NPM version](https://badge.fury.io/js/pryv.png)](http://badge.fury.io/js/pryv)  [![Stories in Ready](https://badge.waffle.io/pryv/lib-javascript.svg?label=ready&title=Ready)](http://waffle.io/pryv/lib-javascript)


## Usage examples on CodePen 

[Pryv on CodePen](http://codepen.io/pryv/) 

- [Pryv basic example](http://codepen.io/pryv/pen/apQJxz): Example exposing how to request an access and fetching basic informations form a Pryv account.
- [Pryv notes and values example](http://codepen.io/pryv/pen/apQJrO): Web form, enter notes and values. 
- [Pryv events monitor example](http://codepen.io/pryv/pen/rjQygX): Monitor changes live on an Pryv account. Create, modifiy and delete events.


### Installation

- Browser: `<script type="text/javascript" src="http://api.pryv.com/lib-javascript/latest/pryv.js"></script>`
- Node.js: `npm install pryv`

### Docs

- [Getting started guide](http://pryv.github.io/getting-started/javascript/)
- [JS docs](http://pryv.github.io/lib-javascript/latest/docs/)


## Contribute

See the issues on the [Waffle board](http://waffle.io/pryv/lib-javascript).


### Dev environment setup

Read, then run `./scripts/setup-environment-dev.sh`

### Build and tests

`grunt`:

- applies code linting (with JSHint)
- builds documentation into `dist/{version}/docs`
- browserifies the lib into `dist/{version}` as well as `dist/latest` for browser standalone distribution
- runs the tests, outputting coverage info into `test/coverage.html`

Also: `grunt test` & `grunt watch` (runs tests on changes)

`./scripts/update-event-types.bash` updates the default event types and extras by fetching the latest master versions online.

### Publish

After building, just commit and push changes from `dist` (working copy of `gh-pages` branch).


## License

[Revised BSD license](https://github.com/pryv/documents/blob/master/license-bsd-revised.md)
