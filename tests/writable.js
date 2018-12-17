const Streams = require( 'stream' );

class Writable extends Streams.Writable {
  constructor( timeout ) {
    super( );

    this.$timeout = timeout;
  }

  _write( chunk, enc, next ) { setTimeout( ( ) => {
    console.log( 'next( )' );
    next( );
  }, this.$timeout ); }
}

module.exports = Writable;
