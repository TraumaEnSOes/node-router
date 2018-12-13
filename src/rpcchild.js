const { EventEmitter } = require( 'events' );
const JsonRpc = require( './jsonrpc.js' );
const { CreateInferface } = require( 'readline' );

class RpcChild extends EventEmitter {
  constructor( child ) {
    super( );

    this.$child = child;
    this.$stdout = CreateInferface( child.stdout );
    this.$stderr = CreateInterface( child.stderr );
    this.$queue = { };
    this.$id = 0;

    this.$stdout.on( 'line', ( line ) => this.$onStdout( line ) );
    this.$stderr.on( 'line', ( line ) => this.$onStderr( line ) );
  }

  $nextId( ) {
    var retId = ++this.$id;

    if( retId == 10000 ) {
      this.$id = 1;
      retId = 1;
    }

    return retId;
  }

  notify( consume, methodName, args ) {
    var id = this.$nextId,
        jsonObject = JsonRpc.makeNotify( methodName, args ),
        work = [
          consume ? setTimeout( consume * 1000, ( ) => this.$timeoutConsume( id ) ) : false,
          false
        ];
        
    this.$queue[id] = work;
    this.child.stdin.write( jsonObject, ( ) => this.$ontimeConsume( id ) );

    return id;
  }

  request( consume, produce, methodName, args ) {
    var id = this.$nextId( ),
        jsonObject = JsonRpc.makeRequest( methodName, args ),
        work = [
          consume ? setTimeout( consume * 1000, ( ) => this.$timeoutConsume( id ) ) : false,
          produce ? setTimeout( produce * 1000, ( ) => this.$timeoutProduce( id ) ) : false
        ];
  
    this.$queue[id] = work;
    this.$child.stdin.write( jsonObject, ( ) => this.$ontimeConsume( id ) );

    return id;
  }

  clearAll( ) {
    var key,
        value,
        queue = this.$queue;

    this.$queue = { }
    this.$id = 0;

    for( [ key, value ] of Object.entries( queue ) ) {
      if( queue.hasOwnProperty( key ) ) {
        if( value[0] ) clearTimeout( value[0] );
        if( value[1] ) clearTimeout( value[1] );
      }
    }
  }

  clear( id ) {
    var work = this.$queue[id];

    if( work[0] ) clearTimeout( work[0] );
    if( work[1] ) clearTimeout( work[0] );

    delete this.$queue[id];
  }

  $ontimeConsume( id ) {
    var work = this.$queue[id];

    if( work[0] ) {
      clearTimeout( work[0] );
      work[0] = false;
    }

    if( !( work[1] ) ) delete this.$queue[id];
  }

  $timeoutConsume( id ) {
    this.$queue[id][0] = false;
    this.emit( 'consumeTimeout', id, this );
  }

  $timeoutProduce( id ) {
    var work = this.$queue[id];

    this.clear( id );
    this.emit( 'produceTimeout', id, this );
  }

  $onStderr( line ) {
  }

  $onStdout( line ) {
  }

  static exec( command, options ) {
  }

  static execFile( command, args, options ) {
  }

  static fork( modulePath, args, options ) {
  }

  static spawn( command, args, options ) {
  }
};

module.exports = RpcChild
