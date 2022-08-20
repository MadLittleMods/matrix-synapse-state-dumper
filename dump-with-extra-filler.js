'use strict';

// Fills in `events`, `current_state_events` tables in Synapse
// with the given events plus a bunch of filler data.

const assert = require('assert');
const crypto = require('crypto');

const { Client } = require('pg');
const pgFormat = require('pg-format');

const client = new Client({
  host: 'localhost',
  // port: 5334,
  database: 'synapse',
  // user: 'database-user',
  // password: 'secretpassword!!',
});

// State from https://matrix-client.matrix.org/_matrix/client/r0/rooms/!OGEhHVWSdvArJzumhm:matrix.org/state
const stateEvents = require('/Users/eric/Downloads/matrixhq-state.json');
console.log('stateEvents', stateEvents.length);

const DUPLICATION_FACTOR = 100;
const CHUNK_SIZE = 1000;

function eventToEventsRecord(event) {
  assert(event);
  return {
    event_id: event.event_id,
    type: event.type,
    room_id: event.room_id,
    processed: true,
    outlier: false,
    origin_server_ts: event.origin_server_ts,
    received_ts: event.origin_server_ts,
    sender: event.sender,
    state_key: event.state_key,
    topological_ordering: event.topological_ordering,
    depth: event.depth,
    stream_ordering: event.stream_ordering,
  };
}

function eventToCurrentStateEventsRecord(event) {
  assert(event);
  return {
    event_id: event.event_id,
    room_id: event.room_id,
    type: event.type,
    state_key: event.state_key,
    membership: event.content?.membership,
  };
}

function generateFakeStateEvent(index) {
  assert(index);
  // Give a random depth in the range where we current are
  const depth = Math.floor(Math.random() * index);

  const mxid = `@fake-user:fake-homeserver-${crypto.randomBytes(8).toString('hex')}`;
  return {
    event_id: `$${crypto.randomBytes(43).toString('hex')}`,
    type: 'm.room.member',
    state_key: mxid,
    sender: mxid,
    content: {
      membership: 'join',
    },
    origin_server_ts: 1633370210924,
    room_id: `!fake-room:fake-homeserver`,
    topological_ordering: depth,
    depth: depth,
    stream_ordering: index,
  };
}

async function exec() {
  await client.connect();

  const maxStreamOrderingResult = await client.query(`SELECT MAX(stream_ordering) FROM events;`);
  const maxStreamOrdering = maxStreamOrderingResult.rows[0].max;
  console.log('maxStreamOrdering', maxStreamOrdering);

  const eventsToPersist = [];
  for (let [stateEventIndex, stateEvent] of stateEvents.entries()) {
    const eventWithInfoWeNeed = {
      ...stateEvent,
      topological_ordering: stateEventIndex,
      depth: stateEventIndex,
      stream_ordering: maxStreamOrdering + stateEventIndex,
    };
    eventsToPersist.push(eventWithInfoWeNeed);

    // Generate filler events
    for (let i = 0; i < DUPLICATION_FACTOR; i++) {
      eventsToPersist.push(
        generateFakeStateEvent(maxStreamOrdering + stateEventIndex * DUPLICATION_FACTOR + i)
      );
    }
  }

  console.log('Done assembling data');

  let insertCount = 0;
  for (let i = 0; i < eventsToPersist.length; i += CHUNK_SIZE) {
    const eventsInChunk = eventsToPersist.slice(i, i + CHUNK_SIZE);

    const eventsInsertQuery = pgFormat(
      `
      INSERT into events
      (${Object.keys(eventToEventsRecord(eventsInChunk[0])).join(', ')})
      VALUES %L
      `,
      eventsInChunk.map((event) => Object.values(eventToEventsRecord(event)))
    );
    await client.query(eventsInsertQuery);

    const currentStateEventsInsertQuery = pgFormat(
      `
      INSERT into current_state_events
      (${Object.keys(eventToCurrentStateEventsRecord(eventsInChunk[0])).join(', ')})
      VALUES %L
      `,
      eventsInChunk.map((event) => Object.values(eventToCurrentStateEventsRecord(event)))
    );
    await client.query(currentStateEventsInsertQuery);

    if (insertCount % 10 === 0) {
      process.stdout.write('.');
    }
    insertCount++;
  }

  const result = await client.query(
    `SELECT COUNT(*) from current_state_events where room_id = '!OGEhHVWSdvArJzumhm:matrix.org';`
  );
  console.log('result', result);

  await client.end();
}

exec();
