(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.pryv = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

},{}],2:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],3:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],4:[function(require,module,exports){
(function (global){
/*! https://mths.be/punycode v1.4.0 by @mathias */
;(function(root) {

	/** Detect free variables */
	var freeExports = typeof exports == 'object' && exports &&
		!exports.nodeType && exports;
	var freeModule = typeof module == 'object' && module &&
		!module.nodeType && module;
	var freeGlobal = typeof global == 'object' && global;
	if (
		freeGlobal.global === freeGlobal ||
		freeGlobal.window === freeGlobal ||
		freeGlobal.self === freeGlobal
	) {
		root = freeGlobal;
	}

	/**
	 * The `punycode` object.
	 * @name punycode
	 * @type Object
	 */
	var punycode,

	/** Highest positive signed 32-bit float value */
	maxInt = 2147483647, // aka. 0x7FFFFFFF or 2^31-1

	/** Bootstring parameters */
	base = 36,
	tMin = 1,
	tMax = 26,
	skew = 38,
	damp = 700,
	initialBias = 72,
	initialN = 128, // 0x80
	delimiter = '-', // '\x2D'

	/** Regular expressions */
	regexPunycode = /^xn--/,
	regexNonASCII = /[^\x20-\x7E]/, // unprintable ASCII chars + non-ASCII chars
	regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g, // RFC 3490 separators

	/** Error messages */
	errors = {
		'overflow': 'Overflow: input needs wider integers to process',
		'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
		'invalid-input': 'Invalid input'
	},

	/** Convenience shortcuts */
	baseMinusTMin = base - tMin,
	floor = Math.floor,
	stringFromCharCode = String.fromCharCode,

	/** Temporary variable */
	key;

	/*--------------------------------------------------------------------------*/

	/**
	 * A generic error utility function.
	 * @private
	 * @param {String} type The error type.
	 * @returns {Error} Throws a `RangeError` with the applicable error message.
	 */
	function error(type) {
		throw new RangeError(errors[type]);
	}

	/**
	 * A generic `Array#map` utility function.
	 * @private
	 * @param {Array} array The array to iterate over.
	 * @param {Function} callback The function that gets called for every array
	 * item.
	 * @returns {Array} A new array of values returned by the callback function.
	 */
	function map(array, fn) {
		var length = array.length;
		var result = [];
		while (length--) {
			result[length] = fn(array[length]);
		}
		return result;
	}

	/**
	 * A simple `Array#map`-like wrapper to work with domain name strings or email
	 * addresses.
	 * @private
	 * @param {String} domain The domain name or email address.
	 * @param {Function} callback The function that gets called for every
	 * character.
	 * @returns {Array} A new string of characters returned by the callback
	 * function.
	 */
	function mapDomain(string, fn) {
		var parts = string.split('@');
		var result = '';
		if (parts.length > 1) {
			// In email addresses, only the domain name should be punycoded. Leave
			// the local part (i.e. everything up to `@`) intact.
			result = parts[0] + '@';
			string = parts[1];
		}
		// Avoid `split(regex)` for IE8 compatibility. See #17.
		string = string.replace(regexSeparators, '\x2E');
		var labels = string.split('.');
		var encoded = map(labels, fn).join('.');
		return result + encoded;
	}

	/**
	 * Creates an array containing the numeric code points of each Unicode
	 * character in the string. While JavaScript uses UCS-2 internally,
	 * this function will convert a pair of surrogate halves (each of which
	 * UCS-2 exposes as separate characters) into a single code point,
	 * matching UTF-16.
	 * @see `punycode.ucs2.encode`
	 * @see <https://mathiasbynens.be/notes/javascript-encoding>
	 * @memberOf punycode.ucs2
	 * @name decode
	 * @param {String} string The Unicode input string (UCS-2).
	 * @returns {Array} The new array of code points.
	 */
	function ucs2decode(string) {
		var output = [],
		    counter = 0,
		    length = string.length,
		    value,
		    extra;
		while (counter < length) {
			value = string.charCodeAt(counter++);
			if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
				// high surrogate, and there is a next character
				extra = string.charCodeAt(counter++);
				if ((extra & 0xFC00) == 0xDC00) { // low surrogate
					output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
				} else {
					// unmatched surrogate; only append this code unit, in case the next
					// code unit is the high surrogate of a surrogate pair
					output.push(value);
					counter--;
				}
			} else {
				output.push(value);
			}
		}
		return output;
	}

	/**
	 * Creates a string based on an array of numeric code points.
	 * @see `punycode.ucs2.decode`
	 * @memberOf punycode.ucs2
	 * @name encode
	 * @param {Array} codePoints The array of numeric code points.
	 * @returns {String} The new Unicode string (UCS-2).
	 */
	function ucs2encode(array) {
		return map(array, function(value) {
			var output = '';
			if (value > 0xFFFF) {
				value -= 0x10000;
				output += stringFromCharCode(value >>> 10 & 0x3FF | 0xD800);
				value = 0xDC00 | value & 0x3FF;
			}
			output += stringFromCharCode(value);
			return output;
		}).join('');
	}

	/**
	 * Converts a basic code point into a digit/integer.
	 * @see `digitToBasic()`
	 * @private
	 * @param {Number} codePoint The basic numeric code point value.
	 * @returns {Number} The numeric value of a basic code point (for use in
	 * representing integers) in the range `0` to `base - 1`, or `base` if
	 * the code point does not represent a value.
	 */
	function basicToDigit(codePoint) {
		if (codePoint - 48 < 10) {
			return codePoint - 22;
		}
		if (codePoint - 65 < 26) {
			return codePoint - 65;
		}
		if (codePoint - 97 < 26) {
			return codePoint - 97;
		}
		return base;
	}

	/**
	 * Converts a digit/integer into a basic code point.
	 * @see `basicToDigit()`
	 * @private
	 * @param {Number} digit The numeric value of a basic code point.
	 * @returns {Number} The basic code point whose value (when used for
	 * representing integers) is `digit`, which needs to be in the range
	 * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
	 * used; else, the lowercase form is used. The behavior is undefined
	 * if `flag` is non-zero and `digit` has no uppercase form.
	 */
	function digitToBasic(digit, flag) {
		//  0..25 map to ASCII a..z or A..Z
		// 26..35 map to ASCII 0..9
		return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
	}

	/**
	 * Bias adaptation function as per section 3.4 of RFC 3492.
	 * https://tools.ietf.org/html/rfc3492#section-3.4
	 * @private
	 */
	function adapt(delta, numPoints, firstTime) {
		var k = 0;
		delta = firstTime ? floor(delta / damp) : delta >> 1;
		delta += floor(delta / numPoints);
		for (/* no initialization */; delta > baseMinusTMin * tMax >> 1; k += base) {
			delta = floor(delta / baseMinusTMin);
		}
		return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
	}

	/**
	 * Converts a Punycode string of ASCII-only symbols to a string of Unicode
	 * symbols.
	 * @memberOf punycode
	 * @param {String} input The Punycode string of ASCII-only symbols.
	 * @returns {String} The resulting string of Unicode symbols.
	 */
	function decode(input) {
		// Don't use UCS-2
		var output = [],
		    inputLength = input.length,
		    out,
		    i = 0,
		    n = initialN,
		    bias = initialBias,
		    basic,
		    j,
		    index,
		    oldi,
		    w,
		    k,
		    digit,
		    t,
		    /** Cached calculation results */
		    baseMinusT;

		// Handle the basic code points: let `basic` be the number of input code
		// points before the last delimiter, or `0` if there is none, then copy
		// the first basic code points to the output.

		basic = input.lastIndexOf(delimiter);
		if (basic < 0) {
			basic = 0;
		}

		for (j = 0; j < basic; ++j) {
			// if it's not a basic code point
			if (input.charCodeAt(j) >= 0x80) {
				error('not-basic');
			}
			output.push(input.charCodeAt(j));
		}

		// Main decoding loop: start just after the last delimiter if any basic code
		// points were copied; start at the beginning otherwise.

		for (index = basic > 0 ? basic + 1 : 0; index < inputLength; /* no final expression */) {

			// `index` is the index of the next character to be consumed.
			// Decode a generalized variable-length integer into `delta`,
			// which gets added to `i`. The overflow checking is easier
			// if we increase `i` as we go, then subtract off its starting
			// value at the end to obtain `delta`.
			for (oldi = i, w = 1, k = base; /* no condition */; k += base) {

				if (index >= inputLength) {
					error('invalid-input');
				}

				digit = basicToDigit(input.charCodeAt(index++));

				if (digit >= base || digit > floor((maxInt - i) / w)) {
					error('overflow');
				}

				i += digit * w;
				t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);

				if (digit < t) {
					break;
				}

				baseMinusT = base - t;
				if (w > floor(maxInt / baseMinusT)) {
					error('overflow');
				}

				w *= baseMinusT;

			}

			out = output.length + 1;
			bias = adapt(i - oldi, out, oldi == 0);

			// `i` was supposed to wrap around from `out` to `0`,
			// incrementing `n` each time, so we'll fix that now:
			if (floor(i / out) > maxInt - n) {
				error('overflow');
			}

			n += floor(i / out);
			i %= out;

			// Insert `n` at position `i` of the output
			output.splice(i++, 0, n);

		}

		return ucs2encode(output);
	}

	/**
	 * Converts a string of Unicode symbols (e.g. a domain name label) to a
	 * Punycode string of ASCII-only symbols.
	 * @memberOf punycode
	 * @param {String} input The string of Unicode symbols.
	 * @returns {String} The resulting Punycode string of ASCII-only symbols.
	 */
	function encode(input) {
		var n,
		    delta,
		    handledCPCount,
		    basicLength,
		    bias,
		    j,
		    m,
		    q,
		    k,
		    t,
		    currentValue,
		    output = [],
		    /** `inputLength` will hold the number of code points in `input`. */
		    inputLength,
		    /** Cached calculation results */
		    handledCPCountPlusOne,
		    baseMinusT,
		    qMinusT;

		// Convert the input in UCS-2 to Unicode
		input = ucs2decode(input);

		// Cache the length
		inputLength = input.length;

		// Initialize the state
		n = initialN;
		delta = 0;
		bias = initialBias;

		// Handle the basic code points
		for (j = 0; j < inputLength; ++j) {
			currentValue = input[j];
			if (currentValue < 0x80) {
				output.push(stringFromCharCode(currentValue));
			}
		}

		handledCPCount = basicLength = output.length;

		// `handledCPCount` is the number of code points that have been handled;
		// `basicLength` is the number of basic code points.

		// Finish the basic string - if it is not empty - with a delimiter
		if (basicLength) {
			output.push(delimiter);
		}

		// Main encoding loop:
		while (handledCPCount < inputLength) {

			// All non-basic code points < n have been handled already. Find the next
			// larger one:
			for (m = maxInt, j = 0; j < inputLength; ++j) {
				currentValue = input[j];
				if (currentValue >= n && currentValue < m) {
					m = currentValue;
				}
			}

			// Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
			// but guard against overflow
			handledCPCountPlusOne = handledCPCount + 1;
			if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
				error('overflow');
			}

			delta += (m - n) * handledCPCountPlusOne;
			n = m;

			for (j = 0; j < inputLength; ++j) {
				currentValue = input[j];

				if (currentValue < n && ++delta > maxInt) {
					error('overflow');
				}

				if (currentValue == n) {
					// Represent delta as a generalized variable-length integer
					for (q = delta, k = base; /* no condition */; k += base) {
						t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
						if (q < t) {
							break;
						}
						qMinusT = q - t;
						baseMinusT = base - t;
						output.push(
							stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
						);
						q = floor(qMinusT / baseMinusT);
					}

					output.push(stringFromCharCode(digitToBasic(q, 0)));
					bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
					delta = 0;
					++handledCPCount;
				}
			}

			++delta;
			++n;

		}
		return output.join('');
	}

	/**
	 * Converts a Punycode string representing a domain name or an email address
	 * to Unicode. Only the Punycoded parts of the input will be converted, i.e.
	 * it doesn't matter if you call it on a string that has already been
	 * converted to Unicode.
	 * @memberOf punycode
	 * @param {String} input The Punycoded domain name or email address to
	 * convert to Unicode.
	 * @returns {String} The Unicode representation of the given Punycode
	 * string.
	 */
	function toUnicode(input) {
		return mapDomain(input, function(string) {
			return regexPunycode.test(string)
				? decode(string.slice(4).toLowerCase())
				: string;
		});
	}

	/**
	 * Converts a Unicode string representing a domain name or an email address to
	 * Punycode. Only the non-ASCII parts of the domain name will be converted,
	 * i.e. it doesn't matter if you call it with a domain that's already in
	 * ASCII.
	 * @memberOf punycode
	 * @param {String} input The domain name or email address to convert, as a
	 * Unicode string.
	 * @returns {String} The Punycode representation of the given domain name or
	 * email address.
	 */
	function toASCII(input) {
		return mapDomain(input, function(string) {
			return regexNonASCII.test(string)
				? 'xn--' + encode(string)
				: string;
		});
	}

	/*--------------------------------------------------------------------------*/

	/** Define the public API */
	punycode = {
		/**
		 * A string representing the current Punycode.js version number.
		 * @memberOf punycode
		 * @type String
		 */
		'version': '1.3.2',
		/**
		 * An object of methods to convert from JavaScript's internal character
		 * representation (UCS-2) to Unicode code points, and back.
		 * @see <https://mathiasbynens.be/notes/javascript-encoding>
		 * @memberOf punycode
		 * @type Object
		 */
		'ucs2': {
			'decode': ucs2decode,
			'encode': ucs2encode
		},
		'decode': decode,
		'encode': encode,
		'toASCII': toASCII,
		'toUnicode': toUnicode
	};

	/** Expose `punycode` */
	// Some AMD build optimizers, like r.js, check for specific condition patterns
	// like the following:
	if (
		typeof define == 'function' &&
		typeof define.amd == 'object' &&
		define.amd
	) {
		define('punycode', function() {
			return punycode;
		});
	} else if (freeExports && freeModule) {
		if (module.exports == freeExports) {
			// in Node.js, io.js, or RingoJS v0.8.0+
			freeModule.exports = punycode;
		} else {
			// in Narwhal or RingoJS v0.7.0-
			for (key in punycode) {
				punycode.hasOwnProperty(key) && (freeExports[key] = punycode[key]);
			}
		}
	} else {
		// in Rhino or a web browser
		root.punycode = punycode;
	}

}(this));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],5:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

// If obj.hasOwnProperty has been overridden, then calling
// obj.hasOwnProperty(prop) will break.
// See: https://github.com/joyent/node/issues/1707
function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

module.exports = function(qs, sep, eq, options) {
  sep = sep || '&';
  eq = eq || '=';
  var obj = {};

  if (typeof qs !== 'string' || qs.length === 0) {
    return obj;
  }

  var regexp = /\+/g;
  qs = qs.split(sep);

  var maxKeys = 1000;
  if (options && typeof options.maxKeys === 'number') {
    maxKeys = options.maxKeys;
  }

  var len = qs.length;
  // maxKeys <= 0 means that we should not limit keys count
  if (maxKeys > 0 && len > maxKeys) {
    len = maxKeys;
  }

  for (var i = 0; i < len; ++i) {
    var x = qs[i].replace(regexp, '%20'),
        idx = x.indexOf(eq),
        kstr, vstr, k, v;

    if (idx >= 0) {
      kstr = x.substr(0, idx);
      vstr = x.substr(idx + 1);
    } else {
      kstr = x;
      vstr = '';
    }

    k = decodeURIComponent(kstr);
    v = decodeURIComponent(vstr);

    if (!hasOwnProperty(obj, k)) {
      obj[k] = v;
    } else if (isArray(obj[k])) {
      obj[k].push(v);
    } else {
      obj[k] = [obj[k], v];
    }
  }

  return obj;
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

},{}],6:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var stringifyPrimitive = function(v) {
  switch (typeof v) {
    case 'string':
      return v;

    case 'boolean':
      return v ? 'true' : 'false';

    case 'number':
      return isFinite(v) ? v : '';

    default:
      return '';
  }
};

module.exports = function(obj, sep, eq, name) {
  sep = sep || '&';
  eq = eq || '=';
  if (obj === null) {
    obj = undefined;
  }

  if (typeof obj === 'object') {
    return map(objectKeys(obj), function(k) {
      var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;
      if (isArray(obj[k])) {
        return map(obj[k], function(v) {
          return ks + encodeURIComponent(stringifyPrimitive(v));
        }).join(sep);
      } else {
        return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
      }
    }).join(sep);

  }

  if (!name) return '';
  return encodeURIComponent(stringifyPrimitive(name)) + eq +
         encodeURIComponent(stringifyPrimitive(obj));
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

function map (xs, f) {
  if (xs.map) return xs.map(f);
  var res = [];
  for (var i = 0; i < xs.length; i++) {
    res.push(f(xs[i], i));
  }
  return res;
}

var objectKeys = Object.keys || function (obj) {
  var res = [];
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) res.push(key);
  }
  return res;
};

},{}],7:[function(require,module,exports){
'use strict';

exports.decode = exports.parse = require('./decode');
exports.encode = exports.stringify = require('./encode');

},{"./decode":5,"./encode":6}],8:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var punycode = require('punycode');

exports.parse = urlParse;
exports.resolve = urlResolve;
exports.resolveObject = urlResolveObject;
exports.format = urlFormat;

exports.Url = Url;

function Url() {
  this.protocol = null;
  this.slashes = null;
  this.auth = null;
  this.host = null;
  this.port = null;
  this.hostname = null;
  this.hash = null;
  this.search = null;
  this.query = null;
  this.pathname = null;
  this.path = null;
  this.href = null;
}

// Reference: RFC 3986, RFC 1808, RFC 2396

// define these here so at least they only have to be
// compiled once on the first module load.
var protocolPattern = /^([a-z0-9.+-]+:)/i,
    portPattern = /:[0-9]*$/,

    // RFC 2396: characters reserved for delimiting URLs.
    // We actually just auto-escape these.
    delims = ['<', '>', '"', '`', ' ', '\r', '\n', '\t'],

    // RFC 2396: characters not allowed for various reasons.
    unwise = ['{', '}', '|', '\\', '^', '`'].concat(delims),

    // Allowed by RFCs, but cause of XSS attacks.  Always escape these.
    autoEscape = ['\''].concat(unwise),
    // Characters that are never ever allowed in a hostname.
    // Note that any invalid chars are also handled, but these
    // are the ones that are *expected* to be seen, so we fast-path
    // them.
    nonHostChars = ['%', '/', '?', ';', '#'].concat(autoEscape),
    hostEndingChars = ['/', '?', '#'],
    hostnameMaxLen = 255,
    hostnamePartPattern = /^[a-z0-9A-Z_-]{0,63}$/,
    hostnamePartStart = /^([a-z0-9A-Z_-]{0,63})(.*)$/,
    // protocols that can allow "unsafe" and "unwise" chars.
    unsafeProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that never have a hostname.
    hostlessProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that always contain a // bit.
    slashedProtocol = {
      'http': true,
      'https': true,
      'ftp': true,
      'gopher': true,
      'file': true,
      'http:': true,
      'https:': true,
      'ftp:': true,
      'gopher:': true,
      'file:': true
    },
    querystring = require('querystring');

function urlParse(url, parseQueryString, slashesDenoteHost) {
  if (url && isObject(url) && url instanceof Url) return url;

  var u = new Url;
  u.parse(url, parseQueryString, slashesDenoteHost);
  return u;
}

Url.prototype.parse = function(url, parseQueryString, slashesDenoteHost) {
  if (!isString(url)) {
    throw new TypeError("Parameter 'url' must be a string, not " + typeof url);
  }

  var rest = url;

  // trim before proceeding.
  // This is to support parse stuff like "  http://foo.com  \n"
  rest = rest.trim();

  var proto = protocolPattern.exec(rest);
  if (proto) {
    proto = proto[0];
    var lowerProto = proto.toLowerCase();
    this.protocol = lowerProto;
    rest = rest.substr(proto.length);
  }

  // figure out if it's got a host
  // user@server is *always* interpreted as a hostname, and url
  // resolution will treat //foo/bar as host=foo,path=bar because that's
  // how the browser resolves relative URLs.
  if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
    var slashes = rest.substr(0, 2) === '//';
    if (slashes && !(proto && hostlessProtocol[proto])) {
      rest = rest.substr(2);
      this.slashes = true;
    }
  }

  if (!hostlessProtocol[proto] &&
      (slashes || (proto && !slashedProtocol[proto]))) {

    // there's a hostname.
    // the first instance of /, ?, ;, or # ends the host.
    //
    // If there is an @ in the hostname, then non-host chars *are* allowed
    // to the left of the last @ sign, unless some host-ending character
    // comes *before* the @-sign.
    // URLs are obnoxious.
    //
    // ex:
    // http://a@b@c/ => user:a@b host:c
    // http://a@b?@c => user:a host:c path:/?@c

    // v0.12 TODO(isaacs): This is not quite how Chrome does things.
    // Review our test case against browsers more comprehensively.

    // find the first instance of any hostEndingChars
    var hostEnd = -1;
    for (var i = 0; i < hostEndingChars.length; i++) {
      var hec = rest.indexOf(hostEndingChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
        hostEnd = hec;
    }

    // at this point, either we have an explicit point where the
    // auth portion cannot go past, or the last @ char is the decider.
    var auth, atSign;
    if (hostEnd === -1) {
      // atSign can be anywhere.
      atSign = rest.lastIndexOf('@');
    } else {
      // atSign must be in auth portion.
      // http://a@b/c@d => host:b auth:a path:/c@d
      atSign = rest.lastIndexOf('@', hostEnd);
    }

    // Now we have a portion which is definitely the auth.
    // Pull that off.
    if (atSign !== -1) {
      auth = rest.slice(0, atSign);
      rest = rest.slice(atSign + 1);
      this.auth = decodeURIComponent(auth);
    }

    // the host is the remaining to the left of the first non-host char
    hostEnd = -1;
    for (var i = 0; i < nonHostChars.length; i++) {
      var hec = rest.indexOf(nonHostChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
        hostEnd = hec;
    }
    // if we still have not hit it, then the entire thing is a host.
    if (hostEnd === -1)
      hostEnd = rest.length;

    this.host = rest.slice(0, hostEnd);
    rest = rest.slice(hostEnd);

    // pull out port.
    this.parseHost();

    // we've indicated that there is a hostname,
    // so even if it's empty, it has to be present.
    this.hostname = this.hostname || '';

    // if hostname begins with [ and ends with ]
    // assume that it's an IPv6 address.
    var ipv6Hostname = this.hostname[0] === '[' &&
        this.hostname[this.hostname.length - 1] === ']';

    // validate a little.
    if (!ipv6Hostname) {
      var hostparts = this.hostname.split(/\./);
      for (var i = 0, l = hostparts.length; i < l; i++) {
        var part = hostparts[i];
        if (!part) continue;
        if (!part.match(hostnamePartPattern)) {
          var newpart = '';
          for (var j = 0, k = part.length; j < k; j++) {
            if (part.charCodeAt(j) > 127) {
              // we replace non-ASCII char with a temporary placeholder
              // we need this to make sure size of hostname is not
              // broken by replacing non-ASCII by nothing
              newpart += 'x';
            } else {
              newpart += part[j];
            }
          }
          // we test again with ASCII char only
          if (!newpart.match(hostnamePartPattern)) {
            var validParts = hostparts.slice(0, i);
            var notHost = hostparts.slice(i + 1);
            var bit = part.match(hostnamePartStart);
            if (bit) {
              validParts.push(bit[1]);
              notHost.unshift(bit[2]);
            }
            if (notHost.length) {
              rest = '/' + notHost.join('.') + rest;
            }
            this.hostname = validParts.join('.');
            break;
          }
        }
      }
    }

    if (this.hostname.length > hostnameMaxLen) {
      this.hostname = '';
    } else {
      // hostnames are always lower case.
      this.hostname = this.hostname.toLowerCase();
    }

    if (!ipv6Hostname) {
      // IDNA Support: Returns a puny coded representation of "domain".
      // It only converts the part of the domain name that
      // has non ASCII characters. I.e. it dosent matter if
      // you call it with a domain that already is in ASCII.
      var domainArray = this.hostname.split('.');
      var newOut = [];
      for (var i = 0; i < domainArray.length; ++i) {
        var s = domainArray[i];
        newOut.push(s.match(/[^A-Za-z0-9_-]/) ?
            'xn--' + punycode.encode(s) : s);
      }
      this.hostname = newOut.join('.');
    }

    var p = this.port ? ':' + this.port : '';
    var h = this.hostname || '';
    this.host = h + p;
    this.href += this.host;

    // strip [ and ] from the hostname
    // the host field still retains them, though
    if (ipv6Hostname) {
      this.hostname = this.hostname.substr(1, this.hostname.length - 2);
      if (rest[0] !== '/') {
        rest = '/' + rest;
      }
    }
  }

  // now rest is set to the post-host stuff.
  // chop off any delim chars.
  if (!unsafeProtocol[lowerProto]) {

    // First, make 100% sure that any "autoEscape" chars get
    // escaped, even if encodeURIComponent doesn't think they
    // need to be.
    for (var i = 0, l = autoEscape.length; i < l; i++) {
      var ae = autoEscape[i];
      var esc = encodeURIComponent(ae);
      if (esc === ae) {
        esc = escape(ae);
      }
      rest = rest.split(ae).join(esc);
    }
  }


  // chop off from the tail first.
  var hash = rest.indexOf('#');
  if (hash !== -1) {
    // got a fragment string.
    this.hash = rest.substr(hash);
    rest = rest.slice(0, hash);
  }
  var qm = rest.indexOf('?');
  if (qm !== -1) {
    this.search = rest.substr(qm);
    this.query = rest.substr(qm + 1);
    if (parseQueryString) {
      this.query = querystring.parse(this.query);
    }
    rest = rest.slice(0, qm);
  } else if (parseQueryString) {
    // no query string, but parseQueryString still requested
    this.search = '';
    this.query = {};
  }
  if (rest) this.pathname = rest;
  if (slashedProtocol[lowerProto] &&
      this.hostname && !this.pathname) {
    this.pathname = '/';
  }

  //to support http.request
  if (this.pathname || this.search) {
    var p = this.pathname || '';
    var s = this.search || '';
    this.path = p + s;
  }

  // finally, reconstruct the href based on what has been validated.
  this.href = this.format();
  return this;
};

// format a parsed object into a url string
function urlFormat(obj) {
  // ensure it's an object, and not a string url.
  // If it's an obj, this is a no-op.
  // this way, you can call url_format() on strings
  // to clean up potentially wonky urls.
  if (isString(obj)) obj = urlParse(obj);
  if (!(obj instanceof Url)) return Url.prototype.format.call(obj);
  return obj.format();
}

Url.prototype.format = function() {
  var auth = this.auth || '';
  if (auth) {
    auth = encodeURIComponent(auth);
    auth = auth.replace(/%3A/i, ':');
    auth += '@';
  }

  var protocol = this.protocol || '',
      pathname = this.pathname || '',
      hash = this.hash || '',
      host = false,
      query = '';

  if (this.host) {
    host = auth + this.host;
  } else if (this.hostname) {
    host = auth + (this.hostname.indexOf(':') === -1 ?
        this.hostname :
        '[' + this.hostname + ']');
    if (this.port) {
      host += ':' + this.port;
    }
  }

  if (this.query &&
      isObject(this.query) &&
      Object.keys(this.query).length) {
    query = querystring.stringify(this.query);
  }

  var search = this.search || (query && ('?' + query)) || '';

  if (protocol && protocol.substr(-1) !== ':') protocol += ':';

  // only the slashedProtocols get the //.  Not mailto:, xmpp:, etc.
  // unless they had them to begin with.
  if (this.slashes ||
      (!protocol || slashedProtocol[protocol]) && host !== false) {
    host = '//' + (host || '');
    if (pathname && pathname.charAt(0) !== '/') pathname = '/' + pathname;
  } else if (!host) {
    host = '';
  }

  if (hash && hash.charAt(0) !== '#') hash = '#' + hash;
  if (search && search.charAt(0) !== '?') search = '?' + search;

  pathname = pathname.replace(/[?#]/g, function(match) {
    return encodeURIComponent(match);
  });
  search = search.replace('#', '%23');

  return protocol + host + pathname + search + hash;
};

function urlResolve(source, relative) {
  return urlParse(source, false, true).resolve(relative);
}

Url.prototype.resolve = function(relative) {
  return this.resolveObject(urlParse(relative, false, true)).format();
};

function urlResolveObject(source, relative) {
  if (!source) return relative;
  return urlParse(source, false, true).resolveObject(relative);
}

Url.prototype.resolveObject = function(relative) {
  if (isString(relative)) {
    var rel = new Url();
    rel.parse(relative, false, true);
    relative = rel;
  }

  var result = new Url();
  Object.keys(this).forEach(function(k) {
    result[k] = this[k];
  }, this);

  // hash is always overridden, no matter what.
  // even href="" will remove it.
  result.hash = relative.hash;

  // if the relative url is empty, then there's nothing left to do here.
  if (relative.href === '') {
    result.href = result.format();
    return result;
  }

  // hrefs like //foo/bar always cut to the protocol.
  if (relative.slashes && !relative.protocol) {
    // take everything except the protocol from relative
    Object.keys(relative).forEach(function(k) {
      if (k !== 'protocol')
        result[k] = relative[k];
    });

    //urlParse appends trailing / to urls like http://www.example.com
    if (slashedProtocol[result.protocol] &&
        result.hostname && !result.pathname) {
      result.path = result.pathname = '/';
    }

    result.href = result.format();
    return result;
  }

  if (relative.protocol && relative.protocol !== result.protocol) {
    // if it's a known url protocol, then changing
    // the protocol does weird things
    // first, if it's not file:, then we MUST have a host,
    // and if there was a path
    // to begin with, then we MUST have a path.
    // if it is file:, then the host is dropped,
    // because that's known to be hostless.
    // anything else is assumed to be absolute.
    if (!slashedProtocol[relative.protocol]) {
      Object.keys(relative).forEach(function(k) {
        result[k] = relative[k];
      });
      result.href = result.format();
      return result;
    }

    result.protocol = relative.protocol;
    if (!relative.host && !hostlessProtocol[relative.protocol]) {
      var relPath = (relative.pathname || '').split('/');
      while (relPath.length && !(relative.host = relPath.shift()));
      if (!relative.host) relative.host = '';
      if (!relative.hostname) relative.hostname = '';
      if (relPath[0] !== '') relPath.unshift('');
      if (relPath.length < 2) relPath.unshift('');
      result.pathname = relPath.join('/');
    } else {
      result.pathname = relative.pathname;
    }
    result.search = relative.search;
    result.query = relative.query;
    result.host = relative.host || '';
    result.auth = relative.auth;
    result.hostname = relative.hostname || relative.host;
    result.port = relative.port;
    // to support http.request
    if (result.pathname || result.search) {
      var p = result.pathname || '';
      var s = result.search || '';
      result.path = p + s;
    }
    result.slashes = result.slashes || relative.slashes;
    result.href = result.format();
    return result;
  }

  var isSourceAbs = (result.pathname && result.pathname.charAt(0) === '/'),
      isRelAbs = (
          relative.host ||
          relative.pathname && relative.pathname.charAt(0) === '/'
      ),
      mustEndAbs = (isRelAbs || isSourceAbs ||
                    (result.host && relative.pathname)),
      removeAllDots = mustEndAbs,
      srcPath = result.pathname && result.pathname.split('/') || [],
      relPath = relative.pathname && relative.pathname.split('/') || [],
      psychotic = result.protocol && !slashedProtocol[result.protocol];

  // if the url is a non-slashed url, then relative
  // links like ../.. should be able
  // to crawl up to the hostname, as well.  This is strange.
  // result.protocol has already been set by now.
  // Later on, put the first path part into the host field.
  if (psychotic) {
    result.hostname = '';
    result.port = null;
    if (result.host) {
      if (srcPath[0] === '') srcPath[0] = result.host;
      else srcPath.unshift(result.host);
    }
    result.host = '';
    if (relative.protocol) {
      relative.hostname = null;
      relative.port = null;
      if (relative.host) {
        if (relPath[0] === '') relPath[0] = relative.host;
        else relPath.unshift(relative.host);
      }
      relative.host = null;
    }
    mustEndAbs = mustEndAbs && (relPath[0] === '' || srcPath[0] === '');
  }

  if (isRelAbs) {
    // it's absolute.
    result.host = (relative.host || relative.host === '') ?
                  relative.host : result.host;
    result.hostname = (relative.hostname || relative.hostname === '') ?
                      relative.hostname : result.hostname;
    result.search = relative.search;
    result.query = relative.query;
    srcPath = relPath;
    // fall through to the dot-handling below.
  } else if (relPath.length) {
    // it's relative
    // throw away the existing file, and take the new path instead.
    if (!srcPath) srcPath = [];
    srcPath.pop();
    srcPath = srcPath.concat(relPath);
    result.search = relative.search;
    result.query = relative.query;
  } else if (!isNullOrUndefined(relative.search)) {
    // just pull out the search.
    // like href='?foo'.
    // Put this after the other two cases because it simplifies the booleans
    if (psychotic) {
      result.hostname = result.host = srcPath.shift();
      //occationaly the auth can get stuck only in host
      //this especialy happens in cases like
      //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
      var authInHost = result.host && result.host.indexOf('@') > 0 ?
                       result.host.split('@') : false;
      if (authInHost) {
        result.auth = authInHost.shift();
        result.host = result.hostname = authInHost.shift();
      }
    }
    result.search = relative.search;
    result.query = relative.query;
    //to support http.request
    if (!isNull(result.pathname) || !isNull(result.search)) {
      result.path = (result.pathname ? result.pathname : '') +
                    (result.search ? result.search : '');
    }
    result.href = result.format();
    return result;
  }

  if (!srcPath.length) {
    // no path at all.  easy.
    // we've already handled the other stuff above.
    result.pathname = null;
    //to support http.request
    if (result.search) {
      result.path = '/' + result.search;
    } else {
      result.path = null;
    }
    result.href = result.format();
    return result;
  }

  // if a url ENDs in . or .., then it must get a trailing slash.
  // however, if it ends in anything else non-slashy,
  // then it must NOT get a trailing slash.
  var last = srcPath.slice(-1)[0];
  var hasTrailingSlash = (
      (result.host || relative.host) && (last === '.' || last === '..') ||
      last === '');

  // strip single dots, resolve double dots to parent dir
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = srcPath.length; i >= 0; i--) {
    last = srcPath[i];
    if (last == '.') {
      srcPath.splice(i, 1);
    } else if (last === '..') {
      srcPath.splice(i, 1);
      up++;
    } else if (up) {
      srcPath.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (!mustEndAbs && !removeAllDots) {
    for (; up--; up) {
      srcPath.unshift('..');
    }
  }

  if (mustEndAbs && srcPath[0] !== '' &&
      (!srcPath[0] || srcPath[0].charAt(0) !== '/')) {
    srcPath.unshift('');
  }

  if (hasTrailingSlash && (srcPath.join('/').substr(-1) !== '/')) {
    srcPath.push('');
  }

  var isAbsolute = srcPath[0] === '' ||
      (srcPath[0] && srcPath[0].charAt(0) === '/');

  // put the host back
  if (psychotic) {
    result.hostname = result.host = isAbsolute ? '' :
                                    srcPath.length ? srcPath.shift() : '';
    //occationaly the auth can get stuck only in host
    //this especialy happens in cases like
    //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
    var authInHost = result.host && result.host.indexOf('@') > 0 ?
                     result.host.split('@') : false;
    if (authInHost) {
      result.auth = authInHost.shift();
      result.host = result.hostname = authInHost.shift();
    }
  }

  mustEndAbs = mustEndAbs || (result.host && srcPath.length);

  if (mustEndAbs && !isAbsolute) {
    srcPath.unshift('');
  }

  if (!srcPath.length) {
    result.pathname = null;
    result.path = null;
  } else {
    result.pathname = srcPath.join('/');
  }

  //to support request.http
  if (!isNull(result.pathname) || !isNull(result.search)) {
    result.path = (result.pathname ? result.pathname : '') +
                  (result.search ? result.search : '');
  }
  result.auth = relative.auth || result.auth;
  result.slashes = result.slashes || relative.slashes;
  result.href = result.format();
  return result;
};

Url.prototype.parseHost = function() {
  var host = this.host;
  var port = portPattern.exec(host);
  if (port) {
    port = port[0];
    if (port !== ':') {
      this.port = port.substr(1);
    }
    host = host.substr(0, host.length - port.length);
  }
  if (host) this.hostname = host;
};

function isString(arg) {
  return typeof arg === "string";
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isNull(arg) {
  return arg === null;
}
function isNullOrUndefined(arg) {
  return  arg == null;
}

},{"punycode":4,"querystring":7}],9:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],10:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":9,"_process":3,"inherits":2}],11:[function(require,module,exports){
/*! Socket.IO.js build:0.9.17, development. Copyright(c) 2011 LearnBoost <dev@learnboost.com> MIT Licensed */

var io = ('undefined' === typeof module ? {} : module.exports);
(function() {

/**
 * socket.io
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function (exports, global) {

  /**
   * IO namespace.
   *
   * @namespace
   */

  var io = exports;

  /**
   * Socket.IO version
   *
   * @api public
   */

  io.version = '0.9.17';

  /**
   * Protocol implemented.
   *
   * @api public
   */

  io.protocol = 1;

  /**
   * Available transports, these will be populated with the available transports
   *
   * @api public
   */

  io.transports = [];

  /**
   * Keep track of jsonp callbacks.
   *
   * @api private
   */

  io.j = [];

  /**
   * Keep track of our io.Sockets
   *
   * @api private
   */
  io.sockets = {};


  /**
   * Manages connections to hosts.
   *
   * @param {String} uri
   * @Param {Boolean} force creation of new socket (defaults to false)
   * @api public
   */

  io.connect = function (host, details) {
    var uri = io.util.parseUri(host)
      , uuri
      , socket;

    if (global && global.location) {
      uri.protocol = uri.protocol || global.location.protocol.slice(0, -1);
      uri.host = uri.host || (global.document
        ? global.document.domain : global.location.hostname);
      uri.port = uri.port || global.location.port;
    }

    uuri = io.util.uniqueUri(uri);

    var options = {
        host: uri.host
      , secure: 'https' == uri.protocol
      , port: uri.port || ('https' == uri.protocol ? 443 : 80)
      , query: uri.query || ''
    };

    io.util.merge(options, details);

    if (options['force new connection'] || !io.sockets[uuri]) {
      socket = new io.Socket(options);
    }

    if (!options['force new connection'] && socket) {
      io.sockets[uuri] = socket;
    }

    socket = socket || io.sockets[uuri];

    // if path is different from '' or /
    return socket.of(uri.path.length > 1 ? uri.path : '');
  };

})('object' === typeof module ? module.exports : (this.io = {}), this);
/**
 * socket.io
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function (exports, global) {

  /**
   * Utilities namespace.
   *
   * @namespace
   */

  var util = exports.util = {};

  /**
   * Parses an URI
   *
   * @author Steven Levithan <stevenlevithan.com> (MIT license)
   * @api public
   */

  var re = /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/;

  var parts = ['source', 'protocol', 'authority', 'userInfo', 'user', 'password',
               'host', 'port', 'relative', 'path', 'directory', 'file', 'query',
               'anchor'];

  util.parseUri = function (str) {
    var m = re.exec(str || '')
      , uri = {}
      , i = 14;

    while (i--) {
      uri[parts[i]] = m[i] || '';
    }

    return uri;
  };

  /**
   * Produces a unique url that identifies a Socket.IO connection.
   *
   * @param {Object} uri
   * @api public
   */

  util.uniqueUri = function (uri) {
    var protocol = uri.protocol
      , host = uri.host
      , port = uri.port;

    if ('document' in global) {
      host = host || document.domain;
      port = port || (protocol == 'https'
        && document.location.protocol !== 'https:' ? 443 : document.location.port);
    } else {
      host = host || 'localhost';

      if (!port && protocol == 'https') {
        port = 443;
      }
    }

    return (protocol || 'http') + '://' + host + ':' + (port || 80);
  };

  /**
   * Mergest 2 query strings in to once unique query string
   *
   * @param {String} base
   * @param {String} addition
   * @api public
   */

  util.query = function (base, addition) {
    var query = util.chunkQuery(base || '')
      , components = [];

    util.merge(query, util.chunkQuery(addition || ''));
    for (var part in query) {
      if (query.hasOwnProperty(part)) {
        components.push(part + '=' + query[part]);
      }
    }

    return components.length ? '?' + components.join('&') : '';
  };

  /**
   * Transforms a querystring in to an object
   *
   * @param {String} qs
   * @api public
   */

  util.chunkQuery = function (qs) {
    var query = {}
      , params = qs.split('&')
      , i = 0
      , l = params.length
      , kv;

    for (; i < l; ++i) {
      kv = params[i].split('=');
      if (kv[0]) {
        query[kv[0]] = kv[1];
      }
    }

    return query;
  };

  /**
   * Executes the given function when the page is loaded.
   *
   *     io.util.load(function () { console.log('page loaded'); });
   *
   * @param {Function} fn
   * @api public
   */

  var pageLoaded = false;

  util.load = function (fn) {
    if ('document' in global && document.readyState === 'complete' || pageLoaded) {
      return fn();
    }

    util.on(global, 'load', fn, false);
  };

  /**
   * Adds an event.
   *
   * @api private
   */

  util.on = function (element, event, fn, capture) {
    if (element.attachEvent) {
      element.attachEvent('on' + event, fn);
    } else if (element.addEventListener) {
      element.addEventListener(event, fn, capture);
    }
  };

  /**
   * Generates the correct `XMLHttpRequest` for regular and cross domain requests.
   *
   * @param {Boolean} [xdomain] Create a request that can be used cross domain.
   * @returns {XMLHttpRequest|false} If we can create a XMLHttpRequest.
   * @api private
   */

  util.request = function (xdomain) {

    if (xdomain && 'undefined' != typeof XDomainRequest && !util.ua.hasCORS) {
      return new XDomainRequest();
    }

    if ('undefined' != typeof XMLHttpRequest && (!xdomain || util.ua.hasCORS)) {
      return new XMLHttpRequest();
    }

    if (!xdomain) {
      try {
        return new window[(['Active'].concat('Object').join('X'))]('Microsoft.XMLHTTP');
      } catch(e) { }
    }

    return null;
  };

  /**
   * XHR based transport constructor.
   *
   * @constructor
   * @api public
   */

  /**
   * Change the internal pageLoaded value.
   */

  if ('undefined' != typeof window) {
    util.load(function () {
      pageLoaded = true;
    });
  }

  /**
   * Defers a function to ensure a spinner is not displayed by the browser
   *
   * @param {Function} fn
   * @api public
   */

  util.defer = function (fn) {
    if (!util.ua.webkit || 'undefined' != typeof importScripts) {
      return fn();
    }

    util.load(function () {
      setTimeout(fn, 100);
    });
  };

  /**
   * Merges two objects.
   *
   * @api public
   */

  util.merge = function merge (target, additional, deep, lastseen) {
    var seen = lastseen || []
      , depth = typeof deep == 'undefined' ? 2 : deep
      , prop;

    for (prop in additional) {
      if (additional.hasOwnProperty(prop) && util.indexOf(seen, prop) < 0) {
        if (typeof target[prop] !== 'object' || !depth) {
          target[prop] = additional[prop];
          seen.push(additional[prop]);
        } else {
          util.merge(target[prop], additional[prop], depth - 1, seen);
        }
      }
    }

    return target;
  };

  /**
   * Merges prototypes from objects
   *
   * @api public
   */

  util.mixin = function (ctor, ctor2) {
    util.merge(ctor.prototype, ctor2.prototype);
  };

  /**
   * Shortcut for prototypical and static inheritance.
   *
   * @api private
   */

  util.inherit = function (ctor, ctor2) {
    function f() {};
    f.prototype = ctor2.prototype;
    ctor.prototype = new f;
  };

  /**
   * Checks if the given object is an Array.
   *
   *     io.util.isArray([]); // true
   *     io.util.isArray({}); // false
   *
   * @param Object obj
   * @api public
   */

  util.isArray = Array.isArray || function (obj) {
    return Object.prototype.toString.call(obj) === '[object Array]';
  };

  /**
   * Intersects values of two arrays into a third
   *
   * @api public
   */

  util.intersect = function (arr, arr2) {
    var ret = []
      , longest = arr.length > arr2.length ? arr : arr2
      , shortest = arr.length > arr2.length ? arr2 : arr;

    for (var i = 0, l = shortest.length; i < l; i++) {
      if (~util.indexOf(longest, shortest[i]))
        ret.push(shortest[i]);
    }

    return ret;
  };

  /**
   * Array indexOf compatibility.
   *
   * @see bit.ly/a5Dxa2
   * @api public
   */

  util.indexOf = function (arr, o, i) {

    for (var j = arr.length, i = i < 0 ? i + j < 0 ? 0 : i + j : i || 0;
         i < j && arr[i] !== o; i++) {}

    return j <= i ? -1 : i;
  };

  /**
   * Converts enumerables to array.
   *
   * @api public
   */

  util.toArray = function (enu) {
    var arr = [];

    for (var i = 0, l = enu.length; i < l; i++)
      arr.push(enu[i]);

    return arr;
  };

  /**
   * UA / engines detection namespace.
   *
   * @namespace
   */

  util.ua = {};

  /**
   * Whether the UA supports CORS for XHR.
   *
   * @api public
   */

  util.ua.hasCORS = 'undefined' != typeof XMLHttpRequest && (function () {
    try {
      var a = new XMLHttpRequest();
    } catch (e) {
      return false;
    }

    return a.withCredentials != undefined;
  })();

  /**
   * Detect webkit.
   *
   * @api public
   */

  util.ua.webkit = 'undefined' != typeof navigator
    && /webkit/i.test(navigator.userAgent);

   /**
   * Detect iPad/iPhone/iPod.
   *
   * @api public
   */

  util.ua.iDevice = 'undefined' != typeof navigator
      && /iPad|iPhone|iPod/i.test(navigator.userAgent);

})('undefined' != typeof io ? io : module.exports, this);
/**
 * socket.io
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function (exports, io) {

  /**
   * Expose constructor.
   */

  exports.EventEmitter = EventEmitter;

  /**
   * Event emitter constructor.
   *
   * @api public.
   */

  function EventEmitter () {};

  /**
   * Adds a listener
   *
   * @api public
   */

  EventEmitter.prototype.on = function (name, fn) {
    if (!this.$events) {
      this.$events = {};
    }

    if (!this.$events[name]) {
      this.$events[name] = fn;
    } else if (io.util.isArray(this.$events[name])) {
      this.$events[name].push(fn);
    } else {
      this.$events[name] = [this.$events[name], fn];
    }

    return this;
  };

  EventEmitter.prototype.addListener = EventEmitter.prototype.on;

  /**
   * Adds a volatile listener.
   *
   * @api public
   */

  EventEmitter.prototype.once = function (name, fn) {
    var self = this;

    function on () {
      self.removeListener(name, on);
      fn.apply(this, arguments);
    };

    on.listener = fn;
    this.on(name, on);

    return this;
  };

  /**
   * Removes a listener.
   *
   * @api public
   */

  EventEmitter.prototype.removeListener = function (name, fn) {
    if (this.$events && this.$events[name]) {
      var list = this.$events[name];

      if (io.util.isArray(list)) {
        var pos = -1;

        for (var i = 0, l = list.length; i < l; i++) {
          if (list[i] === fn || (list[i].listener && list[i].listener === fn)) {
            pos = i;
            break;
          }
        }

        if (pos < 0) {
          return this;
        }

        list.splice(pos, 1);

        if (!list.length) {
          delete this.$events[name];
        }
      } else if (list === fn || (list.listener && list.listener === fn)) {
        delete this.$events[name];
      }
    }

    return this;
  };

  /**
   * Removes all listeners for an event.
   *
   * @api public
   */

  EventEmitter.prototype.removeAllListeners = function (name) {
    if (name === undefined) {
      this.$events = {};
      return this;
    }

    if (this.$events && this.$events[name]) {
      this.$events[name] = null;
    }

    return this;
  };

  /**
   * Gets all listeners for a certain event.
   *
   * @api publci
   */

  EventEmitter.prototype.listeners = function (name) {
    if (!this.$events) {
      this.$events = {};
    }

    if (!this.$events[name]) {
      this.$events[name] = [];
    }

    if (!io.util.isArray(this.$events[name])) {
      this.$events[name] = [this.$events[name]];
    }

    return this.$events[name];
  };

  /**
   * Emits an event.
   *
   * @api public
   */

  EventEmitter.prototype.emit = function (name) {
    if (!this.$events) {
      return false;
    }

    var handler = this.$events[name];

    if (!handler) {
      return false;
    }

    var args = Array.prototype.slice.call(arguments, 1);

    if ('function' == typeof handler) {
      handler.apply(this, args);
    } else if (io.util.isArray(handler)) {
      var listeners = handler.slice();

      for (var i = 0, l = listeners.length; i < l; i++) {
        listeners[i].apply(this, args);
      }
    } else {
      return false;
    }

    return true;
  };

})(
    'undefined' != typeof io ? io : module.exports
  , 'undefined' != typeof io ? io : module.parent.exports
);

/**
 * socket.io
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Based on JSON2 (http://www.JSON.org/js.html).
 */

(function (exports, nativeJSON) {
  "use strict";

  // use native JSON if it's available
  if (nativeJSON && nativeJSON.parse){
    return exports.JSON = {
      parse: nativeJSON.parse
    , stringify: nativeJSON.stringify
    };
  }

  var JSON = exports.JSON = {};

  function f(n) {
      // Format integers to have at least two digits.
      return n < 10 ? '0' + n : n;
  }

  function date(d, key) {
    return isFinite(d.valueOf()) ?
        d.getUTCFullYear()     + '-' +
        f(d.getUTCMonth() + 1) + '-' +
        f(d.getUTCDate())      + 'T' +
        f(d.getUTCHours())     + ':' +
        f(d.getUTCMinutes())   + ':' +
        f(d.getUTCSeconds())   + 'Z' : null;
  };

  var cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
      escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
      gap,
      indent,
      meta = {    // table of character substitutions
          '\b': '\\b',
          '\t': '\\t',
          '\n': '\\n',
          '\f': '\\f',
          '\r': '\\r',
          '"' : '\\"',
          '\\': '\\\\'
      },
      rep;


  function quote(string) {

// If the string contains no control characters, no quote characters, and no
// backslash characters, then we can safely slap some quotes around it.
// Otherwise we must also replace the offending characters with safe escape
// sequences.

      escapable.lastIndex = 0;
      return escapable.test(string) ? '"' + string.replace(escapable, function (a) {
          var c = meta[a];
          return typeof c === 'string' ? c :
              '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
      }) + '"' : '"' + string + '"';
  }


  function str(key, holder) {

// Produce a string from holder[key].

      var i,          // The loop counter.
          k,          // The member key.
          v,          // The member value.
          length,
          mind = gap,
          partial,
          value = holder[key];

// If the value has a toJSON method, call it to obtain a replacement value.

      if (value instanceof Date) {
          value = date(key);
      }

// If we were called with a replacer function, then call the replacer to
// obtain a replacement value.

      if (typeof rep === 'function') {
          value = rep.call(holder, key, value);
      }

// What happens next depends on the value's type.

      switch (typeof value) {
      case 'string':
          return quote(value);

      case 'number':

// JSON numbers must be finite. Encode non-finite numbers as null.

          return isFinite(value) ? String(value) : 'null';

      case 'boolean':
      case 'null':

// If the value is a boolean or null, convert it to a string. Note:
// typeof null does not produce 'null'. The case is included here in
// the remote chance that this gets fixed someday.

          return String(value);

// If the type is 'object', we might be dealing with an object or an array or
// null.

      case 'object':

// Due to a specification blunder in ECMAScript, typeof null is 'object',
// so watch out for that case.

          if (!value) {
              return 'null';
          }

// Make an array to hold the partial results of stringifying this object value.

          gap += indent;
          partial = [];

// Is the value an array?

          if (Object.prototype.toString.apply(value) === '[object Array]') {

// The value is an array. Stringify every element. Use null as a placeholder
// for non-JSON values.

              length = value.length;
              for (i = 0; i < length; i += 1) {
                  partial[i] = str(i, value) || 'null';
              }

// Join all of the elements together, separated with commas, and wrap them in
// brackets.

              v = partial.length === 0 ? '[]' : gap ?
                  '[\n' + gap + partial.join(',\n' + gap) + '\n' + mind + ']' :
                  '[' + partial.join(',') + ']';
              gap = mind;
              return v;
          }

// If the replacer is an array, use it to select the members to be stringified.

          if (rep && typeof rep === 'object') {
              length = rep.length;
              for (i = 0; i < length; i += 1) {
                  if (typeof rep[i] === 'string') {
                      k = rep[i];
                      v = str(k, value);
                      if (v) {
                          partial.push(quote(k) + (gap ? ': ' : ':') + v);
                      }
                  }
              }
          } else {

// Otherwise, iterate through all of the keys in the object.

              for (k in value) {
                  if (Object.prototype.hasOwnProperty.call(value, k)) {
                      v = str(k, value);
                      if (v) {
                          partial.push(quote(k) + (gap ? ': ' : ':') + v);
                      }
                  }
              }
          }

// Join all of the member texts together, separated with commas,
// and wrap them in braces.

          v = partial.length === 0 ? '{}' : gap ?
              '{\n' + gap + partial.join(',\n' + gap) + '\n' + mind + '}' :
              '{' + partial.join(',') + '}';
          gap = mind;
          return v;
      }
  }

// If the JSON object does not yet have a stringify method, give it one.

  JSON.stringify = function (value, replacer, space) {

// The stringify method takes a value and an optional replacer, and an optional
// space parameter, and returns a JSON text. The replacer can be a function
// that can replace values, or an array of strings that will select the keys.
// A default replacer method can be provided. Use of the space parameter can
// produce text that is more easily readable.

      var i;
      gap = '';
      indent = '';

// If the space parameter is a number, make an indent string containing that
// many spaces.

      if (typeof space === 'number') {
          for (i = 0; i < space; i += 1) {
              indent += ' ';
          }

// If the space parameter is a string, it will be used as the indent string.

      } else if (typeof space === 'string') {
          indent = space;
      }

// If there is a replacer, it must be a function or an array.
// Otherwise, throw an error.

      rep = replacer;
      if (replacer && typeof replacer !== 'function' &&
              (typeof replacer !== 'object' ||
              typeof replacer.length !== 'number')) {
          throw new Error('JSON.stringify');
      }

// Make a fake root object containing our value under the key of ''.
// Return the result of stringifying the value.

      return str('', {'': value});
  };

// If the JSON object does not yet have a parse method, give it one.

  JSON.parse = function (text, reviver) {
  // The parse method takes a text and an optional reviver function, and returns
  // a JavaScript value if the text is a valid JSON text.

      var j;

      function walk(holder, key) {

  // The walk method is used to recursively walk the resulting structure so
  // that modifications can be made.

          var k, v, value = holder[key];
          if (value && typeof value === 'object') {
              for (k in value) {
                  if (Object.prototype.hasOwnProperty.call(value, k)) {
                      v = walk(value, k);
                      if (v !== undefined) {
                          value[k] = v;
                      } else {
                          delete value[k];
                      }
                  }
              }
          }
          return reviver.call(holder, key, value);
      }


  // Parsing happens in four stages. In the first stage, we replace certain
  // Unicode characters with escape sequences. JavaScript handles many characters
  // incorrectly, either silently deleting them, or treating them as line endings.

      text = String(text);
      cx.lastIndex = 0;
      if (cx.test(text)) {
          text = text.replace(cx, function (a) {
              return '\\u' +
                  ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
          });
      }

  // In the second stage, we run the text against regular expressions that look
  // for non-JSON patterns. We are especially concerned with '()' and 'new'
  // because they can cause invocation, and '=' because it can cause mutation.
  // But just to be safe, we want to reject all unexpected forms.

  // We split the second stage into 4 regexp operations in order to work around
  // crippling inefficiencies in IE's and Safari's regexp engines. First we
  // replace the JSON backslash pairs with '@' (a non-JSON character). Second, we
  // replace all simple value tokens with ']' characters. Third, we delete all
  // open brackets that follow a colon or comma or that begin the text. Finally,
  // we look to see that the remaining characters are only whitespace or ']' or
  // ',' or ':' or '{' or '}'. If that is so, then the text is safe for eval.

      if (/^[\],:{}\s]*$/
              .test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@')
                  .replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']')
                  .replace(/(?:^|:|,)(?:\s*\[)+/g, ''))) {

  // In the third stage we use the eval function to compile the text into a
  // JavaScript structure. The '{' operator is subject to a syntactic ambiguity
  // in JavaScript: it can begin a block or an object literal. We wrap the text
  // in parens to eliminate the ambiguity.

          j = eval('(' + text + ')');

  // In the optional fourth stage, we recursively walk the new structure, passing
  // each name/value pair to a reviver function for possible transformation.

          return typeof reviver === 'function' ?
              walk({'': j}, '') : j;
      }

  // If the text is not JSON parseable, then a SyntaxError is thrown.

      throw new SyntaxError('JSON.parse');
  };

})(
    'undefined' != typeof io ? io : module.exports
  , typeof JSON !== 'undefined' ? JSON : undefined
);

/**
 * socket.io
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function (exports, io) {

  /**
   * Parser namespace.
   *
   * @namespace
   */

  var parser = exports.parser = {};

  /**
   * Packet types.
   */

  var packets = parser.packets = [
      'disconnect'
    , 'connect'
    , 'heartbeat'
    , 'message'
    , 'json'
    , 'event'
    , 'ack'
    , 'error'
    , 'noop'
  ];

  /**
   * Errors reasons.
   */

  var reasons = parser.reasons = [
      'transport not supported'
    , 'client not handshaken'
    , 'unauthorized'
  ];

  /**
   * Errors advice.
   */

  var advice = parser.advice = [
      'reconnect'
  ];

  /**
   * Shortcuts.
   */

  var JSON = io.JSON
    , indexOf = io.util.indexOf;

  /**
   * Encodes a packet.
   *
   * @api private
   */

  parser.encodePacket = function (packet) {
    var type = indexOf(packets, packet.type)
      , id = packet.id || ''
      , endpoint = packet.endpoint || ''
      , ack = packet.ack
      , data = null;

    switch (packet.type) {
      case 'error':
        var reason = packet.reason ? indexOf(reasons, packet.reason) : ''
          , adv = packet.advice ? indexOf(advice, packet.advice) : '';

        if (reason !== '' || adv !== '')
          data = reason + (adv !== '' ? ('+' + adv) : '');

        break;

      case 'message':
        if (packet.data !== '')
          data = packet.data;
        break;

      case 'event':
        var ev = { name: packet.name };

        if (packet.args && packet.args.length) {
          ev.args = packet.args;
        }

        data = JSON.stringify(ev);
        break;

      case 'json':
        data = JSON.stringify(packet.data);
        break;

      case 'connect':
        if (packet.qs)
          data = packet.qs;
        break;

      case 'ack':
        data = packet.ackId
          + (packet.args && packet.args.length
              ? '+' + JSON.stringify(packet.args) : '');
        break;
    }

    // construct packet with required fragments
    var encoded = [
        type
      , id + (ack == 'data' ? '+' : '')
      , endpoint
    ];

    // data fragment is optional
    if (data !== null && data !== undefined)
      encoded.push(data);

    return encoded.join(':');
  };

  /**
   * Encodes multiple messages (payload).
   *
   * @param {Array} messages
   * @api private
   */

  parser.encodePayload = function (packets) {
    var decoded = '';

    if (packets.length == 1)
      return packets[0];

    for (var i = 0, l = packets.length; i < l; i++) {
      var packet = packets[i];
      decoded += '\ufffd' + packet.length + '\ufffd' + packets[i];
    }

    return decoded;
  };

  /**
   * Decodes a packet
   *
   * @api private
   */

  var regexp = /([^:]+):([0-9]+)?(\+)?:([^:]+)?:?([\s\S]*)?/;

  parser.decodePacket = function (data) {
    var pieces = data.match(regexp);

    if (!pieces) return {};

    var id = pieces[2] || ''
      , data = pieces[5] || ''
      , packet = {
            type: packets[pieces[1]]
          , endpoint: pieces[4] || ''
        };

    // whether we need to acknowledge the packet
    if (id) {
      packet.id = id;
      if (pieces[3])
        packet.ack = 'data';
      else
        packet.ack = true;
    }

    // handle different packet types
    switch (packet.type) {
      case 'error':
        var pieces = data.split('+');
        packet.reason = reasons[pieces[0]] || '';
        packet.advice = advice[pieces[1]] || '';
        break;

      case 'message':
        packet.data = data || '';
        break;

      case 'event':
        try {
          var opts = JSON.parse(data);
          packet.name = opts.name;
          packet.args = opts.args;
        } catch (e) { }

        packet.args = packet.args || [];
        break;

      case 'json':
        try {
          packet.data = JSON.parse(data);
        } catch (e) { }
        break;

      case 'connect':
        packet.qs = data || '';
        break;

      case 'ack':
        var pieces = data.match(/^([0-9]+)(\+)?(.*)/);
        if (pieces) {
          packet.ackId = pieces[1];
          packet.args = [];

          if (pieces[3]) {
            try {
              packet.args = pieces[3] ? JSON.parse(pieces[3]) : [];
            } catch (e) { }
          }
        }
        break;

      case 'disconnect':
      case 'heartbeat':
        break;
    };

    return packet;
  };

  /**
   * Decodes data payload. Detects multiple messages
   *
   * @return {Array} messages
   * @api public
   */

  parser.decodePayload = function (data) {
    // IE doesn't like data[i] for unicode chars, charAt works fine
    if (data.charAt(0) == '\ufffd') {
      var ret = [];

      for (var i = 1, length = ''; i < data.length; i++) {
        if (data.charAt(i) == '\ufffd') {
          ret.push(parser.decodePacket(data.substr(i + 1).substr(0, length)));
          i += Number(length) + 1;
          length = '';
        } else {
          length += data.charAt(i);
        }
      }

      return ret;
    } else {
      return [parser.decodePacket(data)];
    }
  };

})(
    'undefined' != typeof io ? io : module.exports
  , 'undefined' != typeof io ? io : module.parent.exports
);
/**
 * socket.io
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function (exports, io) {

  /**
   * Expose constructor.
   */

  exports.Transport = Transport;

  /**
   * This is the transport template for all supported transport methods.
   *
   * @constructor
   * @api public
   */

  function Transport (socket, sessid) {
    this.socket = socket;
    this.sessid = sessid;
  };

  /**
   * Apply EventEmitter mixin.
   */

  io.util.mixin(Transport, io.EventEmitter);


  /**
   * Indicates whether heartbeats is enabled for this transport
   *
   * @api private
   */

  Transport.prototype.heartbeats = function () {
    return true;
  };

  /**
   * Handles the response from the server. When a new response is received
   * it will automatically update the timeout, decode the message and
   * forwards the response to the onMessage function for further processing.
   *
   * @param {String} data Response from the server.
   * @api private
   */

  Transport.prototype.onData = function (data) {
    this.clearCloseTimeout();

    // If the connection in currently open (or in a reopening state) reset the close
    // timeout since we have just received data. This check is necessary so
    // that we don't reset the timeout on an explicitly disconnected connection.
    if (this.socket.connected || this.socket.connecting || this.socket.reconnecting) {
      this.setCloseTimeout();
    }

    if (data !== '') {
      // todo: we should only do decodePayload for xhr transports
      var msgs = io.parser.decodePayload(data);

      if (msgs && msgs.length) {
        for (var i = 0, l = msgs.length; i < l; i++) {
          this.onPacket(msgs[i]);
        }
      }
    }

    return this;
  };

  /**
   * Handles packets.
   *
   * @api private
   */

  Transport.prototype.onPacket = function (packet) {
    this.socket.setHeartbeatTimeout();

    if (packet.type == 'heartbeat') {
      return this.onHeartbeat();
    }

    if (packet.type == 'connect' && packet.endpoint == '') {
      this.onConnect();
    }

    if (packet.type == 'error' && packet.advice == 'reconnect') {
      this.isOpen = false;
    }

    this.socket.onPacket(packet);

    return this;
  };

  /**
   * Sets close timeout
   *
   * @api private
   */

  Transport.prototype.setCloseTimeout = function () {
    if (!this.closeTimeout) {
      var self = this;

      this.closeTimeout = setTimeout(function () {
        self.onDisconnect();
      }, this.socket.closeTimeout);
    }
  };

  /**
   * Called when transport disconnects.
   *
   * @api private
   */

  Transport.prototype.onDisconnect = function () {
    if (this.isOpen) this.close();
    this.clearTimeouts();
    this.socket.onDisconnect();
    return this;
  };

  /**
   * Called when transport connects
   *
   * @api private
   */

  Transport.prototype.onConnect = function () {
    this.socket.onConnect();
    return this;
  };

  /**
   * Clears close timeout
   *
   * @api private
   */

  Transport.prototype.clearCloseTimeout = function () {
    if (this.closeTimeout) {
      clearTimeout(this.closeTimeout);
      this.closeTimeout = null;
    }
  };

  /**
   * Clear timeouts
   *
   * @api private
   */

  Transport.prototype.clearTimeouts = function () {
    this.clearCloseTimeout();

    if (this.reopenTimeout) {
      clearTimeout(this.reopenTimeout);
    }
  };

  /**
   * Sends a packet
   *
   * @param {Object} packet object.
   * @api private
   */

  Transport.prototype.packet = function (packet) {
    this.send(io.parser.encodePacket(packet));
  };

  /**
   * Send the received heartbeat message back to server. So the server
   * knows we are still connected.
   *
   * @param {String} heartbeat Heartbeat response from the server.
   * @api private
   */

  Transport.prototype.onHeartbeat = function (heartbeat) {
    this.packet({ type: 'heartbeat' });
  };

  /**
   * Called when the transport opens.
   *
   * @api private
   */

  Transport.prototype.onOpen = function () {
    this.isOpen = true;
    this.clearCloseTimeout();
    this.socket.onOpen();
  };

  /**
   * Notifies the base when the connection with the Socket.IO server
   * has been disconnected.
   *
   * @api private
   */

  Transport.prototype.onClose = function () {
    var self = this;

    /* FIXME: reopen delay causing a infinit loop
    this.reopenTimeout = setTimeout(function () {
      self.open();
    }, this.socket.options['reopen delay']);*/

    this.isOpen = false;
    this.socket.onClose();
    this.onDisconnect();
  };

  /**
   * Generates a connection url based on the Socket.IO URL Protocol.
   * See <https://github.com/learnboost/socket.io-node/> for more details.
   *
   * @returns {String} Connection url
   * @api private
   */

  Transport.prototype.prepareUrl = function () {
    var options = this.socket.options;

    return this.scheme() + '://'
      + options.host + ':' + options.port + '/'
      + options.resource + '/' + io.protocol
      + '/' + this.name + '/' + this.sessid;
  };

  /**
   * Checks if the transport is ready to start a connection.
   *
   * @param {Socket} socket The socket instance that needs a transport
   * @param {Function} fn The callback
   * @api private
   */

  Transport.prototype.ready = function (socket, fn) {
    fn.call(this);
  };
})(
    'undefined' != typeof io ? io : module.exports
  , 'undefined' != typeof io ? io : module.parent.exports
);
/**
 * socket.io
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function (exports, io, global) {

  /**
   * Expose constructor.
   */

  exports.Socket = Socket;

  /**
   * Create a new `Socket.IO client` which can establish a persistent
   * connection with a Socket.IO enabled server.
   *
   * @api public
   */

  function Socket (options) {
    this.options = {
        port: 80
      , secure: false
      , document: 'document' in global ? document : false
      , resource: 'socket.io'
      , transports: io.transports
      , 'connect timeout': 10000
      , 'try multiple transports': true
      , 'reconnect': true
      , 'reconnection delay': 500
      , 'reconnection limit': Infinity
      , 'reopen delay': 3000
      , 'max reconnection attempts': 10
      , 'sync disconnect on unload': false
      , 'auto connect': true
      , 'flash policy port': 10843
      , 'manualFlush': false
    };

    io.util.merge(this.options, options);

    this.connected = false;
    this.open = false;
    this.connecting = false;
    this.reconnecting = false;
    this.namespaces = {};
    this.buffer = [];
    this.doBuffer = false;

    if (this.options['sync disconnect on unload'] &&
        (!this.isXDomain() || io.util.ua.hasCORS)) {
      var self = this;
      io.util.on(global, 'beforeunload', function () {
        self.disconnectSync();
      }, false);
    }

    if (this.options['auto connect']) {
      this.connect();
    }
};

  /**
   * Apply EventEmitter mixin.
   */

  io.util.mixin(Socket, io.EventEmitter);

  /**
   * Returns a namespace listener/emitter for this socket
   *
   * @api public
   */

  Socket.prototype.of = function (name) {
    if (!this.namespaces[name]) {
      this.namespaces[name] = new io.SocketNamespace(this, name);

      if (name !== '') {
        this.namespaces[name].packet({ type: 'connect' });
      }
    }

    return this.namespaces[name];
  };

  /**
   * Emits the given event to the Socket and all namespaces
   *
   * @api private
   */

  Socket.prototype.publish = function () {
    this.emit.apply(this, arguments);

    var nsp;

    for (var i in this.namespaces) {
      if (this.namespaces.hasOwnProperty(i)) {
        nsp = this.of(i);
        nsp.$emit.apply(nsp, arguments);
      }
    }
  };

  /**
   * Performs the handshake
   *
   * @api private
   */

  function empty () { };

  Socket.prototype.handshake = function (fn) {
    var self = this
      , options = this.options;

    function complete (data) {
      if (data instanceof Error) {
        self.connecting = false;
        self.onError(data.message);
      } else {
        fn.apply(null, data.split(':'));
      }
    };

    var url = [
          'http' + (options.secure ? 's' : '') + ':/'
        , options.host + ':' + options.port
        , options.resource
        , io.protocol
        , io.util.query(this.options.query, 't=' + +new Date)
      ].join('/');

    if (this.isXDomain() && !io.util.ua.hasCORS) {
      var insertAt = document.getElementsByTagName('script')[0]
        , script = document.createElement('script');

      script.src = url + '&jsonp=' + io.j.length;
      insertAt.parentNode.insertBefore(script, insertAt);

      io.j.push(function (data) {
        complete(data);
        script.parentNode.removeChild(script);
      });
    } else {
      var xhr = io.util.request();

      xhr.open('GET', url, true);
      if (this.isXDomain()) {
        xhr.withCredentials = true;
      }
      xhr.onreadystatechange = function () {
        if (xhr.readyState == 4) {
          xhr.onreadystatechange = empty;

          if (xhr.status == 200) {
            complete(xhr.responseText);
          } else if (xhr.status == 403) {
            self.onError(xhr.responseText);
          } else {
            self.connecting = false;            
            !self.reconnecting && self.onError(xhr.responseText);
          }
        }
      };
      xhr.send(null);
    }
  };

  /**
   * Find an available transport based on the options supplied in the constructor.
   *
   * @api private
   */

  Socket.prototype.getTransport = function (override) {
    var transports = override || this.transports, match;

    for (var i = 0, transport; transport = transports[i]; i++) {
      if (io.Transport[transport]
        && io.Transport[transport].check(this)
        && (!this.isXDomain() || io.Transport[transport].xdomainCheck(this))) {
        return new io.Transport[transport](this, this.sessionid);
      }
    }

    return null;
  };

  /**
   * Connects to the server.
   *
   * @param {Function} [fn] Callback.
   * @returns {io.Socket}
   * @api public
   */

  Socket.prototype.connect = function (fn) {
    if (this.connecting) {
      return this;
    }

    var self = this;
    self.connecting = true;
    
    this.handshake(function (sid, heartbeat, close, transports) {
      self.sessionid = sid;
      self.closeTimeout = close * 1000;
      self.heartbeatTimeout = heartbeat * 1000;
      if(!self.transports)
          self.transports = self.origTransports = (transports ? io.util.intersect(
              transports.split(',')
            , self.options.transports
          ) : self.options.transports);

      self.setHeartbeatTimeout();

      function connect (transports){
        if (self.transport) self.transport.clearTimeouts();

        self.transport = self.getTransport(transports);
        if (!self.transport) return self.publish('connect_failed');

        // once the transport is ready
        self.transport.ready(self, function () {
          self.connecting = true;
          self.publish('connecting', self.transport.name);
          self.transport.open();

          if (self.options['connect timeout']) {
            self.connectTimeoutTimer = setTimeout(function () {
              if (!self.connected) {
                self.connecting = false;

                if (self.options['try multiple transports']) {
                  var remaining = self.transports;

                  while (remaining.length > 0 && remaining.splice(0,1)[0] !=
                         self.transport.name) {}

                    if (remaining.length){
                      connect(remaining);
                    } else {
                      self.publish('connect_failed');
                    }
                }
              }
            }, self.options['connect timeout']);
          }
        });
      }

      connect(self.transports);

      self.once('connect', function (){
        clearTimeout(self.connectTimeoutTimer);

        fn && typeof fn == 'function' && fn();
      });
    });

    return this;
  };

  /**
   * Clears and sets a new heartbeat timeout using the value given by the
   * server during the handshake.
   *
   * @api private
   */

  Socket.prototype.setHeartbeatTimeout = function () {
    clearTimeout(this.heartbeatTimeoutTimer);
    if(this.transport && !this.transport.heartbeats()) return;

    var self = this;
    this.heartbeatTimeoutTimer = setTimeout(function () {
      self.transport.onClose();
    }, this.heartbeatTimeout);
  };

  /**
   * Sends a message.
   *
   * @param {Object} data packet.
   * @returns {io.Socket}
   * @api public
   */

  Socket.prototype.packet = function (data) {
    if (this.connected && !this.doBuffer) {
      this.transport.packet(data);
    } else {
      this.buffer.push(data);
    }

    return this;
  };

  /**
   * Sets buffer state
   *
   * @api private
   */

  Socket.prototype.setBuffer = function (v) {
    this.doBuffer = v;

    if (!v && this.connected && this.buffer.length) {
      if (!this.options['manualFlush']) {
        this.flushBuffer();
      }
    }
  };

  /**
   * Flushes the buffer data over the wire.
   * To be invoked manually when 'manualFlush' is set to true.
   *
   * @api public
   */

  Socket.prototype.flushBuffer = function() {
    this.transport.payload(this.buffer);
    this.buffer = [];
  };
  

  /**
   * Disconnect the established connect.
   *
   * @returns {io.Socket}
   * @api public
   */

  Socket.prototype.disconnect = function () {
    if (this.connected || this.connecting) {
      if (this.open) {
        this.of('').packet({ type: 'disconnect' });
      }

      // handle disconnection immediately
      this.onDisconnect('booted');
    }

    return this;
  };

  /**
   * Disconnects the socket with a sync XHR.
   *
   * @api private
   */

  Socket.prototype.disconnectSync = function () {
    // ensure disconnection
    var xhr = io.util.request();
    var uri = [
        'http' + (this.options.secure ? 's' : '') + ':/'
      , this.options.host + ':' + this.options.port
      , this.options.resource
      , io.protocol
      , ''
      , this.sessionid
    ].join('/') + '/?disconnect=1';

    xhr.open('GET', uri, false);
    xhr.send(null);

    // handle disconnection immediately
    this.onDisconnect('booted');
  };

  /**
   * Check if we need to use cross domain enabled transports. Cross domain would
   * be a different port or different domain name.
   *
   * @returns {Boolean}
   * @api private
   */

  Socket.prototype.isXDomain = function () {

    var port = global.location.port ||
      ('https:' == global.location.protocol ? 443 : 80);

    return this.options.host !== global.location.hostname 
      || this.options.port != port;
  };

  /**
   * Called upon handshake.
   *
   * @api private
   */

  Socket.prototype.onConnect = function () {
    if (!this.connected) {
      this.connected = true;
      this.connecting = false;
      if (!this.doBuffer) {
        // make sure to flush the buffer
        this.setBuffer(false);
      }
      this.emit('connect');
    }
  };

  /**
   * Called when the transport opens
   *
   * @api private
   */

  Socket.prototype.onOpen = function () {
    this.open = true;
  };

  /**
   * Called when the transport closes.
   *
   * @api private
   */

  Socket.prototype.onClose = function () {
    this.open = false;
    clearTimeout(this.heartbeatTimeoutTimer);
  };

  /**
   * Called when the transport first opens a connection
   *
   * @param text
   */

  Socket.prototype.onPacket = function (packet) {
    this.of(packet.endpoint).onPacket(packet);
  };

  /**
   * Handles an error.
   *
   * @api private
   */

  Socket.prototype.onError = function (err) {
    if (err && err.advice) {
      if (err.advice === 'reconnect' && (this.connected || this.connecting)) {
        this.disconnect();
        if (this.options.reconnect) {
          this.reconnect();
        }
      }
    }

    this.publish('error', err && err.reason ? err.reason : err);
  };

  /**
   * Called when the transport disconnects.
   *
   * @api private
   */

  Socket.prototype.onDisconnect = function (reason) {
    var wasConnected = this.connected
      , wasConnecting = this.connecting;

    this.connected = false;
    this.connecting = false;
    this.open = false;

    if (wasConnected || wasConnecting) {
      this.transport.close();
      this.transport.clearTimeouts();
      if (wasConnected) {
        this.publish('disconnect', reason);

        if ('booted' != reason && this.options.reconnect && !this.reconnecting) {
          this.reconnect();
        }
      }
    }
  };

  /**
   * Called upon reconnection.
   *
   * @api private
   */

  Socket.prototype.reconnect = function () {
    this.reconnecting = true;
    this.reconnectionAttempts = 0;
    this.reconnectionDelay = this.options['reconnection delay'];

    var self = this
      , maxAttempts = this.options['max reconnection attempts']
      , tryMultiple = this.options['try multiple transports']
      , limit = this.options['reconnection limit'];

    function reset () {
      if (self.connected) {
        for (var i in self.namespaces) {
          if (self.namespaces.hasOwnProperty(i) && '' !== i) {
              self.namespaces[i].packet({ type: 'connect' });
          }
        }
        self.publish('reconnect', self.transport.name, self.reconnectionAttempts);
      }

      clearTimeout(self.reconnectionTimer);

      self.removeListener('connect_failed', maybeReconnect);
      self.removeListener('connect', maybeReconnect);

      self.reconnecting = false;

      delete self.reconnectionAttempts;
      delete self.reconnectionDelay;
      delete self.reconnectionTimer;
      delete self.redoTransports;

      self.options['try multiple transports'] = tryMultiple;
    };

    function maybeReconnect () {
      if (!self.reconnecting) {
        return;
      }

      if (self.connected) {
        return reset();
      };

      if (self.connecting && self.reconnecting) {
        return self.reconnectionTimer = setTimeout(maybeReconnect, 1000);
      }

      if (self.reconnectionAttempts++ >= maxAttempts) {
        if (!self.redoTransports) {
          self.on('connect_failed', maybeReconnect);
          self.options['try multiple transports'] = true;
          self.transports = self.origTransports;
          self.transport = self.getTransport();
          self.redoTransports = true;
          self.connect();
        } else {
          self.publish('reconnect_failed');
          reset();
        }
      } else {
        if (self.reconnectionDelay < limit) {
          self.reconnectionDelay *= 2; // exponential back off
        }

        self.connect();
        self.publish('reconnecting', self.reconnectionDelay, self.reconnectionAttempts);
        self.reconnectionTimer = setTimeout(maybeReconnect, self.reconnectionDelay);
      }
    };

    this.options['try multiple transports'] = false;
    this.reconnectionTimer = setTimeout(maybeReconnect, this.reconnectionDelay);

    this.on('connect', maybeReconnect);
  };

})(
    'undefined' != typeof io ? io : module.exports
  , 'undefined' != typeof io ? io : module.parent.exports
  , this
);
/**
 * socket.io
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function (exports, io) {

  /**
   * Expose constructor.
   */

  exports.SocketNamespace = SocketNamespace;

  /**
   * Socket namespace constructor.
   *
   * @constructor
   * @api public
   */

  function SocketNamespace (socket, name) {
    this.socket = socket;
    this.name = name || '';
    this.flags = {};
    this.json = new Flag(this, 'json');
    this.ackPackets = 0;
    this.acks = {};
  };

  /**
   * Apply EventEmitter mixin.
   */

  io.util.mixin(SocketNamespace, io.EventEmitter);

  /**
   * Copies emit since we override it
   *
   * @api private
   */

  SocketNamespace.prototype.$emit = io.EventEmitter.prototype.emit;

  /**
   * Creates a new namespace, by proxying the request to the socket. This
   * allows us to use the synax as we do on the server.
   *
   * @api public
   */

  SocketNamespace.prototype.of = function () {
    return this.socket.of.apply(this.socket, arguments);
  };

  /**
   * Sends a packet.
   *
   * @api private
   */

  SocketNamespace.prototype.packet = function (packet) {
    packet.endpoint = this.name;
    this.socket.packet(packet);
    this.flags = {};
    return this;
  };

  /**
   * Sends a message
   *
   * @api public
   */

  SocketNamespace.prototype.send = function (data, fn) {
    var packet = {
        type: this.flags.json ? 'json' : 'message'
      , data: data
    };

    if ('function' == typeof fn) {
      packet.id = ++this.ackPackets;
      packet.ack = true;
      this.acks[packet.id] = fn;
    }

    return this.packet(packet);
  };

  /**
   * Emits an event
   *
   * @api public
   */
  
  SocketNamespace.prototype.emit = function (name) {
    var args = Array.prototype.slice.call(arguments, 1)
      , lastArg = args[args.length - 1]
      , packet = {
            type: 'event'
          , name: name
        };

    if ('function' == typeof lastArg) {
      packet.id = ++this.ackPackets;
      packet.ack = 'data';
      this.acks[packet.id] = lastArg;
      args = args.slice(0, args.length - 1);
    }

    packet.args = args;

    return this.packet(packet);
  };

  /**
   * Disconnects the namespace
   *
   * @api private
   */

  SocketNamespace.prototype.disconnect = function () {
    if (this.name === '') {
      this.socket.disconnect();
    } else {
      this.packet({ type: 'disconnect' });
      this.$emit('disconnect');
    }

    return this;
  };

  /**
   * Handles a packet
   *
   * @api private
   */

  SocketNamespace.prototype.onPacket = function (packet) {
    var self = this;

    function ack () {
      self.packet({
          type: 'ack'
        , args: io.util.toArray(arguments)
        , ackId: packet.id
      });
    };

    switch (packet.type) {
      case 'connect':
        this.$emit('connect');
        break;

      case 'disconnect':
        if (this.name === '') {
          this.socket.onDisconnect(packet.reason || 'booted');
        } else {
          this.$emit('disconnect', packet.reason);
        }
        break;

      case 'message':
      case 'json':
        var params = ['message', packet.data];

        if (packet.ack == 'data') {
          params.push(ack);
        } else if (packet.ack) {
          this.packet({ type: 'ack', ackId: packet.id });
        }

        this.$emit.apply(this, params);
        break;

      case 'event':
        var params = [packet.name].concat(packet.args);

        if (packet.ack == 'data')
          params.push(ack);

        this.$emit.apply(this, params);
        break;

      case 'ack':
        if (this.acks[packet.ackId]) {
          this.acks[packet.ackId].apply(this, packet.args);
          delete this.acks[packet.ackId];
        }
        break;

      case 'error':
        if (packet.advice){
          this.socket.onError(packet);
        } else {
          if (packet.reason == 'unauthorized') {
            this.$emit('connect_failed', packet.reason);
          } else {
            this.$emit('error', packet.reason);
          }
        }
        break;
    }
  };

  /**
   * Flag interface.
   *
   * @api private
   */

  function Flag (nsp, name) {
    this.namespace = nsp;
    this.name = name;
  };

  /**
   * Send a message
   *
   * @api public
   */

  Flag.prototype.send = function () {
    this.namespace.flags[this.name] = true;
    this.namespace.send.apply(this.namespace, arguments);
  };

  /**
   * Emit an event
   *
   * @api public
   */

  Flag.prototype.emit = function () {
    this.namespace.flags[this.name] = true;
    this.namespace.emit.apply(this.namespace, arguments);
  };

})(
    'undefined' != typeof io ? io : module.exports
  , 'undefined' != typeof io ? io : module.parent.exports
);

/**
 * socket.io
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function (exports, io, global) {

  /**
   * Expose constructor.
   */

  exports.websocket = WS;

  /**
   * The WebSocket transport uses the HTML5 WebSocket API to establish an
   * persistent connection with the Socket.IO server. This transport will also
   * be inherited by the FlashSocket fallback as it provides a API compatible
   * polyfill for the WebSockets.
   *
   * @constructor
   * @extends {io.Transport}
   * @api public
   */

  function WS (socket) {
    io.Transport.apply(this, arguments);
  };

  /**
   * Inherits from Transport.
   */

  io.util.inherit(WS, io.Transport);

  /**
   * Transport name
   *
   * @api public
   */

  WS.prototype.name = 'websocket';

  /**
   * Initializes a new `WebSocket` connection with the Socket.IO server. We attach
   * all the appropriate listeners to handle the responses from the server.
   *
   * @returns {Transport}
   * @api public
   */

  WS.prototype.open = function () {
    var query = io.util.query(this.socket.options.query)
      , self = this
      , Socket


    if (!Socket) {
      Socket = global.MozWebSocket || global.WebSocket;
    }

    this.websocket = new Socket(this.prepareUrl() + query);

    this.websocket.onopen = function () {
      self.onOpen();
      self.socket.setBuffer(false);
    };
    this.websocket.onmessage = function (ev) {
      self.onData(ev.data);
    };
    this.websocket.onclose = function () {
      self.onClose();
      self.socket.setBuffer(true);
    };
    this.websocket.onerror = function (e) {
      self.onError(e);
    };

    return this;
  };

  /**
   * Send a message to the Socket.IO server. The message will automatically be
   * encoded in the correct message format.
   *
   * @returns {Transport}
   * @api public
   */

  // Do to a bug in the current IDevices browser, we need to wrap the send in a 
  // setTimeout, when they resume from sleeping the browser will crash if 
  // we don't allow the browser time to detect the socket has been closed
  if (io.util.ua.iDevice) {
    WS.prototype.send = function (data) {
      var self = this;
      setTimeout(function() {
         self.websocket.send(data);
      },0);
      return this;
    };
  } else {
    WS.prototype.send = function (data) {
      this.websocket.send(data);
      return this;
    };
  }

  /**
   * Payload
   *
   * @api private
   */

  WS.prototype.payload = function (arr) {
    for (var i = 0, l = arr.length; i < l; i++) {
      this.packet(arr[i]);
    }
    return this;
  };

  /**
   * Disconnect the established `WebSocket` connection.
   *
   * @returns {Transport}
   * @api public
   */

  WS.prototype.close = function () {
    this.websocket.close();
    return this;
  };

  /**
   * Handle the errors that `WebSocket` might be giving when we
   * are attempting to connect or send messages.
   *
   * @param {Error} e The error.
   * @api private
   */

  WS.prototype.onError = function (e) {
    this.socket.onError(e);
  };

  /**
   * Returns the appropriate scheme for the URI generation.
   *
   * @api private
   */
  WS.prototype.scheme = function () {
    return this.socket.options.secure ? 'wss' : 'ws';
  };

  /**
   * Checks if the browser has support for native `WebSockets` and that
   * it's not the polyfill created for the FlashSocket transport.
   *
   * @return {Boolean}
   * @api public
   */

  WS.check = function () {
    return ('WebSocket' in global && !('__addTask' in WebSocket))
          || 'MozWebSocket' in global;
  };

  /**
   * Check if the `WebSocket` transport support cross domain communications.
   *
   * @returns {Boolean}
   * @api public
   */

  WS.xdomainCheck = function () {
    return true;
  };

  /**
   * Add the transport to your public io.transports array.
   *
   * @api private
   */

  io.transports.push('websocket');

})(
    'undefined' != typeof io ? io.Transport : module.exports
  , 'undefined' != typeof io ? io : module.parent.exports
  , this
);

/**
 * socket.io
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function (exports, io) {

  /**
   * Expose constructor.
   */

  exports.flashsocket = Flashsocket;

  /**
   * The FlashSocket transport. This is a API wrapper for the HTML5 WebSocket
   * specification. It uses a .swf file to communicate with the server. If you want
   * to serve the .swf file from a other server than where the Socket.IO script is
   * coming from you need to use the insecure version of the .swf. More information
   * about this can be found on the github page.
   *
   * @constructor
   * @extends {io.Transport.websocket}
   * @api public
   */

  function Flashsocket () {
    io.Transport.websocket.apply(this, arguments);
  };

  /**
   * Inherits from Transport.
   */

  io.util.inherit(Flashsocket, io.Transport.websocket);

  /**
   * Transport name
   *
   * @api public
   */

  Flashsocket.prototype.name = 'flashsocket';

  /**
   * Disconnect the established `FlashSocket` connection. This is done by adding a 
   * new task to the FlashSocket. The rest will be handled off by the `WebSocket` 
   * transport.
   *
   * @returns {Transport}
   * @api public
   */

  Flashsocket.prototype.open = function () {
    var self = this
      , args = arguments;

    WebSocket.__addTask(function () {
      io.Transport.websocket.prototype.open.apply(self, args);
    });
    return this;
  };
  
  /**
   * Sends a message to the Socket.IO server. This is done by adding a new
   * task to the FlashSocket. The rest will be handled off by the `WebSocket` 
   * transport.
   *
   * @returns {Transport}
   * @api public
   */

  Flashsocket.prototype.send = function () {
    var self = this, args = arguments;
    WebSocket.__addTask(function () {
      io.Transport.websocket.prototype.send.apply(self, args);
    });
    return this;
  };

  /**
   * Disconnects the established `FlashSocket` connection.
   *
   * @returns {Transport}
   * @api public
   */

  Flashsocket.prototype.close = function () {
    WebSocket.__tasks.length = 0;
    io.Transport.websocket.prototype.close.call(this);
    return this;
  };

  /**
   * The WebSocket fall back needs to append the flash container to the body
   * element, so we need to make sure we have access to it. Or defer the call
   * until we are sure there is a body element.
   *
   * @param {Socket} socket The socket instance that needs a transport
   * @param {Function} fn The callback
   * @api private
   */

  Flashsocket.prototype.ready = function (socket, fn) {
    function init () {
      var options = socket.options
        , port = options['flash policy port']
        , path = [
              'http' + (options.secure ? 's' : '') + ':/'
            , options.host + ':' + options.port
            , options.resource
            , 'static/flashsocket'
            , 'WebSocketMain' + (socket.isXDomain() ? 'Insecure' : '') + '.swf'
          ];

      // Only start downloading the swf file when the checked that this browser
      // actually supports it
      if (!Flashsocket.loaded) {
        if (typeof WEB_SOCKET_SWF_LOCATION === 'undefined') {
          // Set the correct file based on the XDomain settings
          WEB_SOCKET_SWF_LOCATION = path.join('/');
        }

        if (port !== 843) {
          WebSocket.loadFlashPolicyFile('xmlsocket://' + options.host + ':' + port);
        }

        WebSocket.__initialize();
        Flashsocket.loaded = true;
      }

      fn.call(self);
    }

    var self = this;
    if (document.body) return init();

    io.util.load(init);
  };

  /**
   * Check if the FlashSocket transport is supported as it requires that the Adobe
   * Flash Player plug-in version `10.0.0` or greater is installed. And also check if
   * the polyfill is correctly loaded.
   *
   * @returns {Boolean}
   * @api public
   */

  Flashsocket.check = function () {
    if (
        typeof WebSocket == 'undefined'
      || !('__initialize' in WebSocket) || !swfobject
    ) return false;

    return swfobject.getFlashPlayerVersion().major >= 10;
  };

  /**
   * Check if the FlashSocket transport can be used as cross domain / cross origin 
   * transport. Because we can't see which type (secure or insecure) of .swf is used
   * we will just return true.
   *
   * @returns {Boolean}
   * @api public
   */

  Flashsocket.xdomainCheck = function () {
    return true;
  };

  /**
   * Disable AUTO_INITIALIZATION
   */

  if (typeof window != 'undefined') {
    WEB_SOCKET_DISABLE_AUTO_INITIALIZATION = true;
  }

  /**
   * Add the transport to your public io.transports array.
   *
   * @api private
   */

  io.transports.push('flashsocket');
})(
    'undefined' != typeof io ? io.Transport : module.exports
  , 'undefined' != typeof io ? io : module.parent.exports
);
/*	SWFObject v2.2 <http://code.google.com/p/swfobject/> 
	is released under the MIT License <http://www.opensource.org/licenses/mit-license.php> 
*/
if ('undefined' != typeof window) {
var swfobject=function(){var D="undefined",r="object",S="Shockwave Flash",W="ShockwaveFlash.ShockwaveFlash",q="application/x-shockwave-flash",R="SWFObjectExprInst",x="onreadystatechange",O=window,j=document,t=navigator,T=false,U=[h],o=[],N=[],I=[],l,Q,E,B,J=false,a=false,n,G,m=true,M=function(){var aa=typeof j.getElementById!=D&&typeof j.getElementsByTagName!=D&&typeof j.createElement!=D,ah=t.userAgent.toLowerCase(),Y=t.platform.toLowerCase(),ae=Y?/win/.test(Y):/win/.test(ah),ac=Y?/mac/.test(Y):/mac/.test(ah),af=/webkit/.test(ah)?parseFloat(ah.replace(/^.*webkit\/(\d+(\.\d+)?).*$/,"$1")):false,X=!+"\v1",ag=[0,0,0],ab=null;if(typeof t.plugins!=D&&typeof t.plugins[S]==r){ab=t.plugins[S].description;if(ab&&!(typeof t.mimeTypes!=D&&t.mimeTypes[q]&&!t.mimeTypes[q].enabledPlugin)){T=true;X=false;ab=ab.replace(/^.*\s+(\S+\s+\S+$)/,"$1");ag[0]=parseInt(ab.replace(/^(.*)\..*$/,"$1"),10);ag[1]=parseInt(ab.replace(/^.*\.(.*)\s.*$/,"$1"),10);ag[2]=/[a-zA-Z]/.test(ab)?parseInt(ab.replace(/^.*[a-zA-Z]+(.*)$/,"$1"),10):0}}else{if(typeof O[(['Active'].concat('Object').join('X'))]!=D){try{var ad=new window[(['Active'].concat('Object').join('X'))](W);if(ad){ab=ad.GetVariable("$version");if(ab){X=true;ab=ab.split(" ")[1].split(",");ag=[parseInt(ab[0],10),parseInt(ab[1],10),parseInt(ab[2],10)]}}}catch(Z){}}}return{w3:aa,pv:ag,wk:af,ie:X,win:ae,mac:ac}}(),k=function(){if(!M.w3){return}if((typeof j.readyState!=D&&j.readyState=="complete")||(typeof j.readyState==D&&(j.getElementsByTagName("body")[0]||j.body))){f()}if(!J){if(typeof j.addEventListener!=D){j.addEventListener("DOMContentLoaded",f,false)}if(M.ie&&M.win){j.attachEvent(x,function(){if(j.readyState=="complete"){j.detachEvent(x,arguments.callee);f()}});if(O==top){(function(){if(J){return}try{j.documentElement.doScroll("left")}catch(X){setTimeout(arguments.callee,0);return}f()})()}}if(M.wk){(function(){if(J){return}if(!/loaded|complete/.test(j.readyState)){setTimeout(arguments.callee,0);return}f()})()}s(f)}}();function f(){if(J){return}try{var Z=j.getElementsByTagName("body")[0].appendChild(C("span"));Z.parentNode.removeChild(Z)}catch(aa){return}J=true;var X=U.length;for(var Y=0;Y<X;Y++){U[Y]()}}function K(X){if(J){X()}else{U[U.length]=X}}function s(Y){if(typeof O.addEventListener!=D){O.addEventListener("load",Y,false)}else{if(typeof j.addEventListener!=D){j.addEventListener("load",Y,false)}else{if(typeof O.attachEvent!=D){i(O,"onload",Y)}else{if(typeof O.onload=="function"){var X=O.onload;O.onload=function(){X();Y()}}else{O.onload=Y}}}}}function h(){if(T){V()}else{H()}}function V(){var X=j.getElementsByTagName("body")[0];var aa=C(r);aa.setAttribute("type",q);var Z=X.appendChild(aa);if(Z){var Y=0;(function(){if(typeof Z.GetVariable!=D){var ab=Z.GetVariable("$version");if(ab){ab=ab.split(" ")[1].split(",");M.pv=[parseInt(ab[0],10),parseInt(ab[1],10),parseInt(ab[2],10)]}}else{if(Y<10){Y++;setTimeout(arguments.callee,10);return}}X.removeChild(aa);Z=null;H()})()}else{H()}}function H(){var ag=o.length;if(ag>0){for(var af=0;af<ag;af++){var Y=o[af].id;var ab=o[af].callbackFn;var aa={success:false,id:Y};if(M.pv[0]>0){var ae=c(Y);if(ae){if(F(o[af].swfVersion)&&!(M.wk&&M.wk<312)){w(Y,true);if(ab){aa.success=true;aa.ref=z(Y);ab(aa)}}else{if(o[af].expressInstall&&A()){var ai={};ai.data=o[af].expressInstall;ai.width=ae.getAttribute("width")||"0";ai.height=ae.getAttribute("height")||"0";if(ae.getAttribute("class")){ai.styleclass=ae.getAttribute("class")}if(ae.getAttribute("align")){ai.align=ae.getAttribute("align")}var ah={};var X=ae.getElementsByTagName("param");var ac=X.length;for(var ad=0;ad<ac;ad++){if(X[ad].getAttribute("name").toLowerCase()!="movie"){ah[X[ad].getAttribute("name")]=X[ad].getAttribute("value")}}P(ai,ah,Y,ab)}else{p(ae);if(ab){ab(aa)}}}}}else{w(Y,true);if(ab){var Z=z(Y);if(Z&&typeof Z.SetVariable!=D){aa.success=true;aa.ref=Z}ab(aa)}}}}}function z(aa){var X=null;var Y=c(aa);if(Y&&Y.nodeName=="OBJECT"){if(typeof Y.SetVariable!=D){X=Y}else{var Z=Y.getElementsByTagName(r)[0];if(Z){X=Z}}}return X}function A(){return !a&&F("6.0.65")&&(M.win||M.mac)&&!(M.wk&&M.wk<312)}function P(aa,ab,X,Z){a=true;E=Z||null;B={success:false,id:X};var ae=c(X);if(ae){if(ae.nodeName=="OBJECT"){l=g(ae);Q=null}else{l=ae;Q=X}aa.id=R;if(typeof aa.width==D||(!/%$/.test(aa.width)&&parseInt(aa.width,10)<310)){aa.width="310"}if(typeof aa.height==D||(!/%$/.test(aa.height)&&parseInt(aa.height,10)<137)){aa.height="137"}j.title=j.title.slice(0,47)+" - Flash Player Installation";var ad=M.ie&&M.win?(['Active'].concat('').join('X')):"PlugIn",ac="MMredirectURL="+O.location.toString().replace(/&/g,"%26")+"&MMplayerType="+ad+"&MMdoctitle="+j.title;if(typeof ab.flashvars!=D){ab.flashvars+="&"+ac}else{ab.flashvars=ac}if(M.ie&&M.win&&ae.readyState!=4){var Y=C("div");X+="SWFObjectNew";Y.setAttribute("id",X);ae.parentNode.insertBefore(Y,ae);ae.style.display="none";(function(){if(ae.readyState==4){ae.parentNode.removeChild(ae)}else{setTimeout(arguments.callee,10)}})()}u(aa,ab,X)}}function p(Y){if(M.ie&&M.win&&Y.readyState!=4){var X=C("div");Y.parentNode.insertBefore(X,Y);X.parentNode.replaceChild(g(Y),X);Y.style.display="none";(function(){if(Y.readyState==4){Y.parentNode.removeChild(Y)}else{setTimeout(arguments.callee,10)}})()}else{Y.parentNode.replaceChild(g(Y),Y)}}function g(ab){var aa=C("div");if(M.win&&M.ie){aa.innerHTML=ab.innerHTML}else{var Y=ab.getElementsByTagName(r)[0];if(Y){var ad=Y.childNodes;if(ad){var X=ad.length;for(var Z=0;Z<X;Z++){if(!(ad[Z].nodeType==1&&ad[Z].nodeName=="PARAM")&&!(ad[Z].nodeType==8)){aa.appendChild(ad[Z].cloneNode(true))}}}}}return aa}function u(ai,ag,Y){var X,aa=c(Y);if(M.wk&&M.wk<312){return X}if(aa){if(typeof ai.id==D){ai.id=Y}if(M.ie&&M.win){var ah="";for(var ae in ai){if(ai[ae]!=Object.prototype[ae]){if(ae.toLowerCase()=="data"){ag.movie=ai[ae]}else{if(ae.toLowerCase()=="styleclass"){ah+=' class="'+ai[ae]+'"'}else{if(ae.toLowerCase()!="classid"){ah+=" "+ae+'="'+ai[ae]+'"'}}}}}var af="";for(var ad in ag){if(ag[ad]!=Object.prototype[ad]){af+='<param name="'+ad+'" value="'+ag[ad]+'" />'}}aa.outerHTML='<object classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000"'+ah+">"+af+"</object>";N[N.length]=ai.id;X=c(ai.id)}else{var Z=C(r);Z.setAttribute("type",q);for(var ac in ai){if(ai[ac]!=Object.prototype[ac]){if(ac.toLowerCase()=="styleclass"){Z.setAttribute("class",ai[ac])}else{if(ac.toLowerCase()!="classid"){Z.setAttribute(ac,ai[ac])}}}}for(var ab in ag){if(ag[ab]!=Object.prototype[ab]&&ab.toLowerCase()!="movie"){e(Z,ab,ag[ab])}}aa.parentNode.replaceChild(Z,aa);X=Z}}return X}function e(Z,X,Y){var aa=C("param");aa.setAttribute("name",X);aa.setAttribute("value",Y);Z.appendChild(aa)}function y(Y){var X=c(Y);if(X&&X.nodeName=="OBJECT"){if(M.ie&&M.win){X.style.display="none";(function(){if(X.readyState==4){b(Y)}else{setTimeout(arguments.callee,10)}})()}else{X.parentNode.removeChild(X)}}}function b(Z){var Y=c(Z);if(Y){for(var X in Y){if(typeof Y[X]=="function"){Y[X]=null}}Y.parentNode.removeChild(Y)}}function c(Z){var X=null;try{X=j.getElementById(Z)}catch(Y){}return X}function C(X){return j.createElement(X)}function i(Z,X,Y){Z.attachEvent(X,Y);I[I.length]=[Z,X,Y]}function F(Z){var Y=M.pv,X=Z.split(".");X[0]=parseInt(X[0],10);X[1]=parseInt(X[1],10)||0;X[2]=parseInt(X[2],10)||0;return(Y[0]>X[0]||(Y[0]==X[0]&&Y[1]>X[1])||(Y[0]==X[0]&&Y[1]==X[1]&&Y[2]>=X[2]))?true:false}function v(ac,Y,ad,ab){if(M.ie&&M.mac){return}var aa=j.getElementsByTagName("head")[0];if(!aa){return}var X=(ad&&typeof ad=="string")?ad:"screen";if(ab){n=null;G=null}if(!n||G!=X){var Z=C("style");Z.setAttribute("type","text/css");Z.setAttribute("media",X);n=aa.appendChild(Z);if(M.ie&&M.win&&typeof j.styleSheets!=D&&j.styleSheets.length>0){n=j.styleSheets[j.styleSheets.length-1]}G=X}if(M.ie&&M.win){if(n&&typeof n.addRule==r){n.addRule(ac,Y)}}else{if(n&&typeof j.createTextNode!=D){n.appendChild(j.createTextNode(ac+" {"+Y+"}"))}}}function w(Z,X){if(!m){return}var Y=X?"visible":"hidden";if(J&&c(Z)){c(Z).style.visibility=Y}else{v("#"+Z,"visibility:"+Y)}}function L(Y){var Z=/[\\\"<>\.;]/;var X=Z.exec(Y)!=null;return X&&typeof encodeURIComponent!=D?encodeURIComponent(Y):Y}var d=function(){if(M.ie&&M.win){window.attachEvent("onunload",function(){var ac=I.length;for(var ab=0;ab<ac;ab++){I[ab][0].detachEvent(I[ab][1],I[ab][2])}var Z=N.length;for(var aa=0;aa<Z;aa++){y(N[aa])}for(var Y in M){M[Y]=null}M=null;for(var X in swfobject){swfobject[X]=null}swfobject=null})}}();return{registerObject:function(ab,X,aa,Z){if(M.w3&&ab&&X){var Y={};Y.id=ab;Y.swfVersion=X;Y.expressInstall=aa;Y.callbackFn=Z;o[o.length]=Y;w(ab,false)}else{if(Z){Z({success:false,id:ab})}}},getObjectById:function(X){if(M.w3){return z(X)}},embedSWF:function(ab,ah,ae,ag,Y,aa,Z,ad,af,ac){var X={success:false,id:ah};if(M.w3&&!(M.wk&&M.wk<312)&&ab&&ah&&ae&&ag&&Y){w(ah,false);K(function(){ae+="";ag+="";var aj={};if(af&&typeof af===r){for(var al in af){aj[al]=af[al]}}aj.data=ab;aj.width=ae;aj.height=ag;var am={};if(ad&&typeof ad===r){for(var ak in ad){am[ak]=ad[ak]}}if(Z&&typeof Z===r){for(var ai in Z){if(typeof am.flashvars!=D){am.flashvars+="&"+ai+"="+Z[ai]}else{am.flashvars=ai+"="+Z[ai]}}}if(F(Y)){var an=u(aj,am,ah);if(aj.id==ah){w(ah,true)}X.success=true;X.ref=an}else{if(aa&&A()){aj.data=aa;P(aj,am,ah,ac);return}else{w(ah,true)}}if(ac){ac(X)}})}else{if(ac){ac(X)}}},switchOffAutoHideShow:function(){m=false},ua:M,getFlashPlayerVersion:function(){return{major:M.pv[0],minor:M.pv[1],release:M.pv[2]}},hasFlashPlayerVersion:F,createSWF:function(Z,Y,X){if(M.w3){return u(Z,Y,X)}else{return undefined}},showExpressInstall:function(Z,aa,X,Y){if(M.w3&&A()){P(Z,aa,X,Y)}},removeSWF:function(X){if(M.w3){y(X)}},createCSS:function(aa,Z,Y,X){if(M.w3){v(aa,Z,Y,X)}},addDomLoadEvent:K,addLoadEvent:s,getQueryParamValue:function(aa){var Z=j.location.search||j.location.hash;if(Z){if(/\?/.test(Z)){Z=Z.split("?")[1]}if(aa==null){return L(Z)}var Y=Z.split("&");for(var X=0;X<Y.length;X++){if(Y[X].substring(0,Y[X].indexOf("="))==aa){return L(Y[X].substring((Y[X].indexOf("=")+1)))}}}return""},expressInstallCallback:function(){if(a){var X=c(R);if(X&&l){X.parentNode.replaceChild(l,X);if(Q){w(Q,true);if(M.ie&&M.win){l.style.display="block"}}if(E){E(B)}}a=false}}}}();
}
// Copyright: Hiroshi Ichikawa <http://gimite.net/en/>
// License: New BSD License
// Reference: http://dev.w3.org/html5/websockets/
// Reference: http://tools.ietf.org/html/draft-hixie-thewebsocketprotocol

(function() {
  
  if ('undefined' == typeof window || window.WebSocket) return;

  var console = window.console;
  if (!console || !console.log || !console.error) {
    console = {log: function(){ }, error: function(){ }};
  }
  
  if (!swfobject.hasFlashPlayerVersion("10.0.0")) {
    console.error("Flash Player >= 10.0.0 is required.");
    return;
  }
  if (location.protocol == "file:") {
    console.error(
      "WARNING: web-socket-js doesn't work in file:///... URL " +
      "unless you set Flash Security Settings properly. " +
      "Open the page via Web server i.e. http://...");
  }

  /**
   * This class represents a faux web socket.
   * @param {string} url
   * @param {array or string} protocols
   * @param {string} proxyHost
   * @param {int} proxyPort
   * @param {string} headers
   */
  WebSocket = function(url, protocols, proxyHost, proxyPort, headers) {
    var self = this;
    self.__id = WebSocket.__nextId++;
    WebSocket.__instances[self.__id] = self;
    self.readyState = WebSocket.CONNECTING;
    self.bufferedAmount = 0;
    self.__events = {};
    if (!protocols) {
      protocols = [];
    } else if (typeof protocols == "string") {
      protocols = [protocols];
    }
    // Uses setTimeout() to make sure __createFlash() runs after the caller sets ws.onopen etc.
    // Otherwise, when onopen fires immediately, onopen is called before it is set.
    setTimeout(function() {
      WebSocket.__addTask(function() {
        WebSocket.__flash.create(
            self.__id, url, protocols, proxyHost || null, proxyPort || 0, headers || null);
      });
    }, 0);
  };

  /**
   * Send data to the web socket.
   * @param {string} data  The data to send to the socket.
   * @return {boolean}  True for success, false for failure.
   */
  WebSocket.prototype.send = function(data) {
    if (this.readyState == WebSocket.CONNECTING) {
      throw "INVALID_STATE_ERR: Web Socket connection has not been established";
    }
    // We use encodeURIComponent() here, because FABridge doesn't work if
    // the argument includes some characters. We don't use escape() here
    // because of this:
    // https://developer.mozilla.org/en/Core_JavaScript_1.5_Guide/Functions#escape_and_unescape_Functions
    // But it looks decodeURIComponent(encodeURIComponent(s)) doesn't
    // preserve all Unicode characters either e.g. "\uffff" in Firefox.
    // Note by wtritch: Hopefully this will not be necessary using ExternalInterface.  Will require
    // additional testing.
    var result = WebSocket.__flash.send(this.__id, encodeURIComponent(data));
    if (result < 0) { // success
      return true;
    } else {
      this.bufferedAmount += result;
      return false;
    }
  };

  /**
   * Close this web socket gracefully.
   */
  WebSocket.prototype.close = function() {
    if (this.readyState == WebSocket.CLOSED || this.readyState == WebSocket.CLOSING) {
      return;
    }
    this.readyState = WebSocket.CLOSING;
    WebSocket.__flash.close(this.__id);
  };

  /**
   * Implementation of {@link <a href="http://www.w3.org/TR/DOM-Level-2-Events/events.html#Events-registration">DOM 2 EventTarget Interface</a>}
   *
   * @param {string} type
   * @param {function} listener
   * @param {boolean} useCapture
   * @return void
   */
  WebSocket.prototype.addEventListener = function(type, listener, useCapture) {
    if (!(type in this.__events)) {
      this.__events[type] = [];
    }
    this.__events[type].push(listener);
  };

  /**
   * Implementation of {@link <a href="http://www.w3.org/TR/DOM-Level-2-Events/events.html#Events-registration">DOM 2 EventTarget Interface</a>}
   *
   * @param {string} type
   * @param {function} listener
   * @param {boolean} useCapture
   * @return void
   */
  WebSocket.prototype.removeEventListener = function(type, listener, useCapture) {
    if (!(type in this.__events)) return;
    var events = this.__events[type];
    for (var i = events.length - 1; i >= 0; --i) {
      if (events[i] === listener) {
        events.splice(i, 1);
        break;
      }
    }
  };

  /**
   * Implementation of {@link <a href="http://www.w3.org/TR/DOM-Level-2-Events/events.html#Events-registration">DOM 2 EventTarget Interface</a>}
   *
   * @param {Event} event
   * @return void
   */
  WebSocket.prototype.dispatchEvent = function(event) {
    var events = this.__events[event.type] || [];
    for (var i = 0; i < events.length; ++i) {
      events[i](event);
    }
    var handler = this["on" + event.type];
    if (handler) handler(event);
  };

  /**
   * Handles an event from Flash.
   * @param {Object} flashEvent
   */
  WebSocket.prototype.__handleEvent = function(flashEvent) {
    if ("readyState" in flashEvent) {
      this.readyState = flashEvent.readyState;
    }
    if ("protocol" in flashEvent) {
      this.protocol = flashEvent.protocol;
    }
    
    var jsEvent;
    if (flashEvent.type == "open" || flashEvent.type == "error") {
      jsEvent = this.__createSimpleEvent(flashEvent.type);
    } else if (flashEvent.type == "close") {
      // TODO implement jsEvent.wasClean
      jsEvent = this.__createSimpleEvent("close");
    } else if (flashEvent.type == "message") {
      var data = decodeURIComponent(flashEvent.message);
      jsEvent = this.__createMessageEvent("message", data);
    } else {
      throw "unknown event type: " + flashEvent.type;
    }
    
    this.dispatchEvent(jsEvent);
  };
  
  WebSocket.prototype.__createSimpleEvent = function(type) {
    if (document.createEvent && window.Event) {
      var event = document.createEvent("Event");
      event.initEvent(type, false, false);
      return event;
    } else {
      return {type: type, bubbles: false, cancelable: false};
    }
  };
  
  WebSocket.prototype.__createMessageEvent = function(type, data) {
    if (document.createEvent && window.MessageEvent && !window.opera) {
      var event = document.createEvent("MessageEvent");
      event.initMessageEvent("message", false, false, data, null, null, window, null);
      return event;
    } else {
      // IE and Opera, the latter one truncates the data parameter after any 0x00 bytes.
      return {type: type, data: data, bubbles: false, cancelable: false};
    }
  };
  
  /**
   * Define the WebSocket readyState enumeration.
   */
  WebSocket.CONNECTING = 0;
  WebSocket.OPEN = 1;
  WebSocket.CLOSING = 2;
  WebSocket.CLOSED = 3;

  WebSocket.__flash = null;
  WebSocket.__instances = {};
  WebSocket.__tasks = [];
  WebSocket.__nextId = 0;
  
  /**
   * Load a new flash security policy file.
   * @param {string} url
   */
  WebSocket.loadFlashPolicyFile = function(url){
    WebSocket.__addTask(function() {
      WebSocket.__flash.loadManualPolicyFile(url);
    });
  };

  /**
   * Loads WebSocketMain.swf and creates WebSocketMain object in Flash.
   */
  WebSocket.__initialize = function() {
    if (WebSocket.__flash) return;
    
    if (WebSocket.__swfLocation) {
      // For backword compatibility.
      window.WEB_SOCKET_SWF_LOCATION = WebSocket.__swfLocation;
    }
    if (!window.WEB_SOCKET_SWF_LOCATION) {
      console.error("[WebSocket] set WEB_SOCKET_SWF_LOCATION to location of WebSocketMain.swf");
      return;
    }
    var container = document.createElement("div");
    container.id = "webSocketContainer";
    // Hides Flash box. We cannot use display: none or visibility: hidden because it prevents
    // Flash from loading at least in IE. So we move it out of the screen at (-100, -100).
    // But this even doesn't work with Flash Lite (e.g. in Droid Incredible). So with Flash
    // Lite, we put it at (0, 0). This shows 1x1 box visible at left-top corner but this is
    // the best we can do as far as we know now.
    container.style.position = "absolute";
    if (WebSocket.__isFlashLite()) {
      container.style.left = "0px";
      container.style.top = "0px";
    } else {
      container.style.left = "-100px";
      container.style.top = "-100px";
    }
    var holder = document.createElement("div");
    holder.id = "webSocketFlash";
    container.appendChild(holder);
    document.body.appendChild(container);
    // See this article for hasPriority:
    // http://help.adobe.com/en_US/as3/mobile/WS4bebcd66a74275c36cfb8137124318eebc6-7ffd.html
    swfobject.embedSWF(
      WEB_SOCKET_SWF_LOCATION,
      "webSocketFlash",
      "1" /* width */,
      "1" /* height */,
      "10.0.0" /* SWF version */,
      null,
      null,
      {hasPriority: true, swliveconnect : true, allowScriptAccess: "always"},
      null,
      function(e) {
        if (!e.success) {
          console.error("[WebSocket] swfobject.embedSWF failed");
        }
      });
  };
  
  /**
   * Called by Flash to notify JS that it's fully loaded and ready
   * for communication.
   */
  WebSocket.__onFlashInitialized = function() {
    // We need to set a timeout here to avoid round-trip calls
    // to flash during the initialization process.
    setTimeout(function() {
      WebSocket.__flash = document.getElementById("webSocketFlash");
      WebSocket.__flash.setCallerUrl(location.href);
      WebSocket.__flash.setDebug(!!window.WEB_SOCKET_DEBUG);
      for (var i = 0; i < WebSocket.__tasks.length; ++i) {
        WebSocket.__tasks[i]();
      }
      WebSocket.__tasks = [];
    }, 0);
  };
  
  /**
   * Called by Flash to notify WebSockets events are fired.
   */
  WebSocket.__onFlashEvent = function() {
    setTimeout(function() {
      try {
        // Gets events using receiveEvents() instead of getting it from event object
        // of Flash event. This is to make sure to keep message order.
        // It seems sometimes Flash events don't arrive in the same order as they are sent.
        var events = WebSocket.__flash.receiveEvents();
        for (var i = 0; i < events.length; ++i) {
          WebSocket.__instances[events[i].webSocketId].__handleEvent(events[i]);
        }
      } catch (e) {
        console.error(e);
      }
    }, 0);
    return true;
  };
  
  // Called by Flash.
  WebSocket.__log = function(message) {
    console.log(decodeURIComponent(message));
  };
  
  // Called by Flash.
  WebSocket.__error = function(message) {
    console.error(decodeURIComponent(message));
  };
  
  WebSocket.__addTask = function(task) {
    if (WebSocket.__flash) {
      task();
    } else {
      WebSocket.__tasks.push(task);
    }
  };
  
  /**
   * Test if the browser is running flash lite.
   * @return {boolean} True if flash lite is running, false otherwise.
   */
  WebSocket.__isFlashLite = function() {
    if (!window.navigator || !window.navigator.mimeTypes) {
      return false;
    }
    var mimeType = window.navigator.mimeTypes["application/x-shockwave-flash"];
    if (!mimeType || !mimeType.enabledPlugin || !mimeType.enabledPlugin.filename) {
      return false;
    }
    return mimeType.enabledPlugin.filename.match(/flashlite/i) ? true : false;
  };
  
  if (!window.WEB_SOCKET_DISABLE_AUTO_INITIALIZATION) {
    if (window.addEventListener) {
      window.addEventListener("load", function(){
        WebSocket.__initialize();
      }, false);
    } else {
      window.attachEvent("onload", function(){
        WebSocket.__initialize();
      });
    }
  }
  
})();

/**
 * socket.io
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function (exports, io, global) {

  /**
   * Expose constructor.
   *
   * @api public
   */

  exports.XHR = XHR;

  /**
   * XHR constructor
   *
   * @costructor
   * @api public
   */

  function XHR (socket) {
    if (!socket) return;

    io.Transport.apply(this, arguments);
    this.sendBuffer = [];
  };

  /**
   * Inherits from Transport.
   */

  io.util.inherit(XHR, io.Transport);

  /**
   * Establish a connection
   *
   * @returns {Transport}
   * @api public
   */

  XHR.prototype.open = function () {
    this.socket.setBuffer(false);
    this.onOpen();
    this.get();

    // we need to make sure the request succeeds since we have no indication
    // whether the request opened or not until it succeeded.
    this.setCloseTimeout();

    return this;
  };

  /**
   * Check if we need to send data to the Socket.IO server, if we have data in our
   * buffer we encode it and forward it to the `post` method.
   *
   * @api private
   */

  XHR.prototype.payload = function (payload) {
    var msgs = [];

    for (var i = 0, l = payload.length; i < l; i++) {
      msgs.push(io.parser.encodePacket(payload[i]));
    }

    this.send(io.parser.encodePayload(msgs));
  };

  /**
   * Send data to the Socket.IO server.
   *
   * @param data The message
   * @returns {Transport}
   * @api public
   */

  XHR.prototype.send = function (data) {
    this.post(data);
    return this;
  };

  /**
   * Posts a encoded message to the Socket.IO server.
   *
   * @param {String} data A encoded message.
   * @api private
   */

  function empty () { };

  XHR.prototype.post = function (data) {
    var self = this;
    this.socket.setBuffer(true);

    function stateChange () {
      if (this.readyState == 4) {
        this.onreadystatechange = empty;
        self.posting = false;

        if (this.status == 200){
          self.socket.setBuffer(false);
        } else {
          self.onClose();
        }
      }
    }

    function onload () {
      this.onload = empty;
      self.socket.setBuffer(false);
    };

    this.sendXHR = this.request('POST');

    if (global.XDomainRequest && this.sendXHR instanceof XDomainRequest) {
      this.sendXHR.onload = this.sendXHR.onerror = onload;
    } else {
      this.sendXHR.onreadystatechange = stateChange;
    }

    this.sendXHR.send(data);
  };

  /**
   * Disconnects the established `XHR` connection.
   *
   * @returns {Transport}
   * @api public
   */

  XHR.prototype.close = function () {
    this.onClose();
    return this;
  };

  /**
   * Generates a configured XHR request
   *
   * @param {String} url The url that needs to be requested.
   * @param {String} method The method the request should use.
   * @returns {XMLHttpRequest}
   * @api private
   */

  XHR.prototype.request = function (method) {
    var req = io.util.request(this.socket.isXDomain())
      , query = io.util.query(this.socket.options.query, 't=' + +new Date);

    req.open(method || 'GET', this.prepareUrl() + query, true);

    if (method == 'POST') {
      try {
        if (req.setRequestHeader) {
          req.setRequestHeader('Content-type', 'text/plain;charset=UTF-8');
        } else {
          // XDomainRequest
          req.contentType = 'text/plain';
        }
      } catch (e) {}
    }

    return req;
  };

  /**
   * Returns the scheme to use for the transport URLs.
   *
   * @api private
   */

  XHR.prototype.scheme = function () {
    return this.socket.options.secure ? 'https' : 'http';
  };

  /**
   * Check if the XHR transports are supported
   *
   * @param {Boolean} xdomain Check if we support cross domain requests.
   * @returns {Boolean}
   * @api public
   */

  XHR.check = function (socket, xdomain) {
    try {
      var request = io.util.request(xdomain),
          usesXDomReq = (global.XDomainRequest && request instanceof XDomainRequest),
          socketProtocol = (socket && socket.options && socket.options.secure ? 'https:' : 'http:'),
          isXProtocol = (global.location && socketProtocol != global.location.protocol);
      if (request && !(usesXDomReq && isXProtocol)) {
        return true;
      }
    } catch(e) {}

    return false;
  };

  /**
   * Check if the XHR transport supports cross domain requests.
   *
   * @returns {Boolean}
   * @api public
   */

  XHR.xdomainCheck = function (socket) {
    return XHR.check(socket, true);
  };

})(
    'undefined' != typeof io ? io.Transport : module.exports
  , 'undefined' != typeof io ? io : module.parent.exports
  , this
);
/**
 * socket.io
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function (exports, io) {

  /**
   * Expose constructor.
   */

  exports.htmlfile = HTMLFile;

  /**
   * The HTMLFile transport creates a `forever iframe` based transport
   * for Internet Explorer. Regular forever iframe implementations will 
   * continuously trigger the browsers buzy indicators. If the forever iframe
   * is created inside a `htmlfile` these indicators will not be trigged.
   *
   * @constructor
   * @extends {io.Transport.XHR}
   * @api public
   */

  function HTMLFile (socket) {
    io.Transport.XHR.apply(this, arguments);
  };

  /**
   * Inherits from XHR transport.
   */

  io.util.inherit(HTMLFile, io.Transport.XHR);

  /**
   * Transport name
   *
   * @api public
   */

  HTMLFile.prototype.name = 'htmlfile';

  /**
   * Creates a new Ac...eX `htmlfile` with a forever loading iframe
   * that can be used to listen to messages. Inside the generated
   * `htmlfile` a reference will be made to the HTMLFile transport.
   *
   * @api private
   */

  HTMLFile.prototype.get = function () {
    this.doc = new window[(['Active'].concat('Object').join('X'))]('htmlfile');
    this.doc.open();
    this.doc.write('<html></html>');
    this.doc.close();
    this.doc.parentWindow.s = this;

    var iframeC = this.doc.createElement('div');
    iframeC.className = 'socketio';

    this.doc.body.appendChild(iframeC);
    this.iframe = this.doc.createElement('iframe');

    iframeC.appendChild(this.iframe);

    var self = this
      , query = io.util.query(this.socket.options.query, 't='+ +new Date);

    this.iframe.src = this.prepareUrl() + query;

    io.util.on(window, 'unload', function () {
      self.destroy();
    });
  };

  /**
   * The Socket.IO server will write script tags inside the forever
   * iframe, this function will be used as callback for the incoming
   * information.
   *
   * @param {String} data The message
   * @param {document} doc Reference to the context
   * @api private
   */

  HTMLFile.prototype._ = function (data, doc) {
    // unescape all forward slashes. see GH-1251
    data = data.replace(/\\\//g, '/');
    this.onData(data);
    try {
      var script = doc.getElementsByTagName('script')[0];
      script.parentNode.removeChild(script);
    } catch (e) { }
  };

  /**
   * Destroy the established connection, iframe and `htmlfile`.
   * And calls the `CollectGarbage` function of Internet Explorer
   * to release the memory.
   *
   * @api private
   */

  HTMLFile.prototype.destroy = function () {
    if (this.iframe){
      try {
        this.iframe.src = 'about:blank';
      } catch(e){}

      this.doc = null;
      this.iframe.parentNode.removeChild(this.iframe);
      this.iframe = null;

      CollectGarbage();
    }
  };

  /**
   * Disconnects the established connection.
   *
   * @returns {Transport} Chaining.
   * @api public
   */

  HTMLFile.prototype.close = function () {
    this.destroy();
    return io.Transport.XHR.prototype.close.call(this);
  };

  /**
   * Checks if the browser supports this transport. The browser
   * must have an `Ac...eXObject` implementation.
   *
   * @return {Boolean}
   * @api public
   */

  HTMLFile.check = function (socket) {
    if (typeof window != "undefined" && (['Active'].concat('Object').join('X')) in window){
      try {
        var a = new window[(['Active'].concat('Object').join('X'))]('htmlfile');
        return a && io.Transport.XHR.check(socket);
      } catch(e){}
    }
    return false;
  };

  /**
   * Check if cross domain requests are supported.
   *
   * @returns {Boolean}
   * @api public
   */

  HTMLFile.xdomainCheck = function () {
    // we can probably do handling for sub-domains, we should
    // test that it's cross domain but a subdomain here
    return false;
  };

  /**
   * Add the transport to your public io.transports array.
   *
   * @api private
   */

  io.transports.push('htmlfile');

})(
    'undefined' != typeof io ? io.Transport : module.exports
  , 'undefined' != typeof io ? io : module.parent.exports
);

/**
 * socket.io
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function (exports, io, global) {

  /**
   * Expose constructor.
   */

  exports['xhr-polling'] = XHRPolling;

  /**
   * The XHR-polling transport uses long polling XHR requests to create a
   * "persistent" connection with the server.
   *
   * @constructor
   * @api public
   */

  function XHRPolling () {
    io.Transport.XHR.apply(this, arguments);
  };

  /**
   * Inherits from XHR transport.
   */

  io.util.inherit(XHRPolling, io.Transport.XHR);

  /**
   * Merge the properties from XHR transport
   */

  io.util.merge(XHRPolling, io.Transport.XHR);

  /**
   * Transport name
   *
   * @api public
   */

  XHRPolling.prototype.name = 'xhr-polling';

  /**
   * Indicates whether heartbeats is enabled for this transport
   *
   * @api private
   */

  XHRPolling.prototype.heartbeats = function () {
    return false;
  };

  /** 
   * Establish a connection, for iPhone and Android this will be done once the page
   * is loaded.
   *
   * @returns {Transport} Chaining.
   * @api public
   */

  XHRPolling.prototype.open = function () {
    var self = this;

    io.Transport.XHR.prototype.open.call(self);
    return false;
  };

  /**
   * Starts a XHR request to wait for incoming messages.
   *
   * @api private
   */

  function empty () {};

  XHRPolling.prototype.get = function () {
    if (!this.isOpen) return;

    var self = this;

    function stateChange () {
      if (this.readyState == 4) {
        this.onreadystatechange = empty;

        if (this.status == 200) {
          self.onData(this.responseText);
          self.get();
        } else {
          self.onClose();
        }
      }
    };

    function onload () {
      this.onload = empty;
      this.onerror = empty;
      self.retryCounter = 1;
      self.onData(this.responseText);
      self.get();
    };

    function onerror () {
      self.retryCounter ++;
      if(!self.retryCounter || self.retryCounter > 3) {
        self.onClose();  
      } else {
        self.get();
      }
    };

    this.xhr = this.request();

    if (global.XDomainRequest && this.xhr instanceof XDomainRequest) {
      this.xhr.onload = onload;
      this.xhr.onerror = onerror;
    } else {
      this.xhr.onreadystatechange = stateChange;
    }

    this.xhr.send(null);
  };

  /**
   * Handle the unclean close behavior.
   *
   * @api private
   */

  XHRPolling.prototype.onClose = function () {
    io.Transport.XHR.prototype.onClose.call(this);

    if (this.xhr) {
      this.xhr.onreadystatechange = this.xhr.onload = this.xhr.onerror = empty;
      try {
        this.xhr.abort();
      } catch(e){}
      this.xhr = null;
    }
  };

  /**
   * Webkit based browsers show a infinit spinner when you start a XHR request
   * before the browsers onload event is called so we need to defer opening of
   * the transport until the onload event is called. Wrapping the cb in our
   * defer method solve this.
   *
   * @param {Socket} socket The socket instance that needs a transport
   * @param {Function} fn The callback
   * @api private
   */

  XHRPolling.prototype.ready = function (socket, fn) {
    var self = this;

    io.util.defer(function () {
      fn.call(self);
    });
  };

  /**
   * Add the transport to your public io.transports array.
   *
   * @api private
   */

  io.transports.push('xhr-polling');

})(
    'undefined' != typeof io ? io.Transport : module.exports
  , 'undefined' != typeof io ? io : module.parent.exports
  , this
);

/**
 * socket.io
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function (exports, io, global) {
  /**
   * There is a way to hide the loading indicator in Firefox. If you create and
   * remove a iframe it will stop showing the current loading indicator.
   * Unfortunately we can't feature detect that and UA sniffing is evil.
   *
   * @api private
   */

  var indicator = global.document && "MozAppearance" in
    global.document.documentElement.style;

  /**
   * Expose constructor.
   */

  exports['jsonp-polling'] = JSONPPolling;

  /**
   * The JSONP transport creates an persistent connection by dynamically
   * inserting a script tag in the page. This script tag will receive the
   * information of the Socket.IO server. When new information is received
   * it creates a new script tag for the new data stream.
   *
   * @constructor
   * @extends {io.Transport.xhr-polling}
   * @api public
   */

  function JSONPPolling (socket) {
    io.Transport['xhr-polling'].apply(this, arguments);

    this.index = io.j.length;

    var self = this;

    io.j.push(function (msg) {
      self._(msg);
    });
  };

  /**
   * Inherits from XHR polling transport.
   */

  io.util.inherit(JSONPPolling, io.Transport['xhr-polling']);

  /**
   * Transport name
   *
   * @api public
   */

  JSONPPolling.prototype.name = 'jsonp-polling';

  /**
   * Posts a encoded message to the Socket.IO server using an iframe.
   * The iframe is used because script tags can create POST based requests.
   * The iframe is positioned outside of the view so the user does not
   * notice it's existence.
   *
   * @param {String} data A encoded message.
   * @api private
   */

  JSONPPolling.prototype.post = function (data) {
    var self = this
      , query = io.util.query(
             this.socket.options.query
          , 't='+ (+new Date) + '&i=' + this.index
        );

    if (!this.form) {
      var form = document.createElement('form')
        , area = document.createElement('textarea')
        , id = this.iframeId = 'socketio_iframe_' + this.index
        , iframe;

      form.className = 'socketio';
      form.style.position = 'absolute';
      form.style.top = '0px';
      form.style.left = '0px';
      form.style.display = 'none';
      form.target = id;
      form.method = 'POST';
      form.setAttribute('accept-charset', 'utf-8');
      area.name = 'd';
      form.appendChild(area);
      document.body.appendChild(form);

      this.form = form;
      this.area = area;
    }

    this.form.action = this.prepareUrl() + query;

    function complete () {
      initIframe();
      self.socket.setBuffer(false);
    };

    function initIframe () {
      if (self.iframe) {
        self.form.removeChild(self.iframe);
      }

      try {
        // ie6 dynamic iframes with target="" support (thanks Chris Lambacher)
        iframe = document.createElement('<iframe name="'+ self.iframeId +'">');
      } catch (e) {
        iframe = document.createElement('iframe');
        iframe.name = self.iframeId;
      }

      iframe.id = self.iframeId;

      self.form.appendChild(iframe);
      self.iframe = iframe;
    };

    initIframe();

    // we temporarily stringify until we figure out how to prevent
    // browsers from turning `\n` into `\r\n` in form inputs
    this.area.value = io.JSON.stringify(data);

    try {
      this.form.submit();
    } catch(e) {}

    if (this.iframe.attachEvent) {
      iframe.onreadystatechange = function () {
        if (self.iframe.readyState == 'complete') {
          complete();
        }
      };
    } else {
      this.iframe.onload = complete;
    }

    this.socket.setBuffer(true);
  };

  /**
   * Creates a new JSONP poll that can be used to listen
   * for messages from the Socket.IO server.
   *
   * @api private
   */

  JSONPPolling.prototype.get = function () {
    var self = this
      , script = document.createElement('script')
      , query = io.util.query(
             this.socket.options.query
          , 't='+ (+new Date) + '&i=' + this.index
        );

    if (this.script) {
      this.script.parentNode.removeChild(this.script);
      this.script = null;
    }

    script.async = true;
    script.src = this.prepareUrl() + query;
    script.onerror = function () {
      self.onClose();
    };

    var insertAt = document.getElementsByTagName('script')[0];
    insertAt.parentNode.insertBefore(script, insertAt);
    this.script = script;

    if (indicator) {
      setTimeout(function () {
        var iframe = document.createElement('iframe');
        document.body.appendChild(iframe);
        document.body.removeChild(iframe);
      }, 100);
    }
  };

  /**
   * Callback function for the incoming message stream from the Socket.IO server.
   *
   * @param {String} data The message
   * @api private
   */

  JSONPPolling.prototype._ = function (msg) {
    this.onData(msg);
    if (this.isOpen) {
      this.get();
    }
    return this;
  };

  /**
   * The indicator hack only works after onload
   *
   * @param {Socket} socket The socket instance that needs a transport
   * @param {Function} fn The callback
   * @api private
   */

  JSONPPolling.prototype.ready = function (socket, fn) {
    var self = this;
    if (!indicator) return fn.call(this);

    io.util.load(function () {
      fn.call(self);
    });
  };

  /**
   * Checks if browser supports this transport.
   *
   * @return {Boolean}
   * @api public
   */

  JSONPPolling.check = function () {
    return 'document' in global;
  };

  /**
   * Check if cross domain requests are supported
   *
   * @returns {Boolean}
   * @api public
   */

  JSONPPolling.xdomainCheck = function () {
    return true;
  };

  /**
   * Add the transport to your public io.transports array.
   *
   * @api private
   */

  io.transports.push('jsonp-polling');

})(
    'undefined' != typeof io ? io.Transport : module.exports
  , 'undefined' != typeof io ? io : module.parent.exports
  , this
);

if (typeof define === "function" && define.amd) {
  define([], function () { return io; });
}
})();
},{}],12:[function(require,module,exports){
//     Underscore.js 1.8.3
//     http://underscorejs.org
//     (c) 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `exports` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var
    push             = ArrayProto.push,
    slice            = ArrayProto.slice,
    toString         = ObjProto.toString,
    hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind,
    nativeCreate       = Object.create;

  // Naked function reference for surrogate-prototype-swapping.
  var Ctor = function(){};

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.8.3';

  // Internal function that returns an efficient (for current engines) version
  // of the passed-in callback, to be repeatedly applied in other Underscore
  // functions.
  var optimizeCb = function(func, context, argCount) {
    if (context === void 0) return func;
    switch (argCount == null ? 3 : argCount) {
      case 1: return function(value) {
        return func.call(context, value);
      };
      case 2: return function(value, other) {
        return func.call(context, value, other);
      };
      case 3: return function(value, index, collection) {
        return func.call(context, value, index, collection);
      };
      case 4: return function(accumulator, value, index, collection) {
        return func.call(context, accumulator, value, index, collection);
      };
    }
    return function() {
      return func.apply(context, arguments);
    };
  };

  // A mostly-internal function to generate callbacks that can be applied
  // to each element in a collection, returning the desired result — either
  // identity, an arbitrary callback, a property matcher, or a property accessor.
  var cb = function(value, context, argCount) {
    if (value == null) return _.identity;
    if (_.isFunction(value)) return optimizeCb(value, context, argCount);
    if (_.isObject(value)) return _.matcher(value);
    return _.property(value);
  };
  _.iteratee = function(value, context) {
    return cb(value, context, Infinity);
  };

  // An internal function for creating assigner functions.
  var createAssigner = function(keysFunc, undefinedOnly) {
    return function(obj) {
      var length = arguments.length;
      if (length < 2 || obj == null) return obj;
      for (var index = 1; index < length; index++) {
        var source = arguments[index],
            keys = keysFunc(source),
            l = keys.length;
        for (var i = 0; i < l; i++) {
          var key = keys[i];
          if (!undefinedOnly || obj[key] === void 0) obj[key] = source[key];
        }
      }
      return obj;
    };
  };

  // An internal function for creating a new object that inherits from another.
  var baseCreate = function(prototype) {
    if (!_.isObject(prototype)) return {};
    if (nativeCreate) return nativeCreate(prototype);
    Ctor.prototype = prototype;
    var result = new Ctor;
    Ctor.prototype = null;
    return result;
  };

  var property = function(key) {
    return function(obj) {
      return obj == null ? void 0 : obj[key];
    };
  };

  // Helper for collection methods to determine whether a collection
  // should be iterated as an array or as an object
  // Related: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
  // Avoids a very nasty iOS 8 JIT bug on ARM-64. #2094
  var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
  var getLength = property('length');
  var isArrayLike = function(collection) {
    var length = getLength(collection);
    return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
  };

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles raw objects in addition to array-likes. Treats all
  // sparse array-likes as if they were dense.
  _.each = _.forEach = function(obj, iteratee, context) {
    iteratee = optimizeCb(iteratee, context);
    var i, length;
    if (isArrayLike(obj)) {
      for (i = 0, length = obj.length; i < length; i++) {
        iteratee(obj[i], i, obj);
      }
    } else {
      var keys = _.keys(obj);
      for (i = 0, length = keys.length; i < length; i++) {
        iteratee(obj[keys[i]], keys[i], obj);
      }
    }
    return obj;
  };

  // Return the results of applying the iteratee to each element.
  _.map = _.collect = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length,
        results = Array(length);
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      results[index] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  };

  // Create a reducing function iterating left or right.
  function createReduce(dir) {
    // Optimized iterator function as using arguments.length
    // in the main function will deoptimize the, see #1991.
    function iterator(obj, iteratee, memo, keys, index, length) {
      for (; index >= 0 && index < length; index += dir) {
        var currentKey = keys ? keys[index] : index;
        memo = iteratee(memo, obj[currentKey], currentKey, obj);
      }
      return memo;
    }

    return function(obj, iteratee, memo, context) {
      iteratee = optimizeCb(iteratee, context, 4);
      var keys = !isArrayLike(obj) && _.keys(obj),
          length = (keys || obj).length,
          index = dir > 0 ? 0 : length - 1;
      // Determine the initial value if none is provided.
      if (arguments.length < 3) {
        memo = obj[keys ? keys[index] : index];
        index += dir;
      }
      return iterator(obj, iteratee, memo, keys, index, length);
    };
  }

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`.
  _.reduce = _.foldl = _.inject = createReduce(1);

  // The right-associative version of reduce, also known as `foldr`.
  _.reduceRight = _.foldr = createReduce(-1);

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, predicate, context) {
    var key;
    if (isArrayLike(obj)) {
      key = _.findIndex(obj, predicate, context);
    } else {
      key = _.findKey(obj, predicate, context);
    }
    if (key !== void 0 && key !== -1) return obj[key];
  };

  // Return all the elements that pass a truth test.
  // Aliased as `select`.
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    predicate = cb(predicate, context);
    _.each(obj, function(value, index, list) {
      if (predicate(value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, _.negate(cb(predicate)), context);
  };

  // Determine whether all of the elements match a truth test.
  // Aliased as `all`.
  _.every = _.all = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (!predicate(obj[currentKey], currentKey, obj)) return false;
    }
    return true;
  };

  // Determine if at least one element in the object matches a truth test.
  // Aliased as `any`.
  _.some = _.any = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (predicate(obj[currentKey], currentKey, obj)) return true;
    }
    return false;
  };

  // Determine if the array or object contains a given item (using `===`).
  // Aliased as `includes` and `include`.
  _.contains = _.includes = _.include = function(obj, item, fromIndex, guard) {
    if (!isArrayLike(obj)) obj = _.values(obj);
    if (typeof fromIndex != 'number' || guard) fromIndex = 0;
    return _.indexOf(obj, item, fromIndex) >= 0;
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      var func = isFunc ? method : value[method];
      return func == null ? func : func.apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matcher(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matcher(attrs));
  };

  // Return the maximum element (or element-based computation).
  _.max = function(obj, iteratee, context) {
    var result = -Infinity, lastComputed = -Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value > result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iteratee, context) {
    var result = Infinity, lastComputed = Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value < result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed < lastComputed || computed === Infinity && result === Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Shuffle a collection, using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  _.shuffle = function(obj) {
    var set = isArrayLike(obj) ? obj : _.values(obj);
    var length = set.length;
    var shuffled = Array(length);
    for (var index = 0, rand; index < length; index++) {
      rand = _.random(0, index);
      if (rand !== index) shuffled[index] = shuffled[rand];
      shuffled[rand] = set[index];
    }
    return shuffled;
  };

  // Sample **n** random values from a collection.
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  _.sample = function(obj, n, guard) {
    if (n == null || guard) {
      if (!isArrayLike(obj)) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }
    return _.shuffle(obj).slice(0, Math.max(0, n));
  };

  // Sort the object's values by a criterion produced by an iteratee.
  _.sortBy = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value: value,
        index: index,
        criteria: iteratee(value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(behavior) {
    return function(obj, iteratee, context) {
      var result = {};
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index) {
        var key = iteratee(value, index, obj);
        behavior(result, value, key);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key].push(value); else result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  _.indexBy = group(function(result, value, key) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key]++; else result[key] = 1;
  });

  // Safely create a real, live array from anything iterable.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (isArrayLike(obj)) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return isArrayLike(obj) ? obj.length : _.keys(obj).length;
  };

  // Split a collection into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
  _.partition = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var pass = [], fail = [];
    _.each(obj, function(value, key, obj) {
      (predicate(value, key, obj) ? pass : fail).push(value);
    });
    return [pass, fail];
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[0];
    return _.initial(array, array.length - n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array.
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[array.length - 1];
    return _.rest(array, Math.max(0, array.length - n));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, n == null || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, strict, startIndex) {
    var output = [], idx = 0;
    for (var i = startIndex || 0, length = getLength(input); i < length; i++) {
      var value = input[i];
      if (isArrayLike(value) && (_.isArray(value) || _.isArguments(value))) {
        //flatten current level of array or arguments object
        if (!shallow) value = flatten(value, shallow, strict);
        var j = 0, len = value.length;
        output.length += len;
        while (j < len) {
          output[idx++] = value[j++];
        }
      } else if (!strict) {
        output[idx++] = value;
      }
    }
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, false);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iteratee, context) {
    if (!_.isBoolean(isSorted)) {
      context = iteratee;
      iteratee = isSorted;
      isSorted = false;
    }
    if (iteratee != null) iteratee = cb(iteratee, context);
    var result = [];
    var seen = [];
    for (var i = 0, length = getLength(array); i < length; i++) {
      var value = array[i],
          computed = iteratee ? iteratee(value, i, array) : value;
      if (isSorted) {
        if (!i || seen !== computed) result.push(value);
        seen = computed;
      } else if (iteratee) {
        if (!_.contains(seen, computed)) {
          seen.push(computed);
          result.push(value);
        }
      } else if (!_.contains(result, value)) {
        result.push(value);
      }
    }
    return result;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(flatten(arguments, true, true));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    var result = [];
    var argsLength = arguments.length;
    for (var i = 0, length = getLength(array); i < length; i++) {
      var item = array[i];
      if (_.contains(result, item)) continue;
      for (var j = 1; j < argsLength; j++) {
        if (!_.contains(arguments[j], item)) break;
      }
      if (j === argsLength) result.push(item);
    }
    return result;
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = flatten(arguments, true, true, 1);
    return _.filter(array, function(value){
      return !_.contains(rest, value);
    });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function() {
    return _.unzip(arguments);
  };

  // Complement of _.zip. Unzip accepts an array of arrays and groups
  // each array's elements on shared indices
  _.unzip = function(array) {
    var length = array && _.max(array, getLength).length || 0;
    var result = Array(length);

    for (var index = 0; index < length; index++) {
      result[index] = _.pluck(array, index);
    }
    return result;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  _.object = function(list, values) {
    var result = {};
    for (var i = 0, length = getLength(list); i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // Generator function to create the findIndex and findLastIndex functions
  function createPredicateIndexFinder(dir) {
    return function(array, predicate, context) {
      predicate = cb(predicate, context);
      var length = getLength(array);
      var index = dir > 0 ? 0 : length - 1;
      for (; index >= 0 && index < length; index += dir) {
        if (predicate(array[index], index, array)) return index;
      }
      return -1;
    };
  }

  // Returns the first index on an array-like that passes a predicate test
  _.findIndex = createPredicateIndexFinder(1);
  _.findLastIndex = createPredicateIndexFinder(-1);

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iteratee, context) {
    iteratee = cb(iteratee, context, 1);
    var value = iteratee(obj);
    var low = 0, high = getLength(array);
    while (low < high) {
      var mid = Math.floor((low + high) / 2);
      if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
    }
    return low;
  };

  // Generator function to create the indexOf and lastIndexOf functions
  function createIndexFinder(dir, predicateFind, sortedIndex) {
    return function(array, item, idx) {
      var i = 0, length = getLength(array);
      if (typeof idx == 'number') {
        if (dir > 0) {
            i = idx >= 0 ? idx : Math.max(idx + length, i);
        } else {
            length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
        }
      } else if (sortedIndex && idx && length) {
        idx = sortedIndex(array, item);
        return array[idx] === item ? idx : -1;
      }
      if (item !== item) {
        idx = predicateFind(slice.call(array, i, length), _.isNaN);
        return idx >= 0 ? idx + i : -1;
      }
      for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
        if (array[idx] === item) return idx;
      }
      return -1;
    };
  }

  // Return the position of the first occurrence of an item in an array,
  // or -1 if the item is not included in the array.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);
  _.lastIndexOf = createIndexFinder(-1, _.findLastIndex);

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (stop == null) {
      stop = start || 0;
      start = 0;
    }
    step = step || 1;

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var range = Array(length);

    for (var idx = 0; idx < length; idx++, start += step) {
      range[idx] = start;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Determines whether to execute a function as a constructor
  // or a normal function with the provided arguments
  var executeBound = function(sourceFunc, boundFunc, context, callingContext, args) {
    if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
    var self = baseCreate(sourceFunc.prototype);
    var result = sourceFunc.apply(self, args);
    if (_.isObject(result)) return result;
    return self;
  };

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = function(func, context) {
    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
    var args = slice.call(arguments, 2);
    var bound = function() {
      return executeBound(func, bound, context, this, args.concat(slice.call(arguments)));
    };
    return bound;
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder, allowing any combination of arguments to be pre-filled.
  _.partial = function(func) {
    var boundArgs = slice.call(arguments, 1);
    var bound = function() {
      var position = 0, length = boundArgs.length;
      var args = Array(length);
      for (var i = 0; i < length; i++) {
        args[i] = boundArgs[i] === _ ? arguments[position++] : boundArgs[i];
      }
      while (position < arguments.length) args.push(arguments[position++]);
      return executeBound(func, bound, this, this, args);
    };
    return bound;
  };

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  _.bindAll = function(obj) {
    var i, length = arguments.length, key;
    if (length <= 1) throw new Error('bindAll must be passed function names');
    for (i = 1; i < length; i++) {
      key = arguments[i];
      obj[key] = _.bind(obj[key], obj);
    }
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memoize = function(key) {
      var cache = memoize.cache;
      var address = '' + (hasher ? hasher.apply(this, arguments) : key);
      if (!_.has(cache, address)) cache[address] = func.apply(this, arguments);
      return cache[address];
    };
    memoize.cache = {};
    return memoize;
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){
      return func.apply(null, args);
    }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = _.partial(_.delay, _, 1);

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  _.throttle = function(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    if (!options) options = {};
    var later = function() {
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    };
    return function() {
      var now = _.now();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, args, context, timestamp, result;

    var later = function() {
      var last = _.now() - timestamp;

      if (last < wait && last >= 0) {
        timeout = setTimeout(later, wait - last);
      } else {
        timeout = null;
        if (!immediate) {
          result = func.apply(context, args);
          if (!timeout) context = args = null;
        }
      }
    };

    return function() {
      context = this;
      args = arguments;
      timestamp = _.now();
      var callNow = immediate && !timeout;
      if (!timeout) timeout = setTimeout(later, wait);
      if (callNow) {
        result = func.apply(context, args);
        context = args = null;
      }

      return result;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a negated version of the passed-in predicate.
  _.negate = function(predicate) {
    return function() {
      return !predicate.apply(this, arguments);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var args = arguments;
    var start = args.length - 1;
    return function() {
      var i = start;
      var result = args[start].apply(this, arguments);
      while (i--) result = args[i].call(this, result);
      return result;
    };
  };

  // Returns a function that will only be executed on and after the Nth call.
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Returns a function that will only be executed up to (but not including) the Nth call.
  _.before = function(times, func) {
    var memo;
    return function() {
      if (--times > 0) {
        memo = func.apply(this, arguments);
      }
      if (times <= 1) func = null;
      return memo;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = _.partial(_.before, 2);

  // Object Functions
  // ----------------

  // Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
  var hasEnumBug = !{toString: null}.propertyIsEnumerable('toString');
  var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
                      'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];

  function collectNonEnumProps(obj, keys) {
    var nonEnumIdx = nonEnumerableProps.length;
    var constructor = obj.constructor;
    var proto = (_.isFunction(constructor) && constructor.prototype) || ObjProto;

    // Constructor is a special case.
    var prop = 'constructor';
    if (_.has(obj, prop) && !_.contains(keys, prop)) keys.push(prop);

    while (nonEnumIdx--) {
      prop = nonEnumerableProps[nonEnumIdx];
      if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
        keys.push(prop);
      }
    }
  }

  // Retrieve the names of an object's own properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve all the property names of an object.
  _.allKeys = function(obj) {
    if (!_.isObject(obj)) return [];
    var keys = [];
    for (var key in obj) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Returns the results of applying the iteratee to each element of the object
  // In contrast to _.map it returns an object
  _.mapObject = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys =  _.keys(obj),
          length = keys.length,
          results = {},
          currentKey;
      for (var index = 0; index < length; index++) {
        currentKey = keys[index];
        results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
      }
      return results;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = createAssigner(_.allKeys);

  // Assigns a given object with all the own properties in the passed-in object(s)
  // (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
  _.extendOwn = _.assign = createAssigner(_.keys);

  // Returns the first key on an object that passes a predicate test
  _.findKey = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = _.keys(obj), key;
    for (var i = 0, length = keys.length; i < length; i++) {
      key = keys[i];
      if (predicate(obj[key], key, obj)) return key;
    }
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(object, oiteratee, context) {
    var result = {}, obj = object, iteratee, keys;
    if (obj == null) return result;
    if (_.isFunction(oiteratee)) {
      keys = _.allKeys(obj);
      iteratee = optimizeCb(oiteratee, context);
    } else {
      keys = flatten(arguments, false, false, 1);
      iteratee = function(value, key, obj) { return key in obj; };
      obj = Object(obj);
    }
    for (var i = 0, length = keys.length; i < length; i++) {
      var key = keys[i];
      var value = obj[key];
      if (iteratee(value, key, obj)) result[key] = value;
    }
    return result;
  };

   // Return a copy of the object without the blacklisted properties.
  _.omit = function(obj, iteratee, context) {
    if (_.isFunction(iteratee)) {
      iteratee = _.negate(iteratee);
    } else {
      var keys = _.map(flatten(arguments, false, false, 1), String);
      iteratee = function(value, key) {
        return !_.contains(keys, key);
      };
    }
    return _.pick(obj, iteratee, context);
  };

  // Fill in a given object with default properties.
  _.defaults = createAssigner(_.allKeys, true);

  // Creates an object that inherits from the given prototype object.
  // If additional properties are provided then they will be added to the
  // created object.
  _.create = function(prototype, props) {
    var result = baseCreate(prototype);
    if (props) _.extendOwn(result, props);
    return result;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Returns whether an object has a given set of `key:value` pairs.
  _.isMatch = function(object, attrs) {
    var keys = _.keys(attrs), length = keys.length;
    if (object == null) return !length;
    var obj = Object(object);
    for (var i = 0; i < length; i++) {
      var key = keys[i];
      if (attrs[key] !== obj[key] || !(key in obj)) return false;
    }
    return true;
  };


  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a === 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className !== toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, regular expressions, dates, and booleans are compared by value.
      case '[object RegExp]':
      // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return '' + a === '' + b;
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive.
        // Object(NaN) is equivalent to NaN
        if (+a !== +a) return +b !== +b;
        // An `egal` comparison is performed for other numeric values.
        return +a === 0 ? 1 / +a === 1 / b : +a === +b;
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a === +b;
    }

    var areArrays = className === '[object Array]';
    if (!areArrays) {
      if (typeof a != 'object' || typeof b != 'object') return false;

      // Objects with different constructors are not equivalent, but `Object`s or `Array`s
      // from different frames are.
      var aCtor = a.constructor, bCtor = b.constructor;
      if (aCtor !== bCtor && !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
                               _.isFunction(bCtor) && bCtor instanceof bCtor)
                          && ('constructor' in a && 'constructor' in b)) {
        return false;
      }
    }
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.

    // Initializing stack of traversed objects.
    // It's done here since we only need them for objects and arrays comparison.
    aStack = aStack || [];
    bStack = bStack || [];
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] === a) return bStack[length] === b;
    }

    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);

    // Recursively compare objects and arrays.
    if (areArrays) {
      // Compare array lengths to determine if a deep comparison is necessary.
      length = a.length;
      if (length !== b.length) return false;
      // Deep compare the contents, ignoring non-numeric properties.
      while (length--) {
        if (!eq(a[length], b[length], aStack, bStack)) return false;
      }
    } else {
      // Deep compare objects.
      var keys = _.keys(a), key;
      length = keys.length;
      // Ensure that both objects contain the same number of properties before comparing deep equality.
      if (_.keys(b).length !== length) return false;
      while (length--) {
        // Deep compare each member
        key = keys[length];
        if (!(_.has(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return true;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (isArrayLike(obj) && (_.isArray(obj) || _.isString(obj) || _.isArguments(obj))) return obj.length === 0;
    return _.keys(obj).length === 0;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) === '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError.
  _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) === '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE < 9), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return _.has(obj, 'callee');
    };
  }

  // Optimize `isFunction` if appropriate. Work around some typeof bugs in old v8,
  // IE 11 (#1621), and in Safari 8 (#1929).
  if (typeof /./ != 'function' && typeof Int8Array != 'object') {
    _.isFunction = function(obj) {
      return typeof obj == 'function' || false;
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj !== +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, key) {
    return obj != null && hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iteratees.
  _.identity = function(value) {
    return value;
  };

  // Predicate-generating functions. Often useful outside of Underscore.
  _.constant = function(value) {
    return function() {
      return value;
    };
  };

  _.noop = function(){};

  _.property = property;

  // Generates a function for a given object that returns a given property.
  _.propertyOf = function(obj) {
    return obj == null ? function(){} : function(key) {
      return obj[key];
    };
  };

  // Returns a predicate for checking whether an object has a given set of
  // `key:value` pairs.
  _.matcher = _.matches = function(attrs) {
    attrs = _.extendOwn({}, attrs);
    return function(obj) {
      return _.isMatch(obj, attrs);
    };
  };

  // Run a function **n** times.
  _.times = function(n, iteratee, context) {
    var accum = Array(Math.max(0, n));
    iteratee = optimizeCb(iteratee, context, 1);
    for (var i = 0; i < n; i++) accum[i] = iteratee(i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  _.now = Date.now || function() {
    return new Date().getTime();
  };

   // List of HTML entities for escaping.
  var escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
  };
  var unescapeMap = _.invert(escapeMap);

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  var createEscaper = function(map) {
    var escaper = function(match) {
      return map[match];
    };
    // Regexes for identifying a key that needs to be escaped
    var source = '(?:' + _.keys(map).join('|') + ')';
    var testRegexp = RegExp(source);
    var replaceRegexp = RegExp(source, 'g');
    return function(string) {
      string = string == null ? '' : '' + string;
      return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
    };
  };
  _.escape = createEscaper(escapeMap);
  _.unescape = createEscaper(unescapeMap);

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
  _.result = function(object, property, fallback) {
    var value = object == null ? void 0 : object[property];
    if (value === void 0) {
      value = fallback;
    }
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\u2028|\u2029/g;

  var escapeChar = function(match) {
    return '\\' + escapes[match];
  };

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  // NB: `oldSettings` only exists for backwards compatibility.
  _.template = function(text, settings, oldSettings) {
    if (!settings && oldSettings) settings = oldSettings;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset).replace(escaper, escapeChar);
      index = offset + match.length;

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      } else if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      } else if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }

      // Adobe VMs need the match returned to produce the correct offest.
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + 'return __p;\n';

    try {
      var render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled source as a convenience for precompilation.
    var argument = settings.variable || 'obj';
    template.source = 'function(' + argument + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function. Start chaining a wrapped Underscore object.
  _.chain = function(obj) {
    var instance = _(obj);
    instance._chain = true;
    return instance;
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(instance, obj) {
    return instance._chain ? _(obj).chain() : obj;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    _.each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result(this, func.apply(_, args));
      };
    });
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
      return result(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  _.each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result(this, method.apply(this._wrapped, arguments));
    };
  });

  // Extracts the result from a wrapped and chained object.
  _.prototype.value = function() {
    return this._wrapped;
  };

  // Provide unwrapping proxy for some methods used in engine operations
  // such as arithmetic and JSON stringification.
  _.prototype.valueOf = _.prototype.toJSON = _.prototype.value;

  _.prototype.toString = function() {
    return '' + this._wrapped;
  };

  // AMD registration happens at the end for compatibility with AMD loaders
  // that may not enforce next-turn semantics on modules. Even though general
  // practice for AMD registration is to be anonymous, underscore registers
  // as a named module because, like jQuery, it is a base library that is
  // popular enough to be bundled in a third party lib, but not be part of
  // an AMD load request. Those cases could generate an error when an
  // anonymous define() is called outside of a loader request.
  if (typeof define === 'function' && define.amd) {
    define('underscore', [], function() {
      return _;
    });
  }
}.call(this));

},{}],13:[function(require,module,exports){
var utility = require('./utility/utility.js'),
    ConnectionEvents = require('./connection/ConnectionEvents.js'),
    ConnectionStreams = require('./connection/ConnectionStreams.js'),
    ConnectionProfile = require('./connection/ConnectionProfile.js'),
    ConnectionBookmarks = require('./connection/ConnectionBookmarks.js'),
    ConnectionAccesses = require('./connection/ConnectionAccesses.js'),
    ConnectionMonitors = require('./connection/ConnectionMonitors.js'),
    ConnectionAccount = require('./connection/ConnectionAccount.js'),
    CC = require('./connection/ConnectionConstants.js'),
    Datastore = require('./Datastore.js'),
    _ = require('underscore');

/**
 * @class Connection
 * Create an instance of Connection to Pryv API.
 * The connection will be opened on
 * http[s]://&lt;username>.&lt;domain>:&lt;port>/&lt;extraPath>?auth=&lt;auth>
 *
 * @example
 * // create a connection for the user 'pryvtest' with the token 'TTZycvBTiq'
 * var conn = new pryv.Connection({username: 'pryvtest', auth: 'TTZycvBTiq'});
 *
 * @constructor
 * @this {Connection}
 * @param {Object} [settings]
 * @param {string} settings.username
 * @param {string} settings.auth - the authorization token for this username
 * @param {number} [settings.port = 443]
 * @param {string} [settings.domain = 'pryv.io'] change the domain.
 * @param {boolean} [settings.ssl = true] Use ssl (https) or no
 * @param {string} [settings.extraPath = ''] append to the connections. Must start with a '/'
 */
module.exports = Connection;
function Connection() {
  var settings;
  if (!arguments[0] || typeof arguments[0] === 'string') {
    console.warn('new Connection(username, auth, settings) is deprecated.',
      'Please use new Connection(settings)', arguments);
    this.username = arguments[0];
    this.auth = arguments[1];
    settings = arguments[2];
  } else {
    settings = arguments[0];
    this.username = settings.username;
    this.auth = settings.auth;
    if (settings.url) {
      var urlInfo = utility.urls.parseServerURL(settings.url);
      this.username = urlInfo.username;
      settings.hostname = urlInfo.hostname;
      settings.domain = urlInfo.domain;
      settings.port = urlInfo.port;
      settings.extraPath = urlInfo.path === '/' ? '' : urlInfo.path;
      settings.ssl = urlInfo.isSSL();
    }
  }
  this._serialId = Connection._serialCounter++;

  this.settings = _.extend({
    port: 443,
    ssl: true,
    extraPath: '',
    staging: false
  }, settings);

  this.settings.domain = settings.domain ?
      settings.domain : utility.urls.defaultDomain;

  this.serverInfos = {
    // nowLocalTime - nowServerTime
    deltaTime: null,
    apiVersion: null,
    lastSeenLT: null
  };

  this._accessInfo = null;
  this._privateProfile = null;

  this._streamSerialCounter = 0;
  this._eventSerialCounter = 0;

  /**
   * Manipulate events for this connection
   * @type {ConnectionEvents}
   */
  this.events = new ConnectionEvents(this);
  /**
   * Manipulate streams for this connection
   * @type {ConnectionStreams}
   */
  this.streams = new ConnectionStreams(this);
  /**
  * Manipulate app profile for this connection
  * @type {ConnectionProfile}
  */
  this.profile = new ConnectionProfile(this);
  /**
  * Manipulate bookmarks for this connection
  * @type {ConnectionProfile}
  */
  this.bookmarks = new ConnectionBookmarks(this, Connection);
  /**
  * Manipulate accesses for this connection
  * @type {ConnectionProfile}
  */
  this.accesses = new ConnectionAccesses(this);
  /**
   * Manipulate this connection monitors
   */
  this.monitors = new ConnectionMonitors(this);

  this.account = new ConnectionAccount(this);
  this.datastore = null;

}

Connection._serialCounter = 0;


/**
 * In order to access some properties such as event.stream and get a {Stream} object, you
 * need to fetch the structure at least once. For now, there is now way to be sure that the
 * structure is up to date. Soon we will implement an optional parameter "keepItUpToDate", that
 * will do that for you.
 *
 * TODO implements "keepItUpToDate" logic.
 * @param {Streams~getCallback} callback - array of "root" Streams
 * @returns {Connection} this
 */
Connection.prototype.fetchStructure = function (callback /*, keepItUpToDate*/) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  if (this.datastore) { return this.datastore.init(callback); }
  this.datastore = new Datastore(this);
  this.accessInfo(function (error) {
    if (error) { return callback(error); }
    this.datastore.init(callback);
  }.bind(this));
  return this;
};


/**
 * Set username / auth to this Connection
 * @param credentials key / value map containing username and token fields
 * @param callback
 */
Connection.prototype.attachCredentials = function (credentials, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  if (!credentials.username || !credentials.auth) {
    callback('error: incorrect input parameters');
  } else {
    this.username = credentials.username;
    this.auth = credentials.auth;
    callback(null, this);
  }
};

/**
 * Get access information related this connection. This is also the best way to test
 * that the combination username/token is valid.
 * @param {Connection~accessInfoCallback} callback
 * @returns {Connection} this
 */
Connection.prototype.accessInfo = function (callback) {
  if (this._accessInfo) {
    return this._accessInfo;
  }
  this.request({
    method: 'GET',
    path: '/access-info',
    callback: function (error, result) {
      if (!error) {
        this._accessInfo = result;
      }
      if (typeof(callback) === 'function') {
        return callback(error, result);
      }
    }.bind(this)
  });
  return this;
};

/**
 * Get the private profile related this connection.
 * @param {Connection~privateProfileCallback} callback
 * @returns {Connection} this
 */
Connection.prototype.privateProfile = function (callback) {
  if (this._privateProfile) {
    return this._privateProfile;
  }
  this.profile.getPrivate(null, function (error, result) {
    if (result && result.message) {
      error = result;
    }
    if (!error) {
      this._privateProfile = result;
    }
    if (typeof(callback) === 'function') {
      return callback(error, result);
    }
  }.bind(this));
  return this;
};

/**
 * Translate this timestamp (server dimension) to local system dimension
 * This could have been named to "translate2LocalTime"
 * @param {number} serverTime timestamp  (server dimension)
 * @returns {number} timestamp (local dimension) same time space as (new Date()).getTime();
 */
Connection.prototype.getLocalTime = function (serverTime) {
  return (serverTime + this.serverInfos.deltaTime) * 1000;
};

/**
 * Translate this timestamp (local system dimension) to server dimension
 * This could have been named to "translate2ServerTime"
 * @param {number} localTime timestamp  (local dimension) same time space as (new Date()).getTime();
 * @returns {number} timestamp (server dimension)
 */
Connection.prototype.getServerTime = function (localTime) {
  if (typeof localTime === 'undefined') { localTime = new Date().getTime(); }
  return (localTime / 1000) - this.serverInfos.deltaTime;
};


// ------------- monitor this connection --------//

/**
 * Start monitoring this Connection. Any change that occurs on the connection (add, delete, change)
 * will trigger an event. Changes to the filter will also trigger events if they have an impact on
 * the monitored data.
 * @param {Filter} filter - changes to this filter will be monitored.
 * @returns {Monitor}
 */
Connection.prototype.monitor = function (filter) {
  return this.monitors.create(filter);
};

// ------------- start / stop Monitoring is called by Monitor constructor / destructor -----//



/**
 * Do a direct request to Pryv's API.
 * Even if exposed there must be an abstraction for every API call in this library.
 * @param {Object} params object with
 * @param {string} params.method - GET | POST | PUT | DELETE
 * @param {string} params.path - to resource, starting with '/' like '/events'
 * @param {Object} params.jsonData - data to POST or PUT
 * @param {Boolean} params.isFile indicates if the data is a binary file.
 * @params {string} [params.parseResult = 'json'] - 'json|binary'
 * @param {Connection~requestCallback} params.callback called when the request is finished
 * @param {Connection~requestCallback} params.progressCallback called when the request gives
 * progress updates
 */
Connection.prototype.request = function (params) {

  if (arguments.length > 1) {
    console.warn('Connection.request(method, path, callback, jsonData, isFile, progressCallback)' +
    ' is deprecated. Please use Connection.request(params).', arguments);
    params = {};
    params.method = arguments[0];
    params.path = arguments[1];
    params.callback = arguments[2];
    params.jsonData = arguments[3];
    params.isFile = arguments[4];
    params.progressCallback = arguments[5];
  }

  if (typeof(params.callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  var headers =  { 'authorization': this.auth };
  var withoutCredentials = false;
  var payload = JSON.stringify({});
  if (params.jsonData && !params.isFile) {
    payload = JSON.stringify(params.jsonData);
    headers['Content-Type'] = 'application/json; charset=utf-8';
  }
  if (params.isFile) {
    payload = params.jsonData;
    headers['Content-Type'] = 'multipart/form-data';
    headers['X-Requested-With'] = 'XMLHttpRequest';
    withoutCredentials = true;
  }

  var request = utility.request({
    method : params.method,
    host : getHostname(this),
    port : this.settings.port,
    ssl : this.settings.ssl,
    path : this.settings.extraPath + params.path,
    headers : headers,
    payload : payload,
    progressCallback: params.progressCallback,
    //TODO: decide what callback convention to use (Node or jQuery)
    success : onSuccess.bind(this),
    error : onError.bind(this),
    withoutCredentials: withoutCredentials,
    parseResult: params.parseResult
  });

  /**
   * @this {Connection}
   */
  function onSuccess(data, responseInfo) {

    var apiVersion = responseInfo.headers['API-Version'] ||
      responseInfo.headers[CC.Api.Headers.ApiVersion];

    // test if API is reached or if we headed into something else
    if (!apiVersion) {
      var error = {
        id: CC.Errors.API_UNREACHEABLE,
        message: 'Cannot find API-Version',
        details: 'Response code: ' + responseInfo.code +
        ' Headers: ' + JSON.stringify(responseInfo.headers)
      };
      return params.callback(error, null, responseInfo);
    } else if (data.error) {
      return params.callback(data.error, null, responseInfo);
    }
    this.serverInfos.lastSeenLT = (new Date()).getTime();
    this.serverInfos.apiVersion = apiVersion || this.serverInfos.apiVersion;
    if (_.has(responseInfo.headers, CC.Api.Headers.ServerTime)) {
      this.serverInfos.deltaTime = (this.serverInfos.lastSeenLT / 1000) -
      responseInfo.headers[CC.Api.Headers.ServerTime];
    }

    params.callback(null, data, responseInfo);
  }

  function onError(error, responseInfo) {
    var errorTemp = {
      id : CC.Errors.API_UNREACHEABLE,
      message: 'Error on request ',
      details: 'ERROR: ' + error
    };
    params.callback(errorTemp, null, responseInfo);
  }
  return request;
};



/**
 * @property {string} Connection.id an unique id that contains all needed information to access
 * this Pryv data source. http[s]://<username>.<domain>:<port>[/extraPath]/?auth=<auth token>
 */
Object.defineProperty(Connection.prototype, 'id', {
  get: function () {
    var id = this.settings.ssl ? 'https://' : 'http://';
    id += getHostname(this) + ':' +
        this.settings.port + this.settings.extraPath + '/?auth=' + this.auth;
    return id;
  },
  set: function () { throw new Error('ConnectionNode.id property is read only'); }
});

/**
 * @property {string} Connection.displayId an id easily readable <username>:<access name>
 */
Object.defineProperty(Connection.prototype, 'displayId', {
  get: function () {
    if (! this._accessInfo) {
      throw new Error('connection must have been initialized to use displayId. ' +
        ' You can call accessInfo() for this');
    }
    var id = this.username + ':' + this._accessInfo.name;
    return id;
  },
  set: function () { throw new Error('Connection.displayId property is read only'); }
});

/**
 * @property {String} Connection.serialId A locally-unique id for the connection; can also be
 *                                        used as a client-side id
 */
Object.defineProperty(Connection.prototype, 'serialId', {
  get: function () { return 'C' + this._serialId; }
});
/**
 * Called with the desired Streams as result.
 * @callback Connection~accessInfoCallback
 * @param {Object} error - eventual error
 * @param {AccessInfo} result
 */

/**
 * @typedef AccessInfo
 * @see http://api.pryv.com/reference.html#data-structure-access
 */

/**
 * Called with the result of the request
 * @callback Connection~requestCallback
 * @param {Object} error - eventual error
 * @param {Object} result - jSonEncoded result
 * @param {Object} resultInfo
 * @param {Number} resultInfo.code - HTTP result code
 * @param {Object} resultInfo.headers - HTTP result headers by key
 */

// --------- login


/**
 * static method to login, returns a connection object in the callback if the username/password
 * pair is valid for the provided appId.
 *
 * @param params key / value map containing username, password and appId fields and optional
 * domain and origin fields
 * @param callback
 */
Connection.login = function (params, callback) {

  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }

  var headers = {
    'Content-Type': 'application/json'
  };

  if (!utility.isBrowser()) {
    var origin = 'https://sw.';
    origin = params.origin ? origin + params.origin :
    origin + utility.urls.domains.client.production;
    _.extend(headers, {Origin: origin});
  }

  var domain = params.domain || utility.urls.domains.client.production;

  var pack = {
    method: 'POST',
    headers: headers,
    ssl: true,
    host: params.username + '.' + domain,
    path: '/auth/login/',
    payload: JSON.stringify({
      appId: params.appId,
      username: params.username,
      password: params.password
    }),

    success: function (data, responseInfo) {
      if (data.error) {
        return callback(data.error, null, responseInfo);
      }
      var settings = {
        username: params.username,
        auth: data.token,
        domain: domain
        // TODO: set staging if in this mode
      };
      return callback(null, new Connection(settings), responseInfo);
    },

    error: function (error, responseInfo) {
      callback(error, null, responseInfo);
    }
  };

  utility.request(pack);
};


// --------- batch call

/**
 * address multiple methods to the API in a single batch call
 *
 * @example
 * // make a batch call to create an event and update a stream
 *  connection.batchCall(
 *  [
 *    { method: 'events.create',
 *      params: {
 *        streamId: 'diary',
 *        type: 'note/txt',
 *        content: 'hello'
 *     }
 *    },
 *    { method: 'streams.update',
 *      params: {
 *        id': 'diary',
 *        params: {
 *          update: { name: 'new diary' }
 *    }
 *  ], function (err, results) {
 *    if (err) {
 *      return console.log(err);
 *    }
 *    results.forEach(function (result) {
 *      console.log(result);
 *    }
 *  });
 * @param {Array} methodsData - array of methods to execute on the API,
 * @param {Function} callback - callback
 */
Connection.prototype.batchCall = function(methodsData, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  if (!_.isArray(methodsData)) { methodsData = [methodsData]; }

  this.request({
    method: 'POST',
    path: '/',
    jsonData: methodsData,
    callback: function (err, res) {

      if (err) {
        return callback(err);
      }
      callback(null, res.results);
    }.bind(this)
  });
};


// --------- private utils

function getHostname(connection) {
  return connection.settings.hostname ||
      connection.username ?
      connection.username + '.' + connection.settings.domain : connection.settings.domain;
}

},{"./Datastore.js":14,"./connection/ConnectionAccesses.js":22,"./connection/ConnectionAccount.js":23,"./connection/ConnectionBookmarks.js":24,"./connection/ConnectionConstants.js":25,"./connection/ConnectionEvents.js":26,"./connection/ConnectionMonitors.js":27,"./connection/ConnectionProfile.js":28,"./connection/ConnectionStreams.js":29,"./utility/utility.js":41,"underscore":12}],14:[function(require,module,exports){
/**
 * DataStore handles in memory caching of objects.
 * @private
 */

var _ = require('underscore');
var Event = require('./Event');
var Stream = require('./Stream');

function Datastore(connection) {
  this.connection = connection;
  this.streamsIndex = {}; // streams are linked to their object representation
  this.eventIndex = {}; // events are store by their id
  this.rootStreams = [];
  this.rootStreamsAll = []; // including trashed streams
}

module.exports = Datastore;

Datastore.prototype.init = function (callback) {
  this.connection.streams._getObjects({state: 'all'}, function (error, result) {
    if (error) { return callback('Datastore faild to init - '  + error); }
    if (result) {
      this._rebuildStreamIndex(result); // maybe done transparently
    }
    callback(null, result);
  }.bind(this));

  // TODO activate monitoring
};

Datastore.prototype._rebuildStreamIndex = function (streamArray) {
  this.streamsIndex = {};
  this.rootStreams = [];
  this.rootStreamsAll = [];
  this._indexStreamArray(streamArray);
};

Datastore.prototype._indexStreamArray = function (streamArray) {
  _.each(streamArray, function (stream) {
    this.indexStream(stream);
  }.bind(this));
};

Datastore.prototype.indexStream = function (stream) {
  this.streamsIndex[stream.id] = stream;
  if (! stream.parentId) {
    this.rootStreamsAll.push(stream);
    if (! stream.trashed) {
      this.rootStreams.push(stream);
    }
  }
  this._indexStreamArray(stream._children);
  delete stream._children; // cleanup when in datastore mode
  delete stream._parent;
};

/**
 *
 * @param all True to get all root streams including trashed one
 * @returns Stream or null if not found
 */
Datastore.prototype.getStreams = function (all) {
  if (all) { return this.rootStreamsAll; }
  return this.rootStreams;
};


/**
 *
 * @param streamId
 * @param test (do no throw error if Stream is not found
 * @returns Stream or null if not found
 */
Datastore.prototype.getStreamById = function (streamId) {
  var result = this.streamsIndex[streamId];
  return result;
};

//-------------------------

/**
 * @param serialId
 * @returns Event or null if not found
 */
Datastore.prototype.getEventBySerialId = function (serialId) {
  var result = null;
  _.each(this.eventIndex, function (event /*,eventId*/) {
    if (event.serialId === serialId) { result = event; }
    // TODO optimize and break
  }.bind(this));
  return result;
};

/**
 * @param eventID
 * @returns Event or null if not found
 */
Datastore.prototype.getEventById = function (eventId) {
  return this.eventIndex[eventId];

};

/**
 * @returns allEvents
 */
Datastore.prototype.getEventsMatchingFilter = function (filter) {
  var result = [];
  _.each(this.eventIndex, function (event /*,eventId*/) {
    if (filter.matchEvent(event)) { result.push(event); }
  }.bind(this));
  return result;
};


/**
 * @returns allEvents
 */
Datastore.prototype.getAllEvents = function () {
  return _.value(this.eventIndex);
};

/**
 * @param event
 */
Datastore.prototype.addEvent = function (event) {
  if (! event.id) {
    throw new Error('Datastore.addEvent cannot add event with unkown id', event);
  }
  this.eventIndex[event.id] = event;
};



/**
 * @param {Object} data to map
 * @return {Event} event
 */
Datastore.prototype.createOrReuseEvent = function (data) {
  if (! data.id) {
    throw new Error('Datastore.createOrReuseEvent cannot create event with ' +
      ' unkown id' + require('util').inspect(data));
  }

  var result = this.getEventById(data.id);
  if (result) {  // found event
    _.extend(result, data);
    return result;
  }
  // create an event and register it
  result = new Event(this.connection, data);
  this.addEvent(result);

  return result;
};


/**
 * @param {Object} data to map
 * @return {Event} event
 */
Datastore.prototype.createOrReuseStream = function (data) {
    if (! data.id) {
        throw new Error('Datastore.createOrReuseStream cannot create stream with ' +
            ' unkown id' + require('util').inspect(data));
    }

    var result = this.getStreamById(data.id);
    if (result) {  // found event
        _.extend(result, data);
        return result;
    }
    // create an stream and register it
    result = new Stream(this.connection, data);
    this.indexStream(result);

    return result;
};



},{"./Event":15,"./Stream":18,"underscore":12,"util":10}],15:[function(require,module,exports){

var _ = require('underscore');

var RW_PROPERTIES =
  ['streamId', 'time', 'duration', 'type', 'content', 'tags', 'description',
    'clientData', 'state', 'modified', 'trashed'];


var escapeHtml = function (obj) {
  _.each(obj, function (value, key) {
    if (_.isString(value)) {
      obj[key] = _.escape(value);
    } else if ((key === 'content' && _.isObject(value)) || (key === 'tags' && _.isArray(value))) {
      escapeHtml(value);
    }
  });
};
/**
 *
 * @type {Function}
 * @constructor
 */
var Event = module.exports = function Event(connection, data) {
  if (! connection) {
    throw new Error('Cannot create connection less events');
  }
  this.connection = connection;
  this.trashed = false;
  this.serialId = this.connection.serialId + '>E' + this.connection._eventSerialCounter++;
  _.extend(this, data);
};

/**
 * get Json object ready to be posted on the API
 */
Event.prototype.getData = function () {
  var data = {};
  _.each(RW_PROPERTIES, function (key) { // only set non null values
    if (_.has(this, key)) { data[key] = this[key]; }
  }.bind(this));
  return data;
};
/**
 *
 * @param {Connection~requestCallback} callback
 */
Event.prototype.update = function (callback) {
  this.connection.events.update(this, callback);
};
/**
 *
 * @param {Connection~requestCallback} callback
 */
Event.prototype.addAttachment = function (file, callback) {
  this.connection.events.addAttachment(this.id, file, callback);
};
/**
 *
 * @param {Connection~requestCallback} callback
 */
Event.prototype.removeAttachment = function (fileName, callback) {
  this.connection.events.removeAttachment(this.id, fileName, callback);
};
/**
 * TODO create an attachment Class that contains such logic
 * @param {attachment} attachment
 */
Event.prototype.attachmentUrl = function (attachment) {
  var url =  this.connection.settings.ssl ? 'https://' : 'http://';
  url += this.connection.username + '.' + this.connection.settings.domain + '/events/' +
    this.id + '/' + attachment.id + '?readToken=' + attachment.readToken;
  return url;
};
/**
 *
 * @param {Connection~requestCallback} callback
 */
Event.prototype.delete = Event.prototype.trash = function (callback) {
  this.connection.events.trash(this, callback);
};
/**
 * TODO document and rename to getPicturePreviewUrl
 * @param width
 * @param height
 * @returns {string}
 */
Event.prototype.getPicturePreview = function (width, height) {
  width = width ? '&w=' + width : '';
  height = height ? '&h=' + height : '';
  var url = this.connection.settings.ssl ? 'https://' : 'http://';
  url += this.connection.username + '.' + this.connection.settings.domain + ':3443/events/' +
    this.id + '?auth=' + this.connection.auth + width + height;
  return url;
};

Event.prototype.isRunning = function () {
  return !!('duration' in this && !this.duration && this.duration !== 0);
};
/**
 * TODO document
 */
Object.defineProperty(Event.prototype, 'timeLT', {
  get: function () {
    return this.connection.getLocalTime(this.time);
  },
  set: function (newValue) {
    this.time = this.connection.getServerTime(newValue);
  }
});



/**
 * TODO document
 */
Object.defineProperty(Event.prototype, 'stream', {
  get: function () {
    if (! this.connection.datastore) {
      throw new Error('call connection.fetchStructure before to get automatic stream mapping.' +
        ' Or use StreamId');
    }
    return this.connection.datastore.getStreamById(this.streamId);
  },
  set: function () { throw new Error('Event.stream property is read only'); }
});

/**
 * TODO document
 */
Object.defineProperty(Event.prototype, 'url', {
  get: function () {
    var url = this.connection.settings.ssl ? 'https://' : 'http://';
    url += this.connection.username + '.' + this.connection.settings.domain + '/events/' + this.id;
    return url;
  },
  set: function () { throw new Error('Event.url property is read only'); }
});


/**
 * An newly created Event (no id, not synched with API)
 * or an object with sufficient properties to be considered as an Event.
 * @typedef {(Event|Object)} NewEventLike
 * @property {String} streamId
 * @property {String} type
 * @property {number} [time]
 */

},{"underscore":12}],16:[function(require,module,exports){
var _ = require('underscore'),
    SignalEmitter = require('./utility/SignalEmitter.js');

/**
 * TODO Filter is badly missing a correct documentation
 * @constructor
 */
var Filter = module.exports = function Filter(settings) {
  SignalEmitter.extend(this, Messages, 'Filter');

  this._settings = _.extend({
    //TODO: set default values
    streams: null, //ids
    tags: null,
    fromTime: null,  // serverTime
    toTime: null,  // serverTime
    limit: null,
    skip: null,
    types: null,
    modifiedSince: null,
    state: null
  }, settings);
};

var Messages = Filter.Messages = {
  /**
   * generic change event called on any change
   * content: {filter, signal, content}
   **/
  ON_CHANGE : 'changed',
  /**
   * called on streams changes
   * content: streams
   */
  STREAMS_CHANGE : 'streamsChanged',

  /**
   * called on streams structure changes
   * content: changes
   */
  STRUCTURE_CHANGE : 'structureChange',

  /*
   * called on date changes
   * content: streams
   */
  DATE_CHANGE : 'timeFrameChanged',

  /*
   * called on state changes
   * content: {state: value}
   */
  STATE_CHANGE : 'stateChanged'
};

// TODO
// redundant with get
function _normalizeTimeFrameST(filterData) {
  var result = [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY];
  if (filterData.fromTime || filterData.fromTime === 0) {
    result[0] = filterData.fromTime;
  }
  if (filterData.toTime || filterData.toTime === 0) {
    result[1] = filterData.toTime;
  }
  return result;
}



/**
 * TODO write doc
 * TODO complete with tags and state and modified and..
 * check if this event is in this filter
 */
Filter.prototype.matchEvent = function (event) {
  if (event.time > this.toTimeSTNormalized) { return false; }
  if (event.time < this.fromTimeSTNormalized) { return false; }


  if (this._settings.state !== 'all') {
    if (event.trashed) { return false; }
  }

  if (this._settings.streams) {

    if (this._settings.streams.length === 0) { return false; }

    if (this._settings.streams.indexOf(event.streamId) < 0) {
      var found = false;
      if (!event.stream) {
        return false;
      }
      event.stream.ancestors.forEach(function (ancestor) {
        if (this._settings.streams.indexOf(ancestor.id) >= 0) {
          if (this._settings.state !== 'all') {
            if (ancestor.trashed) { return false; }
          }
          found = true;
        }
      }.bind(this));
      if (!found) {
        return false;
      }
    }
  }



  // TODO complete test
  return true;
};

/**
 * Compare this filter with data form another filter
 * @param {Object} filterDataTest data got with filter.getData
 * @returns keymap \{ timeFrame : -1, 0 , 1 \}
 * (1 = more than test, -1 = less data than test, 0 == no changes)
 */
Filter.prototype.compareToFilterData = function (filterDataTest) {
  var result = { timeFrame : 0, streams : 0 };


  // timeFrame
  var myTimeFrameST = [this.fromTimeSTNormalized, this.toTimeSTNormalized];
  var testTimeFrameST = _normalizeTimeFrameST(filterDataTest);
  console.log(myTimeFrameST);
  console.log(testTimeFrameST);

  if (myTimeFrameST[0] < testTimeFrameST[0]) {
    result.timeFrame = 1;
  } else if (myTimeFrameST[0] > testTimeFrameST[0]) {
    result.timeFrame = -1;
  }
  if (result.timeFrame <= 0) {
    if (myTimeFrameST[1] > testTimeFrameST[1]) {
      result.timeFrame = 1;
    } else  if (myTimeFrameST[1] < testTimeFrameST[1]) {
      result.timeFrame = -1;
    }
  }

  // streams
  //TODO look if this processing can be optimized

  var nullStream = 0;
  if (! this._settings.streams) {
    if (filterDataTest.streams) {
      result.streams = 1;
    }
    nullStream = 1;
  }
  if (! filterDataTest.streams) {
    if (this._settings.streams) {
      result.streams = -1;
    }
    nullStream = 1;
  }

  if (! nullStream) {
    var notinTest = _.difference(this._settings.streams, filterDataTest.streams);
    if (notinTest.length > 0) {
      result.streams = 1;
    } else {
      var notinLocal = _.difference(filterDataTest.streams, this._settings.streams);
      if (notinLocal.length > 0) {
        result.streams = -1;
      }
    }
  }

  return result;
};

/**
 * Create a clone of this filter and changes some properties
 * @param properties
 * @returns pryv.Filter
 */
Filter.prototype.cloneWithDelta = function (properties) {
  var newProps = _.clone(this._settings);
  _.extend(newProps, properties);
  return new Filter(newProps);
};

/**
 * returns a dictionary containing all the settings of this filter.
 * @param ignoreNulls (optional) boolean
 * @param withDelta (optional) adds this differences on the data
 * @returns {*}
 */
Filter.prototype.getData = function (ignoreNulls, withDelta) {
  ignoreNulls = ignoreNulls || false;
  var result = _.clone(this._settings);
  if (withDelta)  {
    _.extend(result, withDelta);
  }
  if (ignoreNulls) {
    _.each(_.keys(result), function (key) {
      if ((result[key] === null)) {
        delete result[key];
      }
    });
  }
  return result;
};

/**
 * @private
 */
Filter.prototype._fireFilterChange = function (signal, content, batch) {
  // generic
  this._fireEvent(Messages.ON_CHANGE, {filter: this, signal: signal, content: content}, batch);
  // specific
  this._fireEvent(signal, content, batch);
};

/**
 * TODO review documentation and add example
 * Change several values of the filter in batch.. this wil group all events behind a batch id
 * @param keyValueMap {Object}
 * @param batch {SignalEmitter~Batch}
 */
Filter.prototype.set = function (keyValueMap, batch) {
  batch = this.startBatch('set', batch);

  _.each(keyValueMap, function (value, key) {
    this._setValue(key, value, batch);
  }.bind(this));

  batch.done('set');
};

/**
 * Internal that take in charge of changing values
 * @param keyValueMap
 * @param batch
 * @private
 */
Filter.prototype._setValue = function (key, newValue, batch) {
  batch = this.startBatch('setValue:' + key, batch);

  if (key === 'limit') {
    this._settings.limit = newValue;

    // TODO handle changes
    return;
  }


  if (key === 'state') {
    if (this._settings.state !== newValue) {
      this._settings.state = newValue;
      this._fireFilterChange(Messages.STATE_CHANGE, {state: newValue}, batch);
    }
    batch.done('setValue:' + key);
    return;
  }

  if (key === 'timeFrameST') {
    if (! _.isArray(newValue) || newValue.length !== 2) {
      throw new Error('Filter.timeFrameST is an Array of two timestamps [fromTime, toTime]');
    }
    if (this._settings.fromTime !== newValue[0] || this._settings.toTime !== newValue[1]) {
      this._settings.fromTime = newValue[0];
      this._settings.toTime = newValue[1];
      this._fireFilterChange(Messages.DATE_CHANGE, this.timeFrameST, batch);
    }
    batch.done('setValue:' + key);
    return;
  }

  if (key === 'streamsIds') {

    if (newValue === null || typeof newValue === 'undefined') {
      if (this._settings.streams === null) {

        return;
      }
      newValue = null;
    } else if (! _.isArray(newValue)) {
      newValue = [newValue];
    }

    // TODO check that this stream is valid
    this._settings.streams = newValue;
    this._fireFilterChange(Messages.STREAMS_CHANGE, this.streams, batch);
    batch.done('setValue:' + key);
    return;
  }

  batch.done('setValue:' + key);
  throw new Error('Filter has no property : ' + key);
};

/**
 * get toTime, return Number.POSITIVE_INFINITY if null
 */
Object.defineProperty(Filter.prototype, 'toTimeSTNormalized', {
  get: function () {
    if (this._settings.toTime || this._settings.toTime === 0) {
      return this._settings.toTime;
    }
    return Number.POSITIVE_INFINITY;
  }
});

/**
 * get fromTime, return Number.POSITIVE_INFINITY if null
 */
Object.defineProperty(Filter.prototype, 'fromTimeSTNormalized', {
  get: function () {
    if (this._settings.fromTime || this._settings.fromTime === 0) {
      return this._settings.fromTime;
    }
    return Number.NEGATIVE_INFINITY;
  }
});



/**
 * timeFrameChange ..  [fromTime, toTime]
 * setting them to "null" => ALL
 */
Object.defineProperty(Filter.prototype, 'timeFrameST', {
  get: function () {
    return [this._settings.toTime, this._settings.fromTime];
  },
  set: function (newValue) {
    this._setValue('timeFrameST', newValue);
    return this.timeFrameST;
  }
});


/**
 * StreamIds ..
 * setting them to "null" => ALL and to "[]" => NONE
 */
Object.defineProperty(Filter.prototype, 'streamsIds', {
  get: function () {
    return this._settings.streams;
  },
  set: function (newValue) {
    this._setValue('streamsIds', newValue);
    return this._settings.streams;
  }
});


/**
 * return true if context (stream is on a single stream)
 * This is usefull to check when creating and event in a context.
 * This way, no need to ask the user for a stream specification.
 * TODO determine if this should stay in the lib.. or handle by apps
 */
Filter.prototype.focusedOnSingleStream = function () {
  if (_.isArray(this._settings.streams) && this._settings.streams.length === 1) {
    return this._settings.streams[0];
  }
  return null;
};

/**
 * An pryv Filter or an object corresponding at what we can get with Filter.getData().
 * @typedef {(Filter|Object)} FilterLike
 * @property {String[]} [streams]
 * @property {String[]} [tags]
 * @property {number} [fromTime] -- serverTime
 * @property {number} [toTime] -- serverTime
 * @property {number} [modifiedSince] -- serverTime
 * @property {number} [limit] -- response to 'n' events
 * @property {number} [skip] -- skip the first 'n' events of he response
 */


},{"./utility/SignalEmitter.js":34,"underscore":12}],17:[function(require,module,exports){
var _ = require('underscore'),
  SignalEmitter = require('./utility/SignalEmitter.js'),
  Filter = require('./Filter.js');

var EXTRA_ALL_EVENTS = {state : 'all', modifiedSince : -100000000 };
var REALLY_ALL_EVENTS =  EXTRA_ALL_EVENTS;
REALLY_ALL_EVENTS.fromTime = -1000000000;
REALLY_ALL_EVENTS.toTime = 10000000000;

var GETEVENT_MIN_REFRESH_RATE = 2000;

/**
 * Monitoring
 * @type {Function}
 * @constructor
 */
function Monitor(connection, filter) {
  SignalEmitter.extend(this, Messages, 'Monitor');
  this.connection = connection;
  this.id = 'M' + Monitor.serial++;

  this.filter = filter;

  this._lastUsedFilterData = filter.getData();

  if (this.filter.state) {
    throw new Error('Monitors only work for default state, not trashed or all');
  }

  this.filter.addEventListener(Filter.Messages.ON_CHANGE, this._onFilterChange.bind(this));
  this._events = null;


  // -- optimization & caching
  this.useCacheForEventsGetAllAndCompare = true;  // will look into cache before online
  this.ensureFullCache = true; // will fill the cache with ALL pryv content
  this.initWithPrefetch = 100; // prefetch some events before ensuringFullCache
}

Monitor.serial = 0;

var Messages = Monitor.Messages = {
  /** content: events **/
  ON_LOAD : 'started',
  /** content: error **/
  ON_ERROR : 'error',
  /** content: { enter: [], leave: [], change } **/
  ON_EVENT_CHANGE : 'eventsChanged',
  /** content: streams **/
  ON_STRUCTURE_CHANGE : 'streamsChanged',
  /** content: ? **/
  ON_FILTER_CHANGE : 'filterChanged'
};

// ----------- prototype  public ------------//

Monitor.prototype.start = function (done) {
  done = done || function () {};
  var batch = this.startBatch('Monitor:start');
  batch.addOnDoneListener('Monitor:startCompletion', function () {
    //TODO move this logic to ConnectionMonitors ??
    this.connection.monitors._monitors[this.id] = this;
    this.connection.monitors._startMonitoring(done);
  }.bind(this));


  this.lastSynchedST = -1000000000000;
  this._initEvents(batch);
  batch.done('Monitor:start');


};


Monitor.prototype.destroy = function () {
  //TODO move this logic to ConnectionMonitors ??
  delete this.connection.monitors._monitors[this.id];
  if (_.keys(this.connection.monitors._monitors).length === 0) {
    this.connection.monitors._stopMonitoring();
  }
};

Monitor.prototype.getEvents = function () {
  if (! this._events || ! this._events.active) {return []; }
  return _.toArray(this._events.active);
};

// ------------ private ----------//

// ----------- iOSocket ------//
Monitor.prototype._onIoConnect = function () {
  console.log('Monitor onConnect');
};
Monitor.prototype._onIoError = function (error) {
  console.log('Monitor _onIoError' + error);
};
Monitor.prototype._onIoEventsChanged = function () {
  var batch = this.startBatch('IoEventChanged');
  this._connectionEventsGetChanges(batch);
  batch.done('IoEventChanged');
};
Monitor.prototype._onIoStreamsChanged = function () {
  console.log('SOCKETIO', '_onIoStreamsChanged');
  var batch = this.startBatch('IoStreamsChanged');
  this._connectionStreamsGetChanges(batch);
  batch.done('IoStreamsChanged');
};



// -----------  filter changes ----------- //


Monitor.prototype._saveLastUsedFilter = function () {
  this._lastUsedFilterData = this.filter.getData();
};


Monitor.prototype._onFilterChange = function (signal, batch) {


  var changes = this.filter.compareToFilterData(this._lastUsedFilterData);

  var processLocalyOnly = 0;
  var foundsignal = 0;
  if (signal.signal === Filter.Messages.DATE_CHANGE) {  // only load events if date is wider
    foundsignal = 1;
    console.log('** DATE CHANGE ', changes.timeFrame);
    if (changes.timeFrame === 0) {
      return;
    }
    if (changes.timeFrame < 0) {  // new timeFrame contains more data
      processLocalyOnly = 1;
    }

  }

  if (signal.signal === Filter.Messages.STREAMS_CHANGE) {
    foundsignal = 1;
    console.log('** STREAMS_CHANGE', changes.streams);
    if (changes.streams === 0) {
      return;
    }
    if (changes.streams < 0) {  // new timeFrame contains more data
      processLocalyOnly = 1;
    }
  }

  if (signal.signal === Filter.Messages.STREAMS_CHANGE) {
    foundsignal = 1;
    console.log('** STREAMS_CHANGE', changes.streams);
    if (changes.streams === 0) {
      return;
    }
    if (changes.streams < 0) {  // new timeFrame contains more data
      processLocalyOnly = 1;
    }
  }

  if (signal.signal === Filter.Messages.STRUCTURE_CHANGE) {
    foundsignal = 1;
    // force full refresh
  }


  if (! foundsignal) {
    throw new Error('Signal not found :' + signal.signal);
  }

  this._saveLastUsedFilter();



  if (processLocalyOnly) {
    this._refilterLocaly(Messages.ON_FILTER_CHANGE, {filterInfos: signal}, batch);
  } else {
    this._connectionEventsGetAllAndCompare(Messages.ON_FILTER_CHANGE, {filterInfos: signal}, batch);
  }
};

// ----------- internal ----------------- //

/**
 * Process events locally
 */
Monitor.prototype._refilterLocaly = function (signal, extracontent, batch) {

  var result = { enter : [], leave : [] };
  _.extend(result, extracontent); // pass extracontent to receivers
  _.each(_.clone(this._events.active), function (event) {
    if (! this.filter.matchEvent(event)) {
      result.leave.push(event);
      delete this._events.active[event.id];
    }
  }.bind(this));
  this._fireEvent(signal, result, batch);
};


Monitor.prototype._initEvents = function (batch) {
  batch = this.startBatch('Monitor:initEvents', batch);
  this._events = { active : {}};


  var filterWith = this.filter.getData(true, EXTRA_ALL_EVENTS);

  if (this.initWithPrefetch) {
    filterWith.limit = this.initWithPrefetch;
  } else {
    if (this.ensureFullCache) {  filterWith = REALLY_ALL_EVENTS; }
  }


  this.connection.events.get(filterWith,
    function (error, events) {
      if (error) {
        this._fireEvent(Messages.ON_ERROR, error, batch);
        batch.done('Monitor:initEvents error');
        return;
      }

      if (! this.initWithPrefetch) { this.lastSynchedST = this.connection.getServerTime(); }

      var result = [];

      _.each(events, function (event) {
        if (! this.ensureFullCache || this.filter.matchEvent(event)) {
          this._events.active[event.id] = event;
          result.push(event);
        }
      }.bind(this));


      this._fireEvent(Messages.ON_LOAD, result, batch);

      if (this.initWithPrefetch) {
        batch.waitForMeToFinish('delay');
        setTimeout(function () {
          this._connectionEventsGetChanges(batch);
          batch.done('delay');
        }.bind(this), 100);
      }
      batch.done('Monitor:initEvents finished');


    }.bind(this));
};





/**
 * @private
 */
Monitor.prototype._connectionEventsGetChanges = function (batch) {
  batch = this.startBatch('connectionEventsGetChanges', batch);
  if (this.eventsGetChangesInProgress) {
    this.eventsGetChangesNeeded = true;
    console.log('[WARNING] Skipping _connectionEventsGetChanges because one is in Progress');
    batch.done('connectionEventsGetChanges in Progress');
    return;
  }
  this.eventsGetChangesInProgress = true;
  this.eventsGetChangesNeeded = false;


  // var options = { modifiedSince : this.lastSynchedST};
  var options = { modifiedSince : this.lastSynchedST, state : 'all'};


  var filterWith = this.filter.getData(true, options);
  if (this.ensureFullCache) {
    filterWith = REALLY_ALL_EVENTS;
    filterWith = _.extend(filterWith, options);
  }
  this.lastSynchedST = this.connection.getServerTime();

  var result = { created : [], trashed : [], modified: []};

  this.connection.events.get(filterWith,
    function (error, events) {
      if (error) {
        this._fireEvent(Messages.ON_ERROR, error, batch);
        batch.done('connectionEventsGetChanges error');
        return;
      }

      _.each(events, function (event) {
        if (! this.ensureFullCache || this.filter.matchEvent(event)) {
          if (this._events.active[event.id]) {
            if (event.trashed && !this._events.active[event.id].trashed) { // trashed
              result.trashed.push(event);
              delete this._events.active[event.id];
            } else {
              result.modified.push(event);
              this._events.active[event.id] = event;
            }
          } else {
            if (this.ensureFullCache) { // can test streams  state (trashed)
              if (!event.trashed && event.stream && !event.stream.trashed) {
                result.created.push(event);
                this._events.active[event.id] = event;
              }
            } else {  // cannot test stream state
              if (!event.trashed) {
                result.created.push(event);
                this._events.active[event.id] = event;
              }
            }
          }
        }
      }.bind(this));

      this._fireEvent(Messages.ON_EVENT_CHANGE, result, batch);
      batch.done('connectionEventsGetChanges');

      // ---
      setTimeout(function () {
        this.eventsGetChangesInProgress = false;
        if (this.eventsGetChangesNeeded) {
          this._connectionEventsGetChanges();
        }
      }.bind(this), GETEVENT_MIN_REFRESH_RATE);

    }.bind(this));
};

/**
 * @private
 */
Monitor.prototype._connectionStreamsGetChanges = function (batch) {
  batch = this.startBatch('connectionStreamsGetChanges', batch);
  var previousStreamsData = {};
  var previousStreamsMap = {}; // !! only used to get back deleted streams..
  var created = [], modified = [], modifiedPreviousProperties = {}, trashed = [], deleted = [];

  var isStreamChanged = function (streamA, streamB) {
    return !_.isEqual(streamA, streamB);
  };


  // check if the stream has changed it.. and save it in the right message box
  var checkChangedStatus = function (stream) {


    if (! previousStreamsData[stream.id]) { // new stream
      created.push(stream);
    } else if (isStreamChanged(previousStreamsData[stream.id], stream.getData())) {

      if (previousStreamsData[stream.id].trashed !== stream.trashed) {
        if (!stream.trashed) {
          created.push(stream);
        } else {
          trashed.push(stream);
        }
      } else {
        modified.push(stream);
        modifiedPreviousProperties[stream.id] = previousStreamsData[stream.id];
      }
    }

    _.each(stream.children, function (child) {
      checkChangedStatus(child);
    });
    delete previousStreamsData[stream.id];
  };

  //-- get all current streams before matching with new ones --//
  var getFlatTree = function (stream) {
    previousStreamsData[stream.id] = stream.getData();
    previousStreamsMap[stream.id] = stream;

    _.each(stream.children, function (child) {
      getFlatTree(child);
    });
  };
  _.each(this.connection.datastore.getStreams(true), function (rootStream) {
    getFlatTree(rootStream);
  });

  this.connection.fetchStructure(function (error, result) {
    if (error) {
      batch.done('connectionStreamsGetChanges fetchStructure error');
      return;
    }
    _.each(result, function (rootStream) {
      checkChangedStatus(rootStream);
    });
    // each stream remaining in streams[] are deleted streams;
    _.each(previousStreamsData, function (streamData, streamId) {
      deleted.push(previousStreamsMap[streamId]);
    });

    this._fireEvent(Messages.ON_STRUCTURE_CHANGE,
      { created : created, trashed : trashed, modified: modified, deleted: deleted,
        modifiedPreviousProperties: modifiedPreviousProperties}, batch);

    this._onFilterChange({signal : Filter.Messages.STRUCTURE_CHANGE}, batch);
    batch.done('connectionStreamsGetChanges');
  }.bind(this));
};

/**
 * @private
 */
Monitor.prototype._connectionEventsGetAllAndCompare = function (signal, extracontent, batch) {
  this.lastSynchedST = this.connection.getServerTime();


  if (this.useCacheForEventsGetAllAndCompare) {



    // POC code to look into in-memory events for matching events..
    // do not activate until cache handles DELETE
    var result1 = { enter : [], leave : []};
    _.extend(result1, extracontent);


    // first cleanup same as : this._refilterLocaly(signal, extracontent, batch);
    if (! this._events) {
      throw new Error('Not yet started!!!');
    }
    _.each(_.clone(this._events.active), function (event) {
      if (! this.filter.matchEvent(event)) {
        result1.leave.push(event);
        delete this._events.active[event.id];
      }
    }.bind(this));



    var cachedEvents = this.connection.datastore.getEventsMatchingFilter(this.filter);
    _.each(cachedEvents, function (event) {
      if (! this._events.active[event.id]) {  // we don't care for already known event
        this._events.active[event.id] = event; // store it
        result1.enter.push(event);
      }
    }.bind(this));



    this._fireEvent(signal, result1, batch);

    // remove all events not matching filter


  }

  // look online
  if (! this.ensureFullCache)  { // not needed when full cache is enabled
    var result = { enter : [] };
    _.extend(result, extracontent); // pass extracontent to receivers

    var toremove = _.clone(this._events.active);

    batch = this.startBatch('connectionEventsGetAllAndCompare:online', batch);
    this.connection.events.get(this.filter.getData(true, EXTRA_ALL_EVENTS),
      function (error, events) {
        if (error) {
          this._fireEvent(Messages.ON_ERROR, error, batch);
          batch.done('connectionEventsGetAllAndCompare:online error');
          return;
        }
        _.each(events, function (event) {
          if (this._events.active[event.id]) {  // already known event we don't care
            delete toremove[event.id];
          } else {
            this._events.active[event.id] = event;
            result.enter.push(event);
          }
        }.bind(this));
        _.each(_.keys(toremove), function (streamid) {
          delete this._events.active[streamid]; // cleanup not found streams
        }.bind(this));
        result.leave = _.values(toremove); // unmatched events are to be removed
        this._fireEvent(signal, result, batch);
        batch.done('connectionEventsGetAllAndCompare:online');
      }.bind(this));
  }
};


/**
 * TODO write doc
 * return informations on events
 */
Monitor.prototype.stats = function (force, callback) {
  this.connection.profile.getTimeLimits(force, callback);
};

module.exports = Monitor;



},{"./Filter.js":16,"./utility/SignalEmitter.js":34,"underscore":12}],18:[function(require,module,exports){
var _ = require('underscore');



/**
 * TODO write documentation  with use cases.. !!
 * @type {Function}
 */
var Stream = module.exports = function Stream(connection, data) {
  this.connection = connection;

  this.serialId = this.connection.serialId + '>S' + this.connection._streamSerialCounter++;
  /** those are only used when no datastore **/
  this._parent = null;
  this.parentId = null;
  this.trashed = false;
  this._children = [];
  data.name = _.escape(data.name);
  _.extend(this, data);
};

Stream.RW_PROPERTIES =
  ['name', 'parentId', 'singleActivity', 'clientData', 'trashed'];

/**
 * get Json object ready to be posted on the API
 */
Stream.prototype.getData = function () {
  var data = {};
  _.each(Stream.RW_PROPERTIES, function (key) { // only set non null values
    if (_.has(this, key)) { data[key] = this[key]; }
  }.bind(this));
  return data;
};


/**
 * Set or erase clientData properties
 * @example // set x=25 and delete y
 * stream.setClientData({x : 25, y : null}, function(error) { console.log('done'); });
 *
 * @param {Object} keyValueMap
 * @param {Connection~requestCallback} callback
 */
Stream.prototype.setClientData = function (keyValueMap, callback) {
  return this.connection.streams.setClientData(this, keyValueMap, callback);
};

Object.defineProperty(Stream.prototype, 'parent', {
  get: function () {

    if (!this.parentId) {
      return null;
    }
    if (!this.connection.datastore) { // we use this._parent and this._children
      return this._parent;
    }

    return this.connection.datastore.getStreamById(this.parentId);
  },
  set: function (p) {
    if (p instanceof Stream) {
      p = p.id;
    }

    this.parentId = p;

    if (!this.connection.datastore) { // we use this._parent and this._children
      this._parent = p;
    }
    throw new Error('Stream.parent property is read only');
  }
});

/**
 * TODO write documentation
 * Does not return trashed childrens
 */
Object.defineProperty(Stream.prototype, 'children', {
  get: function () {
    if (!this.connection.datastore) { // we use this._parent and this._children
      return this._children;
    }
    var children = [];
    _.each(this.childrenIds, function (childrenId) {
      try {
        var child = this.connection.datastore.getStreamById(childrenId);
        if (child.parentId === this.id && ! child.trashed) { // exclude trashed childs
          children.push(child);
        }
      } catch (e) {
        console.warn('cannot find child', e);
      }
    }.bind(this));
    return children;
  },
  set: function () {
    throw new Error('Stream.children property is read only');
  }
});

// TODO write test
Object.defineProperty(Stream.prototype, 'ancestors', {
  get: function () {
    if (!this.parentId || this.parent === null) {
      return [];
    }
    var result = this.parent.ancestors;
    result.push(this.parent);
    return result;
  },
  set: function () {
    throw new Error('Stream.ancestors property is read only');
  }
});







},{"underscore":12}],19:[function(require,module,exports){
/* global confirm, document, navigator, location, window */

var utility = require('../utility/utility.js');
var Connection = require('../Connection.js');
var _ = require('underscore');


//--------------------- access ----------//
/**
 * @class Auth
 * */
var Auth = function () {
};


_.extend(Auth.prototype, {
  connection: null, // actual connection managed by Auth
  config: {
    // TODO: clean up this hard-coded mess and rely on the one and only Pryv URL domains reference
    registerURL: {ssl: true, host: 'reg.pryv.io'},
    sdkFullPath: 'https://api.pryv.com/lib-javascript/latest'
  },
  state: null,  // actual state
  window: null,  // popup window reference (if any)
  spanButton: null, // an element on the app web page that can be controlled
  buttonHTML: '',
  onClick: {}, // functions called when button is clicked
  settings: null,
  pollingID: false,
  pollingIsOn: true, //may be turned off if we can communicate between windows
  cookieEnabled: false,
  ignoreStateFromURL: false // turned to true in case of loggout
});

/**
 * Method to initialize the data required for authorization.
 * @method _init
 * @access private
 */
Auth._init = function (i) {
  // start only if utility is loaded
  if (typeof utility === 'undefined') {
    if (i > 100) {
      throw new Error('Cannot find utility');
    }
    i++;
    return setTimeout('Auth._init(' + i + ')', 10 * i);
  }

  utility.loadExternalFiles(
    Auth.prototype.config.sdkFullPath + '/assets/buttonSigninPryv.css', 'css');


  console.log('init done');
};


Auth._init(1);

//--------------------- UI Content -----------//


Auth.prototype.uiSupportedLanguages = ['en', 'fr'];

Auth.prototype.uiButton = function (onClick, buttonText) {
  if (utility.supportCSS3()) {
    return '<div id="pryv-access-btn" class="pryv-access-btn-signin" data-onclick-action="' +
      onClick + '">' +
      '<a class="pryv-access-btn pryv-access-btn-pryv-access-color" href="#">' +
      '<span class="logoSignin">Y</span></a>' +
      '<a class="pryv-access-btn pryv-access-btn-pryv-access-color"  href="#"><span>' +
      buttonText + '</span></a></div>';
  } else   {
    return '<a href="#" id ="pryv-access-btn" data-onclick-action="' + onClick +
      '" class="pryv-access-btn-signinImage" ' +
      'src="' + this.config.sdkFullPath + '/assets/btnSignIn.png" >' + buttonText + '</a>';
  }
};

Auth.prototype.uiErrorButton = function () {
  var strs = {
    'en': { 'msg': 'Error :(' },
    'fr': { 'msg': 'Erreur :('}
  }[this.settings.languageCode];
  this.onClick.Error = function () {
    this.logout();
    return false;
  }.bind(this);
  return this.uiButton('Error', strs.msg);
};

Auth.prototype.uiLoadingButton = function () {
  var strs = {
    'en': { 'msg': 'Loading...' },
    'fr': { 'msg': 'Chargement...'}
  }[this.settings.languageCode];
  this.onClick.Loading = function () {
    return false;
  };
  return this.uiButton('Loading', strs.msg);

};

Auth.prototype.uiSigninButton = function () {
  var strs = {
    'en': { 'msg': 'Sign in' },
    'fr': { 'msg': 'S\'identifier' }
  }[this.settings.languageCode];
  this.onClick.Signin = function () {
    this.popupLogin();
    return false;
  }.bind(this);
  return this.uiButton('Signin', strs.msg);

};

Auth.prototype.uiConfirmLogout = function () {
  var strs = {
    'en': { 'logout': 'Sign out?'},
    'fr': { 'logout': 'Se déconnecter?'}
  }[this.settings.languageCode];

  if (confirm(strs.logout)) {
    this.logout();
  }
};

Auth.prototype.uiInButton = function (username) {
  this.onClick.In = function () {
    this.uiConfirmLogout();
    return false;
  }.bind(this);
  return this.uiButton('In', username);
};

Auth.prototype.uiRefusedButton = function (message) {
  console.log('Pryv access [REFUSED]' + message);
  var strs = {
    'en': { 'msg': 'access refused'},
    'fr': { 'msg': 'Accès refusé'}
  }[this.settings.languageCode];
  this.onClick.Refused = function () {
    this.retry();
    return false;
  }.bind(this);
  return this.uiButton('Refused', strs.msg);

};

//--------------- end of UI ------------------//


Auth.prototype.updateButton = function (html) {
  this.buttonHTML = html;
  if (! this.settings.spanButtonID) { return; }

  utility.domReady(function () {
    if (! this.spanButton) {
      var element = document.getElementById(this.settings.spanButtonID);
      if (typeof(element) === 'undefined' || element === null) {
        throw new Error('access-SDK cannot find span ID: "' +
          this.settings.spanButtonID + '"');
      } else {
        this.spanButton = element;
      }
    }
    this.spanButton.innerHTML = this.buttonHTML;
    this.spanButton.onclick = function (e) {
      e.preventDefault();
      var element = document.getElementById('pryv-access-btn');
      console.log('onClick', this.spanButton,
        element.getAttribute('data-onclick-action'));
      this.onClick[element.getAttribute('data-onclick-action')]();
    }.bind(this);
  }.bind(this));
};

Auth.prototype.internalError = function (message, jsonData) {
  this.stateChanged({id: 'INTERNAL_ERROR', message: message, data: jsonData});
};

//STATE HUB
Auth.prototype.stateChanged  = function (data) {


  if (data.id) { // error
    if (this.settings.callbacks.error) {
      this.settings.callbacks.error(data.id, data.message);
    }
    this.updateButton(this.uiErrorButton());
    console.log('Error: ' + JSON.stringify(data));
    // this.logout();   Why should I retry if it failed already once?
  }

  if (data.status === this.state.status) {
    return;
  }
  if (data.status === 'LOADED') { // skip
    return;
  }
  if (data.status === 'POPUPINIT') { // skip
    return;
  }

  this.state = data;
  if (this.state.status === 'NEED_SIGNIN') {
    this.stateNeedSignin();
  }
  if (this.state.status === 'REFUSED') {
    this.stateRefused();
  }

  if (this.state.status === 'ACCEPTED') {
    this.stateAccepted();
  }

};

//STATE 0 Init
Auth.prototype.stateInitialization = function () {
  this.state = {status : 'initialization'};
  this.updateButton(this.uiLoadingButton());
  if (this.settings.callbacks.initialization) {
    this.settings.callbacks.initialization();
  }
};

//STATE 1 Need Signin
Auth.prototype.stateNeedSignin = function () {
  this.updateButton(this.uiSigninButton());
  if (this.settings.callbacks.needSignin) {
    this.settings.callbacks.needSignin(this.state.url, this.state.poll,
      this.state.poll_rate_ms);
  }
};


//STATE 2 User logged in and authorized
Auth.prototype.stateAccepted = function () {
  if (this.cookieEnabled) {
    utility.docCookies.setItem('access_username' + this.settings.domain, this.state.username, 3600);
    utility.docCookies.setItem('access_token' + this.settings.domain, this.state.token, 3600);
  }
  this.updateButton(this.uiInButton(this.state.username));

  this.connection.username = this.state.username;
  this.connection.auth = this.state.token;
  this.connection.domain = this.settings.domain;
  if (this.settings.callbacks.accepted) {
    this.settings.callbacks.accepted(this.state.username, this.state.token, this.state.lang);
  }
  if (this.settings.callbacks.signedIn) {
    this.settings.callbacks.signedIn(this.connection, this.state.lang);
  }
};

//STATE 3 User refused
Auth.prototype.stateRefused = function () {
  this.updateButton(this.uiRefusedButton(this.state.message));
  if (this.settings.callbacks.refused) {
    this.settings.callbacks.refused('refused:' + this.state.message);
  }
};


/**
 * clear all references
 */
Auth.prototype.logout = function () {
  this.ignoreStateFromURL = true;
  if (this.cookieEnabled) {
    utility.docCookies.removeItem('access_username' + this.settings.domain);
    utility.docCookies.removeItem('access_token' + this.settings.domain);
  }
  this.state = null;
  if (this.settings.callbacks.accepted) {
    this.settings.callbacks.accepted(false, false, false);
  }
  if (this.settings.callbacks.signedOut) {
    this.settings.callbacks.signedOut(this.connection);
  }
  this.connection = null;
  this.setup(this.settings);
};

/**
 * clear references and try again
 */
Auth.prototype.retry = Auth.prototype.logout;




/* jshint -W101 */
// TODO: the 4 methods below belong elsewhere (e.g. static methods of Connection); original author please check with @sgoumaz

/**
 * TODO: discuss whether signature should be `(settings, callback)`
 * @param settings
 */
Auth.prototype.login = function (settings) {
  // cookies
  this.cookieEnabled = (navigator.cookieEnabled) ? true : false;
  if (typeof navigator.cookieEnabled === 'undefined' && !this.cookieEnabled) {  //if not IE4+ NS6+
    document.cookie = 'testcookie';
    this.cookieEnabled = (document.cookie.indexOf('testcookie') !== -1) ? true : false;
  }


  var defaultDomain = utility.urls.defaultDomain;
  this.settings = settings = _.defaults(settings, {
    ssl: true,
    domain: defaultDomain
  });

  this.connection = new Connection({
    ssl: settings.ssl,
    domain: settings.domain
  });

  var pack = {
    ssl: settings.ssl,
    host: settings.username + '.' + settings.domain,
    path: '/auth/login',
    params: {
      appId : settings.appId,
      username : settings.username,
      password : settings.password
    },
    success: function (data)  {
      if (data.token) {
        if (this.cookieEnabled && settings.rememberMe) {
          utility.docCookies.setItem('access_username' + this.settings.domain,
             settings.username, 3600);
          utility.docCookies.setItem('access_token' + this.settings.domain,
            data.token, 3600);
          utility.docCookies.setItem('access_preferredLanguage' + this.settings.domain,
            data.preferredLanguage, 3600);
        }
        console.log('set cookie', this.cookieEnabled, settings.rememberMe,
          utility.docCookies.getItem('access_username' + this.settings.domain),
          utility.docCookies.getItem('access_token' + this.settings.domain));
        this.connection.username = settings.username;
        this.connection.auth = data.token;
        if (typeof(this.settings.callbacks.signedIn)  === 'function') {
          this.settings.callbacks.signedIn(this.connection);
        }
      } else {
        if (typeof(this.settings.callbacks.error) === 'function') {
          this.settings.callbacks.error(data);
        }
      }
    }.bind(this),
    error: function (jsonError) {
      if (typeof(this.settings.callbacks.error) === 'function') {
        this.settings.callbacks.error(jsonError);
      }
    }.bind(this)
  };

  utility.request(pack);
};

// TODO: must be an instance member of Connection instead
Auth.prototype.trustedLogout = function () {
  if (this.connection) {
    this.connection.request({
      method: 'POST',
      path: '/auth/logout',
      callback: function (error) {
        if (error && typeof(this.settings.callbacks.error) === 'function') {
          return this.settings.callbacks.error(error);
        }
        if (!error && typeof(this.settings.callbacks.signedOut) === 'function') {
          return this.settings.callbacks.signedOut(this.connection);
        }
      }.bind(this)
    });
  }
};

Auth.prototype.whoAmI = function (settings) {

  var defaultDomain = utility.urls.defaultDomain;
  this.settings = settings = _.defaults(settings, {
    ssl: true,
    domain: defaultDomain
  });

  this.connection = new Connection({
    ssl: settings.ssl,
    domain: settings.domain
  });

  var pack = {
    ssl: settings.ssl,
    host: settings.username + '.' + settings.domain,
    path :  '/auth/who-am-i',
    method: 'GET',
    success : function (data)  {
      if (data.token) {
        this.connection.username = data.username;
        this.connection.auth = data.token;
        var conn = new Connection(data.username, data.token, {
          ssl: settings.ssl,
          domain: settings.domain
        });
        console.log('before access info', this.connection);
        conn.accessInfo(function (error) {
          console.log('after access info', this.connection);
          if (!error) {
            if (typeof(this.settings.callbacks.signedIn)  === 'function') {
              this.settings.callbacks.signedIn(this.connection);
            }
          } else {
            if (typeof(this.settings.callbacks.error) === 'function') {
              this.settings.callbacks.error(error);
            }
          }
        }.bind(this));

      } else {
        if (typeof(this.settings.callbacks.error) === 'function') {
          this.settings.callbacks.error(data);
        }
      }
    }.bind(this),
    error : function (jsonError) {
      if (typeof(this.settings.callbacks.error) === 'function') {
        this.settings.callbacks.error(jsonError);
      }
    }.bind(this)
  };

  utility.request(pack);
};

Auth.prototype.loginWithCookie = function (settings) {

  var defaultDomain = utility.urls.defaultDomain;
  this.settings = settings = _.defaults(settings, {
    ssl: true,
    domain: defaultDomain
  });

  this.connection = new Connection({
    ssl: settings.ssl,
    domain: settings.domain
  });

  this.cookieEnabled = (navigator.cookieEnabled) ? true : false;
  if (typeof navigator.cookieEnabled === 'undefined' && !this.cookieEnabled) {  //if not IE4+ NS6+
    document.cookie = 'testcookie';
    this.cookieEnabled = (document.cookie.indexOf('testcookie') !== -1) ? true : false;
  }
  var cookieUserName = this.cookieEnabled ?
    utility.docCookies.getItem('access_username' + this.settings.domain) : false;
  var cookieToken = this.cookieEnabled ?
    utility.docCookies.getItem('access_token' + this.settings.domain) : false;
  console.log('get cookie', cookieUserName, this.settings.domain, cookieToken);
  if (cookieUserName && cookieToken) {
    this.connection.username = cookieUserName;
    this.connection.domain = this.settings.domain;
    this.connection.auth = cookieToken;
    if (typeof(this.settings.callbacks.signedIn) === 'function') {
      this.settings.callbacks.signedIn(this.connection);
    }
    return this.connection;
  }
  return false;
};





/**
 *
 * @param settings
 * @returns {Connection} the connection managed by Auth.. A new one is created each time setup is
 * called.
 */
Auth.prototype.setup = function (settings) {
  this.state = null;

  //--- check the browser capabilities


  // cookies
  this.cookieEnabled = (navigator.cookieEnabled) ? true : false;
  if (typeof navigator.cookieEnabled === 'undefined' && !this.cookieEnabled) {  //if not IE4+ NS6+
    document.cookie = 'testcookie';
    this.cookieEnabled = (document.cookie.indexOf('testcookie') !== -1) ? true : false;
  }

  //TODO check settings..

  settings.languageCode =
    utility.getPreferredLanguage(this.uiSupportedLanguages, settings.languageCode);

  //-- returnURL
  settings.returnURL = settings.returnURL || 'auto#';
  if (settings.returnURL) {
    // check the trailer
    var trailer = settings.returnURL.charAt(settings.returnURL.length - 1);
    if ('#&?'.indexOf(trailer) < 0) {
      throw new Error('Pryv access: Last character of --returnURL setting-- is not ' +
        '"?", "&" or "#": ' + settings.returnURL);
    }

    // set self as return url?
    var returnself = (settings.returnURL.indexOf('self') === 0);
    if (settings.returnURL.indexOf('auto') === 0) {
      returnself = utility.browserIsMobileOrTablet();
      if (!returnself) { settings.returnURL = false; }
    }

    if (returnself) {
      var myParams = settings.returnURL.substring(4);
      // eventually clean-up current url from previous pryv returnURL
      settings.returnURL = this._cleanStatusFromURL() + myParams;
    }

    if (settings.returnURL) {
      if (settings.returnURL.indexOf('http') < 0) {
        throw new Error('Pryv access: --returnURL setting-- does not start with http: ' +
          settings.returnURL);
      }
    }
  }

  //  spanButtonID is checked only when possible
  this.settings = settings;


  // TODO: clean up this hard-coded mess and rely on the one and only Pryv URL domains reference
  var parts =  this.config.registerURL.host.split('.').reverse();
  this.settings.domain = parts[1] + '.' + parts[0];

  var params = {
    requestingAppId : settings.requestingAppId,
    requestedPermissions : settings.requestedPermissions,
    languageCode : settings.languageCode,
    returnURL : settings.returnURL
  };

  this.stateInitialization();


  this.connection = new Connection(null, null, {ssl: true, domain: this.settings.domain});
  // look if we have a returning user (document.cookie)
  var cookieUserName = this.cookieEnabled ?
    utility.docCookies.getItem('access_username' + this.settings.domain) : false;
  var cookieToken = this.cookieEnabled ?
    utility.docCookies.getItem('access_token' + this.settings.domain) : false;

  // look in the URL if we are returning from a login process
  var stateFromURL =  this._getStatusFromURL();

  if (stateFromURL && (! this.ignoreStateFromURL)) {
    this.stateChanged(stateFromURL);
  } else if (cookieToken && cookieUserName) {
    this.stateChanged({status: 'ACCEPTED', username: cookieUserName,
      token: cookieToken, domain: this.settings.domain});
  } else { // launch process $

    var pack = {
      path :  '/access',
      params : params,
      success : function (data)  {
        if (data.status && data.status !== 'ERROR') {
          this.stateChanged(data);
        } else {
          // TODO call shouldn't failed
          this.internalError('/access Invalid data: ', data);
        }
      }.bind(this),
      error : function (jsonError) {
        this.internalError('/access ajax call failed: ', jsonError);
      }.bind(this)
    };

    utility.request(_.extend(pack, this.config.registerURL));


  }


  return this.connection;
};

//logout the user if

//read the polling
Auth.prototype.poll = function poll() {
  if (this.pollingIsOn && this.state.poll_rate_ms) {
    // remove eventually waiting poll..
    if (this.pollingID) { clearTimeout(this.pollingID); }


    var pack = {
      path :  '/access/' + this.state.key,
      method : 'GET',
      success : function (data)  {
        this.stateChanged(data);
      }.bind(this),
      error : function (jsonError) {
        this.internalError('poll failed: ', jsonError);
      }.bind(this)
    };

    utility.request(_.extend(pack, this.config.registerURL));


    this.pollingID = setTimeout(this.poll.bind(this), this.state.poll_rate_ms);
  } else {
    console.log('stopped polling: on=' + this.pollingIsOn + ' rate:' + this.state.poll_rate_ms);
  }
};


//messaging between browser window and window.opener
Auth.prototype.popupCallBack = function (event) {
  // Do not use 'this' here !
  if (this.settings.forcePolling) { return; }
  if (event.source !== this.window) {
    console.log('popupCallBack event.source does not match Auth.window');
    return false;
  }
  console.log('from popup >>> ' + JSON.stringify(event.data));
  this.pollingIsOn = false; // if we can receive messages we stop polling
  this.stateChanged(event.data);
};



Auth.prototype.popupLogin = function popupLogin() {
  if ((! this.state) || (! this.state.url)) {
    throw new Error('Pryv Sign-In Error: NO SETUP. Please call Auth.setup() first.');
  }

  if (this.settings.returnURL) {
    location.href = this.state.url;
    return;
  }

  // start polling
  setTimeout(this.poll(), 1000);

  var screenX = typeof window.screenX !== 'undefined' ? window.screenX : window.screenLeft,
    screenY = typeof window.screenY !== 'undefined' ? window.screenY : window.screenTop,
    outerWidth = typeof window.outerWidth !== 'undefined' ?
      window.outerWidth : document.body.clientWidth,
    outerHeight = typeof window.outerHeight !== 'undefined' ?
      window.outerHeight : (document.body.clientHeight - 22),
    width    = 270,
    height   = 420,
    left     = parseInt(screenX + ((outerWidth - width) / 2), 10),
    top      = parseInt(screenY + ((outerHeight - height) / 2.5), 10),
    features = (
      'width=' + width +
        ',height=' + height +
        ',left=' + left +
        ',top=' + top +
        ',scrollbars=yes'
      );


  window.addEventListener('message', this.popupCallBack.bind(this), false);

  this.window = window.open(this.state.url, 'prYv Sign-in', features);

  if (! this.window) {
    // TODO try to fall back on access
    console.log('FAILED_TO_OPEN_WINDOW');
  } else {
    if (window.focus) {
      this.window.focus();
    }
  }

  return false;
};




//util to grab parameters from url query string
Auth.prototype._getStatusFromURL = function () {
  var vars = {};
  window.location.href.replace(/[?#&]+prYv([^=&]+)=([^&]*)/gi,
    function (m, key, value) {
      vars[key] = value;
    });

  //TODO check validity of status

  return (vars.status) ? vars : false;
};

//util to grab parameters from url query string
Auth.prototype._cleanStatusFromURL = function () {
  return window.location.href.replace(/[?#&]+prYv([^=&]+)=([^&]*)/gi, '');
};

//-------------------- UTILS ---------------------//

module.exports = new Auth();

},{"../Connection.js":13,"../utility/utility.js":41,"underscore":12}],20:[function(require,module,exports){

module.exports = {};
},{}],21:[function(require,module,exports){
var utility = require('../utility/utility.js');

module.exports =  utility.isBrowser() ?
    require('./Auth-browser.js') : require('./Auth-node.js');

},{"../utility/utility.js":41,"./Auth-browser.js":19,"./Auth-node.js":20}],22:[function(require,module,exports){
var apiPathAccesses = '/accesses';
var _ = require('underscore'),
  CC = require('./ConnectionConstants.js');

/**
 * @class Accesses
 * @link http://api.pryv.com/reference.html#methods-accesses
 * @link http://api.pryv.com/reference.html#data-structure-access
 * @param {Connection} connection
 * @constructor
 */
function Accesses(connection) {
  this.connection = connection;
}
/**
 * @param {Connection~requestCallback} callback
 */
Accesses.prototype.get = function (callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  this.connection.request({
    method: 'GET',
    path: apiPathAccesses,
    callback: function (err, res) {
      if (err) {
        return callback(err);
      }
      var accesses = res.accesses || res.access;
      callback(null, accesses);
    }
  });
};

/**
 * TODO complete documentation
 * @param access
 * @param callback
 */
Accesses.prototype.create = function (access, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  this.connection.request({
    method: 'POST',
    path: apiPathAccesses,
    callback: function (err, res) {
      if (err) {
        return callback(err);
      }
      callback(err, res.access);
    },
    jsonData: access
  });
};

/**
 * TODO complete documentation
 * @param access
 * @param callback
 */
Accesses.prototype.update = function (access, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  if (access.id) {
    this.connection.request({
      method: 'PUT',
      path: apiPathAccesses + '/' + access.id,
      jsonData: _.pick(access, 'name', 'deviceName', 'permissions'),
      callback: function (err, res) {
        if (err) {
          return callback(err);
        }
        callback(err, res.access);
      }
    });
  } else {
    return callback('No access id found');
  }
};

/**
 * TODO complete documentation
 * @param accessId
 * @param callback
 */
Accesses.prototype.delete = function (accessId, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  this.connection.request({
    method: 'DELETE',
    path: apiPathAccesses + '/' + accessId,
    callback: function (err, result) {
      if (err) {
        return callback(err);
      }
      callback(null, result);
    }
  });
};
module.exports = Accesses;
},{"./ConnectionConstants.js":25,"underscore":12}],23:[function(require,module,exports){
var apiPathAccount = '/account';
var CC = require('./ConnectionConstants.js');

function Account(connection) {
  this.connection = connection;
}

Account.prototype.changePassword = function (oldPassword, newPassword, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  this.connection.request({
    method: 'POST',
    path: apiPathAccount + '/change-password',
    jsonData: {'oldPassword': oldPassword, 'newPassword': newPassword},
    callback: function (err) {
      callback(err);
    }
  });
};
Account.prototype.getInfo = function (callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  this.connection.request({
    method: 'GET',
    path: apiPathAccount,
    callback: function (error, result) {
      if (result && result.account) {
        result = result.account;
      }
      callback(error, result);
    }
  });
};

module.exports = Account;
},{"./ConnectionConstants.js":25}],24:[function(require,module,exports){
var apiPathBookmarks = '/followed-slices',
  Connection = require('../Connection.js'),
  _ = require('underscore'),
  CC = require('./ConnectionConstants.js');

/**
 * @class Bookmarks
 * @link http://api.pryv.com/reference.html#data-structure-subscriptions-aka-bookmarks
 * @param {Connection} connection
 * @constructor
 */
function Bookmarks(connection, Conn) {
  this.connection = connection;
  Connection = Conn;
}
/**
 * @param {Connection~requestCallback} callback
 */
Bookmarks.prototype.get = function (callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  this.connection.request({
    method: 'GET',
    path: apiPathBookmarks,
    callback: function (error, res) {
      var result = [],
        bookmarks = res.followedSlices || res.followedSlice;
      _.each(bookmarks, function (bookmark) {
        bookmark.url = bookmark.url.replace(/\.li/, '.in');
        bookmark.url = bookmark.url.replace(/\.me/, '.io');
        var conn =  new Connection({
          auth: bookmark.accessToken,
          url: bookmark.url,
          name: bookmark.name,
          bookmarkId: bookmark.id
        });
        result.push(conn);
      });
      callback(error, result);
    }
  });
};

/**
 * TODO complete documentation
 * @param bookmark
 * @param callback
 * @returns {*}
 */
Bookmarks.prototype.create = function (bookmark, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  if (bookmark.name && bookmark.url && bookmark.accessToken) {
    this.connection.request({
      method: 'POST',
      path: apiPathBookmarks,
      jsonData: bookmark,
      callback: function (err, result) {
        var error = err;
        if (!error) {
          var conn =  new Connection({
            auth: bookmark.accessToken,
            url: bookmark.url,
            name: bookmark.name,
            bookmarkId: result.followedSlice.id
          });
          bookmark = conn;
        }
        callback(error, bookmark);
      }
    });
    return bookmark;
  }
};

/**
 * TODO complete documentation
 * @param bookmarkId
 * @param callback
 */
Bookmarks.prototype.delete = function (bookmarkId, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  this.connection.request({
    method: 'DELETE',
    path: apiPathBookmarks + '/' + bookmarkId,
    callback: function (err, result) {
      var error = err;
      if (result && result.message) {
        error = result;
      }
      callback(error, result);
    }
  });
};

module.exports = Bookmarks;
},{"../Connection.js":13,"./ConnectionConstants.js":25,"underscore":12}],25:[function(require,module,exports){
exports.Errors = {
  API_UNREACHEABLE : 'API_UNREACHEABLE',
  INVALID_RESULT_CODE : 'INVALID_RESULT_CODE',
  CALLBACK_IS_NOT_A_FUNCTION: 'callback argument must be a function'
};

exports.Api = {
  Headers : {
    ServerTime : 'server-time',
    ApiVersion : 'api-version'
  }
};
},{}],26:[function(require,module,exports){
var utility = require('../utility/utility.js'),
  _ = require('underscore'),
  Filter = require('../Filter'),
  Event = require('../Event'),
  CC = require('./ConnectionConstants.js');

/**
 * @class ConnectionEvents
 *
 * Coverage of the API
 *  GET /events -- 100%
 *  POST /events -- only data (no object)
 *  POST /events/start -- 0%
 *  POST /events/stop -- 0%
 *  PUT /events/{event-id} -- 100%
 *  DELETE /events/{event-id} -- only data (no object)
 *  POST /events/batch -- only data (no object)
 *
 *  attached files manipulations are covered by Event
 *
 *
 * @param {Connection} connection
 * @constructor
 */
function ConnectionEvents(connection) {
  this.connection = connection;
}


/**
 * @example
 * // get events from the Diary stream
 * conn.events.get({streamId : 'diary'},
 *  function(events) {
 *    console.log('got ' + events.length + ' events)
 *  }
 * );
 * @param {FilterLike} filter
 * @param {ConnectionEvents~getCallback} doneCallback
 * @param {ConnectionEvents~partialResultCallback} partialResultCallback
 */
ConnectionEvents.prototype.get = function (filter, doneCallback, partialResultCallback) {
  if (typeof(doneCallback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  //TODO handle caching
  var result = [];
  filter = filter || {};
  this._get(filter, function (error, res) {
    if (error) {
      result = null;
    } else {
      var eventList = res.events || res.event;
      _.each(eventList, function (eventData) {

        var event = null;
        if (!this.connection.datastore) { // no datastore   break
          event = new Event(this.connection, eventData);
        } else {
          event = this.connection.datastore.createOrReuseEvent(eventData);
        }

        result.push(event);

      }.bind(this));
      if (res.eventDeletions) {
        result.eventDeletions = res.eventDeletions;
      }
    }
    doneCallback(error, result);

    if (partialResultCallback) { partialResultCallback(result); }
  }.bind(this));

};

/**
 * @param {Event} event
 * @param {Connection~requestCallback} callback
 */
ConnectionEvents.prototype.update = function (event, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  this._updateWithIdAndData(event.id, event.getData(), callback);
};

/**
 * @param {Event | eventId} event
 * @param {Connection~requestCallback} callback
 */
ConnectionEvents.prototype.delete = ConnectionEvents.prototype.trash = function (event, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  this.trashWithId(event.id, callback);
};

/**
 * @param {String} eventId
 * @param {Connection~requestCallback} callback
 */
ConnectionEvents.prototype.trashWithId = function (eventId, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  this.connection.request({
    method: 'DELETE',
    path: '/events/' + eventId,
    callback: function (error, result) {
      // assume there is only one event (no batch for now)
      if (result && result.event) {
        if (!this.connection.datastore) { // no datastore   break
          result = new Event(this.connection, result.event);
        } else {
          result = this.connection.datastore.createOrReuseEvent(result.event);
        }
      } else {
        result = null;
      }
      callback(error, result);

    }.bind(this)
  });
};

/**
 * This is the preferred method to create an event, or to create it on the API.
 * The function return the newly created object.. It will be updated when posted on the API.
 * @param {NewEventLike} event -- minimum {streamId, type } -- if typeof Event, must belong to
 * the same connection and not exists on the API.
 * @param {ConnectionEvents~eventCreatedOnTheAPI} callback
 * @param {Boolean} [start = false] if set to true will POST the event to /events/start
 * @return {Event} event
 */
ConnectionEvents.prototype.create = function (newEventlike, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  _create.call(this, newEventlike, callback, false);
};


/**
 * This is the preferred method to create and start an event, Starts a new period event.
 * This is equivalent to starting an event with a null duration. In singleActivity streams,
 * also stops the previously running period event if any.
 * @param {NewEventLike} event -- minimum {streamId, type } -- if typeof Event, must belong to
 * the same connection and not exists on the API.
 * @param {ConnectionEvents~eventCreatedOnTheAPI} callback
 * @return {Event} event
 */
ConnectionEvents.prototype.start = function (newEventlike, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  _create.call(this, newEventlike, callback, true);
};


// common call for create and start
function _create(newEventlike, callback, start) {
  var event = null;
  if (newEventlike instanceof Event) {
    if (newEventlike.connection !== this.connection) {
      return callback(new Error('event.connection does not match current connection'));
    }
    if (newEventlike.id) {
      return callback(new Error('cannot create an event already existing on the API'));
    }
    event = newEventlike;
  } else {
    event = new Event(this.connection, newEventlike);
  }

  var url = '/events';
  if (start) { url = '/events/start'; }


  this.connection.request({
    method: 'POST',
    path: url,
    jsonData: event.getData(),
    callback: function (err, result, resultInfo) {
      if (!err && resultInfo.code !== 201) {
        err = {id: CC.Errors.INVALID_RESULT_CODE};
      }
      /**
       * Change will happend with offline caching...
       *
       * An error may hapend 400.. or other if app is behind an non-opened gateway. Thus making
       * difficult to detect if the error is a real bad request.
       * The first step would be to consider only bad request if the response can be identified
       * as coming from a valid api-server. If not, we should cache the event for later synch
       * then remove the error and send the cached version of the event.
       *
       */
      // TODO if err === API_UNREACHABLE then save event in cache
      if (result && !err) {
        _.extend(event, result.event);
        if (this.connection.datastore) {  // if datastore is activated register new event
          this.connection.datastore.addEvent(event);
        }
      }
      callback(err, err ? null : event, err ? null : result.stoppedId);
    }.bind(this)
  });
  return event;
}




/**
 * Stop an event by it's Id
 * @param {EventLike} event -- minimum {id} -- if typeof Event, must belong to
 * the same connection and not exists on the API.
 * @param {Date} [date = now] the date to set to stop the event
 * @param {ConnectionEvents~eventStoppedOnTheAPI} callback
 * @return {Event} event
 */
ConnectionEvents.prototype.stopEvent = function (eventlike, date, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }

  var data = {id: eventlike.id};
  if (date) {
    data.time = date.getTime() / 1000;
  }

  this.connection.request({
    method: 'POST',
    path: '/events/stop',
    jsonData: data,
    callback: function (err, result, resultInfo) {
      if (!err && resultInfo.code !== 200) {
        err = {id: CC.Errors.INVALID_RESULT_CODE};
      }

      // TODO if err === API_UNREACHABLE then save event in cache
      /*
       if (result && ! err) {
       if (this.connection.datastore) {  // if datastore is activated register new event

       }
       } */
      callback(err, err ? null : result.stoppedId);
    }.bind(this)
  });
};



/**
 * Stop any event in this stream
 * @param {StreamLike} stream -- minimum {id} -- if typeof Stream, must belong to
 * the same connection and not exists on the API.
 * @param {Date} [date = now] the date to set to stop the event
 * @param {String} [type = null] stop any matching eventType is this stream.
 * @param {ConnectionEvents~eventStoppedOnTheAPI} callback
 * @return {Event} event
 */
ConnectionEvents.prototype.stopStream = function (streamLike, date, type, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }

  var data = {streamId : streamLike.id };
  if (date) { data.time = date.getTime() / 1000; }
  if (type) { data.type = type; }


  this.connection.request({
    method: 'POST',
    path: '/events/stop',
    jsonData: data,
    callback: function (err, result, resultInfo) {
      if (!err && resultInfo.code !== 200) {
        err = {id: CC.Errors.INVALID_RESULT_CODE};
      }

      // TODO if err === API_UNREACHABLE then cache the stop instruction for later synch

      callback(err, err ? null : result.stoppedId);
    }.bind(this)
  });
};


/**
 * @param {NewEventLike} event -- minimum {streamId, type } -- if typeof Event, must belong to
 * the same connection and not exists on the API.
 * @param {ConnectionEvents~eventCreatedOnTheAPI} callback
 * @param {FormData} the formData to post for fileUpload. On node.js
 * refers to pryv.utility.forgeFormData
 * @return {Event} event
 */
ConnectionEvents.prototype.createWithAttachment =
  function (newEventLike, formData, callback, progressCallback) {
    if (typeof(callback) !== 'function') {
      throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
    }
    var event = null;
    if (newEventLike instanceof Event) {
      if (newEventLike.connection !== this.connection) {
        return callback(new Error('event.connection does not match current connection'));
      }
      if (newEventLike.id) {
        return callback(new Error('cannot create an event already existing on the API'));
      }
      event = newEventLike;
    } else {
      event = new Event(this.connection, newEventLike);
    }
    formData.append('event', JSON.stringify(event.getData()));
    this.connection.request({
      method: 'POST',
      path: '/events',
      jsonData: formData,
      isFile: true,
      progressCallback: progressCallback,
      callback: function (err, result) {
        if (result) {
          _.extend(event, result.event);

          if (this.connection.datastore) {  // if datastore is activated register new event
            this.connection.datastore.addEvent(event);
          }
        }
        callback(err, event);
      }.bind(this)
    });
  };

/**
 * @param {String} eventId
 * @param {ConnectionEvents~eventCreatedOnTheAPI} callback
 * @param {FormData} the formData to post for fileUpload. On node.js
 * refers to pryv.utility.forgeFormData
 * @return {Event} event
 */
ConnectionEvents.prototype.addAttachment =
  function (eventId, formData, callback, progressCallback) {
    if (typeof(callback) !== 'function') {
      throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
    }
  this.connection.request({
    method: 'POST',
    path: '/events/' + eventId,
    jsonData: formData,
    isFile: true,
    progressCallback: progressCallback,
    callback: function (err, result) {
      if (err) {
        return callback(err);
      }
      callback(null, result.event);
    }
  });
};

/**
 * @param {String} eventId
 * @param {ConnectionEvents~eventCreatedOnTheAPI} callback
 * @param {FormData} the formData to post for fileUpload. On node.js
 * refers to pryv.utility.forgeFormData
 * @return {Event} event
 */
ConnectionEvents.prototype.getAttachment =
  function (params, callback, progressCallback) {
    if (typeof(callback) !== 'function') {
      throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
    }
    this.connection.request({
      method: 'GET',
      path: '/events/' + params.eventId + '/' + params.fileId,
      progressCallback: progressCallback,
      parseResult: 'binary',
      callback: function (err, result) {
        if (err) {
          return callback(err);
        }
        callback(null, result);
      }
    });
  };

/**
 * @param {String} eventId
 * @param {ConnectionEvents~eventCreatedOnTheAPI} callback
 * @param {String} fileName
 * @return {Event} event
 */
ConnectionEvents.prototype.removeAttachment = function (eventId, fileName, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  this.connection.request({
    method: 'DELETE',
    path: '/events/' + eventId + '/' + fileName,
    callback: callback
  });
};
/**
 * //TODO rename to batch
 * //TODO make it NewEventLike compatible
 * //TODO once it support an array of mixed values Event and EventLike, the, no need for
 *  callBackWithEventsBeforeRequest at it will. A dev who want Event object just have to create
 *  them before
 * This is the prefered method to create events in batch
 * @param {Object[]} eventsData -- minimum {streamId, type }
 * @param {ConnectionEvents~eventBatchCreatedOnTheAPI}
 * @param {function} [callBackWithEventsBeforeRequest] mostly for testing purposes
 * @return {Event[]} events
 */
ConnectionEvents.prototype.batchWithData =
  function (eventsData, callback, callBackWithEventsBeforeRequest) {
    if (typeof(callback) !== 'function') {
      throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
    }
    if (!_.isArray(eventsData)) { eventsData = [eventsData]; }

    var createdEvents = [];
    var eventMap = {};

    // use the serialId as a temporary Id for the batch
    _.each(eventsData, function (eventData, i) {

      var event =  new Event(this.connection, eventData);

      createdEvents.push(event);
      eventMap[i] = event;
    }.bind(this));

    if (callBackWithEventsBeforeRequest) {
      callBackWithEventsBeforeRequest(createdEvents);
    }

    var mapBeforePush = function (evs) {
      return _.map(evs, function (e) {
        return {
          method: 'events.create',
          params: e
        };
      });
    };

    this.connection.request({
      method: 'POST',
      path: '/',
      jsonData: mapBeforePush(eventsData),
      callback: function (err, result) {
        if (!err && result) {
          _.each(result.results, function (eventData, i) {
            _.extend(eventMap[i], eventData.event); // add the data to the event

            if (this.connection.datastore) {  // if datastore is activated register new event
              this.connection.datastore.addEvent(eventMap[i]);
            }


          }.bind(this));
        }
        callback(err, createdEvents);
      }.bind(this)
    });

    return createdEvents;
  };

// --- raw access to the API

/**
 * TODO anonymise by renaming to function _get(..
 * @param {FilterLike} filter
 * @param {Connection~requestCallback} callback
 * @private
 */
ConnectionEvents.prototype._get = function (filter, callback) {
  var tParams = filter;
  if (filter instanceof Filter) { tParams = filter.getData(true); }
  if (_.has(tParams, 'streams') && tParams.streams.length === 0) { // dead end filter..
    return callback(null, []);
  }
  this.connection.request({
    method: 'GET',
    path: '/events?' + utility.getQueryParametersString(tParams),
    callback: callback
  });
};


/**
 * TODO anonymise by renaming to function _xx(..
 * @param {String} eventId
 * @param {Object} data
 * @param  {Connection~requestCallback} callback
 * @private
 */
ConnectionEvents.prototype._updateWithIdAndData = function (eventId, data, callback) {
  this.connection.request({
    method: 'PUT',
    path: '/events/' + eventId,
    jsonData: data,
    callback: function (error, result) {
      if (!error && result && result.event) {
        if (!this.connection.datastore) {
          result = new Event(this.connection, result.event);
        } else {
          result = this.connection.datastore.createOrReuseEvent(result.event);
        }
      } else {
        result = null;
      }
      callback(error, result);
    }.bind(this)
  });
};


/**
 * @private
 * @param {Event} event
 * @param {Object} the data to map
 */
ConnectionEvents.prototype._registerNewEvent = function (event, data) {


  if (! event.connection.datastore) { // no datastore   break
    _.extend(event, data);
    return event;
  }

  return event.connection.datastore.createOrReuseEvent(this, data);
};

module.exports = ConnectionEvents;

/**
 * Called with the desired Events as result.
 * @callback ConnectionEvents~getCallback
 * @param {Object} error - eventual error
 * @param {Event[]} result
 */


/**
 * Called each time a "part" of the result is received
 * @callback ConnectionEvents~partialResultCallback
 * @param {Event[]} result
 */


/**
 * Called when an event is created on the API
 * @callback ConnectionEvents~eventCreatedOnTheAPI
 * @param {Object} error - eventual error
 * @param {Event} event
 */

/**
 * Called when an event is created on the API
 * @callback ConnectionEvents~eventStoppedOnTheAPI
 * @param {Object} error - eventual error
 * @param {String} stoppedEventId or null if event not found
 */

/**
 * Called when batch create an array of events on the API
 * @callback ConnectionEvents~eventBatchCreatedOnTheAPI
 * @param {Object} error - eventual error
 * @param {Event[]} events
 */

},{"../Event":15,"../Filter":16,"../utility/utility.js":41,"./ConnectionConstants.js":25,"underscore":12}],27:[function(require,module,exports){
var _ = require('underscore'),
    utility = require('../utility/utility'),
    Monitor = require('../Monitor');

/**
 * @class ConnectionMonitors
 * @private
 *
 * @param {Connection} connection
 * @constructor
 */
function ConnectionMonitors(connection) {
  this.connection = connection;
  this._monitors = {};
  this.ioSocket = null;
}

/**
 * Start monitoring this Connection. Any change that occurs on the connection (add, delete, change)
 * will trigger an event. Changes to the filter will also trigger events if they have an impact on
 * the monitored data.
 * @param {Filter} filter - changes to this filter will be monitored.
 * @returns {Monitor}
 */
ConnectionMonitors.prototype.create = function (filter) {
  if (!this.connection.username) {
    console.error('Cannot create a monitor for a connection without username:', this.connection);
    return null;
  }
  return new Monitor(this.connection, filter);
};



/**
 * TODO
 * @private
 */
ConnectionMonitors.prototype._stopMonitoring = function (/*callback*/) {

};

/**
 * Internal for Connection.Monitor
 * Maybe moved in Monitor by the way
 * @param callback
 * @private
 * @return {Object} XHR or Node http request
 */
ConnectionMonitors.prototype._startMonitoring = function (callback) {
  if (!this.connection.username) {
    console.error('Cannot start monitoring for a connection without username:', this.connection);
    return callback(true);
  }
  if (this.ioSocket) { return callback(null/*, ioSocket*/); }

  var settings = {
    host : this.connection.username + '.' + this.connection.settings.domain,
    port : this.connection.settings.port,
    ssl : this.connection.settings.ssl,
    path : this.connection.settings.extraPath + '/' + this.connection.username,
    namespace : '/' + this.connection.username,
    auth : this.connection.auth
  };

  this.ioSocket = utility.ioConnect(settings);

  this.ioSocket.on('connect', function () {
    _.each(this._monitors, function (monitor) { monitor._onIoConnect(); });
  }.bind(this));
  this.ioSocket.on('error', function (error) {
    _.each(this._monitors, function (monitor) { monitor._onIoError(error); });
  }.bind(this));
  this.ioSocket.on('eventsChanged', function () {
    _.each(this._monitors, function (monitor) { monitor._onIoEventsChanged(); });
  }.bind(this));
  this.ioSocket.on('streamsChanged', function () {
    _.each(this._monitors, function (monitor) { monitor._onIoStreamsChanged(); });
  }.bind(this));
  callback(null);
};

module.exports = ConnectionMonitors;



},{"../Monitor":17,"../utility/utility":41,"underscore":12}],28:[function(require,module,exports){
var apiPathPrivateProfile = '/profile/private';
var apiPathPublicProfile = '/profile/app';
var CC = require('./ConnectionConstants.js');

/**
 * @class Profile
 * @link http://api.pryv.com/reference.html#methods-app-profile
 */

/**
 * Accessible by connection.profile.xxx`
 * @param {Connection} connection
 * @constructor
 */
function Profile(connection) {
  this.connection = connection;
  this.timeLimits = null;
}




/**
 * @param {String | null} key
 * @param {Connection~requestCallback} callback - handles the response
 */
Profile.prototype.getPrivate = function (key, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  this._get(apiPathPrivateProfile, key, callback);
};
/**
 * @param {String | null} key
 * @param {Connection~requestCallback} callback - handles the response
 */
Profile.prototype.getPublic = function (key, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  this._get(apiPathPublicProfile, key, callback);
};


/**
 * @example
 * // set x=25 and delete y
 * conn.profile.setPrivate({x : 25, y : null}, function(error) { console.log('done'); });
 *
 * @param {Object} keyValuePairs
 * @param {Connection~requestCallback} callback - handles the response
 */
Profile.prototype.setPrivate = function (keyValuePairs, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  this._set(apiPathPrivateProfile, keyValuePairs, callback);
};
/**
 * @example
 * // set x=25 and delete y
 * conn.profile.setPublic({x : 25, y : null}, function(error) { console.log('done'); });
 *
 * @param {Object} keyValuePairs
 * @param {Connection~requestCallback} callback - handles the response
 */
Profile.prototype.setPublic = function (keyValuePairs, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  this._set(apiPathPublicProfile, keyValuePairs, callback);
};

/**
 * TODO write documentation
 */
Profile.prototype.getTimeLimits = function (force, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  if (!force && this.timeLimits) {
      callback(this.timeLimits);
  } else {
    var i = 2;
    this.timeLimits = {
      timeFrameST : [],
      timeFrameLT : []
    };
    this.connection.events.get({
      toTime: 9900000000,
      fromTime: 0,
      limit: 1,
      sortAscending: false,
      state: 'all'
    }, function (error, events) {
      if (!error && events) {
        this.timeLimits.timeFrameST[1] = events[0].time;
        this.timeLimits.timeFrameLT[1] = events[0].timeLT;
      }
      i--;
      if (i === 0) {
          callback(this.timeLimits);
      }
    }.bind(this));
    this.connection.events.get({
      toTime: 9900000000, // TODO add a constant UNDEFINED_TO_TIME in constant
      fromTime: -9900000000, // TODO add a constant UNDEFINED_FROM_TIME in constant
      limit: 1,
      sortAscending: true,
      state: 'all'
    }, function (error, events) {
      if (!error && events) {
        this.timeLimits.timeFrameST[0] = events[0].time;
        this.timeLimits.timeFrameLT[0] = events[0].timeLT;
      }
      i--;
      if (i === 0) {
          callback(this.timeLimits);
      }
    }.bind(this));
  }
};


// --------- private stuff to be hidden

/**
 * @private
 * @param {String | null} key
 * @param {Connection~requestCallback} callback - handles the response
 */
Profile.prototype._get = function (path, key, callback) {
  this.connection.request({
    method: 'GET',
    path: path,
    callback: function(error, result) {
      if (error) {
        return callback(error);
      }
      result = result.profile || null;
      if (key !== null && result) {
        result = result[key];
      }
      callback(null, result);
    }
  });
};

/**
 * @private
 * @example
 * // set x=25 and delete y
 * conn.profile.set({x : 25, y : null}, function(error) { console.log('done'); });
 *
 * @param {Object} keyValuePairs
 * @param {Connection~requestCallback} callback - handles the response
 */
Profile.prototype._set = function (path, keyValuePairs, callback) {
  this.connection.request({
    method: 'PUT',
    path: path,
    callback: callback,
    jsonData: keyValuePairs
  });
};

module.exports = Profile;
},{"./ConnectionConstants.js":25}],29:[function(require,module,exports){
var _ = require('underscore'),
  utility = require('../utility/utility.js'),
  Stream = require('../Stream.js'),
  CC = require('./ConnectionConstants.js');

/**
 * @class ConnectionStreams
 * @description
 * ##Coverage of the API
 *
 *  * GET /streams -- 100%
 *  * POST /streams -- only data (no object)
 *  * PUT /streams -- 0%
 *  * DELETE /streams/{stream-id} -- 0%
 *
 *
 *
 * @param {Connection} connection
 * @constructor
 */
function ConnectionStreams(connection) {
  this.connection = connection;
  this._streamsIndex = {};
}


/**
 * @typedef ConnectionStreamsOptions parameters than can be passed along a Stream request
 * @property {string} parentId  if parentId is null you will get all the "root" streams.
 * @property {string} [state] 'all' || null  - if null you get only "active" streams
 **/


/**
 * @param {ConnectionStreamsOptions} options
 * @param {ConnectionStreams~getCallback} callback - handles the response
 */
ConnectionStreams.prototype.get = function (options, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  if (this.connection.datastore) {
    var resultTree = [];
    if (options && _.has(options, 'parentId')) {
      resultTree = this.connection.datastore.getStreamById(options.parentId).children;
    } else {
      resultTree = this.connection.datastore.getStreams();
    }
    if (resultTree.length > 0) {
      callback(null, resultTree);
    } else {
      this._getObjects(options, callback);
    }
  } else {
    this._getObjects(options, callback);
  }
};

/**
 * TODO make it object-aware like for Events
 * TODO why to we need a _create ?
 * TODO could return Stream object synchronously before calling the API
 * @param streamData
 * @param callback
 */
ConnectionStreams.prototype.create = function (streamData, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  streamData = _.pick(streamData, 'id', 'name', 'parentId', 'singleActivity',
    'clientData', 'trashed');
  return this._createWithData(streamData, callback);
};


ConnectionStreams.prototype.update = function (streamData, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }

  if (typeof streamData === 'object') {
    streamData = [ streamData ];
  }

  _.each(streamData, function (e) {
    var s = _.pick(e, 'id', 'name', 'parentId', 'singleActivity',
      'clientData', 'trashed');
    this.connection.request({
      method: 'PUT',
      path: '/streams/' + s.id,
      callback: function (error, result) {
        if (!error && result && result.stream) {

          this._getObjects(null, function (err, res) {
            if (!err && res) {
              if (!this.connection.datastore) {
                result = new Stream(this.connection, result.stream);
              } else {
                result = this.connection.datastore.createOrReuseStream(result.stream);
                if (result.parent &&
                  _.indexOf(result.parent.childrenIds, result.id) === -1) {
                  result.parent.childrenIds.push(result.id);
                }
              }
            } else {
              result = null;
            }

            callback(err, result);
          }.bind(this));

        } else {
          result = null;
        }
        if (error) {
          callback(error, null);
        }
      }.bind(this),
      jsonData: s
    });
  }.bind(this));
};


/**
 * @param streamData
 * @param callback
 * @param mergeEventsWithParent
 */
ConnectionStreams.prototype.delete = ConnectionStreams.prototype.trash =
    function (streamData, callback, mergeEventsWithParent) {
      if (typeof(callback) !== 'function') {
        throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
      }
      var id;
      if (streamData && streamData.id) {
        id = streamData.id;
      } else {
        id = streamData;
      }

      mergeEventsWithParent = mergeEventsWithParent ? true : false;
      this.connection.request({
        method: 'DELETE',
        path: '/streams/' + id + '?mergeEventsWithParent=' + mergeEventsWithParent,
        callback: function (error, resultData) {
          var stream = null;
          if (!error && resultData && resultData.stream) {
            streamData.id = resultData.stream.id;
            stream = new Stream(this.connection, resultData.stream);
            if (this.connection.datastore) {
              this.connection.datastore.indexStream(stream);
            }
          }
          return callback(error, error ? null : resultData.stream);
        }.bind(this)
      });
};


/**
 * TODO remove it's unused
 * @param {ConnectionStreamsOptions} options
 * @param {ConnectionStreams~getCallback} callback - handles the response
 */
ConnectionStreams.prototype.updateProperties = function (stream, properties, options, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  if (this.connection.datastore) {
    var resultTree = [];
    if (options && _.has(options, 'parentId')) {
      resultTree = this.connection.datastore.getStreamById(options.parentId).children;
    } else {
      resultTree = this.connection.datastore.getStreams();
    }
    callback(null, resultTree);
  } else {
    this._getObjects(options, callback);
  }
};


/**
 * TODO remove it's unused and could lead to miscomprehension
 * Get a Stream by it's Id.
 * Works only if fetchStructure has been done once.
 * @param {string} streamId
 * @throws {Error} Connection.fetchStructure must have been called before.
 */
ConnectionStreams.prototype.getById = function (streamId) {
  if (!this.connection.datastore) {
    throw new Error('Call connection.fetchStructure before, to get automatic stream mapping');
  }
  return this.connection.datastore.getStreamById(streamId);
};


// ------------- Raw calls to the API ----------- //

/**
 * TODO rename _getStreams
 * get streams on the API
 * @private
 * @param {ConnectionStreams~options} opts
 * @param callback
 */
ConnectionStreams.prototype._getData = function (opts, callback) {
  this.connection.request({
    method: 'GET',
    path: opts ? '/streams?' + utility.getQueryParametersString(opts) : '/streams',
    callback: callback
  });
};


/**
 * TODO makes it return the Stream object before doing the online request
 * TODO create a streamLike Object
 * Create a stream on the API with a jsonObject
 * @private
 * @param {Object} streamData an object array.. typically one that can be obtained with
 * stream.getData()
 * @param callback
 */
ConnectionStreams.prototype._createWithData = function (streamData, callback) {
  this.connection.request({
    method: 'POST',
    path: '/streams',
    jsonData: streamData,
    callback: function (err, resultData) {
      var stream = null;
      if (!err && resultData) {
        streamData.id = resultData.stream.id;
        stream = new Stream(this.connection, resultData.stream);
        if (this.connection.datastore) {
          this.connection.datastore.indexStream(stream);
        }
      }
      if (_.isFunction(callback)) {
        return callback(err, err ? null : stream);
      }
    }.bind(this)
  });
};

/**
 * Update a stream on the API with a jsonObject
 * @private
 * @param {Object} streamData an object array.. typically one that can be obtained with
 * stream.getData()
 * @param callback
 */
ConnectionStreams.prototype._updateWithData = function (streamData, callback) {
  this.connection.request({
    method: 'PUT',
    path: '/streams/' + streamData.id,
    jsonData: streamData,
    callback: callback
  });
};

// -- helper for get --- //

/**
 * @private
 * @param {ConnectionStreams~options} options
 */
ConnectionStreams.prototype._getObjects = function (options, callback) {
  options = options || {};
  options.parentId = options.parentId || null;
  var streamsIndex = {};
  var resultTree = [];
  this._getData(options, function (error, result) {
    if (error) {
      return callback('Stream.get failed: ' + JSON.stringify(error));
    }
    var treeData = result.streams || result.stream;
    ConnectionStreams.Utils.walkDataTree(treeData, function (streamData) {
      var stream = new Stream(this.connection, streamData);
      streamsIndex[streamData.id] = stream;
      if (stream.parentId === options.parentId) { // attached to the rootNode or filter
        resultTree.push(stream);
        stream._parent = null;
        stream._children = [];
      } else {
        // localStorage will cleanup  parent / children link if needed
        stream._parent = streamsIndex[stream.parentId];
        stream._parent._children.push(stream);
      }
    }.bind(this));
    callback(null, resultTree);
  }.bind(this));
};


/**
 * Called once per streams
 * @callback ConnectionStreams~walkTreeEachStreams
 * @param {Stream} stream
 */

/**
 * Called when walk is done
 * @callback ConnectionStreams~walkTreeDone
 */

/**
 * Walk the tree structure.. parents are always announced before childrens
 * @param {ConnectionStreams~options} options
 * @param {ConnectionStreams~walkTreeEachStreams} eachStream
 * @param {ConnectionStreams~walkTreeDone} done
 */
ConnectionStreams.prototype.walkTree = function (options, eachStream, done) {
  this.get(options, function (error, result) {
    if (error) {
      return done('Stream.walkTree failed: ' + error);
    }
    ConnectionStreams.Utils.walkObjectTree(result, eachStream);
    if (done) {
      done(null);
    }
  });
};


/**
 * Get the all the streams of the Tree in a list.. parents firsts
 * @param {ConnectionStreams~options} options
 * @param {ConnectionStreams~getFlatenedObjectsDone} done
 */
ConnectionStreams.prototype.getFlatenedObjects = function (options, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  var result = [];
  this.walkTree(options,
    function (stream) { // each stream
      result.push(stream);
    }, function (error) {  // done
      if (error) {
        return callback(error);
      }
      callback(null, result);
    }.bind(this));
};


/**
 * Utility to debug a tree structure
 * @param {ConnectionStreams[]} arrayOfStreams
 */
ConnectionStreams.prototype.getDisplayTree = function (arrayOfStreams) {
  return ConnectionStreams.Utils._debugTree(arrayOfStreams);
};

/**
 * Utility to get a Stream Tree as if was sent by the API
 * @param {ConnectionStreams[]} arrayOfStreams
 */
ConnectionStreams.prototype.toJSON = function (arrayOfStreams) {
  return ConnectionStreams.Utils.toJSON(arrayOfStreams);
};


// TODO Validate that it's the good place for them .. Could have been in Stream or utility
ConnectionStreams.Utils = {

  /**
   * Make a pure JSON object from an array of Stream.. shoudl be the same than what we
   * get from the API
   * @param streamArray
   * @param eachStream
   */
  toJSON: function (arrayOfStreams) {

    var result = [];
    if (!arrayOfStreams || !(arrayOfStreams instanceof Array)) {
      throw new Error('expected an array for argument :' + arrayOfStreams);
    }

    _.each(arrayOfStreams, function (stream) {
      if (!stream || !(stream instanceof Stream)) {
        throw new Error('expected a Streams array ' + stream);
      }
      result.push({
        name: stream.name,
        id: stream.id,
        parentId: stream.parentId,
        singleActivity: stream.singleActivity,
        clientData: stream.clientData,
        trashed: stream.trashed,
        created: stream.created,
        createdBy: stream.createdBy,
        modified: stream.modified,
        modifiedBy: stream.modifiedBy,
        children: ConnectionStreams.Utils.toJSON(stream.children)
      });
    });
    return result;
  },

  /**
   * Walk thru a streamArray of objects
   * @param streamTree
   * @param callback function(stream)
   */
  walkObjectTree: function (streamArray, eachStream) {
    _.each(streamArray, function (stream) {
      eachStream(stream);
      ConnectionStreams.Utils.walkObjectTree(stream.children, eachStream);
    });
  },

  /**
   * Walk thru a streamTree obtained from the API. Replaces the children[] by childrenIds[].
   * This is used to Flaten the Tree
   * @param streamTree
   * @param callback function(streamData, subTree)  subTree is the descendance tree
   */
  walkDataTree: function (streamTree, callback) {
    if (typeof(callback) !== 'function') {
      throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
    }
    _.each(streamTree, function (streamStruct) {
      var stream = _.omit(streamStruct, 'children');
      stream.childrenIds = [];
      var subTree = {};
      callback(stream, subTree);
      if (_.has(streamStruct, 'children')) {
        subTree = streamStruct.children;

        _.each(streamStruct.children, function (childTree) {
          stream.childrenIds.push(childTree.id);
        });
        this.walkDataTree(streamStruct.children, callback);
      }
    }.bind(this));
  },


  /**
   * ShowTree
   */
  _debugTree: function (arrayOfStreams) {
    var result = [];
    if (!arrayOfStreams || !(arrayOfStreams instanceof Array)) {
      throw new Error('expected an array for argument :' + arrayOfStreams);
    }
    _.each(arrayOfStreams, function (stream) {
      if (!stream || !(stream instanceof Stream)) {
        throw new Error('expected a Streams array ' + stream);
      }
      result.push({
        name: stream.name,
        id: stream.id,
        parentId: stream.parentId,
        children: ConnectionStreams.Utils._debugTree(stream.children)
      });
    });
    return result;
  }

};

module.exports = ConnectionStreams;

/**
 * Called with the desired streams as result.
 * @callback ConnectionStreams~getCallback
 * @param {Object} error - eventual error
 * @param {Stream[]} result
 */


},{"../Stream.js":18,"../utility/utility.js":41,"./ConnectionConstants.js":25,"underscore":12}],30:[function(require,module,exports){
module.exports={
  "version": "0.2.9",
  "sets": {
    "basic-measurements-metric": {
      "name": {
        "en": "Metric measures (basics)",
        "fr": "Mesures métriques de base"
      },
      "description": {
        "en": "Kg, m, Km, ... "
      },
      "types": {
        "count": [
          "generic"
        ],
        "length": [
          "cm",
          "km",
          "m",
          "mm"
        ],
        "mass": [
          "kg",
          "g",
          "t"
        ],
        "temperature": [
          "c"
        ],
        "ratio": [
          "percent"
        ],
        "speed": [
          "km-h",
          "m-s"
        ],
        "volume": [
          "l",
          "m3",
          "ml"
        ]
      }
    },
    "generic-measurements-metric": {
      "name": {
        "en": "Metric measures",
        "fr": "Mesures métriques"
      },
      "description": {
        "en": "Kg, m, Km, ... "
      },
      "types": {
        "area": [
          "ha",
          "km2",
          "m2"
        ],
        "electric-current": [
          "a"
        ],
        "electromotive-force": [
          "v"
        ],
        "energy": [
          "cal",
          "j",
          "kcal"
        ],
        "frequency": [
          "hz",
          "bpm",
          "rpm"
        ],
        "length": [
          "cm",
          "km",
          "m",
          "mm"
        ],
        "mass": [
          "kg",
          "g",
          "t"
        ],
        "power": [
          "hp",
          "kw",
          "w"
        ],
        "pressure": [
          "bar",
          "kg-m2",
          "pa",
          "kpa"
        ],
        "temperature": [
          "c"
        ],
        "speed": [
          "km-h",
          "m-s"
        ],
        "volume": [
          "l",
          "m3",
          "ml"
        ]
      }
    },
    "basic-measurements-imperial": {
      "name": {
        "en": "Imperial measures (basics)",
        "fr": "Mesures, système impérial (de base)"
      },
      "description": {
        "en": "lb, in, ft, ..."
      },
      "types": {
        "count": [
          "generic"
        ],
        "length": [
          "ch",
          "lea",
          "ft",
          "in",
          "mi",
          "fur",
          "yd"
        ],
        "mass": [
          "lb",
          "oz",
          "s-t",
          "st"
        ],
        "temperature": [
          "f"
        ],
        "ratio": [
          "percent"
        ],
        "speed": [
          "ft-s",
          "m-min",
          "mph"
        ],
        "volume": [
          "c",
          "floz",
          "galgb",
          "pt",
          "qt",
          "tbs",
          "tsp"
        ]
      }
    },
    "generic-measurements-imperial": {
      "name": {
        "en": "Imperial measures",
        "fr": "Mesures, système impérial"
      },
      "description": {
        "en": "lb, in, ft, ..."
      },
      "types": {
        "area": [
          "ac",
          "ft2",
          "in2",
          "yd2",
          "mi2"
        ],
        "electric-current": [
          "a"
        ],
        "electromotive-force": [
          "v"
        ],
        "energy": [
          "btu",
          "erg",
          "ftlb",
          "kcal"
        ],
        "force": [
          "pdl"
        ],
        "length": [
          "ch",
          "lea",
          "ft",
          "in",
          "mi",
          "fur",
          "yd"
        ],
        "mass": [
          "lb",
          "oz",
          "s-t",
          "st"
        ],
        "power": [
          "hp"
        ],
        "pressure": [
          "inhg",
          "psi"
        ],
        "temperature": [
          "f"
        ],
        "speed": [
          "ft-s",
          "m-min",
          "mph"
        ],
        "volume": [
          "c",
          "floz",
          "galgb",
          "pt",
          "qt",
          "tbs",
          "tsp"
        ]
      }
    },
    "basic-measurements-us": {
      "name": {
        "en": "US measures (basics)",
        "fr": "Mesures USA (de base)"
      },
      "description": {
        "en": "yd, mil, oz, ..."
      },
      "types": {
        "count": [
          "generic"
        ],
        "length": [
          "ch",
          "ft",
          "in",
          "mil",
          "mi",
          "fur",
          "p",
          "pica",
          "yd"
        ],
        "mass": [
          "gr",
          "dr",
          "l-t",
          "lb",
          "oz"
        ],
        "temperature": [
          "f"
        ],
        "ratio": [
          "percent"
        ],
        "speed": [
          "ft-s",
          "m-min",
          "mph"
        ],
        "volume": [
          "c",
          "floz",
          "ft3",
          "galus",
          "in3",
          "yd3",
          "pt",
          "qt",
          "bbloil",
          "tbs",
          "tsp"
        ]
      }
    },
    "generic-measurements-us": {
      "name": {
        "en": "US measures",
        "fr": "Mesures USA"
      },
      "description": {
        "en": "yd, mil, oz, ..."
      },
      "types": {
        "area": [
          "ac",
          "ft2",
          "in2",
          "yd2"
        ],
        "electric-current": [
          "a"
        ],
        "electromotive-force": [
          "v"
        ],
        "length": [
          "ch",
          "ft",
          "in",
          "mil",
          "mi",
          "fur",
          "p",
          "pica",
          "yd"
        ],
        "mass": [
          "gr",
          "dr",
          "l-t",
          "lb",
          "oz"
        ],
        "power": [
          "hp"
        ],
        "pressure": [
          "inhg",
          "psi"
        ],
        "temperature": [
          "f"
        ],
        "speed": [
          "ft-s",
          "m-min",
          "mph"
        ],
        "volume": [
          "c",
          "floz",
          "ft3",
          "galus",
          "in3",
          "yd3",
          "pt",
          "qt",
          "bbloil",
          "tbs",
          "tsp"
        ]
      }
    },
    "money-most-used": {
      "name": {
        "en": "Most used currencies",
        "fr": "Devises les plus utilisées"
      },
      "description": {
        "en": "$, €, ¥, ..."
      },
      "types": {
        "money": [
          "eur",
          "usd",
          "cny",
          "gbp",
          "jpy",
          "chf",
          "cad"
        ]
      }
    },
    "money-europe": {
      "name": {
        "en": "Currencies Europe",
        "fr": "Devises Europe"
      },
      "description": {
        "en": "€, £, CHF, ..."
      },
      "types": {
        "money": [
          "all",
          "byr",
          "bam",
          "bgn",
          "hrk",
          "czk",
          "dkk",
          "eek",
          "eur",
          "fkp",
          "gip",
          "ggp",
          "huf",
          "isk",
          "irr",
          "jep",
          "lvl",
          "ltl",
          "mkd",
          "ang",
          "nok",
          "pln",
          "ron",
          "rub",
          "shp",
          "rsd",
          "sek",
          "chf",
          "try",
          "trl",
          "uah",
          "gbp"
        ]
      }
    },
    "money-america": {
      "name": {
        "en": "Currencies Americas",
        "fr": "Devises Amériques"
      },
      "description": {
        "en": "$US, $CAD,  BRL, ..."
      },
      "types": {
        "money": [
          "ars",
          "bsd",
          "bbd",
          "bzd",
          "bmd",
          "bob",
          "brl",
          "cad",
          "kyd",
          "clp",
          "cop",
          "crc",
          "cup",
          "dop",
          "xcd",
          "svc",
          "fjd",
          "gtq",
          "gyd",
          "jmd",
          "mxn",
          "nio",
          "pab",
          "pyg",
          "pen",
          "shp",
          "srd",
          "ttd",
          "usd",
          "uyu",
          "vef"
        ]
      }
    },
    "money-asia": {
      "name": {
        "en": "Currencies Asia",
        "fr": "Devises Asie"
      },
      "description": {
        "en": "¥, 元, INR, ..."
      },
      "types": {
        "money": [
          "azn",
          "khr",
          "cny",
          "hnl",
          "inr",
          "idr",
          "jpy",
          "kzt",
          "kpw",
          "krw",
          "kgs",
          "lak",
          "myr",
          "mur",
          "mnt",
          "npr",
          "pkr",
          "rub",
          "scr",
          "sgd",
          "lkr",
          "syp",
          "twd",
          "thb",
          "try",
          "trl",
          "uzs",
          "vnd"
        ]
      }
    },
    "money-africa": {
      "name": {
        "en": "Currencies Africa",
        "fr": "Devises Afrique"
      },
      "description": {
        "en": "BWP, EGP, GHC, ..."
      },
      "types": {
        "money": [
          "bwp",
          "egp",
          "ghc",
          "mzn",
          "nad",
          "ngn",
          "sos",
          "zar",
          "zwd"
        ]
      }
    },
    "money-indonesia-australia": {
      "name": {
        "en": "Currencies Oceania & Indonesia",
        "fr": "Devises Océanie & Indonésie"
      },
      "description": {
        "en": "$AU, $NZ, PHP, ... "
      },
      "types": {
        "money": [
          "aud",
          "nzd",
          "php",
          "sbd",
          "tvd"
        ]
      }
    },
    "money-middleeast": {
      "name": {
        "en": "Currencies Middle East",
        "fr": "Devises Moyen-Orient"
      },
      "description": {
        "en": "AFN, BND, OMR, ...."
      },
      "types": {
        "money": [
          "afn",
          "bnd",
          "egp",
          "imp",
          "lbp",
          "omr",
          "qar",
          "sar",
          "syp",
          "yer"
        ]
      }
    },
    "generic-medical": {
      "name": {
        "en": "Common health mesures",
        "fr": "Mesures de santé courantes"
      },
      "description": {
        "en": "mmhg, bpm, ..."
      },
      "types": {
        "count": [
          "steps"
        ],
        "density": [
          "mg-dl",
          "mmol-l"
        ],
        "pressure": [
          "mmhg"
        ],
        "frequency": [
          "bpm"
        ]
      }
    },
    "navigation": {
      "name": {
        "en": "Navigation",
        "fr": "Navigation"
      },
      "description": {
        "en": "nmi, °, kt, ..."
      },
      "types": {
        "angle": [
          "deg",
          "grad",
          "rad"
        ],
        "length": [
          "nmi",
          "ftm",
          "cb"
        ],
        "speed": [
          "kt"
        ]
      }
    },
    "all-measures": {
      "name": {
        "en": "All measures",
        "fr": "Toutes les mesures"
      },
      "types": {
        "absorbed-dose": [
          "gy"
        ],
        "absorbed-dose-equivalent": [
          "sv"
        ],
        "absorbed-dose-rate": [
          "gy-s"
        ],
        "mol": [
          "mol"
        ],
        "angle": [
          "deg",
          "grad",
          "rad"
        ],
        "angular-acceleration": [
          "rad-s2"
        ],
        "area": [
          "ac",
          "ft2",
          "ha",
          "in2",
          "km2",
          "m2",
          "mm2",
          "yd2",
          "mi2"
        ],
        "capacitance": [
          "f"
        ],
        "catalytic-activity": [
          "kat"
        ],
        "data-quantity": [
          "b",
          "bits",
          "gb",
          "gbits",
          "kb",
          "kbits",
          "mb",
          "mbits",
          "tb"
        ],
        "density": [
          "g-dl",
          "kg-m3",
          "mg-dl",
          "mmol-l"
        ],
        "time": [
          "d",
          "h",
          "min",
          "ms",
          "s",
          "y"
        ],
        "dynamic-viscosity": [
          "pa-s"
        ],
        "electric-charge": [
          "c"
        ],
        "electric-charge-line-density": [
          "c-m"
        ],
        "electric-current": [
          "a"
        ],
        "electrical-conductivity": [
          "s"
        ],
        "electromotive-force": [
          "v"
        ],
        "energy": [
          "btu",
          "cal",
          "ev",
          "erg",
          "ftlb",
          "j",
          "kcal",
          "ws",
          "kwh",
          "nm",
          "wh"
        ],
        "force": [
          "dyn",
          "n",
          "pdl"
        ],
        "length": [
          "a",
          "au",
          "cm",
          "ch",
          "lea",
          "ft",
          "in",
          "km",
          "ly",
          "m",
          "mil",
          "mi",
          "fur",
          "mm",
          "nmi",
          "p",
          "pica",
          "ftm",
          "cb",
          "um",
          "yd"
        ],
        "luminous-intensity": [
          "cd"
        ],
        "mass": [
          "gr",
          "dr",
          "kg",
          "g",
          "l-t",
          "lb",
          "t",
          "oz",
          "s-t",
          "st"
        ],
        "power": [
          "btu-min",
          "ftlb-s",
          "hp",
          "kw",
          "w"
        ],
        "pressure": [
          "at",
          "bar",
          "cmhg",
          "inhg",
          "kg-m2",
          "pa",
          "kpa",
          "psf",
          "psi"
        ],
        "temperature": [
          "c",
          "f",
          "k"
        ],
        "speed": [
          "ft-m",
          "ft-s",
          "km-h",
          "kt",
          "m-min",
          "m-s",
          "mph"
        ],
        "volume": [
          "c",
          "cm3",
          "floz",
          "ft3",
          "galgb",
          "galus",
          "in3",
          "yd3",
          "l",
          "m3",
          "ml",
          "pt",
          "qt",
          "bbloil",
          "tbs",
          "tsp"
        ]
      }
    }
  },
  "extras": {
    "count": {
      "name": {
        "en": "Count",
        "fr": "Compte"
      },
      "formats": {
        "steps": {
          "name": {
            "en": "Steps",
            "fr": "Pas"
          }
        },
        "generic": {
          "name": {
            "en": "Units",
            "fr": "Unités"
          }
        }
      }
    },
    "money": {
      "name": {
        "en": "Money",
        "fr": "Argent"
      },
      "formats": {
        "chf": {
          "name": {
            "en": "Switzerland Franc",
            "fr": "Franc Suisse"
          },
          "symbol": "CHF"
        },
        "cny": {
          "name": {
            "en": "China Yuan Renminbi",
            "fr": "Yuan Ren-Min-Bi"
          },
          "symbol": "¥"
        },
        "eur": {
          "symbol": "€",
          "name": {
            "en": "Euro",
            "fr": "Euro"
          }
        },
        "gbp": {
          "name": {
            "en": "United Kingdom Pound",
            "fr": "Livre"
          },
          "symbol": "£"
        },
        "jpy": {
          "name": {
            "en": "Japan Yen",
            "fr": "Yen japonais"
          },
          "symbol": "¥"
        },
        "usd": {
          "name": {
            "en": "United States Dollar",
            "fr": "Dollar des États-Unis"
          },
          "symbol": "$"
        },
        "btc": {
          "name": {
            "en": "Bitcoin"
          },
          "symbol": "฿"
        },
        "all": {
          "name": {
            "en": "Albania Lek",
            "fr": "Lek Albanai"
          },
          "symbol": "Lek"
        },
        "afn": {
          "name": {
            "en": "Afghanistan Afghani",
            "fr": "Afghani"
          },
          "symbol": "؋"
        },
        "ars": {
          "name": {
            "en": "Argentina Peso",
            "fr": "Peso argentin"
          },
          "symbol": "$"
        },
        "awg": {
          "name": {
            "en": "Aruba Guilder",
            "fr": "Florin d'Aruba"
          },
          "symbol": "ƒ"
        },
        "aud": {
          "name": {
            "en": "Australia Dollar",
            "fr": "Dollar australien"
          },
          "symbol": "$"
        },
        "azn": {
          "name": {
            "en": "Azerbaijan New Manat",
            "fr": "Manat"
          },
          "symbol": "ман"
        },
        "bsd": {
          "name": {
            "en": "Bahamas Dollar",
            "fr": "Dollar des Bahamas"
          },
          "symbol": "$"
        },
        "bbd": {
          "name": {
            "en": "Barbados Dollar",
            "fr": "Dollar de Barbade"
          },
          "symbol": "$"
        },
        "byr": {
          "name": {
            "en": "Belarus Ruble",
            "fr": "Rouble bélorusse"
          },
          "symbol": "p."
        },
        "bzd": {
          "name": {
            "en": "Belize Dollar",
            "fr": "Dollar de Belize"
          },
          "symbol": "BZ$"
        },
        "bmd": {
          "name": {
            "en": "Bermuda Dollar",
            "fr": "Dollar des Bermudes"
          },
          "symbol": "$"
        },
        "bob": {
          "name": {
            "en": "Bolivia Boliviano",
            "fr": "Boliviano"
          },
          "symbol": "$b"
        },
        "bam": {
          "name": {
            "en": "Bosnia and Herzegovina Convertible Marka"
          },
          "symbol": "KM"
        },
        "bwp": {
          "name": {
            "en": "Botswana Pula"
          },
          "symbol": "P"
        },
        "bgn": {
          "name": {
            "en": "Bulgaria Lev",
            "fr": "Bulgarian Lev"
          },
          "symbol": "лв"
        },
        "brl": {
          "name": {
            "en": "Brazil Real",
            "fr": "Real"
          },
          "symbol": "R$"
        },
        "bnd": {
          "name": {
            "en": "Brunei Darussalam Dollar",
            "fr": "Dollar de Brunei"
          },
          "symbol": "$"
        },
        "khr": {
          "name": {
            "en": "Cambodia Riel",
            "fr": "Riel"
          },
          "symbol": "៛"
        },
        "cad": {
          "name": {
            "en": "Canada Dollar",
            "fr": "Dollar canadien"
          },
          "symbol": "$"
        },
        "kyd": {
          "name": {
            "en": "Cayman Islands Dollar",
            "fr": "Dollar des Iles Caïmans"
          },
          "symbol": "$"
        },
        "clp": {
          "name": {
            "en": "Chile Peso",
            "fr": "Peso chilien"
          },
          "symbol": "$"
        },
        "cop": {
          "name": {
            "en": "Colombia Peso",
            "fr": "Peso colombien"
          },
          "symbol": "$"
        },
        "crc": {
          "name": {
            "en": "Costa Rica Colon",
            "fr": "Colon de Costa Rica"
          },
          "symbol": "₡"
        },
        "hrk": {
          "name": {
            "en": "Croatia Kuna",
            "fr": "Kuna"
          },
          "symbol": "kn"
        },
        "cup": {
          "name": {
            "en": "Cuba Peso",
            "fr": "Peso cubain"
          },
          "symbol": "₱"
        },
        "czk": {
          "name": {
            "en": "Czech Republic Koruna"
          },
          "symbol": "Kč"
        },
        "dkk": {
          "name": {
            "en": "Denmark Krone",
            "fr": "Couronne danoise"
          },
          "symbol": "kr"
        },
        "dop": {
          "name": {
            "en": "Dominican Republic Peso",
            "fr": "Peso dominicain"
          },
          "symbol": "RD$"
        },
        "xcd": {
          "name": {
            "en": "East Caribbean Dollar",
            "fr": "Dollar des Caraïbes orientales"
          },
          "symbol": "$"
        },
        "egp": {
          "name": {
            "en": "Egypt Pound",
            "fr": "Livre égyptienne"
          },
          "symbol": "£"
        },
        "svc": {
          "name": {
            "en": "El Salvador Colon",
            "fr": "Colon du El Salvador"
          },
          "symbol": "$"
        },
        "eek": {
          "name": {
            "en": "Estonia Kroon",
            "fr": "Couronne estonienne"
          },
          "symbol": "kr"
        },
        "fkp": {
          "name": {
            "en": "Falkland Islands (Malvinas) Pound"
          },
          "symbol": "£"
        },
        "fjd": {
          "name": {
            "en": "Fiji Dollar"
          },
          "symbol": "$"
        },
        "ghc": {
          "name": {
            "en": "Ghana Cedis"
          },
          "symbol": "¢"
        },
        "gip": {
          "name": {
            "en": "Gibraltar Pound"
          },
          "symbol": "£"
        },
        "gtq": {
          "name": {
            "en": "Guatemala Quetzal"
          },
          "symbol": "Q"
        },
        "ggp": {
          "name": {
            "en": "Guernsey Pound"
          },
          "symbol": "£"
        },
        "gyd": {
          "name": {
            "en": "Guyana Dollar"
          },
          "symbol": "$"
        },
        "hnl": {
          "name": {
            "en": "Honduras Lempira"
          },
          "symbol": "L"
        },
        "hkd": {
          "name": {
            "en": "Hong Kong Dollar"
          },
          "symbol": "$"
        },
        "huf": {
          "name": {
            "en": "Hungary Forint"
          },
          "symbol": "Ft"
        },
        "isk": {
          "name": {
            "en": "Iceland Krona"
          },
          "symbol": "kr"
        },
        "inr": {
          "name": {
            "en": "India Rupee",
            "fr": "Rhoupie indienne"
          }
        },
        "idr": {
          "name": {
            "en": "Indonesia Rupiah"
          },
          "symbol": "Rp"
        },
        "irr": {
          "name": {
            "en": "Iran Rial"
          },
          "symbol": "﷼"
        },
        "imp": {
          "name": {
            "en": "Isle of Man Pound"
          },
          "symbol": "£"
        },
        "ils": {
          "name": {
            "en": "Israel Shekel"
          },
          "symbol": "₪"
        },
        "jmd": {
          "name": {
            "en": "Jamaica Dollar"
          },
          "symbol": "J$"
        },
        "jep": {
          "name": {
            "en": "Jersey Pound"
          },
          "symbol": "£"
        },
        "kzt": {
          "name": {
            "en": "Kazakhstan Tenge"
          },
          "symbol": "лв"
        },
        "kpw": {
          "name": {
            "en": "Korea (North) Won",
            "fr": "Won de la Corée du Nord"
          },
          "symbol": "₩"
        },
        "krw": {
          "name": {
            "en": "Korea (South) Won",
            "fr": "Won"
          },
          "symbol": "₩"
        },
        "kgs": {
          "name": {
            "en": "Kyrgyzstan Som"
          },
          "symbol": "лв"
        },
        "lak": {
          "name": {
            "en": "Laos Kip"
          },
          "symbol": "₭"
        },
        "lvl": {
          "name": {
            "en": "Latvia Lat",
            "fr": "Lat letton"
          },
          "symbol": "Ls"
        },
        "lbp": {
          "name": {
            "en": "Lebanon Pound"
          },
          "symbol": "£"
        },
        "lrd": {
          "name": {
            "en": "Liberia Dollar"
          },
          "symbol": "$"
        },
        "ltl": {
          "name": {
            "en": "Lithuania Litas"
          },
          "symbol": "Lt"
        },
        "mkd": {
          "name": {
            "en": "Macedonia Denar"
          },
          "symbol": "ден"
        },
        "myr": {
          "name": {
            "en": "Malaysia Ringgit"
          },
          "symbol": "RM"
        },
        "mur": {
          "name": {
            "en": "Mauritius Rupee"
          },
          "symbol": "₨"
        },
        "mxn": {
          "name": {
            "en": "Mexico Peso"
          },
          "symbol": "$"
        },
        "mnt": {
          "name": {
            "en": "Mongolia Tughrik"
          },
          "symbol": "₮"
        },
        "mzn": {
          "name": {
            "en": "Mozambique Metical"
          },
          "symbol": "MT"
        },
        "nad": {
          "name": {
            "en": "Namibia Dollar"
          },
          "symbol": "$"
        },
        "npr": {
          "name": {
            "en": "Nepal Rupee"
          },
          "symbol": "₨"
        },
        "ang": {
          "name": {
            "en": "Netherlands Antilles Guilder",
            "fr": "Florin des Antilles"
          },
          "symbol": "ƒ"
        },
        "nzd": {
          "name": {
            "en": "New Zealand Dollar",
            "fr": "Dollar néo-zélandais"
          },
          "symbol": "$"
        },
        "nio": {
          "name": {
            "en": "Nicaragua Cordoba"
          },
          "symbol": "C$"
        },
        "ngn": {
          "name": {
            "en": "Nigeria Naira"
          },
          "symbol": "₦"
        },
        "nok": {
          "name": {
            "en": "Norway Krone",
            "fr": "Couronne norvégienne"
          },
          "symbol": "kr"
        },
        "omr": {
          "name": {
            "en": "Oman Rial"
          },
          "symbol": "﷼"
        },
        "pkr": {
          "name": {
            "en": "Pakistan Rupee"
          },
          "symbol": "₨"
        },
        "pab": {
          "name": {
            "en": "Panama Balboa"
          },
          "symbol": "B/."
        },
        "pyg": {
          "name": {
            "en": "Paraguay Guarani"
          },
          "symbol": "Gs"
        },
        "pen": {
          "name": {
            "en": "Peru Nuevo Sol"
          },
          "symbol": "S/."
        },
        "php": {
          "name": {
            "en": "Philippines Peso"
          },
          "symbol": "₱"
        },
        "pln": {
          "name": {
            "en": "Poland Zloty"
          },
          "symbol": "zł"
        },
        "qar": {
          "name": {
            "en": "Qatar Riyal"
          },
          "symbol": "﷼"
        },
        "ron": {
          "name": {
            "en": "Romania New Leu"
          },
          "symbol": "lei"
        },
        "rub": {
          "name": {
            "en": "Russia Ruble"
          },
          "symbol": "руб"
        },
        "shp": {
          "name": {
            "en": "Saint Helena Pound"
          },
          "symbol": "£"
        },
        "sar": {
          "name": {
            "en": "Saudi Arabia Riyal",
            "fr": "Riyal saoudien"
          },
          "symbol": "﷼"
        },
        "rsd": {
          "name": {
            "en": "Serbia Dinar"
          },
          "symbol": "Дин."
        },
        "scr": {
          "name": {
            "en": "Seychelles Rupee"
          },
          "symbol": "₨"
        },
        "sgd": {
          "name": {
            "en": "Singapore Dollar"
          },
          "symbol": "$"
        },
        "sbd": {
          "name": {
            "en": "Solomon Islands Dollar"
          },
          "symbol": "$"
        },
        "sos": {
          "name": {
            "en": "Somalia Shilling"
          },
          "symbol": "S"
        },
        "zar": {
          "name": {
            "en": "South Africa Rand",
            "fr": "Rand"
          },
          "symbol": "R"
        },
        "lkr": {
          "name": {
            "en": "Sri Lanka Rupee"
          },
          "symbol": "₨"
        },
        "sek": {
          "name": {
            "en": "Sweden Krona"
          },
          "symbol": "kr"
        },
        "srd": {
          "name": {
            "en": "Suriname Dollar"
          },
          "symbol": "$"
        },
        "syp": {
          "name": {
            "en": "Syria Pound"
          },
          "symbol": "£"
        },
        "twd": {
          "name": {
            "en": "Taiwan New Dollar"
          },
          "symbol": "NT$"
        },
        "thb": {
          "name": {
            "en": "Thailand Baht"
          },
          "symbol": "฿"
        },
        "ttd": {
          "name": {
            "en": "Trinidad and Tobago Dollar"
          },
          "symbol": "TT$"
        },
        "try": {
          "name": {
            "en": "Turkey Lira"
          }
        },
        "trl": {
          "name": {
            "en": "Turkey Lira"
          },
          "symbol": "₤"
        },
        "tvd": {
          "name": {
            "en": "Tuvalu Dollar"
          },
          "symbol": "$"
        },
        "uah": {
          "name": {
            "en": "Ukraine Hryvna"
          },
          "symbol": "₴"
        },
        "uyu": {
          "name": {
            "en": "Uruguay Peso"
          },
          "symbol": "$U"
        },
        "uzs": {
          "name": {
            "en": "Uzbekistan Som"
          },
          "symbol": "лв"
        },
        "vef": {
          "name": {
            "en": "Venezuela Bolivar"
          },
          "symbol": "Bs"
        },
        "vnd": {
          "name": {
            "en": "Viet Nam Dong"
          },
          "symbol": "₫"
        },
        "yer": {
          "name": {
            "en": "Yemen Rial"
          },
          "symbol": "﷼"
        },
        "zwd": {
          "name": {
            "en": "Zimbabwe Dollar"
          },
          "symbol": "Z$"
        }
      }
    },
    "temperature": {
      "name": {
        "en": "Temperature",
        "fr": "Température"
      },
      "formats": {
        "c": {
          "name": {
            "en": "Degrees Celsius",
            "fr": "Degrés Celsius"
          },
          "symbol": "°C"
        },
        "f": {
          "name": {
            "en": "Degrees Fahrenheit",
            "fr": "Degrés Fahrenheit"
          },
          "symbol": "°F"
        },
        "k": {
          "name": {
            "en": "Degrees Kelvin",
            "fr": "Degrés Kelvin"
          },
          "symbol": "°K"
        }
      }
    },
    "length": {
      "name": {
        "fr": "Longueur",
        "en": "Length"
      },
      "formats": {
        "cm": {
          "name": {
            "en": "Centimeters",
            "fr": "Centimètres"
          },
          "symbol": "cm"
        },
        "km": {
          "name": {
            "en": "Kilometers",
            "fr": "Kilomètres"
          },
          "symbol": "km"
        },
        "m": {
          "name": {
            "en": "Meters",
            "fr": "Mètres"
          },
          "symbol": "m"
        },
        "mm": {
          "name": {
            "en": "Millimeters",
            "fr": "Millimètres"
          },
          "symbol": "mm"
        },
        "a": {
          "name": {
            "en": "Ångströms",
            "fr": "Ångströms"
          },
          "symbol": "Å"
        },
        "au": {
          "name": {
            "en": "Astronomical units",
            "fr": "Unités astronomiques"
          },
          "symbol": "AU"
        },
        "ch": {
          "name": {
            "en": "Chains",
            "fr": "Chaînes"
          },
          "symbol": "ch"
        },
        "lea": {
          "name": {
            "en": "Leagues",
            "fr": "Lieues"
          },
          "symbol": "lea"
        },
        "ft": {
          "name": {
            "en": "Feet",
            "fr": "Pieds"
          },
          "symbol": "ft"
        },
        "in": {
          "name": {
            "en": "Inches",
            "fr": "Pouces"
          },
          "symbol": "In"
        },
        "ly": {
          "name": {
            "en": "Light-years",
            "fr": "Années-lumière"
          },
          "symbol": "ly"
        },
        "mil": {
          "name": {
            "en": "Mils",
            "fr": "Mils"
          },
          "symbol": "mil"
        },
        "mi": {
          "name": {
            "en": "Miles",
            "fr": "Miles"
          },
          "symbol": "mi"
        },
        "fur": {
          "name": {
            "en": "Furlongs",
            "fr": "Furlongs"
          },
          "symbol": "fur"
        },
        "nmi": {
          "name": {
            "en": "Miles (nautical)",
            "fr": "Miles nautiques"
          },
          "symbol": "nmi"
        },
        "p": {
          "name": {
            "en": "Points",
            "fr": "Points"
          },
          "symbol": "p"
        },
        "pica": {
          "name": {
            "en": "Picas",
            "fr": "Picas"
          },
          "symbol": "P̸"
        },
        "ftm": {
          "name": {
            "en": "Fathoms",
            "fr": "Fathoms"
          },
          "symbol": "ftm"
        },
        "cb": {
          "name": {
            "en": "Cables",
            "fr": "Cables"
          },
          "symbol": "cb"
        },
        "um": {
          "name": {
            "en": "Microns",
            "fr": "Microns"
          },
          "symbol": "µm"
        },
        "yd": {
          "name": {
            "en": "Yards",
            "fr": "Verges"
          },
          "symbol": "yd"
        }
      }
    },
    "mass": {
      "formats": {
        "g": {
          "name": {
            "en": "Grams",
            "fr": "Grammes"
          },
          "symbol": "g"
        },
        "kg": {
          "name": {
            "en": "Kilograms",
            "fr": "Kilogrammes"
          },
          "symbol": "Kg"
        },
        "gr": {
          "name": {
            "en": "Grains",
            "fr": "Grains"
          },
          "symbol": "gr"
        },
        "dr": {
          "name": {
            "en": "Drams",
            "fr": "Drams"
          },
          "symbol": "dr"
        },
        "l-t": {
          "name": {
            "en": "Long tons",
            "fr": "Tonnes longues"
          },
          "symbol": "L/T"
        },
        "lb": {
          "name": {
            "en": "Pounds",
            "fr": "Livres"
          },
          "symbol": "lb"
        },
        "t": {
          "name": {
            "en": "Metric tons",
            "fr": "Tonnes métriques"
          },
          "symbol": "Mg"
        },
        "oz": {
          "name": {
            "en": "Ounces",
            "fr": "Onces"
          },
          "symbol": "oz"
        },
        "s-t": {
          "name": {
            "en": "Short tons",
            "fr": "Tonnes courtes"
          },
          "symbol": "S/T"
        },
        "st": {
          "name": {
            "en": "Stones",
            "fr": "Stones"
          },
          "symbol": "st"
        }
      },
      "name": {
        "en": "Mass",
        "fr": "Masse"
      }
    },
    "absorbed-dose": {
      "formats": {
        "gy": {
          "name": {
            "en": "Grays",
            "fr": "Grays"
          },
          "symbol": "Gy"
        }
      },
      "name": {
        "en": "Absorbed dose",
        "fr": "Dose absorbée"
      }
    },
    "absorbed-dose-equivalent": {
      "formats": {
        "sv": {
          "name": {
            "en": "Sieverts",
            "fr": "Sieverts"
          },
          "symbol": "Sv"
        }
      },
      "name": {
        "en": "Dose equivalent",
        "fr": "Dose équivalente"
      }
    },
    "absorbed-dose-rate": {
      "formats": {
        "gy-s": {
          "name": {
            "en": "Grays/second",
            "fr": "Grays/seconde"
          },
          "symbol": "Gy/s"
        }
      },
      "name": {
        "en": "Absorbed dose rate",
        "fr": "Débit de dose absorbée"
      }
    },
    "angle": {
      "formats": {
        "deg": {
          "name": {
            "en": "Degrees",
            "fr": "Degrés"
          },
          "symbol": "°"
        },
        "grad": {
          "name": {
            "en": "Gradians",
            "fr": "Grades"
          },
          "symbol": "grad"
        },
        "rad": {
          "name": {
            "en": "Radians",
            "fr": "Radians"
          },
          "symbol": "rad"
        }
      },
      "name": {
        "en": "Angle",
        "fr": "Angle"
      }
    },
    "angular-acceleration": {
      "formats": {
        "rad-s2": {
          "name": {
            "en": "Radians/second squared",
            "fr": "Radians/seconde carrée"
          },
          "symbol": "rad/s²"
        }
      },
      "name": {
        "en": "Angular acceleration",
        "fr": "Accélération angulaire"
      }
    },
    "area": {
      "formats": {
        "ac": {
          "name": {
            "en": "Acres (imperial)",
            "fr": "Acres (anglo-saxon)"
          },
          "symbol": "ac"
        },
        "ft2": {
          "name": {
            "en": "Square feet",
            "fr": "Pieds carrés"
          },
          "symbol": "ft²"
        },
        "ha": {
          "name": {
            "en": "Hectares",
            "fr": "Hectares"
          },
          "symbol": "ha"
        },
        "in2": {
          "name": {
            "en": "Square inches",
            "fr": "Pouces carrés"
          },
          "symbol": "in²"
        },
        "km2": {
          "name": {
            "en": "Square kilometers",
            "fr": "Kilomètres carrés"
          },
          "symbol": "km²"
        },
        "m2": {
          "name": {
            "en": "Square meters",
            "fr": "Mètres carrés"
          },
          "symbol": "m²"
        },
        "mm2": {
          "name": {
            "en": "Square millimeters",
            "fr": "Millimètres carrés"
          },
          "symbol": "mm²"
        },
        "yd2": {
          "name": {
            "en": "Square yards",
            "fr": "Verges carrées"
          },
          "symbol": "yd²"
        },
        "mi2": {
          "name": {
            "en": "Square miles",
            "fr": "Milles carrés"
          },
          "symbol": "mi²"
        }
      },
      "name": {
        "en": "Area",
        "fr": "Aire"
      }
    },
    "capacitance": {
      "formats": {
        "f": {
          "name": {
            "en": "Farads",
            "fr": "Farads"
          },
          "symbol": "F"
        }
      },
      "name": {
        "en": "Capacitance",
        "fr": "Capacitance"
      }
    },
    "catalytic-activity": {
      "formats": {
        "kat": {
          "name": {
            "en": "Katals",
            "fr": "Katals"
          },
          "symbol": "kat"
        }
      },
      "name": {
        "en": "Catalytic activity",
        "fr": "Activité catalytique"
      }
    },
    "data-quantity": {
      "formats": {
        "b": {
          "name": {
            "en": "Bytes",
            "fr": "Octets"
          },
          "symbol": "B"
        },
        "bits": {
          "name": {
            "en": "Bits",
            "fr": "Bits"
          },
          "symbol": "bit"
        },
        "gb": {
          "name": {
            "en": "Gigabytes",
            "fr": "Gigaoctets"
          },
          "symbol": "Gb"
        },
        "gbits": {
          "name": {
            "en": "Gigabits",
            "fr": "Gigabits"
          },
          "symbol": "Gbit"
        },
        "kb": {
          "name": {
            "en": "Kilobytes",
            "fr": "Kilooctets"
          },
          "symbol": "Kb"
        },
        "kbits": {
          "name": {
            "en": "Kilobits",
            "fr": "Kilobits"
          },
          "symbol": "Kbit"
        },
        "mb": {
          "name": {
            "en": "Megabytes",
            "fr": "Megaoctets"
          },
          "symbol": "Mb"
        },
        "mbits": {
          "name": {
            "en": "Megabits",
            "fr": "Megabits"
          },
          "symbol": "Mbit"
        },
        "tb": {
          "name": {
            "en": "Terabytes",
            "fr": "Teraoctets"
          },
          "symbol": "Tb"
        }
      },
      "name": {
        "en": "Data quantity",
        "fr": "Quantité de données"
      }
    },
    "density": {
      "formats": {
        "g-dl": {
          "name": {
            "en": "Grams/deciliter",
            "fr": "Grammes/décilitre"
          },
          "symbol": "g/dL"
        },
        "kg-m3": {
          "name": {
            "en": "Kilograms/cubic meter",
            "fr": "Kilogrammes/mètre cube"
          },
          "symbol": "kg/m³"
        },
        "mg-dl": {
          "name": {
            "en": "Milligrams/deciliter",
            "fr": "Milligrammes/décilitre"
          },
          "symbol": "mg/dL"
        },
        "mmol-l": {
          "name": {
            "en": "Millimoles/liter",
            "fr": "Millimoles/litre"
          },
          "symbol": "mmol/L"
        }
      },
      "name": {
        "en": "Density",
        "fr": "Densité"
      }
    },
    "dynamic-viscosity": {
      "formats": {
        "pa-s": {
          "name": {
            "en": "Pascals/second",
            "fr": "Pascals/seconde"
          },
          "symbol": "Pa/s"
        }
      },
      "name": {
        "en": "Dynamic viscosity",
        "fr": "Viscosité dynamique"
      }
    },
    "electric-charge": {
      "formats": {
        "c": {
          "name": {
            "en": "Coulombs",
            "fr": "Coulombs"
          },
          "symbol": "C"
        }
      },
      "name": {
        "en": "Electric charge",
        "fr": "Charge électrique"
      }
    },
    "electric-charge-line-density": {
      "formats": {
        "c-m": {
          "name": {
            "en": "Coulombs/meter",
            "fr": "Coulombs/mètre"
          },
          "symbol": "C/m"
        }
      },
      "name": {
        "en": "Electric charge line density",
        "fr": "Densité linéique de charge électrique"
      }
    },
    "electric-current": {
      "formats": {
        "a": {
          "name": {
            "en": "Amperes",
            "fr": "Ampères"
          },
          "symbol": "A"
        }
      },
      "name": {
        "en": "Electric current",
        "fr": "Courant électrique"
      }
    },
    "electrical-conductivity": {
      "formats": {
        "s": {
          "name": {
            "en": "Siemens",
            "fr": "Siemens"
          },
          "symbol": "S"
        }
      },
      "name": {
        "en": "Electrical conductivity",
        "fr": "Conductivité électrique"
      }
    },
    "electromotive-force": {
      "formats": {
        "v": {
          "name": {
            "en": "Volts",
            "fr": "Volts"
          },
          "symbol": "V"
        }
      },
      "name": {
        "en": "Electromotive force",
        "fr": "Force électromotrice"
      }
    },
    "energy": {
      "formats": {
        "btu": {
          "name": {
            "en": "British thermal units",
            "fr": "British thermal units"
          },
          "symbol": "BTU"
        },
        "cal": {
          "name": {
            "en": "Calories",
            "fr": "Calories"
          },
          "symbol": "cal"
        },
        "ev": {
          "name": {
            "en": "Electron-volts",
            "fr": "Électron-volts"
          },
          "symbol": "eV"
        },
        "erg": {
          "name": {
            "en": "Ergs",
            "fr": "Ergs"
          },
          "symbol": "Erg"
        },
        "ftlb": {
          "name": {
            "en": "Foot-pounds",
            "fr": "Pied-livres"
          },
          "symbol": "ft·lb"
        },
        "j": {
          "name": {
            "en": "Joules",
            "fr": "Joules"
          },
          "symbol": "J"
        },
        "kcal": {
          "name": {
            "en": "Kilogram-calories",
            "fr": "Kilocalories"
          },
          "symbol": "kg·cal"
        },
        "ws": {
          "name": {
            "en": "Watt-seconds",
            "fr": "Watt-secondes"
          },
          "symbol": "Ws"
        },
        "kwh": {
          "name": {
            "en": "Kilowatt-hours",
            "fr": "Kilowatt-heures"
          },
          "symbol": "kW·h"
        },
        "nm": {
          "name": {
            "en": "Newton-meters",
            "fr": "Newton-mètres"
          },
          "symbol": "N·m"
        },
        "wh": {
          "name": {
            "en": "Watt-hours",
            "fr": "Watt-heures"
          },
          "symbol": "W·h"
        }
      },
      "name": {
        "en": "Energy",
        "fr": "Energie"
      }
    },
    "force": {
      "formats": {
        "dyn": {
          "name": {
            "en": "Dynes",
            "fr": "Dynes"
          },
          "symbol": "dyn"
        },
        "n": {
          "name": {
            "en": "Newtons",
            "fr": "Newtons"
          },
          "symbol": "N"
        },
        "pdl": {
          "name": {
            "en": "Poundals",
            "fr": "Poundals"
          },
          "symbol": "Pdl"
        }
      },
      "name": {
        "en": "Force",
        "fr": "Force"
      }
    },
    "frequency": {
      "formats": {
        "rpm": {
          "name": {
            "en": "Revolutions per minute",
            "fr": "Rotations par minute"
          },
          "symbol": "rpm"
        },
        "hz": {
          "name": {
            "en": "Hertz",
            "fr": "Hertz"
          },
          "symbol": "Hz"
        },
        "bpm": {
          "name": {
            "en": "Beats per minute",
            "fr": "Battements par minute"
          },
          "symbol": "bpm"
        }
      },
      "name": {
        "en": "Frequency",
        "fr": "Fréquence"
      }
    },
    "luminous-intensity": {
      "formats": {
        "cd": {
          "name": {
            "en": "Candelas",
            "fr": "Candelas"
          },
          "symbol": "Cd"
        }
      },
      "name": {
        "en": "Luminous intensity",
        "fr": "Intensité lumineuse"
      }
    },
    "mol": {
      "formats": {
        "mol": {
          "name": {
            "en": "Moles",
            "fr": "Moles"
          },
          "symbol": "Mol"
        }
      },
      "name": {
        "en": "Amount of substance",
        "fr": "Quantité de matière"
      }
    },
    "power": {
      "formats": {
        "btu-min": {
          "name": {
            "en": "BTUs/minute",
            "fr": "BTUs/minute"
          },
          "symbol": "BTU/min"
        },
        "ftlb-s": {
          "name": {
            "en": "Foot-pounds/second",
            "fr": "Pied-livres/seconde"
          },
          "symbol": "ft·lb/s"
        },
        "hp": {
          "name": {
            "en": "Horsepower",
            "fr": "Chevaux"
          },
          "symbol": "hp"
        },
        "kw": {
          "name": {
            "en": "Kilowatts",
            "fr": "Kilowatts"
          },
          "symbol": "kW"
        },
        "w": {
          "name": {
            "en": "Watts",
            "fr": "Watts"
          },
          "symbol": "W"
        }
      },
      "name": {
        "en": "Power",
        "fr": "Puissance"
      }
    },
    "pressure": {
      "formats": {
        "at": {
          "name": {
            "en": "Atmospheres",
            "fr": "Atmosphères"
          },
          "symbol": "at"
        },
        "bar": {
          "name": {
            "en": "Bars",
            "fr": "Bars"
          },
          "symbol": "bar"
        },
        "cmhg": {
          "name": {
            "en": "Centimeters of mercury",
            "fr": "Centimètres de mercure"
          },
          "symbol": "cmHg"
        },
        "inhg": {
          "name": {
            "en": "Inches of mercury",
            "fr": "Pouces de mercure"
          },
          "symbol": "inHg"
        },
        "kg-m2": {
          "name": {
            "en": "Kilograms/square meter",
            "fr": "Kilogrammes/mètre cube"
          },
          "symbol": "kg/m²"
        },
        "mmhg": {
          "name": {
            "en": "Millimeters of mercury",
            "fr": "Millimètres de mercure"
          },
          "symbol": "mmHg"
        },
        "pa": {
          "name": {
            "en": "Pascals",
            "fr": "Pascals"
          },
          "symbol": "Pa"
        },
        "kpa": {
          "name": {
            "en": "Kilo Pascals",
            "fr": "Kilo Pascals"
          },
          "symbol": "kPa"
        },
        "psf": {
          "name": {
            "en": "Pounds/square foot",
            "fr": "Livres/pied carré"
          },
          "symbol": "psf"
        },
        "psi": {
          "name": {
            "en": "Pounds/square inch",
            "fr": "Livres/pouce carré"
          },
          "symbol": "psi"
        }
      },
      "name": {
        "en": "Pressure",
        "fr": "Pression"
      }
    },
    "ratio": {
      "formats": {
        "percent": {
          "name": {
            "en": "Percentage",
            "fr": "Pourcentage"
          }
        }
      },
      "name": {
        "en": "Ratio",
        "fr": "Ratio"
      }
    },
    "speed": {
      "formats": {
        "ft-m": {
          "name": {
            "en": "Feet/minute",
            "fr": "Pieds/minute"
          },
          "symbol": "ft/m"
        },
        "ft-s": {
          "name": {
            "en": "Feet/second",
            "fr": "Pieds/seconde"
          },
          "symbol": "ft/s"
        },
        "km-h": {
          "name": {
            "en": "Kilometers/hour",
            "fr": "Kilomètres/heure"
          },
          "symbol": "km/h"
        },
        "kt": {
          "name": {
            "en": "Knots",
            "fr": "Noeuds"
          },
          "symbol": "kt"
        },
        "m-min": {
          "name": {
            "en": "Miles/minute",
            "fr": "Miles/minute"
          },
          "symbol": "m/min"
        },
        "m-s": {
          "name": {
            "en": "Meters/second",
            "fr": "Mètres/seconde"
          },
          "symbol": "m/s"
        },
        "mph": {
          "name": {
            "en": "Miles/hour",
            "fr": "Miles/heure"
          },
          "symbol": "mph"
        }
      },
      "name": {
        "en": "Speed",
        "fr": "Vitesse"
      }
    },
    "volume": {
      "formats": {
        "c": {
          "name": {
            "en": "Cups",
            "fr": "Tasses"
          },
          "symbol": "c"
        },
        "cm3": {
          "name": {
            "en": "Cubic centimeters",
            "fr": "Centimètres cube"
          },
          "symbol": "cm³"
        },
        "floz": {
          "name": {
            "en": "Fluid ounces",
            "fr": "Onces liquides"
          },
          "symbol": "fl oz"
        },
        "ft3": {
          "name": {
            "en": "Cubic feet",
            "fr": "Pieds cube"
          },
          "symbol": "cu ft"
        },
        "galgb": {
          "name": {
            "en": "Gallons imperial",
            "fr": "Gallons impériaux"
          },
          "symbol": "gal GB"
        },
        "galus": {
          "name": {
            "en": "Gallons US",
            "fr": "Gallons US"
          },
          "symbol": "gal US"
        },
        "in3": {
          "name": {
            "en": "Cubic inches",
            "fr": "Pouce cube"
          },
          "symbol": "cu in"
        },
        "yd3": {
          "name": {
            "en": "Cubic yards",
            "fr": "Verges cube"
          },
          "symbol": "cu yd"
        },
        "l": {
          "name": {
            "en": "Liters",
            "fr": "Litres"
          },
          "symbol": "L"
        },
        "m3": {
          "name": {
            "en": "Cubic meters",
            "fr": "Mètres cube"
          },
          "symbol": "m³"
        },
        "ml": {
          "name": {
            "en": "Milliliters",
            "fr": "Millilitres"
          },
          "symbol": "mL"
        },
        "pt": {
          "name": {
            "en": "Pints",
            "fr": "Pintes"
          },
          "symbol": "pt"
        },
        "qt": {
          "name": {
            "en": "Quarts",
            "fr": "Quarts"
          },
          "symbol": "qt"
        },
        "bbloil": {
          "name": {
            "en": "Barrels (oil)",
            "fr": "Barils (pétrole)"
          },
          "symbol": "bbl (oil)"
        },
        "tbs": {
          "name": {
            "en": "Tablespoons",
            "fr": "Cuillères à soupe"
          },
          "symbol": "tbs"
        },
        "tsp": {
          "name": {
            "en": "Teaspoons",
            "fr": "Cuillères à café"
          },
          "symbol": "tsp"
        }
      },
      "name": {
        "en": "Volume",
        "fr": "Volume"
      }
    },
    "time": {
      "formats": {
        "d": {
          "name": {
            "en": "Days",
            "fr": "Jours"
          },
          "symbol": "d"
        },
        "h": {
          "name": {
            "en": "Hours",
            "fr": "Heures"
          },
          "symbol": "h"
        },
        "min": {
          "name": {
            "en": "Minutes",
            "fr": "Minutes"
          },
          "symbol": "min"
        },
        "ms": {
          "name": {
            "en": "Milliseconds",
            "fr": "Millisecondes"
          },
          "symbol": "ms"
        },
        "s": {
          "name": {
            "en": "Seconds",
            "fr": "Secondes"
          },
          "symbol": "s"
        },
        "y": {
          "name": {
            "en": "Years (Julian)",
            "fr": "Années (juliennes)"
          },
          "symbol": "yr"
        }
      },
      "name": {
        "en": "Time",
        "fr": "Temps"
      }
    }
  }
}
},{}],31:[function(require,module,exports){
module.exports={
  "version": "0.2.9",
  "classes": {
    "activity": {
      "description": "The time spent on a given activity (tasks, sports, etc.).",
      "formats": {
        "plain": {
          "description": "Plain activity event with no specific content; the activity is defined by the event's stream, time and duration, and possibly description and tags.",
          "type": "null"
        }
      }
    },
    "audio": {
      "description": "To record audio (conversations, voice messages, etc.).",
      "formats": {
        "attached": {
          "description": "The audio source is the file attached to the event (no explicit content defined).\nYou can use the event's duration to mirror the recording's duration.",
          "type": "null",
          "attachmentRequired": true
        },
        "url": {
          "description": "A reference to an audio file online.",
          "type": "string",
          "pattern": "^(https?)://.+$"
        }
      }
    },
    "call": {
      "description": "To record references to phone calls (landline, mobile, Skype, etc.).",
      "formats": {
        "name": {
          "description": "The contact's name (or a free-form identifier)",
          "type": "string"
        },
        "skype": {
          "description": "The Skype id",
          "type": "string"
        },
        "telephone": {
          "description": "The phone number",
          "type": "string"
        }
      }
    },
    "contact": {
      "description": "To record events related to people (meeting someone special, business encounters, etc.).",
      "formats": {
        "facebook": {
          "type": "object",
          "description": "A Facebook user as specified in the Graph API: https://developers.facebook.com/docs/reference/api/user/",
          "additionalProperties": "true",
          "properties": {
            "id": {
              "type": "string"
            }
          },
          "required": [
            "id"
          ]
        },
        "vcard": {
          "description": "A business card in vCard 2.0-3.x format. See: rfc2425, rfc2426.",
          "type": "string"
        }
      }
    },
    "encrypted": {
      "description": "For client-side-encrypted events. The decrypted <code>payload</code> is expected to be a JSON object with the regular <code>type</code> and <code>content</code> properties (e.g. <code>{ \"type\": \"..\", \"content\": \"..\" }</code>). If the event has attached files, they are expected to be similarly encrypted.",
      "formats": {
        "aes-text-base64": {
          "description": "AES encrypted payload, with a <em>text</em> key and a <em>Base64</em> payload.",
          "type": "object",
          "properties": {
            "payload": {
              "description": "The encrypted data.",
              "type": "string"
            },
            "keyRef": {
              "description": "A reference (e.g. id, name in keychain) to the key to use for decryption.",
              "type": "string"
            },
            "hint": {
              "description": "Alternative to <code>keyRef</code>. A textual hint about which key to use for decryption.",
              "type": "string"
            }
          },
          "required": [
            "payload"
          ]
        }
      }
    },
    "file": {
      "description": "To record a file, or a group of files. A fallback type for data with no specific handling in Pryv.",
      "formats": {
        "attached": {
          "description": "The file is attached to the event",
          "type": "null",
          "attachmentRequired": true
        },
        "attached-multiple": {
          "description": "A set of file attached. Structure can be declared in the filenames.",
          "attachmentRequired": true,
          "type": "null"
        },
        "url": {
          "description": "A reference to a file hosted elsewhere",
          "type": "string",
          "pattern": "^(https?)://.+$"
        }
      }
    },
    "message": {
      "description": "To record messages, such as e-mails or posts on social networks.",
      "formats": {
        "email": {
          "description": "An e-mail message.",
          "type": "object",
          "properties": {
            "from": {
              "type": "string"
            },
            "to": {
              "type": "string"
            },
            "cc": {
              "type": "string"
            },
            "bcc": {
              "type": "string"
            },
            "subject": {
              "type": "string"
            },
            "message-id": {
              "type": "string"
            },
            "reply-to": {
              "type": "string"
            },
            "x-headers": {
              "description": "Key/value map of `X-*` headers",
              "type": "object",
              "additionalProperties": true
            },
            "body": {
              "type": "string"
            }
          },
          "required": [
            "from",
            "to",
            "body"
          ]
        },
        "facebook": {
          "description": "A Facebook post. See [Facebook's API docs](https://developers.facebook.com/docs/reference/api/post/) for reference. Facebook properties `message` and `created_time` map to event `description` and `time` respectively. Facebook attached pictures can be directly mapped to attachments. Other Facebook properties such as `link`, `source`, `privacy` are allowed.",
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "id": {
              "type": "string"
            },
            "from": {
              "type": "object",
              "properties": {
                "name": {
                  "type": "string"
                },
                "id": {
                  "type": "string"
                }
              },
              "required": [
                "name",
                "id"
              ]
            },
            "to": {
              "type": "object",
              "properties": {
                "data": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "name": {
                        "type": "string"
                      },
                      "id": {
                        "type": "string"
                      }
                    },
                    "required": [
                      "name",
                      "id"
                    ]
                  }
                }
              }
            },
            "message": {
              "type": "string"
            },
            "source": {
              "type": "string",
              "description": "Either a fully qualified \"URL\" for an external source or a \"filename\" for a Flash Movie or Video attached to this event."
            },
            "properties": {
              "type": "string",
              "description": "Relative to `source`: a list of properties for an uploaded video, for example, the length of the video.",
              "additionalProperties": true
            },
            "picture": {
              "description": "Either a fully qualified \"URL\" for an external picture or a \"filename\" for a picture attached to this event.",
              "type": "string"
            },
            "status-type": {
              "description": "One of mobile_status_update, created_note, added_photos, added_video, shared_story, created_group, created_event, wall_post, app_created_story, published_story, tagged_in_photo, approved_friend",
              "type": "string"
            }
          },
          "required": [
            "id",
            "message"
          ]
        },
        "twitter": {
          "description": "A Twitter post. Twitter property `created_at` maps to event `time`. Other Twitter properties (see [Twitter's API docs](https://dev.twitter.com/docs/api/1.1/get/statuses/show/%3Aid)) are allowed.",
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "id": {
              "type": "string"
            },
            "screen-name": {
              "type": "string"
            },
            "text": {
              "type": "string"
            }
          },
          "required": [
            "id",
            "screen-name",
            "text"
          ]
        }
      }
    },
    "money": {
      "description": "To record sums of money (expenses, loans, stock values, etc.). Format = currency. Based on ISO 4217.",
      "formats": {
        "aed": {
          "type": "number"
        },
        "ang": {
          "type": "number",
          "description": "Netherlands Antilles Guilder"
        },
        "ars": {
          "type": "number",
          "description": "Argentina Peso"
        },
        "aud": {
          "type": "number",
          "description": "Australia Dollar"
        },
        "bgn": {
          "type": "number",
          "description": "Bulgaria Lev"
        },
        "bhd": {
          "type": "number"
        },
        "bnd": {
          "type": "number",
          "description": "Brunei Darussalam Dollar"
        },
        "bob": {
          "type": "number",
          "description": "Bolivia Boliviano"
        },
        "brl": {
          "type": "number",
          "description": "Brazil Real"
        },
        "bwp": {
          "type": "number",
          "description": "Botswana Pula"
        },
        "cad": {
          "type": "number",
          "description": "Canada Dollar"
        },
        "chf": {
          "type": "number",
          "description": "Switzerland Franc"
        },
        "clp": {
          "type": "number",
          "description": "Chile Peso"
        },
        "cny": {
          "type": "number",
          "description": "China Yuan Renminbi"
        },
        "cop": {
          "type": "number",
          "description": "Colombia Peso"
        },
        "crc": {
          "type": "number",
          "description": "Costa Rica Colon"
        },
        "czk": {
          "type": "number",
          "description": "Czech Republic Koruna"
        },
        "dkk": {
          "type": "number",
          "description": "Denmark Krone"
        },
        "dop": {
          "type": "number",
          "description": "Dominican Republic Peso"
        },
        "dzd": {
          "type": "number"
        },
        "eek": {
          "type": "number",
          "description": "Estonia Kroon"
        },
        "egp": {
          "type": "number",
          "description": "Egypt Pound"
        },
        "eur": {
          "type": "number",
          "description": "Euro"
        },
        "fjd": {
          "type": "number",
          "description": "Fiji Dollar"
        },
        "gbp": {
          "type": "number",
          "description": "United Kingdom Pound"
        },
        "hkd": {
          "type": "number",
          "description": "Hong Kong Dollar"
        },
        "hnl": {
          "type": "number",
          "description": "Honduras Lempira"
        },
        "hrk": {
          "type": "number",
          "description": "Croatia Kuna"
        },
        "huf": {
          "type": "number",
          "description": "Hungary Forint"
        },
        "idr": {
          "type": "number",
          "description": "Indonesia Rupiah"
        },
        "ils": {
          "type": "number",
          "description": "Israel Shekel"
        },
        "inr": {
          "type": "number",
          "description": "India Rupee"
        },
        "jmd": {
          "type": "number",
          "description": "Jamaica Dollar"
        },
        "jod": {
          "type": "number"
        },
        "jpy": {
          "type": "number",
          "description": "Japan Yen"
        },
        "kes": {
          "type": "number"
        },
        "krw": {
          "type": "number",
          "description": "Korea (South) Won"
        },
        "kwd": {
          "type": "number"
        },
        "kyd": {
          "type": "number",
          "description": "Cayman Islands Dollar"
        },
        "kzt": {
          "type": "number",
          "description": "Kazakhstan Tenge"
        },
        "lbp": {
          "type": "number",
          "description": "Lebanon Pound"
        },
        "lkr": {
          "type": "number",
          "description": "Sri Lanka Rupee"
        },
        "ltl": {
          "type": "number",
          "description": "Lithuania Litas"
        },
        "lvl": {
          "type": "number",
          "description": "Latvia Lat"
        },
        "mad": {
          "type": "number"
        },
        "mdl": {
          "type": "number"
        },
        "mkd": {
          "type": "number",
          "description": "Macedonia Denar"
        },
        "mur": {
          "type": "number",
          "description": "Mauritius Rupee"
        },
        "mxn": {
          "type": "number",
          "description": "Mexico Peso"
        },
        "myr": {
          "type": "number",
          "description": "Malaysia Ringgit"
        },
        "nad": {
          "type": "number",
          "description": "Namibia Dollar"
        },
        "ngn": {
          "type": "number",
          "description": "Nigeria Naira"
        },
        "nio": {
          "type": "number",
          "description": "Nicaragua Cordoba"
        },
        "nok": {
          "type": "number",
          "description": "Norway Krone"
        },
        "npr": {
          "type": "number",
          "description": "Nepal Rupee"
        },
        "nzd": {
          "type": "number",
          "description": "New Zealand Dollar"
        },
        "omr": {
          "type": "number",
          "description": "Oman Rial"
        },
        "pen": {
          "type": "number",
          "description": "Peru Nuevo Sol"
        },
        "pgk": {
          "type": "number"
        },
        "php": {
          "type": "number",
          "description": "Philippines Peso"
        },
        "pkr": {
          "type": "number",
          "description": "Pakistan Rupee"
        },
        "pln": {
          "type": "number",
          "description": "Poland Zloty"
        },
        "pyg": {
          "type": "number",
          "description": "Paraguay Guarani"
        },
        "qar": {
          "type": "number",
          "description": "Qatar Riyal"
        },
        "ron": {
          "type": "number",
          "description": "Romania New Leu"
        },
        "rsd": {
          "type": "number",
          "description": "Serbia Dinar"
        },
        "rub": {
          "type": "number",
          "description": "Russia Ruble"
        },
        "sar": {
          "type": "number",
          "description": "Saudi Arabia Riyal"
        },
        "scr": {
          "type": "number",
          "description": "Seychelles Rupee"
        },
        "sek": {
          "type": "number",
          "description": "Sweden Krona"
        },
        "sgd": {
          "type": "number",
          "description": "Singapore Dollar"
        },
        "skk": {
          "type": "number"
        },
        "sll": {
          "type": "number"
        },
        "svc": {
          "type": "number",
          "description": "El Salvador Colon"
        },
        "thb": {
          "type": "number",
          "description": "Thailand Baht"
        },
        "tnd": {
          "type": "number"
        },
        "try": {
          "type": "number",
          "description": "Turkey Lira"
        },
        "ttd": {
          "type": "number",
          "description": "Trinidad and Tobago Dollar"
        },
        "twd": {
          "type": "number",
          "description": "Taiwan New Dollar"
        },
        "tzs": {
          "type": "number"
        },
        "uah": {
          "type": "number",
          "description": "Ukraine Hryvna"
        },
        "ugx": {
          "type": "number"
        },
        "usd": {
          "type": "number",
          "description": "United States Dollar"
        },
        "uyu": {
          "type": "number",
          "description": "Uruguay Peso"
        },
        "uzs": {
          "type": "number",
          "description": "Uzbekistan Som"
        },
        "vnd": {
          "type": "number",
          "description": "Viet Nam Dong"
        },
        "yer": {
          "type": "number",
          "description": "Yemen Rial"
        },
        "zar": {
          "type": "number",
          "description": "South Africa Rand"
        },
        "zmk": {
          "type": "number"
        },
        "btc": {
          "description": "Bitcoin",
          "type": "number"
        },
        "all": {
          "description": "Albania Lek",
          "type": "number"
        },
        "afn": {
          "description": "Afghanistan Afghani",
          "type": "number"
        },
        "awg": {
          "description": "Aruba Guilder",
          "type": "number"
        },
        "azn": {
          "description": "Azerbaijan New Manat",
          "type": "number"
        },
        "bsd": {
          "description": "Bahamas Dollar",
          "type": "number"
        },
        "bbd": {
          "description": "Barbados Dollar",
          "type": "number"
        },
        "byr": {
          "description": "Belarus Ruble",
          "type": "number"
        },
        "bzd": {
          "description": "Belize Dollar",
          "type": "number"
        },
        "bmd": {
          "description": "Bermuda Dollar",
          "type": "number"
        },
        "bam": {
          "description": "Bosnia and Herzegovina Convertible Marka",
          "type": "number"
        },
        "khr": {
          "description": "Cambodia Riel",
          "type": "number"
        },
        "cup": {
          "description": "Cuba Peso",
          "type": "number"
        },
        "xcd": {
          "description": "East Caribbean Dollar",
          "type": "number"
        },
        "fkp": {
          "description": "Falkland Islands (Malvinas) Pound",
          "type": "number"
        },
        "ghc": {
          "description": "Ghana Cedis",
          "type": "number"
        },
        "gip": {
          "description": "Gibraltar Pound",
          "type": "number"
        },
        "gtq": {
          "description": "Guatemala Quetzal",
          "type": "number"
        },
        "ggp": {
          "description": "Guernsey Pound",
          "type": "number"
        },
        "gyd": {
          "description": "Guyana Dollar",
          "type": "number"
        },
        "isk": {
          "description": "Iceland Krona",
          "type": "number"
        },
        "irr": {
          "description": "Iran Rial",
          "type": "number"
        },
        "imp": {
          "description": "Isle of Man Pound",
          "type": "number"
        },
        "jep": {
          "description": "Jersey Pound",
          "type": "number"
        },
        "kpw": {
          "description": "Korea (North) Won",
          "type": "number"
        },
        "kgs": {
          "description": "Kyrgyzstan Som",
          "type": "number"
        },
        "lak": {
          "description": "Laos Kip",
          "type": "number"
        },
        "lrd": {
          "description": "Liberia Dollar",
          "type": "number"
        },
        "mnt": {
          "description": "Mongolia Tughrik",
          "type": "number"
        },
        "mzn": {
          "description": "Mozambique Metical",
          "type": "number"
        },
        "pab": {
          "description": "Panama Balboa",
          "type": "number"
        },
        "shp": {
          "description": "Saint Helena Pound",
          "type": "number"
        },
        "sbd": {
          "description": "Solomon Islands Dollar",
          "type": "number"
        },
        "sos": {
          "description": "Somalia Shilling",
          "type": "number"
        },
        "srd": {
          "description": "Suriname Dollar",
          "type": "number"
        },
        "syp": {
          "description": "Syria Pound",
          "type": "number"
        },
        "trl": {
          "description": "Turkey Lira",
          "type": "number"
        },
        "tvd": {
          "description": "Tuvalu Dollar",
          "type": "number"
        },
        "vef": {
          "description": "Venezuela Bolivar",
          "type": "number"
        },
        "zwd": {
          "description": "Zimbabwe Dollar",
          "type": "number"
        }
      }
    },
    "mood": {
      "description": "To record personal mood.",
      "formats": {
        "rating": {
          "description": "Rating of mood (float value) 0:worst -> 1:best",
          "type": "number",
          "minimum": 0,
          "maximum": 1
        },
        "emoticon": {
          "description": "ASCII Art emoticon",
          "type": "string"
        }
      }
    },
    "music": {
      "description": "To record references to music, usualy tracks (from Soundcloud, Shazam tags, etc.).",
      "formats": {
        "basic": {
          "description": "Inspired from id3 key/pair",
          "type": "object",
          "properties": {
            "title": {
              "type": "string"
            },
            "artist": {
              "type": "string"
            },
            "album": {
              "type": "string"
            },
            "track": {
              "type": "integer"
            },
            "year": {
              "type": "integer"
            },
            "genre": {
              "type": "string"
            }
          }
        },
        "soundcloud": {
          "description": "See [Soundcloud track properties](http://developers.soundcloud.com/docs/api/reference#tracks).",
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "id": {
              "type": "integer"
            }
          },
          "required": [
            "id"
          ]
        }
      }
    },
    "note": {
      "description": "To record different kinds of text-based notes, from simple text to more complex formatted content like social network posts.",
      "formats": {
        "html": {
          "description": "An HTML-formatted note.",
          "type": "string",
          "maxLength": 4194304
        },
        "txt": {
          "description": "A plain-text note.",
          "type": "string",
          "maxLength": 4194304
        },
        "webclip": {
          "description": "An HTML-formatted note associated to its source URL.",
          "type": "object",
          "properties": {
            "url": {
              "type": "string",
              "pattern": "^(https?)://.+$"
            },
            "content": {
              "description": "An HTML-formatted string.",
              "type": "string",
              "maxLength": 4194304
            }
          },
          "required": [
            "url"
          ]
        }
      }
    },
    "numset": {
      "description": "A set of numerical values.",
      "formats": {
        "*": {
          "description": "The format key is freely defined.\n\nFor example, a heart measurement with type `numset/heart` and content:\n```\n{Â \n  \"systolic\": { \"pressure/mmhg\": 105 },\n  \"diastolic\": { \"pressure/mmhg\": 64 },\n  \"rate\": { \"frequency/bpm\": 88 }\n}\n```\n\n ",
          "type": "object",
          "patternProperties": {
            "^(/[^/]+)+$": {
              "type": "number"
            }
          },
          "additionalProperties": "false",
          "required": []
        }
      }
    },
    "picture": {
      "description": "To record any kind of image (photos, designs, screenshots, etc.)",
      "formats": {
        "base64": {
          "description": "The picture is caried in base64 (utf-8) encoded in string",
          "type": "string",
          "properties": {
            "payload": {
              "type": "string",
              "description": "base64 encoded content"
            },
            "format": {
              "type": "string",
              "description": "The data format \"gif\", \"jpeg\", \"png\", \"tiff\", \"vnd.microsoft.com\", \"svg+xml\""
            },
            "filename": {
              "description": "A filename",
              "type": "string"
            }
          },
          "required": [
            "payload",
            "format"
          ]
        },
        "attached": {
          "description": "The picture is the image file attached to the event (no explicit content defined). TODO: list accepted formats.",
          "type": "null",
          "attachmentRequired": true
        },
        "url": {
          "description": "A reference to a picture file online.",
          "type": "string",
          "pattern": "^(https?)://.+$"
        }
      }
    },
    "position": {
      "description": "To record a geographical position.",
      "formats": {
        "wgs84": {
          "description": "The latest revision of the World Geodetic System (used by GPS).",
          "type": "object",
          "properties": {
            "latitude": {
              "type": "number",
              "description": "Unit: degrees north from the equator."
            },
            "longitude": {
              "type": "number",
              "description": "Unit: degrees east from the zero meridian."
            },
            "altitude": {
              "type": "number",
              "description": "Unit: meters above sea level."
            },
            "horizontalAccuracy": {
              "type": "number",
              "description": "The radius of uncertainty for latitude and longitude. Unit: meters. Negative if latitude and longitude are invalid."
            },
            "verticalAccuracy": {
              "type": "number",
              "description": "The radius of uncertainty for altitude. Unit: meters. Negative if altitude is invalid."
            },
            "speed": {
              "type": "number",
              "description": "For informational purposes only. Unit: meters / second. Negative if invalid."
            },
            "bearing": {
              "type": "number",
              "description": "Unit: degrees clockwise from north. Negative if invalid."
            }
          },
          "required": [
            "latitude",
            "longitude"
          ]
        }
      }
    },
    "ratio": {
      "description": "To record proportional values (e.g. 1/3, 21.5/100).",
      "formats": {
        "generic": {
          "description": "Generic ratio.",
          "type": "object",
          "properties": {
            "value": {
              "type": "number"
            },
            "relativeTo": {
              "type": "number"
            }
          },
          "required": [
            "value",
            "relativeTo"
          ]
        },
        "percent": {
          "description": "A percentage value.",
          "type": "number"
        }
      }
    },
    "url": {
      "description": "To record references to online resources. Format ~= protocol.",
      "formats": {
        "http": {
          "description": "An HTTP or HTTPS resource.",
          "type": "string",
          "pattern": "^(https?)://.+$"
        }
      }
    },
    "video": {
      "description": "To record video (home snippets, Vimeo or YouTube links, etc.).",
      "formats": {
        "attached": {
          "description": "The video is the file attached to the event (no explicit content defined). TODO: list accepted formats.",
          "type": "null",
          "attachmentRequired": true
        },
        "url": {
          "description": "A reference to an video file online.",
          "type": "string",
          "pattern": "^(https?)://.+$"
        },
        "vimeo": {
          "description": "A Vimeo video ID.",
          "type": "string"
        },
        "youtube": {
          "description": "A YouTube video ID.",
          "type": "string"
        }
      }
    },
    "absorbed-dose": {
      "formats": {
        "gy": {
          "description": "Gray",
          "type": "number"
        }
      },
      "description": "The energy deposited in a medium by ionizing radiation per unit mass."
    },
    "absorbed-dose-equivalent": {
      "formats": {
        "sv": {
          "description": "Sievert",
          "type": "number"
        }
      },
      "description": "TheÂ radiationÂ absorbed by a fixed mass of biological tissue."
    },
    "absorbed-dose-rate": {
      "formats": {
        "gy-s": {
          "description": "Gray per second",
          "type": "number"
        }
      },
      "description": "The absorbed dose of ionizing radiation imparted at a given location per unit of time (second, minute, hour, or day). "
    },
    "angle": {
      "formats": {
        "deg": {
          "description": "Degrees",
          "type": "number"
        },
        "grad": {
          "description": "Grade",
          "type": "number"
        },
        "rad": {
          "description": "Radians",
          "type": "number"
        }
      },
      "description": "The figure formed by two rays."
    },
    "angular-acceleration": {
      "formats": {
        "rad-s2": {
          "description": "Radians per second squared",
          "type": "number"
        }
      },
      "description": "The rate of change ofÂ angular velocity."
    },
    "angular-speed": {
      "formats": {
        "rad-s": {
          "description": "Radians per second",
          "type": "number"
        }
      },
      "description": ""
    },
    "area": {
      "formats": {
        "ac": {
          "description": "Acres (imperial)",
          "type": "number"
        },
        "ft2": {
          "description": "Square feet",
          "type": "number"
        },
        "ha": {
          "description": "Hectares",
          "type": "number"
        },
        "in2": {
          "description": "Square inches",
          "type": "number"
        },
        "km2": {
          "description": "Square kilometers",
          "type": "number"
        },
        "m2": {
          "description": "Square meter",
          "type": "number"
        },
        "mm2": {
          "description": "Square millimeters",
          "type": "number"
        },
        "yd2": {
          "description": "Square yards",
          "type": "number"
        },
        "mi2": {
          "description": "Square miles",
          "type": "number"
        }
      },
      "description": "The extent of a two-dimensional surface or shape, or planar lamina, in the plane."
    },
    "capacitance": {
      "formats": {
        "f": {
          "description": "Farad",
          "type": "number"
        }
      },
      "description": "The ability of a body to store an electricalÂ charge."
    },
    "catalytic-activity": {
      "formats": {
        "kat": {
          "description": "Katal",
          "type": "number"
        }
      },
      "description": "The  increase inÂ rateÂ of aÂ chemical reactionÂ due to the participation of a substance called aÂ catalyst."
    },
    "count": {
      "description": "To record the counting of objects (eggs, apples, etc.).",
      "formats": {
        "steps": {
          "description": "Number of steps",
          "type": "number"
        },
        "generic": {
          "description": "For general items that demand no particular handling.",
          "type": "number"
        }
      }
    },
    "data-quantity": {
      "formats": {
        "b": {
          "description": "Bytes",
          "type": "number"
        },
        "bits": {
          "description": "Bits",
          "type": "number"
        },
        "gb": {
          "description": "Gigabytes",
          "type": "number"
        },
        "gbits": {
          "description": "Gigabits",
          "type": "number"
        },
        "kb": {
          "description": "Kilobytes",
          "type": "number"
        },
        "kbits": {
          "description": "Kilobits",
          "type": "number"
        },
        "mb": {
          "description": "Megabytes",
          "type": "number"
        },
        "mbits": {
          "description": "Megabits",
          "type": "number"
        },
        "tb": {
          "description": "Terabytes",
          "type": "number"
        }
      },
      "description": "UnitÂ ofÂ informationÂ inÂ computingÂ and digitalÂ communications."
    },
    "density": {
      "formats": {
        "g-dl": {
          "description": "Grams per deciliter",
          "type": "number"
        },
        "kg-m3": {
          "description": "Kilograms per cubic meter",
          "type": "number"
        },
        "mmol-l": {
          "description": "Millimoles per liter",
          "type": "number"
        },
        "mg-dl": {
          "description": "Milligrams per deciliter",
          "type": "number"
        }
      },
      "description": "The densityÂ of a material (volumetric mass density)."
    },
    "dynamic-viscosity": {
      "formats": {
        "pa-s": {
          "description": "Pascal second",
          "type": "number"
        }
      },
      "description": "The resistance to flow of a fluid under an applied force."
    },
    "electric-charge": {
      "formats": {
        "c": {
          "description": "Coulomb ",
          "type": "number"
        }
      },
      "description": "The electric charge of an object."
    },
    "electric-charge-line-density": {
      "formats": {
        "c-m": {
          "description": "Coulomb per meter",
          "type": "number"
        }
      },
      "description": "The electric chargeÂ per unitÂ volumeÂ of space, in one, two or three dimensions."
    },
    "electric-current": {
      "formats": {
        "a": {
          "description": "Ampere",
          "type": "number"
        }
      },
      "description": "A flow ofÂ electric charge."
    },
    "electrical-conductivity": {
      "formats": {
        "s": {
          "description": "Siemens",
          "type": "number"
        }
      },
      "description": "A material that accommodates the transport of electric charge."
    },
    "electromotive-force": {
      "formats": {
        "v": {
          "description": "Volt",
          "type": "number"
        }
      },
      "description": "Voltage generated by a battery or by the magnetic force."
    },
    "energy": {
      "formats": {
        "btu": {
          "description": "British Thermal Units",
          "type": "number"
        },
        "cal": {
          "description": "Calories",
          "type": "number"
        },
        "ev": {
          "description": "Electron-Volts",
          "type": "number"
        },
        "erg": {
          "description": "Ergs",
          "type": "number"
        },
        "ftlb": {
          "description": "Foot-Pounds",
          "type": "number"
        },
        "j": {
          "description": "Joules",
          "type": "number"
        },
        "kcal": {
          "description": "Kilo-calories",
          "type": "number"
        },
        "ws": {
          "description": "Watt-seconds",
          "type": "number"
        },
        "kwh": {
          "description": "Kilowatt-hours",
          "type": "number"
        },
        "nm": {
          "description": "Newton-meters",
          "type": "number"
        },
        "wh": {
          "description": "Watt-hours",
          "type": "number"
        }
      },
      "description": "The capacity of a physical system to perform work."
    },
    "force": {
      "formats": {
        "dyn": {
          "description": "Dynes",
          "type": "number"
        },
        "n": {
          "description": "Newtons",
          "type": "number"
        },
        "pdl": {
          "description": "Poundals",
          "type": "number"
        }
      },
      "description": "A push or pull upon an object resulting from the object'sÂ interactionÂ with another object."
    },
    "frequency": {
      "description": "The number of occurrences of a repeating event per unit time.",
      "formats": {
        "bpm": {
          "description": "Beats per minute",
          "type": "number"
        },
        "ghz": {
          "description": "Gigahertz",
          "type": "number"
        },
        "hz": {
          "description": "Hertz (also known as cycles per second) ",
          "type": "number"
        },
        "khz": {
          "description": "Kilohertz",
          "type": "number"
        },
        "megahz": {
          "description": "Megahertz",
          "type": "number"
        },
        "millihz": {
          "description": "Millihertz",
          "type": "number"
        },
        "nhz": {
          "description": "Nanohertz",
          "type": "number"
        },
        "rpm": {
          "description": "Revolutions per minute",
          "type": "number"
        },
        "thz": {
          "description": "Terahertz",
          "type": "number"
        },
        "uhz": {
          "description": "Microhertz",
          "type": "number"
        }
      }
    },
    "length": {
      "description": "Length measurements. Format = unit.",
      "formats": {
        "cm": {
          "description": "Centimeters",
          "type": "number"
        },
        "m": {
          "description": "Meters",
          "type": "number"
        },
        "mm": {
          "description": "Millimeters",
          "type": "number"
        },
        "km": {
          "description": "Kilometers",
          "type": "number"
        },
        "a": {
          "description": "Ã…ngstrÃ¶ms",
          "type": "number"
        },
        "au": {
          "description": "Astronomical units",
          "type": "number"
        },
        "ch": {
          "description": "Chains",
          "type": "number"
        },
        "lea": {
          "description": "Leagues",
          "type": "number"
        },
        "ft": {
          "description": "Feet",
          "type": "number"
        },
        "in": {
          "description": "Inches",
          "type": "number"
        },
        "ly": {
          "description": "Light-years",
          "type": "number"
        },
        "mil": {
          "description": "Mil",
          "type": "number"
        },
        "mi": {
          "description": "Miles",
          "type": "number"
        },
        "fur": {
          "description": "Furlongs",
          "type": "number"
        },
        "nmi": {
          "description": "Miles (nautical)",
          "type": "number"
        },
        "p": {
          "description": "Points",
          "type": "number"
        },
        "pica": {
          "description": "Picas",
          "type": "number"
        },
        "ftm": {
          "description": "Fathoms",
          "type": "number"
        },
        "cb": {
          "description": "Cables",
          "type": "number"
        },
        "um": {
          "description": "Microns",
          "type": "number"
        },
        "yd": {
          "description": "Yards",
          "type": "number"
        }
      }
    },
    "luminous-intensity": {
      "formats": {
        "cd": {
          "description": "Candela",
          "type": "number"
        }
      },
      "description": "TheÂ wavelength-weightedÂ powerÂ emitted by aÂ light source."
    },
    "mass": {
      "description": "The heaviness of an object.",
      "formats": {
        "kg": {
          "description": "Kilograms",
          "type": "number"
        },
        "gr": {
          "description": "Grains",
          "type": "number"
        },
        "dr": {
          "description": "Drams",
          "type": "number"
        },
        "g": {
          "description": "Grams",
          "type": "number"
        },
        "l-t": {
          "description": "Long tons",
          "type": "number"
        },
        "lb": {
          "description": "Pounds",
          "type": "number"
        },
        "t": {
          "description": "Metric tons",
          "type": "number"
        },
        "oz": {
          "description": "Ounces",
          "type": "number"
        },
        "s-t": {
          "description": "Short tons",
          "type": "number"
        },
        "st": {
          "description": "Stone",
          "type": "number"
        }
      }
    },
    "mol": {
      "description": "The size of an ensemble of elementary entities, such as atoms, molecules, electrons, andÂ other particles.",
      "formats": {
        "mol": {
          "description": "Mole ",
          "type": "number"
        },
        "lb-mol": {
          "description": "Pound-mole.",
          "type": "number"
        }
      }
    },
    "power": {
      "formats": {
        "btu-min": {
          "description": "BTUs/minute",
          "type": "number"
        },
        "ftlb-s": {
          "description": "Foot-pounds/second",
          "type": "number"
        },
        "hp": {
          "description": "Horsepower",
          "type": "number"
        },
        "kw": {
          "description": "Kilowatts",
          "type": "number"
        },
        "w": {
          "description": "Watts",
          "type": "number"
        }
      },
      "description": "The rate at whichÂ energyÂ is transferred, used, or transformed."
    },
    "pressure": {
      "formats": {
        "at": {
          "description": "Atmospheres",
          "type": "number"
        },
        "bar": {
          "description": "Bars",
          "type": "number"
        },
        "mmhg": {
          "description": "Millimeters of mercury",
          "type": "number"
        },
        "cmhg": {
          "description": "Centimeters of mercury",
          "type": "number"
        },
        "inhg": {
          "description": "Inches of mercury",
          "type": "number"
        },
        "kg-m2": {
          "description": "Kilograms/square meter",
          "type": "number"
        },
        "pa": {
          "description": "Pascals",
          "type": "number"
        },
        "kpa": {
          "description": "Kilo pascals",
          "type": "number"
        },
        "psf": {
          "description": "Pounds/square foot",
          "type": "number"
        },
        "psi": {
          "description": "Pounds/square inch",
          "type": "number"
        }
      },
      "description": "The ratio of force to the area over which that force is distributed."
    },
    "speed": {
      "formats": {
        "ft-m": {
          "description": "Feet/minute",
          "type": "number"
        },
        "ft-s": {
          "description": "Feet/second",
          "type": "number"
        },
        "km-h": {
          "description": "Kilometers/hour",
          "type": "number"
        },
        "kt": {
          "description": "Knots",
          "type": "number"
        },
        "m-min": {
          "description": "Miles/minute",
          "type": "number"
        },
        "m-s": {
          "description": "Meters/second",
          "type": "number"
        },
        "mph": {
          "description": "Miles/hour",
          "type": "number"
        }
      },
      "description": "TheÂ magnitudeÂ of theÂ velocityÂ of an object."
    },
    "temperature": {
      "description": "Temperature measurements. Format = unit.",
      "formats": {
        "c": {
          "description": "Celsius",
          "type": "number"
        },
        "k": {
          "description": "Kelvin",
          "type": "number"
        },
        "f": {
          "description": "Fahrenheit",
          "type": "number"
        }
      }
    },
    "time": {
      "description": "Amount of time. Use with care! To store an activity or duration the \"activity/plain\" event type is more appropriate, in most cases.",
      "formats": {
        "d": {
          "description": "Days",
          "type": "number"
        },
        "h": {
          "description": "Hours",
          "type": "number"
        },
        "min": {
          "description": "Minutes",
          "type": "number"
        },
        "ms": {
          "description": "Milliseconds",
          "type": "number"
        },
        "s": {
          "description": "Seconds",
          "type": "number"
        },
        "y": {
          "description": "Years",
          "type": "number"
        }
      }
    },
    "volume": {
      "description": "The quantityÂ ofÂ three-dimensional spaceÂ enclosed by some closed boundary.",
      "formats": {
        "l": {
          "description": "Liters",
          "type": "number"
        },
        "m3": {
          "description": "Cubic meters",
          "type": "number"
        },
        "c": {
          "description": "Cups",
          "type": "number"
        },
        "cm3": {
          "description": "Cubic centimeters",
          "type": "number"
        },
        "floz": {
          "description": "Fluid ounces",
          "type": "number"
        },
        "ft3": {
          "description": "Cubic feet",
          "type": "number"
        },
        "galgb": {
          "description": "Gallons imperial",
          "type": "number"
        },
        "galus": {
          "description": "Gallons US",
          "type": "number"
        },
        "in3": {
          "description": "Cubic inches",
          "type": "number"
        },
        "yd3": {
          "description": "Cubic yard",
          "type": "number"
        },
        "ml": {
          "description": "Milliliters",
          "type": "number"
        },
        "pt": {
          "description": "Pints",
          "type": "number"
        },
        "qt": {
          "description": "Quarts",
          "type": "number"
        },
        "bbloil": {
          "description": "Barrels (oil)",
          "type": "number"
        },
        "tbs": {
          "description": "Tablespoons",
          "type": "number"
        },
        "tsp": {
          "description": "Teaspoons",
          "type": "number"
        }
      }
    }
  }
}
},{}],32:[function(require,module,exports){
module.exports=  {
  "version": "0.2.9",
  "types": {
    "activity/plain": {
      "description": "Plain activity event with no specific content; the activity is defined by the event's stream, time and duration, and possibly description and tags.",
      "type": "null"
    },
    "audio/attached": {
      "description": "The audio source is the file attached to the event (no explicit content defined).\nYou can use the event's duration to mirror the recording's duration.",
      "type": "null",
      "attachmentRequired": true
    },
    "audio/url": {
      "description": "A reference to an audio file online.",
      "type": "string",
      "pattern": "^(https?)://.+$"
    },
    "call/name": {
      "description": "The contact's name (or a free-form identifier)",
      "type": "string"
    },
    "call/skype": {
      "description": "The Skype id",
      "type": "string"
    },
    "call/telephone": {
      "description": "The phone number",
      "type": "string"
    },
    "contact/facebook": {
      "type": "object",
      "description": "A Facebook user as specified in the Graph API: https://developers.facebook.com/docs/reference/api/user/",
      "additionalProperties": "true",
      "properties": {
        "id": {
          "type": "string"
        }
      },
      "required": [
        "id"
      ]
    },
    "contact/vcard": {
      "description": "A business card in vCard 2.0-3.x format. See: rfc2425, rfc2426.",
      "type": "string"
    },
    "encrypted/aes-text-base64": {
      "description": "AES encrypted payload, with a <em>text</em> key and a <em>Base64</em> payload.",
      "type": "object",
      "properties": {
        "payload": {
          "description": "The encrypted data.",
          "type": "string"
        },
        "keyRef": {
          "description": "A reference (e.g. id, name in keychain) to the key to use for decryption.",
          "type": "string"
        },
        "hint": {
          "description": "Alternative to <code>keyRef</code>. A textual hint about which key to use for decryption.",
          "type": "string"
        }
      },
      "required": [
        "payload"
      ]
    },
    "file/attached": {
      "description": "The file is attached to the event",
      "type": "null",
      "attachmentRequired": true
    },
    "file/attached-multiple": {
      "description": "A set of file attached. Structure can be declared in the filenames.",
      "attachmentRequired": true,
      "type": "null"
    },
    "file/url": {
      "description": "A reference to a file hosted elsewhere",
      "type": "string",
      "pattern": "^(https?)://.+$"
    },
    "message/email": {
      "description": "An e-mail message.",
      "type": "object",
      "properties": {
        "from": {
          "type": "string"
        },
        "to": {
          "type": "string"
        },
        "cc": {
          "type": "string"
        },
        "bcc": {
          "type": "string"
        },
        "subject": {
          "type": "string"
        },
        "message-id": {
          "type": "string"
        },
        "reply-to": {
          "type": "string"
        },
        "x-headers": {
          "description": "Key/value map of `X-*` headers",
          "type": "object",
          "additionalProperties": true
        },
        "body": {
          "type": "string"
        }
      },
      "required": [
        "from",
        "to",
        "body"
      ]
    },
    "message/facebook": {
      "description": "A Facebook post. See [Facebook's API docs](https://developers.facebook.com/docs/reference/api/post/) for reference. Facebook properties `message` and `created_time` map to event `description` and `time` respectively. Facebook attached pictures can be directly mapped to attachments. Other Facebook properties such as `link`, `source`, `privacy` are allowed.",
      "type": "object",
      "additionalProperties": true,
      "properties": {
        "id": {
          "type": "string"
        },
        "from": {
          "type": "object",
          "properties": {
            "name": {
              "type": "string"
            },
            "id": {
              "type": "string"
            }
          },
          "required": [
            "name",
            "id"
          ]
        },
        "to": {
          "type": "object",
          "properties": {
            "data": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "name": {
                    "type": "string"
                  },
                  "id": {
                    "type": "string"
                  }
                },
                "required": [
                  "name",
                  "id"
                ]
              }
            }
          }
        },
        "message": {
          "type": "string"
        },
        "source": {
          "type": "string",
          "description": "Either a fully qualified \"URL\" for an external source or a \"filename\" for a Flash Movie or Video attached to this event."
        },
        "properties": {
          "type": "string",
          "description": "Relative to `source`: a list of properties for an uploaded video, for example, the length of the video.",
          "additionalProperties": true
        },
        "picture": {
          "description": "Either a fully qualified \"URL\" for an external picture or a \"filename\" for a picture attached to this event.",
          "type": "string"
        },
        "status-type": {
          "description": "One of mobile_status_update, created_note, added_photos, added_video, shared_story, created_group, created_event, wall_post, app_created_story, published_story, tagged_in_photo, approved_friend",
          "type": "string"
        }
      },
      "required": [
        "id",
        "message"
      ]
    },
    "message/twitter": {
      "description": "A Twitter post. Twitter property `created_at` maps to event `time`. Other Twitter properties (see [Twitter's API docs](https://dev.twitter.com/docs/api/1.1/get/statuses/show/%3Aid)) are allowed.",
      "type": "object",
      "additionalProperties": true,
      "properties": {
        "id": {
          "type": "string"
        },
        "screen-name": {
          "type": "string"
        },
        "text": {
          "type": "string"
        }
      },
      "required": [
        "id",
        "screen-name",
        "text"
      ]
    },
    "money/aed": {
      "type": "number"
    },
    "money/ang": {
      "type": "number",
      "description": "Netherlands Antilles Guilder"
    },
    "money/ars": {
      "type": "number",
      "description": "Argentina Peso"
    },
    "money/aud": {
      "type": "number",
      "description": "Australia Dollar"
    },
    "money/bgn": {
      "type": "number",
      "description": "Bulgaria Lev"
    },
    "money/bhd": {
      "type": "number"
    },
    "money/bnd": {
      "type": "number",
      "description": "Brunei Darussalam Dollar"
    },
    "money/bob": {
      "type": "number",
      "description": "Bolivia Boliviano"
    },
    "money/brl": {
      "type": "number",
      "description": "Brazil Real"
    },
    "money/bwp": {
      "type": "number",
      "description": "Botswana Pula"
    },
    "money/cad": {
      "type": "number",
      "description": "Canada Dollar"
    },
    "money/chf": {
      "type": "number",
      "description": "Switzerland Franc"
    },
    "money/clp": {
      "type": "number",
      "description": "Chile Peso"
    },
    "money/cny": {
      "type": "number",
      "description": "China Yuan Renminbi"
    },
    "money/cop": {
      "type": "number",
      "description": "Colombia Peso"
    },
    "money/crc": {
      "type": "number",
      "description": "Costa Rica Colon"
    },
    "money/czk": {
      "type": "number",
      "description": "Czech Republic Koruna"
    },
    "money/dkk": {
      "type": "number",
      "description": "Denmark Krone"
    },
    "money/dop": {
      "type": "number",
      "description": "Dominican Republic Peso"
    },
    "money/dzd": {
      "type": "number"
    },
    "money/eek": {
      "type": "number",
      "description": "Estonia Kroon"
    },
    "money/egp": {
      "type": "number",
      "description": "Egypt Pound"
    },
    "money/eur": {
      "type": "number",
      "description": "Euro"
    },
    "money/fjd": {
      "type": "number",
      "description": "Fiji Dollar"
    },
    "money/gbp": {
      "type": "number",
      "description": "United Kingdom Pound"
    },
    "money/hkd": {
      "type": "number",
      "description": "Hong Kong Dollar"
    },
    "money/hnl": {
      "type": "number",
      "description": "Honduras Lempira"
    },
    "money/hrk": {
      "type": "number",
      "description": "Croatia Kuna"
    },
    "money/huf": {
      "type": "number",
      "description": "Hungary Forint"
    },
    "money/idr": {
      "type": "number",
      "description": "Indonesia Rupiah"
    },
    "money/ils": {
      "type": "number",
      "description": "Israel Shekel"
    },
    "money/inr": {
      "type": "number",
      "description": "India Rupee"
    },
    "money/jmd": {
      "type": "number",
      "description": "Jamaica Dollar"
    },
    "money/jod": {
      "type": "number"
    },
    "money/jpy": {
      "type": "number",
      "description": "Japan Yen"
    },
    "money/kes": {
      "type": "number"
    },
    "money/krw": {
      "type": "number",
      "description": "Korea (South) Won"
    },
    "money/kwd": {
      "type": "number"
    },
    "money/kyd": {
      "type": "number",
      "description": "Cayman Islands Dollar"
    },
    "money/kzt": {
      "type": "number",
      "description": "Kazakhstan Tenge"
    },
    "money/lbp": {
      "type": "number",
      "description": "Lebanon Pound"
    },
    "money/lkr": {
      "type": "number",
      "description": "Sri Lanka Rupee"
    },
    "money/ltl": {
      "type": "number",
      "description": "Lithuania Litas"
    },
    "money/lvl": {
      "type": "number",
      "description": "Latvia Lat"
    },
    "money/mad": {
      "type": "number"
    },
    "money/mdl": {
      "type": "number"
    },
    "money/mkd": {
      "type": "number",
      "description": "Macedonia Denar"
    },
    "money/mur": {
      "type": "number",
      "description": "Mauritius Rupee"
    },
    "money/mxn": {
      "type": "number",
      "description": "Mexico Peso"
    },
    "money/myr": {
      "type": "number",
      "description": "Malaysia Ringgit"
    },
    "money/nad": {
      "type": "number",
      "description": "Namibia Dollar"
    },
    "money/ngn": {
      "type": "number",
      "description": "Nigeria Naira"
    },
    "money/nio": {
      "type": "number",
      "description": "Nicaragua Cordoba"
    },
    "money/nok": {
      "type": "number",
      "description": "Norway Krone"
    },
    "money/npr": {
      "type": "number",
      "description": "Nepal Rupee"
    },
    "money/nzd": {
      "type": "number",
      "description": "New Zealand Dollar"
    },
    "money/omr": {
      "type": "number",
      "description": "Oman Rial"
    },
    "money/pen": {
      "type": "number",
      "description": "Peru Nuevo Sol"
    },
    "money/pgk": {
      "type": "number"
    },
    "money/php": {
      "type": "number",
      "description": "Philippines Peso"
    },
    "money/pkr": {
      "type": "number",
      "description": "Pakistan Rupee"
    },
    "money/pln": {
      "type": "number",
      "description": "Poland Zloty"
    },
    "money/pyg": {
      "type": "number",
      "description": "Paraguay Guarani"
    },
    "money/qar": {
      "type": "number",
      "description": "Qatar Riyal"
    },
    "money/ron": {
      "type": "number",
      "description": "Romania New Leu"
    },
    "money/rsd": {
      "type": "number",
      "description": "Serbia Dinar"
    },
    "money/rub": {
      "type": "number",
      "description": "Russia Ruble"
    },
    "money/sar": {
      "type": "number",
      "description": "Saudi Arabia Riyal"
    },
    "money/scr": {
      "type": "number",
      "description": "Seychelles Rupee"
    },
    "money/sek": {
      "type": "number",
      "description": "Sweden Krona"
    },
    "money/sgd": {
      "type": "number",
      "description": "Singapore Dollar"
    },
    "money/skk": {
      "type": "number"
    },
    "money/sll": {
      "type": "number"
    },
    "money/svc": {
      "type": "number",
      "description": "El Salvador Colon"
    },
    "money/thb": {
      "type": "number",
      "description": "Thailand Baht"
    },
    "money/tnd": {
      "type": "number"
    },
    "money/try": {
      "type": "number",
      "description": "Turkey Lira"
    },
    "money/ttd": {
      "type": "number",
      "description": "Trinidad and Tobago Dollar"
    },
    "money/twd": {
      "type": "number",
      "description": "Taiwan New Dollar"
    },
    "money/tzs": {
      "type": "number"
    },
    "money/uah": {
      "type": "number",
      "description": "Ukraine Hryvna"
    },
    "money/ugx": {
      "type": "number"
    },
    "money/usd": {
      "type": "number",
      "description": "United States Dollar"
    },
    "money/uyu": {
      "type": "number",
      "description": "Uruguay Peso"
    },
    "money/uzs": {
      "type": "number",
      "description": "Uzbekistan Som"
    },
    "money/vnd": {
      "type": "number",
      "description": "Viet Nam Dong"
    },
    "money/yer": {
      "type": "number",
      "description": "Yemen Rial"
    },
    "money/zar": {
      "type": "number",
      "description": "South Africa Rand"
    },
    "money/zmk": {
      "type": "number"
    },
    "money/btc": {
      "description": "Bitcoin",
      "type": "number"
    },
    "money/all": {
      "description": "Albania Lek",
      "type": "number"
    },
    "money/afn": {
      "description": "Afghanistan Afghani",
      "type": "number"
    },
    "money/awg": {
      "description": "Aruba Guilder",
      "type": "number"
    },
    "money/azn": {
      "description": "Azerbaijan New Manat",
      "type": "number"
    },
    "money/bsd": {
      "description": "Bahamas Dollar",
      "type": "number"
    },
    "money/bbd": {
      "description": "Barbados Dollar",
      "type": "number"
    },
    "money/byr": {
      "description": "Belarus Ruble",
      "type": "number"
    },
    "money/bzd": {
      "description": "Belize Dollar",
      "type": "number"
    },
    "money/bmd": {
      "description": "Bermuda Dollar",
      "type": "number"
    },
    "money/bam": {
      "description": "Bosnia and Herzegovina Convertible Marka",
      "type": "number"
    },
    "money/khr": {
      "description": "Cambodia Riel",
      "type": "number"
    },
    "money/cup": {
      "description": "Cuba Peso",
      "type": "number"
    },
    "money/xcd": {
      "description": "East Caribbean Dollar",
      "type": "number"
    },
    "money/fkp": {
      "description": "Falkland Islands (Malvinas) Pound",
      "type": "number"
    },
    "money/ghc": {
      "description": "Ghana Cedis",
      "type": "number"
    },
    "money/gip": {
      "description": "Gibraltar Pound",
      "type": "number"
    },
    "money/gtq": {
      "description": "Guatemala Quetzal",
      "type": "number"
    },
    "money/ggp": {
      "description": "Guernsey Pound",
      "type": "number"
    },
    "money/gyd": {
      "description": "Guyana Dollar",
      "type": "number"
    },
    "money/isk": {
      "description": "Iceland Krona",
      "type": "number"
    },
    "money/irr": {
      "description": "Iran Rial",
      "type": "number"
    },
    "money/imp": {
      "description": "Isle of Man Pound",
      "type": "number"
    },
    "money/jep": {
      "description": "Jersey Pound",
      "type": "number"
    },
    "money/kpw": {
      "description": "Korea (North) Won",
      "type": "number"
    },
    "money/kgs": {
      "description": "Kyrgyzstan Som",
      "type": "number"
    },
    "money/lak": {
      "description": "Laos Kip",
      "type": "number"
    },
    "money/lrd": {
      "description": "Liberia Dollar",
      "type": "number"
    },
    "money/mnt": {
      "description": "Mongolia Tughrik",
      "type": "number"
    },
    "money/mzn": {
      "description": "Mozambique Metical",
      "type": "number"
    },
    "money/pab": {
      "description": "Panama Balboa",
      "type": "number"
    },
    "money/shp": {
      "description": "Saint Helena Pound",
      "type": "number"
    },
    "money/sbd": {
      "description": "Solomon Islands Dollar",
      "type": "number"
    },
    "money/sos": {
      "description": "Somalia Shilling",
      "type": "number"
    },
    "money/srd": {
      "description": "Suriname Dollar",
      "type": "number"
    },
    "money/syp": {
      "description": "Syria Pound",
      "type": "number"
    },
    "money/trl": {
      "description": "Turkey Lira",
      "type": "number"
    },
    "money/tvd": {
      "description": "Tuvalu Dollar",
      "type": "number"
    },
    "money/vef": {
      "description": "Venezuela Bolivar",
      "type": "number"
    },
    "money/zwd": {
      "description": "Zimbabwe Dollar",
      "type": "number"
    },
    "mood/rating": {
      "description": "Rating of mood (float value) 0:worst -> 1:best",
      "type": "number",
      "minimum": 0,
      "maximum": 1
    },
    "mood/emoticon": {
      "description": "ASCII Art emoticon",
      "type": "string"
    },
    "music/basic": {
      "description": "Inspired from id3 key/pair",
      "type": "object",
      "properties": {
        "title": {
          "type": "string"
        },
        "artist": {
          "type": "string"
        },
        "album": {
          "type": "string"
        },
        "track": {
          "type": "integer"
        },
        "year": {
          "type": "integer"
        },
        "genre": {
          "type": "string"
        }
      }
    },
    "music/soundcloud": {
      "description": "See [Soundcloud track properties](http://developers.soundcloud.com/docs/api/reference#tracks).",
      "type": "object",
      "additionalProperties": true,
      "properties": {
        "id": {
          "type": "integer"
        }
      },
      "required": [
        "id"
      ]
    },
    "note/html": {
      "description": "An HTML-formatted note.",
      "type": "string",
      "maxLength": 4194304
    },
    "note/txt": {
      "description": "A plain-text note.",
      "type": "string",
      "maxLength": 4194304
    },
    "note/webclip": {
      "description": "An HTML-formatted note associated to its source URL.",
      "type": "object",
      "properties": {
        "url": {
          "type": "string",
          "pattern": "^(https?)://.+$"
        },
        "content": {
          "description": "An HTML-formatted string.",
          "type": "string",
          "maxLength": 4194304
        }
      },
      "required": [
        "url"
      ]
    },
    "numset/*": {
      "description": "The format key is freely defined.\n\nFor example, a heart measurement with type `numset/heart` and content:\n```\n{ \n  \"systolic\": { \"pressure/mmhg\": 105 },\n  \"diastolic\": { \"pressure/mmhg\": 64 },\n  \"rate\": { \"frequency/bpm\": 88 }\n}\n```\n\n ",
      "type": "object",
      "patternProperties": {
        "^(/[^/]+)+$": {
          "type": "number"
        }
      },
      "additionalProperties": "false",
      "required": []
    },
    "picture/base64": {
      "description": "The picture is caried in base64 (utf-8) encoded in string",
      "type": "string",
      "properties": {
        "payload": {
          "type": "string",
          "description": "base64 encoded content"
        },
        "format": {
          "type": "string",
          "description": "The data format \"gif\", \"jpeg\", \"png\", \"tiff\", \"vnd.microsoft.com\", \"svg+xml\""
        },
        "filename": {
          "description": "A filename",
          "type": "string"
        }
      },
      "required": [
        "payload",
        "format"
      ]
    },
    "picture/attached": {
      "description": "The picture is the image file attached to the event (no explicit content defined). TODO: list accepted formats.",
      "type": "null",
      "attachmentRequired": true
    },
    "picture/url": {
      "description": "A reference to a picture file online.",
      "type": "string",
      "pattern": "^(https?)://.+$"
    },
    "position/wgs84": {
      "description": "The latest revision of the World Geodetic System (used by GPS).",
      "type": "object",
      "properties": {
        "latitude": {
          "type": "number",
          "description": "Unit: degrees north from the equator."
        },
        "longitude": {
          "type": "number",
          "description": "Unit: degrees east from the zero meridian."
        },
        "altitude": {
          "type": "number",
          "description": "Unit: meters above sea level."
        },
        "horizontalAccuracy": {
          "type": "number",
          "description": "The radius of uncertainty for latitude and longitude. Unit: meters. Negative if latitude and longitude are invalid."
        },
        "verticalAccuracy": {
          "type": "number",
          "description": "The radius of uncertainty for altitude. Unit: meters. Negative if altitude is invalid."
        },
        "speed": {
          "type": "number",
          "description": "For informational purposes only. Unit: meters / second. Negative if invalid."
        },
        "bearing": {
          "type": "number",
          "description": "Unit: degrees clockwise from north. Negative if invalid."
        }
      },
      "required": [
        "latitude",
        "longitude"
      ]
    },
    "ratio/generic": {
      "description": "Generic ratio.",
      "type": "object",
      "properties": {
        "value": {
          "type": "number"
        },
        "relativeTo": {
          "type": "number"
        }
      },
      "required": [
        "value",
        "relativeTo"
      ]
    },
    "ratio/percent": {
      "description": "A percentage value.",
      "type": "number"
    },
    "url/http": {
      "description": "An HTTP or HTTPS resource.",
      "type": "string",
      "pattern": "^(https?)://.+$"
    },
    "video/attached": {
      "description": "The video is the file attached to the event (no explicit content defined). TODO: list accepted formats.",
      "type": "null",
      "attachmentRequired": true
    },
    "video/url": {
      "description": "A reference to an video file online.",
      "type": "string",
      "pattern": "^(https?)://.+$"
    },
    "video/vimeo": {
      "description": "A Vimeo video ID.",
      "type": "string"
    },
    "video/youtube": {
      "description": "A YouTube video ID.",
      "type": "string"
    },
    "absorbed-dose/gy": {
      "description": "Gray",
      "type": "number"
    },
    "absorbed-dose-equivalent/sv": {
      "description": "Sievert",
      "type": "number"
    },
    "absorbed-dose-rate/gy-s": {
      "description": "Gray per second",
      "type": "number"
    },
    "angle/deg": {
      "description": "Degrees",
      "type": "number"
    },
    "angle/grad": {
      "description": "Grade",
      "type": "number"
    },
    "angle/rad": {
      "description": "Radians",
      "type": "number"
    },
    "angular-acceleration/rad-s2": {
      "description": "Radians per second squared",
      "type": "number"
    },
    "angular-speed/rad-s": {
      "description": "Radians per second",
      "type": "number"
    },
    "area/ac": {
      "description": "Acres (imperial)",
      "type": "number"
    },
    "area/ft2": {
      "description": "Square feet",
      "type": "number"
    },
    "area/ha": {
      "description": "Hectares",
      "type": "number"
    },
    "area/in2": {
      "description": "Square inches",
      "type": "number"
    },
    "area/km2": {
      "description": "Square kilometers",
      "type": "number"
    },
    "area/m2": {
      "description": "Square meter",
      "type": "number"
    },
    "area/mm2": {
      "description": "Square millimeters",
      "type": "number"
    },
    "area/yd2": {
      "description": "Square yards",
      "type": "number"
    },
    "area/mi2": {
      "description": "Square miles",
      "type": "number"
    },
    "capacitance/f": {
      "description": "Farad",
      "type": "number"
    },
    "catalytic-activity/kat": {
      "description": "Katal",
      "type": "number"
    },
    "count/steps": {
      "description": "Number of steps",
      "type": "number"
    },
    "count/generic": {
      "description": "For general items that demand no particular handling.",
      "type": "number"
    },
    "data-quantity/b": {
      "description": "Bytes",
      "type": "number"
    },
    "data-quantity/bits": {
      "description": "Bits",
      "type": "number"
    },
    "data-quantity/gb": {
      "description": "Gigabytes",
      "type": "number"
    },
    "data-quantity/gbits": {
      "description": "Gigabits",
      "type": "number"
    },
    "data-quantity/kb": {
      "description": "Kilobytes",
      "type": "number"
    },
    "data-quantity/kbits": {
      "description": "Kilobits",
      "type": "number"
    },
    "data-quantity/mb": {
      "description": "Megabytes",
      "type": "number"
    },
    "data-quantity/mbits": {
      "description": "Megabits",
      "type": "number"
    },
    "data-quantity/tb": {
      "description": "Terabytes",
      "type": "number"
    },
    "density/g-dl": {
      "description": "Grams per deciliter",
      "type": "number"
    },
    "density/kg-m3": {
      "description": "Kilograms per cubic meter",
      "type": "number"
    },
    "density/mmol-l": {
      "description": "Millimoles per liter",
      "type": "number"
    },
    "density/mg-dl": {
      "description": "Milligrams per deciliter",
      "type": "number"
    },
    "dynamic-viscosity/pa-s": {
      "description": "Pascal second",
      "type": "number"
    },
    "electric-charge/c": {
      "description": "Coulomb ",
      "type": "number"
    },
    "electric-charge-line-density/c-m": {
      "description": "Coulomb per meter",
      "type": "number"
    },
    "electric-current/a": {
      "description": "Ampere",
      "type": "number"
    },
    "electrical-conductivity/s": {
      "description": "Siemens",
      "type": "number"
    },
    "electromotive-force/v": {
      "description": "Volt",
      "type": "number"
    },
    "energy/btu": {
      "description": "British Thermal Units",
      "type": "number"
    },
    "energy/cal": {
      "description": "Calories",
      "type": "number"
    },
    "energy/ev": {
      "description": "Electron-Volts",
      "type": "number"
    },
    "energy/erg": {
      "description": "Ergs",
      "type": "number"
    },
    "energy/ftlb": {
      "description": "Foot-Pounds",
      "type": "number"
    },
    "energy/j": {
      "description": "Joules",
      "type": "number"
    },
    "energy/kcal": {
      "description": "Kilo-calories",
      "type": "number"
    },
    "energy/ws": {
      "description": "Watt-seconds",
      "type": "number"
    },
    "energy/kwh": {
      "description": "Kilowatt-hours",
      "type": "number"
    },
    "energy/nm": {
      "description": "Newton-meters",
      "type": "number"
    },
    "energy/wh": {
      "description": "Watt-hours",
      "type": "number"
    },
    "force/dyn": {
      "description": "Dynes",
      "type": "number"
    },
    "force/n": {
      "description": "Newtons",
      "type": "number"
    },
    "force/pdl": {
      "description": "Poundals",
      "type": "number"
    },
    "frequency/bpm": {
      "description": "Beats per minute",
      "type": "number"
    },
    "frequency/ghz": {
      "description": "Gigahertz",
      "type": "number"
    },
    "frequency/hz": {
      "description": "Hertz (also known as cycles per second) ",
      "type": "number"
    },
    "frequency/khz": {
      "description": "Kilohertz",
      "type": "number"
    },
    "frequency/megahz": {
      "description": "Megahertz",
      "type": "number"
    },
    "frequency/millihz": {
      "description": "Millihertz",
      "type": "number"
    },
    "frequency/nhz": {
      "description": "Nanohertz",
      "type": "number"
    },
    "frequency/rpm": {
      "description": "Revolutions per minute",
      "type": "number"
    },
    "frequency/thz": {
      "description": "Terahertz",
      "type": "number"
    },
    "frequency/uhz": {
      "description": "Microhertz",
      "type": "number"
    },
    "length/cm": {
      "description": "Centimeters",
      "type": "number"
    },
    "length/m": {
      "description": "Meters",
      "type": "number"
    },
    "length/mm": {
      "description": "Millimeters",
      "type": "number"
    },
    "length/km": {
      "description": "Kilometers",
      "type": "number"
    },
    "length/a": {
      "description": "Ångströms",
      "type": "number"
    },
    "length/au": {
      "description": "Astronomical units",
      "type": "number"
    },
    "length/ch": {
      "description": "Chains",
      "type": "number"
    },
    "length/lea": {
      "description": "Leagues",
      "type": "number"
    },
    "length/ft": {
      "description": "Feet",
      "type": "number"
    },
    "length/in": {
      "description": "Inches",
      "type": "number"
    },
    "length/ly": {
      "description": "Light-years",
      "type": "number"
    },
    "length/mil": {
      "description": "Mil",
      "type": "number"
    },
    "length/mi": {
      "description": "Miles",
      "type": "number"
    },
    "length/fur": {
      "description": "Furlongs",
      "type": "number"
    },
    "length/nmi": {
      "description": "Miles (nautical)",
      "type": "number"
    },
    "length/p": {
      "description": "Points",
      "type": "number"
    },
    "length/pica": {
      "description": "Picas",
      "type": "number"
    },
    "length/ftm": {
      "description": "Fathoms",
      "type": "number"
    },
    "length/cb": {
      "description": "Cables",
      "type": "number"
    },
    "length/um": {
      "description": "Microns",
      "type": "number"
    },
    "length/yd": {
      "description": "Yards",
      "type": "number"
    },
    "luminous-intensity/cd": {
      "description": "Candela",
      "type": "number"
    },
    "mass/kg": {
      "description": "Kilograms",
      "type": "number"
    },
    "mass/gr": {
      "description": "Grains",
      "type": "number"
    },
    "mass/dr": {
      "description": "Drams",
      "type": "number"
    },
    "mass/g": {
      "description": "Grams",
      "type": "number"
    },
    "mass/l-t": {
      "description": "Long tons",
      "type": "number"
    },
    "mass/lb": {
      "description": "Pounds",
      "type": "number"
    },
    "mass/t": {
      "description": "Metric tons",
      "type": "number"
    },
    "mass/oz": {
      "description": "Ounces",
      "type": "number"
    },
    "mass/s-t": {
      "description": "Short tons",
      "type": "number"
    },
    "mass/st": {
      "description": "Stone",
      "type": "number"
    },
    "mol/mol": {
      "description": "Mole ",
      "type": "number"
    },
    "mol/lb-mol": {
      "description": "Pound-mole.",
      "type": "number"
    },
    "power/btu-min": {
      "description": "BTUs/minute",
      "type": "number"
    },
    "power/ftlb-s": {
      "description": "Foot-pounds/second",
      "type": "number"
    },
    "power/hp": {
      "description": "Horsepower",
      "type": "number"
    },
    "power/kw": {
      "description": "Kilowatts",
      "type": "number"
    },
    "power/w": {
      "description": "Watts",
      "type": "number"
    },
    "pressure/at": {
      "description": "Atmospheres",
      "type": "number"
    },
    "pressure/bar": {
      "description": "Bars",
      "type": "number"
    },
    "pressure/mmhg": {
      "description": "Millimeters of mercury",
      "type": "number"
    },
    "pressure/cmhg": {
      "description": "Centimeters of mercury",
      "type": "number"
    },
    "pressure/inhg": {
      "description": "Inches of mercury",
      "type": "number"
    },
    "pressure/kg-m2": {
      "description": "Kilograms/square meter",
      "type": "number"
    },
    "pressure/pa": {
      "description": "Pascals",
      "type": "number"
    },
    "pressure/kpa": {
      "description": "Kilo pascals",
      "type": "number"
    },
    "pressure/psf": {
      "description": "Pounds/square foot",
      "type": "number"
    },
    "pressure/psi": {
      "description": "Pounds/square inch",
      "type": "number"
    },
    "speed/ft-m": {
      "description": "Feet/minute",
      "type": "number"
    },
    "speed/ft-s": {
      "description": "Feet/second",
      "type": "number"
    },
    "speed/km-h": {
      "description": "Kilometers/hour",
      "type": "number"
    },
    "speed/kt": {
      "description": "Knots",
      "type": "number"
    },
    "speed/m-min": {
      "description": "Miles/minute",
      "type": "number"
    },
    "speed/m-s": {
      "description": "Meters/second",
      "type": "number"
    },
    "speed/mph": {
      "description": "Miles/hour",
      "type": "number"
    },
    "temperature/c": {
      "description": "Celsius",
      "type": "number"
    },
    "temperature/k": {
      "description": "Kelvin",
      "type": "number"
    },
    "temperature/f": {
      "description": "Fahrenheit",
      "type": "number"
    },
    "time/d": {
      "description": "Days",
      "type": "number"
    },
    "time/h": {
      "description": "Hours",
      "type": "number"
    },
    "time/min": {
      "description": "Minutes",
      "type": "number"
    },
    "time/ms": {
      "description": "Milliseconds",
      "type": "number"
    },
    "time/s": {
      "description": "Seconds",
      "type": "number"
    },
    "time/y": {
      "description": "Years",
      "type": "number"
    },
    "volume/l": {
      "description": "Liters",
      "type": "number"
    },
    "volume/m3": {
      "description": "Cubic meters",
      "type": "number"
    },
    "volume/c": {
      "description": "Cups",
      "type": "number"
    },
    "volume/cm3": {
      "description": "Cubic centimeters",
      "type": "number"
    },
    "volume/floz": {
      "description": "Fluid ounces",
      "type": "number"
    },
    "volume/ft3": {
      "description": "Cubic feet",
      "type": "number"
    },
    "volume/galgb": {
      "description": "Gallons imperial",
      "type": "number"
    },
    "volume/galus": {
      "description": "Gallons US",
      "type": "number"
    },
    "volume/in3": {
      "description": "Cubic inches",
      "type": "number"
    },
    "volume/yd3": {
      "description": "Cubic yard",
      "type": "number"
    },
    "volume/ml": {
      "description": "Milliliters",
      "type": "number"
    },
    "volume/pt": {
      "description": "Pints",
      "type": "number"
    },
    "volume/qt": {
      "description": "Quarts",
      "type": "number"
    },
    "volume/bbloil": {
      "description": "Barrels (oil)",
      "type": "number"
    },
    "volume/tbs": {
      "description": "Tablespoons",
      "type": "number"
    },
    "volume/tsp": {
      "description": "Teaspoons",
      "type": "number"
    }
  }
}
},{}],33:[function(require,module,exports){
var utility = require('./utility/utility'),
    _ = require('underscore'),
    CC = require('./connection/ConnectionConstants.js');

/**
 * Event types directory data.
 * @link http://api.pryv.com/event-types/
 */
var eventTypes = module.exports = {};

var HOSTNAME = 'api.pryv.com',
    PORT = 443,
    SSL = true,
    PATH = '/event-types/',
    FLATFILE = 'flat.json',
    EXTRASFILE = 'extras.json',
    // TODO: discuss if hierarchical data is really needed (apparently not); remove all that if not
    HIERARCHICALFILE = 'hierarchical.json';

// load default data (fallback)
var types = require('./event-types.default.json'),
    extras = require('./event-extras.default.json'),
    hierarchical = require('./event-hierarchical.default.json');
types.isDefault = true;
extras.isDefault = true;

/**
 * @link http://api.pryv.com/event-types/#json-file
 * @param {Function} callback
 */
eventTypes.loadFlat = function (callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  _requestFile(FLATFILE, function (err, result) {
    if (err) { return callback(err); }
    if (! isValidTypesFile(result)) {
      return callback(new Error('Missing or corrupt types file: "' +
                                HOSTNAME + PATH + FLATFILE + '"'));
    }
    _.extend(types, result);
    types.isDefault = false;
    callback(null, types);
  });
};

/**
 * Performs a basic check to avoid corrupt data (more smoke test than actual validation).
 * @param {Object} data
 */
function isValidTypesFile(data) {
  return data && data.version && data.types && data.types['activity/plain'];
}

eventTypes.flat = function (eventType) {
  return types.types[eventType];
};

/**
 * @link http://api.pryv.com/event-types/#json-file
 * @param {Function} callback
 */
eventTypes.loadExtras = function (callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  _requestFile(EXTRASFILE, function (err, result) {
    if (err) { return callback(err); }
    if (! isValidExtrasFile(result)) {
      return callback(new Error('Missing or corrupt extras file: "' +
                                HOSTNAME + PATH + EXTRASFILE + '"'));
    }
    _.extend(extras, result);
    extras.isDefault = false;
    callback(null, extras);
  });
};

/**
 * Performs a basic check to avoid corrupt data (more smoke test than actual validation).
 * @param {Object} data
 */
function isValidExtrasFile(data) {
  return data && data.version && data.extras && data.extras.count && data.extras.count.formats;
}

eventTypes.hierarchical = function () {
  return hierarchical;
};

eventTypes.extras = function (eventType) {
  var parts = eventType.split('/');
  return extras.extras[parts[0]] && extras.extras[parts[0]].formats[parts[1]] ?
      extras.extras[parts[0]].formats[parts[1]] : null;
};

eventTypes.isNumerical = function (eventOrEventType) {
  if (! eventOrEventType) { return false; }
  var type;
  if (eventOrEventType.type) {
    type = eventOrEventType.type;
  } else {
    type = eventOrEventType;
  }
  var def = eventTypes.flat(type);
  return def ? def.type === 'number' : false;
};

/**
 * @link http://api.pryv.com/event-types/#json-file
 * @param {Function} callback
 */
eventTypes.loadHierarchical = function (callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  _requestFile(HIERARCHICALFILE, function (err, result) {
    if (err) { return callback(err); }
    hierarchical = result;
    hierarchical.isDefault = false;
    callback(null, hierarchical);
  });
};

/**
 * @private
 * @param fileName
 * @param callback
 */
function _requestFile(fileName, callback) {
  utility.request({
    method : 'GET',
    host : HOSTNAME,
    path : PATH + fileName,
    port : PORT,
    ssl : SSL,
    withoutCredentials: true,
    success : function (result) { callback(null, result); },
    error : function (error) { callback(error, null); }
  });
}

},{"./connection/ConnectionConstants.js":25,"./event-extras.default.json":30,"./event-hierarchical.default.json":31,"./event-types.default.json":32,"./utility/utility":41,"underscore":12}],34:[function(require,module,exports){
/**
 * (event)Emitter renamed to avoid confusion with prvy's events
 */


var _ = require('underscore');

var SignalEmitter = module.exports = function (messagesMap) {
  SignalEmitter.extend(this, messagesMap);
};


SignalEmitter.extend = function (object, messagesMap, name) {
  if (! name) {
    throw new Error('"name" parameter must be set');
  }
  object._signalEmitterEvents = {};
  _.each(_.values(messagesMap), function (value) {
    object._signalEmitterEvents[value] = [];
  });
  _.extend(object, SignalEmitter.prototype);
  object._signalEmitterName = name;
};


SignalEmitter.Messages = {
  /** called when a batch of changes is expected, content: <batchId> unique**/
  BATCH_BEGIN : 'beginBatch',
  /** called when a batch of changes is done, content: <batchId> unique**/
  BATCH_DONE : 'doneBatch',
  /** if an eventListener return this string, it will be removed automatically **/
  UNREGISTER_LISTENER : 'unregisterMePlease'
};

/**
 * Add an event listener
 * @param signal one of  Messages.SIGNAL.*.*
 * @param callback function(content) .. content vary on each signal.
 * If the callback returns SignalEmitter.Messages.UNREGISTER_LISTENER it will be removed
 * @return the callback function for further reference
 */
SignalEmitter.prototype.addEventListener = function (signal, callback) {
  this._signalEmitterEvents[signal].push(callback);
  return callback;
};


/**
 * remove the callback matching this signal
 */
SignalEmitter.prototype.removeEventListener = function (signal, callback) {
  for (var i = 0; i < this._signalEmitterEvents[signal].length; i++) {
    if (this._signalEmitterEvents[signal][i] === callback) {
      this._signalEmitterEvents[signal][i] = null;
    }
  }
};


/**
 * A changes occurred on the filter
 * @param signal
 * @param content
 * @param batch
 * @private
 */
SignalEmitter.prototype._fireEvent = function (signal, content, batch) {
  var batchId = batch ? batch.id : null;
  if (! signal) { throw new Error(); }

  var batchStr = batchId ? ' batch: ' + batchId + ', ' + batch.batchName : '';
  console.log('FireEvent-' + this._signalEmitterName  + ' : ' + signal + batchStr);

  _.each(this._signalEmitterEvents[signal], function (callback) {
    if (callback !== null &&
      SignalEmitter.Messages.UNREGISTER_LISTENER === callback(content, batch)) {
      this.removeEventListener(signal, callback);
    }
  }, this);
};


SignalEmitter.batchSerial = 0;
/**
 * Start a batch process
 *
 * @param batchName Name of the new batch
 * @param orHookOnBatch Existing batch to hook on ("superbatch")
 * @return A batch object (call `done()` when done)
 * @private
 */
SignalEmitter.prototype.startBatch = function (name, orHookOnBatch) {

  if (! orHookOnBatch) {
    return new Batch(name, this);
  }
  name = orHookOnBatch.name + '/' + name;
  var batch = new Batch(name, this);
  orHookOnBatch.waitForMeToFinish(name + ':hook');
  batch.addOnDoneListener(name, function () {
    orHookOnBatch.done(name + ':hook');
  });
  return batch;
};

var Batch = function (name, owner) {
  this.owner = owner;
  this.name = name || 'x';
  this.id = owner._signalEmitterName + SignalEmitter.batchSerial++;
  this.waitFor = 0;
  this.history = [];
  this.doneCallbacks = {};
  this.waitForMeToFinish(this.name);
  this.owner._fireEvent(SignalEmitter.Messages.BATCH_BEGIN, this.id, this);

};



/**
 * listener are stored in key/map fashion, so addOnDoneListener('bob',..)
 * may be called several time, callback 'bob', will be done just once
 * @param key a unique key per callback
 * @param callback
 */
Batch.prototype.addOnDoneListener = function (key, callback) {
  this.checkAlreadyDone('addOnDoneListener(' + key + ')');
  this.doneCallbacks[key] = callback;
};

Batch.prototype.waitForMeToFinish = function (key) {
  this.checkAlreadyDone('waitForMeToFinish(' + key + ')');
  this.waitFor++;
  this.history.push({wait: key, waitFor: this.waitFor});
  return this;
};

Batch.prototype.done = function (key) {
  this.checkAlreadyDone('done(' + key + ')');
  key = key || '--';
  this.waitFor--;
  this.history.push({done: key, waitFor: this.waitFor});
  if (this.waitFor === 0) {

    this.doneTriggered = true;
    _.each(this.doneCallbacks, function (callback) {
      callback();
    });
    delete this.doneCallbacks; // prevents memory leaks
    this.owner._fireEvent(SignalEmitter.Messages.BATCH_DONE, this.id, this);
  }
};

Batch.prototype.checkAlreadyDone = function (addon) {
  if (this.doneTriggered) {
    var msg = 'Batch ' + this.name + ', ' + this.id + ' called ' + addon + '  when already done';
    throw new Error(msg + '     ' + JSON.stringify(this.history));
  }
};

},{"underscore":12}],35:[function(require,module,exports){
/* jshint ignore:start */

/*\
 |*|
 |*|  :: cookies.js ::
 |*|
 |*|  A complete cookies reader/writer framework with full unicode support.
 |*|
 |*|  https://developer.mozilla.org/en-US/docs/DOM/document.cookie
 |*|
 |*|  Syntaxes:
 |*|
 |*|  * docCookies.setItem(name, value[, end[, path[, domain[, secure]]]])
 |*|  * docCookies.getItem(name)
 |*|  * docCookies.removeItem(name[, path])
 |*|  * docCookies.hasItem(name)
 |*|  * docCookies.keys()
 |*|
 \*/
module.exports = {
  getItem: function (sKey) {
    if (!sKey || !this.hasItem(sKey)) { return null; }
    return unescape(document.cookie.replace(new RegExp("(?:^|.*;\\s*)" +
        escape(sKey).replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=\\s*((?:[^;](?!;))*[^;]?).*"), "$1"));
  },
  setItem: function (sKey, sValue, vEnd, sPath, sDomain, bSecure) {
    if (!sKey || /^(?:expires|max\-age|path|domain|secure)$/i.test(sKey)) { return; }
    var sExpires = "";
    if (vEnd) {
      switch (vEnd.constructor) {
        case Number:
          sExpires = vEnd === Infinity ?
              "; expires=Tue, 19 Jan 2038 03:14:07 GMT" : "; max-age=" + vEnd;
          break;
        case String:
          sExpires = "; expires=" + vEnd;
          break;
        case Date:
          sExpires = "; expires=" + vEnd.toGMTString();
          break;
      }
    }
    document.cookie = escape(sKey) + "=" + escape(sValue) + sExpires + (sDomain ? "; domain=" + sDomain : "") + (sPath ? "; path=" + sPath : "") + (bSecure ? "; secure" : "");
  },
  removeItem: function (sKey, sPath) {
    if (!sKey || !this.hasItem(sKey)) { return; }
    document.cookie = escape(sKey) + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT" + (sPath ? "; path=" + sPath : "");
  },
  hasItem: function (sKey) {
    return (new RegExp("(?:^|;\\s*)" + escape(sKey).replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=")).test(document.cookie);
  },
  keys: /* optional method: you can safely remove it! */ function () {
    var aKeys = document.cookie.replace(/((?:^|\s*;)[^\=]+)(?=;|$)|^\s*|\s*(?:\=[^;]*)?(?:\1|$)/g, "").split(/\s*(?:\=[^;]*)?;\s*/);
    for (var nIdx = 0; nIdx < aKeys.length; nIdx++) { aKeys[nIdx] = unescape(aKeys[nIdx]); }
    return aKeys;
  }
};

},{}],36:[function(require,module,exports){
/* jshint ignore:start */

/*!
 * domready (c) Dustin Diaz 2012 - License MIT
 */
module.exports = function (ready) {


  var fns = [], fn, f = false,
      doc = document,
      testEl = doc.documentElement,
      hack = testEl.doScroll,
      domContentLoaded = 'DOMContentLoaded',
      addEventListener = 'addEventListener',
      onreadystatechange = 'onreadystatechange',
      readyState = 'readyState',
      loaded = /^loade|c/.test(doc[readyState]);

  function flush(f) {
    loaded = 1;
    while (f = fns.shift()) {
      f()
    }
  }

  doc[addEventListener] && doc[addEventListener](domContentLoaded, fn = function () {
    doc.removeEventListener(domContentLoaded, fn, f);
    flush();
  }, f);


  hack && doc.attachEvent(onreadystatechange, fn = function () {
    if (/^c/.test(doc[readyState])) {
      doc.detachEvent(onreadystatechange, fn);
      flush();
    }
  });

  return (ready = hack ?
      function (fn) {
        self != top ?
            loaded ? fn() : fns.push(fn) :
            function () {
              console.log("on dom ready 2");
              try {
                testEl.doScroll('left')
              } catch (e) {
                return setTimeout(function() { ready(fn) }, 50)
              }
              fn()
            }()
      } :
      function (fn) {
        loaded ? fn() : fns.push(fn)
      })
}();

},{}],37:[function(require,module,exports){
/**
 * Common regexps
 * TODO: fix naming to "commonRegexps", "Username" and "Email" (they are constants)
 */
module.exports = {
  username :  /^([a-zA-Z0-9])(([a-zA-Z0-9\-]){3,21})([a-zA-Z0-9])$/,
  email : /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/
};

},{}],38:[function(require,module,exports){
/**
 *
 * @param {Object} pack json with
 * @param {Object} [pack.type = 'POST'] : 'GET/DELETE/POST/PUT'
 * @param {String} pack.host : fully qualified host name
 * @param {Number} pack.port : port to use
 * @param {String} pack.path : the request PATH
 * @param {Object} [pack.headers] : key / value map of headers
 * @param {Object} [pack.params] : the payload -- only with POST/PUT
 * @param {String} [pack.parseResult = 'json'] : 'text' for no parsing
 * @param {Function} pack.success : function (result, resultInfo)
 * @param {Function} pack.error : function (error, resultInfo)
 * @param {String} [pack.info] : a text
 * @param {Boolean} [pack.async = true]
 * @param {Number} [pack.expectedStatus] : http result code
 * @param {Boolean} [pack.ssl = true]
 * @param {Boolean} [pack.withoutCredentials = false]
 */
module.exports = function (pack)  {
  pack.info = pack.info || '';
  var parseResult = pack.parseResult || 'json';

  if (!pack.hasOwnProperty('async')) {
    pack.async = true;
  }

  // ------------ request TYPE
  pack.method = pack.method || 'POST';
  // method override test
  if (false && pack.method === 'DELETE') {
    pack.method = 'POST';
    pack.params =  pack.params || {};
    pack.params._method = 'DELETE';
  }

  // ------------- request HEADERS


  pack.headers = pack.headers || {};

  if (pack.method === 'POST' || pack.method === 'PUT') {// add json headers is POST or PUT

    if (pack.headers['Content-Type'] === 'multipart/form-data') {
      delete pack.headers['Content-Type'];
    } else {
      pack.headers['Content-Type'] =
          pack.headers['Content-Type'] || 'application/json; charset=utf-8';
    }

    //if (pack.method === 'POST') {
    if (pack.params) {
      pack.params = JSON.stringify(pack.params);
    } else {
      pack.params = pack.payload || {};
    }
  }



  // -------------- error
  pack.error = pack.error || function (error) {
    throw new Error(JSON.stringify(error, function (key, value) {
      if (value === null) { return; }
      if (value === '') { return; }
      return value;
    }, 2));
  };

  var detail = pack.info + ', req: ' + pack.method + ' ' + pack.url;

  // --------------- request
  var xhr = _initXHR(),
      httpMode = pack.ssl ? 'https://' : 'http://',
      url = httpMode + pack.host + pack.path;
  xhr.open(pack.method, url, pack.async);
  xhr.withCredentials = pack.withoutCredentials ? false : true;


  xhr.onreadystatechange = function () {
    detail += ' xhrstatus:' + xhr.statusText;
    if (xhr.readyState === 0) {
      pack.callBackSent = 'error in request';
      pack.error({
        message: 'pryvXHRCall unsent',
        detail: detail,
        id: 'INTERNAL_ERROR',
        xhr: xhr
      });
    } else if (xhr.readyState === 4) {
      var result = null;

      if (parseResult === 'json') {
        var response = xhr.responseText;
        response = response.trim() === '' ? '{}' : response;
        try { result = JSON.parse(response); } catch (e) {
          return pack.error({
            message: 'Data is not JSON',
            detail: xhr.responseText + '\n' + detail,
            id: 'RESULT_NOT_JSON',
            xhr: xhr
          });
        }
      }
      var resultInfo = {
        xhr : xhr,
        code : xhr.status,
        headers : parseResponseHeaders(xhr.getAllResponseHeaders())
      };

      if (pack.callBackSent) {
        console.error('xhr.onreadystatechange called with status==4 even if callback is done:' +
          pack.callBackSent);
        return;
      }
      pack.callBackSent = 'success';
      pack.success(result, resultInfo);
    }
  };
  if (pack.progressCallback && typeof(pack.progressCallback) === 'function') {
    xhr.upload.addEventListener('progress', function (e) {
      return pack.progressCallback(e);
    }, false);
  }
  for (var key in pack.headers) {
    if (pack.headers.hasOwnProperty(key)) {
      xhr.setRequestHeader(key, pack.headers[key]);
    }
  }

  //--- sending the request
  try {
    xhr.send(pack.params);
  } catch (e) {
    pack.callBackSent = 'error sending request';
    return pack.error({
      message: 'pryvXHRCall unsent',
      detail: detail,
      id: 'INTERNAL_ERROR',
      error: e,
      xhr: xhr
    });
  }
  return xhr;
};

/**
 * Method to initialize XMLHttpRequest.
 * @method _initXHR
 * @access private
 * @return object
 */
/* jshint -W117 */
var _initXHR = function () {
  var XHR = null;

  try { XHR = new XMLHttpRequest(); }
  catch (e) {
    try { XHR = new ActiveXObject('Msxml2.XMLHTTP'); }
    catch (e2) {
      try { XHR = new ActiveXObject('Microsoft.XMLHTTP'); }
      catch (e3) {
        console.log('XMLHttpRequest implementation not found.');
      }
      console.log('XMLHttpRequest implementation not found.');
    }
    console.log('XMLHttpRequest implementation not found.');
  }
  return XHR;
};


/**
 * XmlHttpRequest's getAllResponseHeaders() method returns a string of response
 * headers according to the format described here:
 * http://www.w3.org/TR/XMLHttpRequest/#the-getallresponseheaders-method
 * This method parses that string into a user-friendly key/value pair object.
 */
function parseResponseHeaders(headerStr) {
  var headers = {};
  if (!headerStr) {
    return headers;
  }
  var headerPairs = headerStr.split('\u000d\u000a');
  for (var i = 0; i < headerPairs.length; i++) {
    var headerPair = headerPairs[i];
    // Can't use split() here because it does the wrong thing
    // if the header value has the string ": " in it.
    var index = headerPair.indexOf('\u003a\u0020');
    if (index > 0) {
      var key = headerPair.substring(0, index).toLowerCase();
      var val = headerPair.substring(index + 2);
      headers[key] = val;
    }
  }
  return headers;
}

},{}],39:[function(require,module,exports){
/* global document */

var urls = module.exports = {};

/**
 * The one and only reference for Pryv domain names.
 * TODO: client and server will merge
 */
urls.defaultDomain = 'pryv.io';


/* jshint -W101 */
/**
 * Extracts base components from a browser URL string
 * (e.g. today: "https://username.pryv.me:443/some/path").
 *
 * @param url Defaults to `document.location` if available
 * @returns {URLInfo}
 */
urls.parseClientURL = function (url) {
  return new URLInfo(url, 'client');
};

/**
 * Extracts base components from a standard Pryv API URL string
 * (e.g. "https://username.pryv.io:443/some/path").
 *
 * @param url
 * @returns {URLInfo}
 */
urls.parseServerURL = function (url) {
  return new URLInfo(url, 'server');
};

/**
 * @param {String} url
 * @param {String} type "client" or "server"
 * @constructor
 */
function URLInfo(url, type) {
  var loc;
  if (typeof document !== 'undefined') {
    // browser
    if (url) {
      loc = document.createElement('a');
      loc.href = url;
    } else {
      loc = document.location;
    }
  } else {
    // node
    if (! url) {
      throw new Error('`url` is required');
    }
    loc = require('url').parse(url);
  }
  if (! (type === 'client' || type === 'server')) {
    throw new Error('`type` must be either "client" or "server"');
  }
  this.type = type;

  this.protocol = loc.protocol;
  this.hostname = loc.hostname;
  this.port = loc.port || (this.protocol === 'https:' ? 443 : 80);
  this.path = loc.pathname;
  this.hash = loc.hash;
  this.search = loc.search;

  var splitHostname = loc.hostname.split('.');
  if (splitHostname.length >= 3 /* TODO: check & remove, shouldn't be necessary && splitHostname[0].match(this.regex.username)*/) {
    this.username = splitHostname[0];
  }
  this.domain = loc.hostname.substr(loc.hostname.indexOf('.') + 1);

}

URLInfo.prototype.isSSL = function () {
  return this.protocol === 'https:';
};

URLInfo.prototype.parseQuery = function () {
  var objURL = {};
  this.search.replace(new RegExp('([^?=&]+)(=([^&]*))?', 'g'), function ($0, $1, $2, $3) {
    objURL[$1] = $3;
  });
  return objURL;
};

URLInfo.prototype.parseSharingTokens = function () {
  if (this.type !== 'client') {
    throw new Error('Can only parse on client URLs');
  }
  var splitPath = this.hash.split('/');
  var sharingsIndex = splitPath.indexOf('sharings');
  if (sharingsIndex !== -1) {
    return splitPath.splice(sharingsIndex + 1).filter(function (s) { return s.length > 0; });
  } else {
    return [];
  }
};

},{"url":8}],40:[function(require,module,exports){
/* global document, navigator */

/**
 * Browser-only utils
 */
var utility = module.exports = {};

utility.getHostFromUrl = function (url) {
  var location;
  if (url) {
    location = document.createElement('a');
    location.href = url;
  } else {
    location = document.location;
  }
  return location.hostname;
};

utility.getPortFromUrl = function (url) {
  var location;
  if (url) {
    location = document.createElement('a');
    location.href = url;
  } else {
    location = document.location;
  }
  return location.port === '' ? null : location.port;
};

utility.isUrlSsl = function (url) {
  var location;
  if (url) {
    location = document.createElement('a');
    location.href = url;
  } else {
    location = document.location;
  }
  return location.protocol === 'https:';
};

/**
 *  List grabbed from
 *  https://github.com/codefuze/js-mobile-tablet-redirect/blob/master/mobile-redirect.js
 *
 *  @return {Boolean} `true` if browser is seen as a mobile or tablet
 */
utility.browserIsMobileOrTablet = function () {
  /* jshint -W101*/
  return (/iphone|ipod|android|blackberry|opera mini|opera mobi|skyfire|maemo|windows phone|palm|iemobile|symbian|symbianos|fennec|ipad|android 3|sch-i800|playbook|tablet|kindle|gt-p1000|sgh-t849|shw-m180s|a510|a511|a100|dell streak|silk/i.test(navigator.userAgent.toLowerCase()));
};

/**
 * Method to get the preferred language, either from desiredLanguage or from the browser settings
 * @method getPreferredLanguage
 * @param {Array} supportedLanguages an array of supported languages encoded on 2characters
 * @param {String} desiredLanguage (optional) get this language if supported
 */
utility.getPreferredLanguage = function (supportedLanguages, desiredLanguage) {
  if (desiredLanguage) {
    if (supportedLanguages.indexOf(desiredLanguage) >= 0) { return desiredLanguage; }
  }
  var lct = null;
  if (navigator.language) {
    lct = navigator.language.toLowerCase().substring(0, 2);
  } else if (navigator.userLanguage) {
    lct = navigator.userLanguage.toLowerCase().substring(0, 2);
  } else if (navigator.userAgent.indexOf('[') !== -1) {
    var start = navigator.userAgent.indexOf('[');
    var end = navigator.userAgent.indexOf(']');
    lct = navigator.userAgent.substring(start + 1, end).toLowerCase();
  }
  if (desiredLanguage) {
    if (lct.indexOf(desiredLanguage) >= 0) { return lct; }
  }

  return supportedLanguages[0];
};


/**
 * //TODO check if it's robust
 * Method to check the browser supports CSS3.
 * @method supportCSS3
 * @return boolean
 */
utility.supportCSS3 = function ()  {
  var stub = document.createElement('div'),
    testProperty = 'textShadow';

  if (testProperty in stub.style) { return true; }

  testProperty = testProperty.replace(/^[a-z]/, function (val) {
    return val.toUpperCase();
  });

  return false;
};

/**
 * Method to load external files like javascript and stylesheet. this version
 * of method only support to file types - js|javascript and css|stylesheet.
 *
 * @method loadExternalFiles
 * @param {String} filename
 * @param {String} type 'js' or 'css'
 */
utility.loadExternalFiles = function (filename, type)  {
  var tag = null;

  type = type.toLowerCase();

  if (type === 'js' || type === 'javascript') {
    tag = document.createElement('script');
    tag.setAttribute('type', 'text/javascript');
    tag.setAttribute('src', filename);
  } else if (type === 'css' || type === 'stylesheet')  {
    tag = document.createElement('link');
    tag.setAttribute('rel', 'stylesheet');
    tag.setAttribute('type', 'text/css');
    tag.setAttribute('href', filename);
  }

  if (tag !== null || tag !== undefined) {
    document.getElementsByTagName('head')[0].appendChild(tag);
  }
};

utility.docCookies = require('./docCookies');

utility.domReady = require('./domReady');

utility.request = require('./request-browser');

},{"./docCookies":35,"./domReady":36,"./request-browser":38}],41:[function(require,module,exports){
var socketIO = require('socket.io-client'),
    _ = require('underscore');

var utility = module.exports = {};

/**
 * @returns {Boolean} `true` if we're in a web browser environment
 */
utility.isBrowser = function () {
  return typeof(window) !== 'undefined';
};

utility.SignalEmitter = require('./SignalEmitter.js');

/**
 * Merges two object (key/value map) and remove "null" properties
 *
 * @param {Object} sourceA
 * @param {Object} sourceB
 * @returns {*|Block|Node|Tag}
 */
utility.mergeAndClean = function (sourceA, sourceB) {
  sourceA = sourceA || {};
  sourceB = sourceB || {};
  var result = _.clone(sourceA);
  _.extend(result, sourceB);
  _.each(_.keys(result), function (key) {
    if (result[key] === null) { delete result[key]; }
  });
  return result;
};

/**
 * Creates a query string from an object (key/value map)
 *
 * @param {Object} data
 * @returns {String} key1=value1&key2=value2....
 */
utility.getQueryParametersString = function (data) {
  data = this.mergeAndClean(data);
  return Object.keys(data).map(function (key) {
    if (data[key] !== null) {
      if (_.isArray(data[key])) {
        data[key] = this.mergeAndClean(data[key]);
        var keyE = encodeURIComponent(key + '[]');
        return data[key].map(function (subData) {
          return keyE + '=' + encodeURIComponent(subData);
        }).join('&');
      } else {
        return encodeURIComponent(key) + '=' + encodeURIComponent(data[key]);
      }
    }
  }, this).join('&');
};

utility.regex = require('./regex');

/**
 * Cross-platform string endsWith
 *
 * @param {String} string
 * @param {String} suffix
 * @returns {Boolean}
 */
utility.endsWith = function (string, suffix) {
  return string.indexOf(suffix, string.length - suffix.length) !== -1;
};

utility.ioConnect = function (settings) {
  var httpMode = settings.ssl ? 'https' : 'http';
  var url = httpMode + '://' + settings.host + ':' + settings.port + '' +
      settings.path + '?auth=' + settings.auth + '&resource=' + settings.namespace;

  return socketIO.connect(url, {'force new connection': true});
};

utility.urls = require('./urls');

// platform-specific members
_.extend(utility, utility.isBrowser() ?
    require('./utility-browser.js') : require('./utility-node.js'));

},{"./SignalEmitter.js":34,"./regex":37,"./urls":39,"./utility-browser.js":40,"./utility-node.js":1,"socket.io-client":11,"underscore":12}],"pryv":[function(require,module,exports){
module.exports = {
  // TODO: fix singleton (see with me [sgoumaz] if needed)
  Auth: require('./auth/Auth.js'),
  Connection: require('./Connection.js'),
  Event: require('./Event.js'),
  Stream: require('./Stream.js'),
  Filter: require('./Filter.js'),

  eventTypes: require('./eventTypes.js'),
  utility: require('./utility/utility.js'),
  MESSAGES: {
    MONITOR: require('./Monitor.js').Messages
  }
};

},{"./Connection.js":13,"./Event.js":15,"./Filter.js":16,"./Monitor.js":17,"./Stream.js":18,"./auth/Auth.js":21,"./eventTypes.js":33,"./utility/utility.js":41}]},{},["pryv"])("pryv")
});