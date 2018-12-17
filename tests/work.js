const Writable = require( './writable.js' );
const Work = require( '../src/work.js' );

const stream = new Writable( 1500 );
const work = new Work( );

work.on( 'timeout', function( msg, w ) {
  console.log( 'TIMEOUT', msg );
} );
work.on( 'finish', function( w ) {
  console.log( 'FINISHED' );
} );
work.write( 2000, 0, stream, JSON.stringify( { body: 'algo' } ) );