# Install the library

## Node.js / Browserify</h6>

Install the module...

```bash
npm install pryv --save
```

...then require it in your JS:

```javascript
var pryv = require('pryv');
```

## Browser

[Download](https://api.pryv.com/lib-javascript/latest/pryv.js) then include the library file:

```html
<script type="text/javascript" src="pryv.js"></script>
```

Or direct link to latest version:

```html
<script type="text/javascript" src="https://api.pryv.com/lib-javascript/latest/pryv.js"></script>
```

# Authorize your app

First choose an app identifier (min. length 6 chars), then in your client code:

```html
<!-- Add the "Pryv" auth button somewhere (skip this for custom UI/behavior) -->
<span id="pryv-button"></span>
```

```javascript
var credentials = null;
var pryvDomain = 'pryv.me';
var requestedPermissions = [
  {
    // Here we request full permissions on a custom stream;
    // in practice, scope and permission level will vary depending on your needs
    streamId: 'example-app-id',
    defaultName: 'Example app',
    level: 'manage'
  }
];

var settings = {
  requestingAppId: 'example-app-id',
  requestedPermissions: requestedPermissions,
  spanButtonID: 'pryv-button',
  callbacks: {
    initialization: function() {
      // ...
    },
    needSignin: function(popupUrl, pollUrl, pollRateMs) {
      // ...
    },
    signedIn: function(authData) {
      credentials = authData;
      // ...
    },
    refused: function(code) {
      // ...
    },
    error: function(code, message) {
      // ...
    }
  }
};

pryv.Auth.config.registerURL.host = 'reg.' + pryvDomain;
pryv.Auth.setup(settings);
```

See also: [App authorization](/reference/#authorizing-your-app)

# Connect to the account

```javascript
var connection = new pryv.Connection(credentials);
```

# Fetch the stream structure and access info

```javascript
// This is mandatory for Monitors;
// Fetches the stream structure
connection.fetchStructure(function(err, streams) {
  // ...
});
// Retrieves the name, type and permissions of the access in use (optional)
connection.accessInfo(function(err, info) {
  // ...
});
```

# Manage events

## Retrieve

```javascript
var filter = new pryv.Filter({ limit: 10 });
connection.events.get(filter, function(err, events) {
  // ...
});
```

## Create

```javascript
var event = {
  streamId: 'valid-stream-id',
  type: 'note/txt',
  content: 'This is an example.'
};

connection.events.create(event, function(err, eventCreated) {
  // ...
});
```

## Create with attachment

```javascript
var fs = require('fs');

var event = {
  type: 'picture/attached',
  streamId: 'valid-stream-id',
  description: 'This is a description.'
};
var pictureData = fs.readFileSync('pathToFile/image.jpg');
var formData = pryv.utility.forgeFormData('attachment-id', pictureData, {
  type: 'image/jpg',
  filename: 'attachment'
});

connection.events.createWithAttachment(event, formData, function(err, event) {
  // ...
});
```

See also: [More about types](/event-types/)

## Update

```javascript
event.content = 'This is an update.';
connection.events.update(event, function(err, eventUpdated) {
  // ...
});
```

## Delete

```javascript
connection.events.delete(event, function(err, eventDeleted) {
  // ...
});
```

# Manage streams

## Retrieve

```javascript
var options;

// Here we will get all streams (including root and trashed streams)
options = {
  // If null, retrieve active (non-trashed) streams only
  state: 'all'
};

// Same as above but in a selected stream
options = {
  parentId: 'valid-stream-id',
  state: 'all'
};

connection.streams.get(options, function(err, streams) {
  // ...
});
```

## Create

```javascript
// If no id is set, one is generated;
// If parentId is null, the stream is created at the root
var stream = {
  name: 'A Stream',
  id: 'a-stream-id',
  parentId: 'valid-stream-id'
};

connection.streams.create(stream, function(err, streamCreated) {
  // ...
});
```

## Update

```javascript
stream.name: 'An Updated Stream';
connection.streams.update(stream, function (err, streamUpdated) {
  // ...
});
```

## Delete

```javascript
connection.streams.delete(stream, function(err, streamDeleted) {
  // ...
});
```

# Manage accesses

## Retrieve

```javascript
connection.accesses.get(function(err, accesses) {
  // ...
});
```

## Create

```javascript
var access = {
  name: 'An Access',
  permissions: [
    {
      streamId: 'valid-stream-id',
      level: 'manage'
    }
  ]
};

connection.accesses.create(access, function(err, accessCreated) {
  // ...
});
```

## Update

```javascript
access.name: 'An Updated Access';
access.permissions[0].level: 'contribute';
connection.accesses.update(access, function (err, accessUpdated) {
  // ...
});
```

## Delete

```javascript
connection.accesses.delete(access, function(err, accessDeletion) {
  // ...
});
```

# Batch call

```javascript
var methodsData = [
  // Retrieve calls
  {
    method: 'streams.get',
    params: {
      option: {
        state: 'all'
      }
    }
  },
  {
    method: 'events.get',
    params: {
      filter: {
        limit: 10
      }
    }
  },
  {
    method: 'accesses.get',
    params: {}
  },

  // Create calls
  {
    method: 'streams.create',
    params: {
      name: 'Stream Name',
      id: 'stream-id'
    }
  },
  {
    method: 'events.create',
    params: {
      streamId: 'valid-stream-id',
      type: 'note/txt',
      content: 'The event content.'
    }
  },
  {
    method: 'accesses.create',
    params: {
      name: 'An Access',
      permissions: [
        {
          streamId: '*',
          level: 'manage'
        }
      ]
    }
  },

  // Update calls
  {
    method: 'streams.update',
    params: {
      id: 'valid-stream-id',
      update: {
        name: 'Updated Stream Name'
      }
    }
  },
  {
    method: 'events.update',
    params: {
      id: 'valid-event-id',
      update: {
        content: 'The updated event content.'
      }
    }
  },
  {
    method: 'accesses.update',
    params: {
      id: 'valid-access-id',
      update: {
        name: 'An Updated Access',
        permissions: [
          {
            streamId: '*',
            level: 'read'
          }
        ]
      }
    }
  },

  // Delete calls
  {
    method: 'streams.delete',
    params: {
      id: 'valid-stream-id'
    }
  },
  {
    method: 'events.delete',
    params: {
      id: 'valid-event-id'
    }
  },
  {
    method: 'accesses.delete',
    params: {
      id: 'valid-access-id'
    }
  }
];

connection.batchCall(methodsData, function(err, results) {
  //...
});
```

# Monitors

Monitors watch the changes to selected data structures (i.e: Errors, Events, Streams or Filters). They are used to fetch the current state of all the elements in an app upon loading. Therefore it allows to manage data in a user account at runtime.

To use monitors you will need to:

- Setup a monitor variable.
- Add the requested event listener(s).
- Call the `monitor.start`.

## Setup Monitors

```javascript
var filter = new pryv.Filter({ limit: 5 });
var monitor = connection.monitor(filter);

//This will use the local cache before fetching data online, default is true
monitor.useCacheForEventsGetAllAndCompare = false;
// This will fetch all events on start up, default is true
monitor.ensureFullCache = false;
// This will optimize start up by prefecthing some events, default is 100
monitor.initWithPrefetch = 0;
```

## Load

```javascript
// Will fetch events depending on the filter set in 'Setup Monitors' above
var onLoad = pryv.MESSAGES.MONITOR.ON_LOAD;
monitor.addEventListener(onLoad, function(events) {
  // ...
});
```

## Error

```javascript
var onError = pryv.MESSAGES.MONITOR.ON_ERROR;
monitor.addEventListener(onError, function(error) {
  // ...
});
```

## Event change

```javascript
// Will trigger if any event is created, updated or trashed;
// the array index is used to distinguish which type of change was made
var onEventChange = pryv.MESSAGES.MONITOR.ON_EVENT_CHANGE;
monitor.addEventListener(onEventChange, function (changes) {
  [ 'created', 'modified', 'trashed'  ].forEach(function (action) {
  changes[action].forEach(function (event) {
    // ...
  });
});
```

## Structure change

```javascript
// Will trigger if any stream is created, updated, trashed or deleted;
// the array index is used to distinguish which type of change was made
var onStructureChange = pryv.MESSAGES.MONITOR.ON_STRUCTURE_CHANGE;
monitor.addEventListener(onStructureChange, function (changes) {
  [ 'created', 'modified', 'trashed', 'deleted' ].forEach(function (action) {
    changes[action].forEach(function (stream) {
      // ...
    });

});
```

## Filter change

```javascript
// Will trigger if any filter is updated ;
// the array index gives informations about the new filter ('enter'),
// and the old filter ('leave')
var onFilterChange = pryv.MESSAGES.MONITOR.ON_FILTER_CHANGE;
monitor.addEventListener(onFilterChange, function (changes) {
  [ 'enter', 'leave' ].forEach(function (action) {
    changes[action].forEach(function (filter) {
      // ...
    });
});
```

## Start

```javascript
monitor.start(function(err) {
  // ...
});
```

# Further resources

- [API reference](https://api.pryv.com/reference/)
- [Library JS docs](https://api.pryv.com/lib-javascript/latest/docs/)
