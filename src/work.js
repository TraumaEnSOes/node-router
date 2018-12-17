const { EventEmitter } = require( 'events' );

class Work extends EventEmitter {
  get userData( ) { return this.$userData };
  get finished( ) { return this.$finished; }

  constructor( userData ) {
    super( );

    this.$finished = false;
    this.$userData = userData;
  }

  write( consume, produce, writable, chunk, encoding ) {
    // @ifndef NO_PARAMS_CHECK
    if( !Number.isInteger( consume ) ) throw TypeError( '"consume" must be a Integer' );
    if( ( consume < 1 ) || ( consume > 60000 ) ) throw Error( '"consume" out of range( 1 - 60000' );

    if( Number.isInteger( produce ) ) {
      if( ( consume < 1 ) || ( consume > 60000 ) ) throw Error( '"produce" out of range( 1 - 60000' );
    } else {
      if( ( produce !== null ) && ( produce !== undefined ) ) throw TypeError( 'optional "produce" must be a Integer' );
    }

    if( !( consume || produce ) ) throw Error( 'At leaf one of "consume" or "produce" must be present' );
    // @endif

    if( produce ) {
      this.$produce = setTimeout( ( ) => {
        this.finish( );
        this.emit( 'timeout', 'produce', this );
      } , produce );
    }

    if( consume ) {
      this.$consume = setTimeout( ( ) => {
        this.finish( );
        this.emit( 'timeout', 'consume', this )
      }, consume );

      writable.write( chunk, encoding, ( ) => {
        clearTimeout( this.$consume );
        this.$consume = false;

        if( !this.$produce ) this.emit( 'finish', this );
      } );
    } else {
      writable.write( chunk, encoding );
    }

    return this;
  }

  finish( doemit ) {
    if( this.$consume ) clearTimeout( this.$consume );
    if( this.$produce ) clearTimeout( this.$produce );

    this.$finished = true;
    if( doemit ) this.emit( 'finish' );
  }
}

module.exports = Work;
