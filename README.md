# Matrix Synapse state dumper

Made for https://github.com/matrix-org/synapse/pull/13575

## `dump.js`

Dumps state events into your local Synapse `current_state_events` database table.

Usage:

1.  Download some state events: `GET https://matrix-client.matrix.org/_matrix/client/r0/rooms/!OGEhHVWSdvArJzumhm:matrix.org/state`
1.  Update the `stateEvents` JSON file path in the script.
1.  `node dump.js`

## `dump-with-extra-filler.js`

Dumps state events into your local Synapse `events` and `current_state_events` database table. Will also insert filler events in between your actual events so that Postgres doesn't have such an ideal environment to query in.

Usage:

1.  Download some state events: `GET https://matrix-client.matrix.org/_matrix/client/r0/rooms/!OGEhHVWSdvArJzumhm:matrix.org/state`
1.  Update the `stateEvents` JSON file path in the script.
1.  Adjust the `DUPLICATION_FACTOR` variable to your liking. This is the amount of filler events that will be inserted between each actual state event.
    - You can clean up these filler events later with: `psql synapse` -> `DELETE FROM events where room_id = '!fake-room:fake-homeserver';` and `DELETE FROM current_state_events where room_id = '!fake-room:fake-homeserver';`
1.  `node dump-with-extra-filler.js`
