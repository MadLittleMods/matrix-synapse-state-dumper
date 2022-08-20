'use strict';

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

const duplicationFactor = 100;
const chunkSize = 1000;

async function exec() {
  await client.connect();

  //const result = await client.query(`SELECT 1 FROM current_state_events LIMIT 1`);

  const values = [];
  for (let stateEvent of stateEvents) {
    // return {
    //   event_id: stateEvent.event_id,
    //   room_id: stateEvent.room_id,
    //   type: stateEvent.type,
    //   state_key: stateEvent.state_key,
    //   membership: stateEvent?.content?.membership
    // }
    values.push([
      stateEvent.event_id,
      stateEvent.room_id,
      stateEvent.type,
      stateEvent.state_key,
      stateEvent?.content?.membership,
    ]);

    // Generate filler data
    for (let i = 0; i < duplicationFactor; i++) {
      values.push([
        `$${crypto.randomBytes(43).toString('hex')}`,
        `!fake-room:fake-homeserver`,
        'm.room.member',
        `@fake-user:fake-homeserver-${crypto.randomBytes(8).toString('hex')}`,
        'join',
      ]);
    }
  }

  console.log('Done assembling data');

  let insertCount = 0;
  for (let i = 0; i < values.length; i += chunkSize) {
    const valuesInChunk = values.slice(i, i + chunkSize);

    const insertQuery = pgFormat(
      `INSERT into current_state_events
      (event_id, room_id, type, state_key, membership)
      VALUES %L
    `,
      valuesInChunk
    );
    await client.query(insertQuery);
    //console.log('insert result', result);

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
